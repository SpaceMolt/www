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

interface PaintTriangle {
  triangle: THREE.Triangle
  normal: THREE.Vector3
  object: THREE.Mesh
  weapon: boolean
}

/** Index actual triangles, not merged-mesh boxes. A decal's entire projected
 * footprint must be clear even when a thin fixture falls between sample rays. */
function paintFootprintClearance(meshes: THREE.Mesh[], bounds: THREE.Box3, worldSize: number) {
  const span = bounds.getSize(new THREE.Vector3()), cells = new Map<number, PaintTriangle[]>()
  const cellX = (x: number) => Math.max(0, Math.min(15, Math.floor((x - bounds.min.x) / Math.max(span.x, 1e-6) * 16)))
  const cellY = (y: number) => Math.max(0, Math.min(7, Math.floor((y - bounds.min.y) / Math.max(span.y, 1e-6) * 8)))
  const triangleBounds = new THREE.Box3()
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index, mount = mesh.geometry.getAttribute('cinemaMount')
    if (!position) continue
    for (let i = 0, count = index?.count ?? position.count; i + 2 < count; i += 3) {
      const ids = [0, 1, 2].map(offset => index ? index.getX(i + offset) : i + offset)
      const vertices = ids.map(id => new THREE.Vector3().fromBufferAttribute(position, id).applyMatrix4(mesh.matrixWorld))
      const triangle = new THREE.Triangle(vertices[0], vertices[1], vertices[2])
      const item: PaintTriangle = { triangle, normal: triangle.getNormal(new THREE.Vector3()), object: mesh, weapon: Boolean(mount && ids.some(id => mount.getX(id) >= 0)) }
      triangleBounds.setFromPoints(vertices)
      for (let x = cellX(triangleBounds.min.x); x <= cellX(triangleBounds.max.x); x++) for (let y = cellY(triangleBounds.min.y); y <= cellY(triangleBounds.max.y); y++) {
        const key = x + y * 16, bucket = cells.get(key) ?? []
        bucket.push(item); cells.set(key, bucket)
      }
    }
  }
  const local = new THREE.Triangle(), queryBounds = new THREE.Box3(), prism = new THREE.Box3()
  const relative = new THREE.Vector3(), corner = new THREE.Vector3()
  return (point: THREE.Vector3, normal: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, width: number, height: number, support: THREE.Object3D): boolean => {
    const tolerance = Math.min(height * .08, .12 / worldSize), outward = span.length() + 1
    prism.min.set(-width / 2, -height / 2, -tolerance)
    prism.max.set(width / 2, height / 2, outward)
    queryBounds.makeEmpty()
    for (const x of [-width / 2, width / 2]) for (const y of [-height / 2, height / 2]) for (const z of [-tolerance, outward]) {
      corner.copy(point).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(normal, z)
      queryBounds.expandByPoint(corner)
    }
    const seen = new Set<PaintTriangle>()
    for (let x = cellX(queryBounds.min.x); x <= cellX(queryBounds.max.x); x++) for (let y = cellY(queryBounds.min.y); y <= cellY(queryBounds.max.y); y++) {
      for (const item of cells.get(x + y * 16) ?? []) {
        if (seen.has(item)) continue
        seen.add(item)
        for (const [source, target] of [[item.triangle.a, local.a], [item.triangle.b, local.b], [item.triangle.c, local.c]]) {
          relative.copy(source).sub(point)
          target.set(relative.dot(right), relative.dot(up), relative.dot(normal))
        }
        // The supporting flat paint surface is expected to intersect the prism.
        // Other triangles of this same merged mesh still participate normally.
        if (item.object === support && !item.weapon && item.normal.dot(normal) > .98 && [local.a, local.b, local.c].every(vertex => Math.abs(vertex.z) <= tolerance)) continue
        if (prism.intersectsTriangle(local)) return false
      }
    }
    return true
  }
}
/** Before model scaling: require an exposed, nearly planar patch, not a free-floating label.
 * Only hull/armor can support paint; all other meshes still block the placement rays.
 * Five descending sizes and 15 candidates per side bound startup work per detailed ship.
 */
export function findHullMarkingPlacements(model: THREE.Group, worldSize: number, aspect: number): HullMarkingPlacement[] {
  if (!Number.isFinite(worldSize) || worldSize <= 0 || !Number.isFinite(aspect) || aspect <= 0) return []
  model.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  model.traverse(object => { if (object instanceof THREE.Mesh && !object.userData.hullMarking) meshes.push(object) })
  if (!meshes.length) return []
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  const footprintClear = paintFootprintClearance(meshes, bounds, worldSize)
  // Keep familiar lettering on small craft, but use the free panel area of a
  // capital instead of treating its registration as a person-sized fitting.
  const legacyHeight = Math.min(Math.max(.35, Math.min(1.4, worldSize * .015)) / worldSize, size.y * .10)
  const desiredHeight = Math.min(Math.max(legacyHeight * worldSize, Math.min(8, (worldSize - 60) * .025)) / worldSize, size.y * .25)
  const heights = [...new Set([desiredHeight, desiredHeight * .75, desiredHeight * .5, desiredHeight * .25, legacyHeight]
    .map(height => Math.min(Math.max(height, legacyHeight), size.x * .34 / aspect)))].sort((a, b) => b - a)
  if (!heights.length || heights[0] * worldSize < .15) return []
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
    // Cache center hits once, then examine every candidate at a larger size
    // before considering any smaller lettering. Never settle for the first
    // small patch if a later panel can carry the full name more clearly.
    const candidates: { point: THREE.Vector3; normal: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; object: THREE.Object3D }[] = []
    for (const x of [.12, -.12, .28, -.28, 0]) for (const y of [0, -.18, .18]) {
      const hit = hitAt(new THREE.Vector3(center.x + x * size.x, center.y + y * size.y, center.z), new THREE.Vector3(0, 0, side))
      if (!supports(hit)) continue
      const normal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld)
      if (normal.z * side < .85) continue
      const right = new THREE.Vector3(side, 0, 0).addScaledVector(normal, -side * normal.x).normalize()
      candidates.push({ point: hit.point, normal, right, up: new THREE.Vector3().crossVectors(normal, right).normalize(), object: hit.object })
    }
    let found = false
    for (const height of heights) {
      const width = height * aspect
      for (const candidate of candidates) {
        const { point, normal, right, up, object } = candidate
        let safe = true
        sampleGrid: for (const u of [-.5, -.25, 0, .25, .5]) for (const v of [-.5, 0, .5]) {
          const expected = point.clone().addScaledVector(right, u * width).addScaledVector(up, v * height)
          const sample = hitAt(expected, normal)
          if (!supports(sample) || sample.object !== object || sample.point.distanceTo(expected) > Math.min(height * .08, .12 / worldSize) || sample.face!.normal.clone().transformDirection(sample.object.matrixWorld).dot(normal) < .98) {
            safe = false
            break sampleGrid
          }
        }
        if (!safe || !footprintClear(point, normal, right, up, width, height, object)) continue
        placements.push({ position: point.clone().addScaledVector(normal, .008 / worldSize), rotation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal)), width, height })
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
