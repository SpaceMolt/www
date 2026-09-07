import * as THREE from 'three'
import type { ShipEmpire } from './appearance'

export interface HullMarkingPlacement {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  width: number
  height: number
}
export interface HullMarkingOptions { name: string; worldSize: number; empire: ShipEmpire; seed: number }

/** Bound texture work without splitting surrogate pairs or accepting invisible controls. */
export function hullMarkingText(name: string): string {
  return Array.from(name.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/gu, ' ').trim()).slice(0, 48).join('')
}

/** Before model scaling: require an exposed, nearly planar patch, not a free-floating label.
 * Only hull/armor can support paint; all other meshes still block the placement rays.
 * The finite 2 sides x 15 candidates x 9 samples bounds startup work per detailed ship.
 */
export function findHullMarkingPlacements(model: THREE.Group, worldSize: number, aspect: number): HullMarkingPlacement[] {
  if (!Number.isFinite(worldSize) || worldSize <= 0 || !Number.isFinite(aspect) || aspect <= 0) return []
  model.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  model.traverse(object => { if (object instanceof THREE.Mesh && !object.userData.hullMarking) meshes.push(object) })
  if (!meshes.length) return []
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const height = Math.min(Math.max(.35, Math.min(1.4, worldSize * .015)) / worldSize, size.y * .10)
  const width = Math.min(height * aspect, size.x * .34)
  const fittedHeight = Math.min(height, width / aspect)
  if (fittedHeight * worldSize < .15) return []
  const ray = new THREE.Raycaster(), placements: HullMarkingPlacement[] = []
  const hitAt = (point: THREE.Vector3, outward: THREE.Vector3) => {
    ray.set(point.clone().addScaledVector(outward, size.length() + 1), outward.clone().negate())
    return ray.intersectObjects(meshes, false)[0]
  }
  const supports = (hit: THREE.Intersection | undefined) => {
    if (!hit?.face || !(hit.object instanceof THREE.Mesh) || !['hull', 'armor'].includes(hit.object.name)) return false
    const mounts = hit.object.geometry.getAttribute('cinemaMount')
    return !mounts || [hit.face.a, hit.face.b, hit.face.c].every(i => mounts.getX(i) < 0)
  }
  for (const side of [-1, 1]) {
    let found = false
    for (const x of [.12, -.12, .28, -.28, 0]) {
      for (const y of [0, -.18, .18]) {
        const hit = hitAt(new THREE.Vector3(center.x + x * size.x, center.y + y * size.y, center.z), new THREE.Vector3(0, 0, side))
        if (!supports(hit)) continue
        const normal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld)
        if (normal.z * side < .85) continue
        const right = new THREE.Vector3(side, 0, 0).addScaledVector(normal, -side * normal.x).normalize()
        const up = new THREE.Vector3().crossVectors(normal, right).normalize()
        let safe = true
        for (const u of [-.5, 0, .5]) for (const v of [-.5, 0, .5]) {
          const expected = hit.point.clone().addScaledVector(right, u * width).addScaledVector(up, v * fittedHeight)
          const sample = hitAt(expected, normal)
          if (!supports(sample) || sample.object !== hit.object || sample.point.distanceTo(expected) > fittedHeight * .08 || sample.face!.normal.clone().transformDirection(sample.object.matrixWorld).dot(normal) < .98) safe = false
        }
        if (!safe) continue
        placements.push({ position: hit.point.clone().addScaledVector(normal, .008 / worldSize), rotation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal)), width, height: fittedHeight })
        found = true
        break
      }
      if (found) break
    }
  }
  return placements
}

/** Browser-only painted livery. One 512x128 texture and material, at most two draw calls.
 * Material disposal owns the canvas texture; ordinary scene teardown remains sufficient.
 */
export function addHullMarkings(model: THREE.Group, options: HullMarkingOptions): boolean {
  const text = hullMarkingText(options.name)
  if (!text || typeof document === 'undefined' || model.userData.hullMarkings) return false
  const canvas = document.createElement('canvas')
  canvas.width = 512; canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) return false
  context.font = `${options.empire === 'nebula' ? '500' : '600'} 64px ${options.empire === 'nebula' || options.empire === 'voidborn' ? 'serif' : 'sans-serif'}`
  const aspect = Math.max(2, Math.min(16, context.measureText(text).width / 80))
  const placements = findHullMarkingPlacements(model, options.worldSize, aspect)
  if (!placements.length) return false
  context.fillStyle = { solarian: '#c0c8cc', crimson: '#bcae98', nebula: '#263b32', voidborn: '#92959f', outerrim: '#c6b9a0', pirate: '#b9ac91', neutral: '#c0c4be' }[options.empire]
  context.textBaseline = 'middle'; context.textAlign = 'center'
  context.setTransform(512 / (aspect * 80), 0, 0, 128 / 80, 0, 0)
  context.fillText(text, aspect * 40, 40, aspect * 80 * .94)
  context.resetTransform()
  let random = options.seed | 0
  const next = () => { random = Math.imul(random, 1664525) + 1013904223 | 0; return (random >>> 0) / 4294967296 }
  context.globalCompositeOperation = 'destination-out'
  const worn = options.empire === 'pirate' || options.empire === 'outerrim'
  for (let i = 0; i < (worn ? 130 : 45); i++) {
    context.globalAlpha = .25 + next() * .45
    context.fillRect(next() * 512, next() * 128, .8 + next() * 3, .5 + next() * 1.5)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: .8, alphaTest: .08, metalness: .08, roughness: .88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  material.addEventListener('dispose', () => texture.dispose())
  for (const placement of placements) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(placement.width, placement.height), material)
    mesh.name = 'painted participant name'; mesh.userData.hullMarking = true
    mesh.position.copy(placement.position); mesh.quaternion.copy(placement.rotation)
    mesh.receiveShadow = true
    model.add(mesh)
  }
  model.userData.hullMarkings = true
  return true
}
