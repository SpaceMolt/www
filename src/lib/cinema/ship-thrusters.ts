import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ShipAppearance } from './appearance'

/** Small forward exhaust jets, independent of the aft main drive. Call after
 * static hull batches exist. All positions remain in the owning ship's space. */
export function addRetrothrusters(group: THREE.Group, appearance: ShipAppearance, _seed = 0, hero = true): void {
  if (!hero || appearance.family === 'creature' || appearance.family === 'station' || group.children.some(object => object.userData.retrothruster)) return
  group.updateWorldMatrix(true, true)
  const inverse = group.matrixWorld.clone().invert()
  const supports: THREE.Mesh[] = []
  const bounds = new THREE.Box3()
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.engine || object.userData.retrothruster) return
    if (!['hull', 'armor', 'dark', 'metal'].includes(object.name)) return
    // Temporary raycast proxies share geometry and materials, never their owner.
    const proxy = new THREE.Mesh(object.geometry, object.material)
    proxy.matrixAutoUpdate = false
    proxy.matrix.multiplyMatrices(inverse, object.matrixWorld)
    proxy.updateMatrixWorld(true)
    supports.push(proxy)
    object.geometry.computeBoundingBox()
    if (object.geometry.boundingBox) bounds.union(object.geometry.boundingBox.clone().applyMatrix4(proxy.matrixWorld))
  })
  if (bounds.isEmpty()) return
  const ray = new THREE.Raycaster()
  const mounts: THREE.Vector3[] = []
  const radius = Math.max(.004, Math.min(.012, appearance.beam * .027))
  for (const side of [-1, 1]) {
    let chosen: THREE.Vector3 | undefined
    for (const shoulder of [.28, .21, .14, .07]) {
      for (const elevation of [.08, 0, -.08]) {
        ray.set(new THREE.Vector3(bounds.max.x + 1, appearance.height * elevation, side * appearance.beam * shoulder), new THREE.Vector3(-1, 0, 0))
        for (const hit of ray.intersectObjects(supports, false)) {
          if (!hit.face) continue
          const mesh = hit.object as THREE.Mesh
          const mount = mesh.geometry.getAttribute('cinemaMount')
          // Gun triangles move in the vertex shader and are not structural hull.
          if (mount && [hit.face.a, hit.face.b, hit.face.c].some(vertex => mount.getX(vertex) >= 0)) continue
          const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld))
          if (normal.x < .06) continue
          chosen = hit.point.clone()
          break
        }
        if (chosen) break
      }
      if (chosen) break
    }
    if (chosen) mounts.push(chosen)
  }
  if (!mounts.length) return
  const casings: THREE.BufferGeometry[] = [], glows: THREE.BufferGeometry[] = []
  const place = (geometry: THREE.BufferGeometry, point: THREE.Vector3, x: number, target: THREE.BufferGeometry[]) => {
    geometry.translate(point.x + x, point.y, point.z)
    const flat = geometry.index ? geometry.toNonIndexed() : geometry
    if (flat !== geometry) geometry.dispose()
    target.push(flat)
  }
  for (const point of mounts) {
    // The casing penetrates its support slightly; only the exhaust protrudes.
    const collar = new THREE.CylinderGeometry(radius, radius * 1.12, radius * 2.4, 10, 1, true)
    collar.rotateZ(-Math.PI / 2)
    place(collar, point, radius * .3, casings)
    const lip = new THREE.TorusGeometry(radius, radius * .2, 5, 12)
    lip.rotateY(Math.PI / 2)
    place(lip, point, radius * 1.48, casings)
    const core = new THREE.CircleGeometry(radius * .77, 12)
    core.rotateY(Math.PI / 2)
    place(core, point, radius * 1.5, glows)
    const plume = new THREE.ConeGeometry(radius * .76, radius * 5, 9, 1, true)
    plume.rotateZ(-Math.PI / 2)
    place(plume, point, radius * 4.02, glows)
  }
  const casingGeometry = mergeGeometries(casings)!, glowGeometry = mergeGeometries(glows)!
  for (const geometry of [...casings, ...glows]) geometry.dispose()
  const casing = new THREE.Mesh(casingGeometry, new THREE.MeshStandardMaterial({ color: 0x66727b, metalness: .8, roughness: .53 }))
  casing.name = 'retrothruster-casings'
  casing.userData.retrothruster = true
  casing.userData.mounts = mounts
  group.add(casing)
  const glow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({ color: 0xc5ebff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))
  glow.name = 'retrothruster-exhaust'
  glow.userData.retrothruster = true
  glow.userData.retrothrusterGlow = true
  glow.userData.engine = true
  glow.visible = false
  group.add(glow)
}

/** Strength is supplied from braking/reverse acceleration, never navigation
 * lights or departure thrust. Invalid input safely returns the jets to idle. */
export function updateRetrothrusters(group: THREE.Group, strength: number): void {
  const intensity = Number.isFinite(strength) ? THREE.MathUtils.clamp(strength, 0, 1) : 0
  for (const object of group.children) {
    if (!(object instanceof THREE.Mesh) || !object.userData.retrothrusterGlow) continue
    object.visible = intensity > .001
    ;(object.material as THREE.MeshBasicMaterial).opacity = intensity * .72
  }
}
