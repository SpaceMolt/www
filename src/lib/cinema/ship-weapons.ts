import * as THREE from 'three'
import { resolveWeaponFamily, type CinemaWeaponFamily } from './weapons'
import type { CinemaCue } from './types'

export const MAX_WEAPON_MOUNTS = 12

export interface WeaponMount {
  family: CinemaWeaponFamily
  /** Ship-local pivot and muzzle in the unrotated construction pose (+X). */
  pivot: THREE.Vector3
  muzzle: THREE.Vector3
  rotation: THREE.Quaternion
  /** Base traverse stays in the fixed mounting plane; barrels add elevation. */
  traverseRotation?: THREE.Quaternion
  /** Outward hull normal of the mounting face; omitted legacy mounts are unrestricted. */
  normal?: THREE.Vector3
  minimumElevation?: (horizontal: THREE.Vector3) => number
}

export interface WeaponRig {
  mounts: WeaponMount[]
  /** Stable vector objects shared by all hull and shadow material uniforms. */
  uniforms: THREE.Vector4[]
  traverseUniforms: THREE.Vector4[]
}

export function createWeaponRig(): WeaponRig {
  return { mounts: [], uniforms: Array.from({ length: MAX_WEAPON_MOUNTS }, () => new THREE.Vector4(0, 0, 0, 1)), traverseUniforms: Array.from({ length: MAX_WEAPON_MOUNTS }, () => new THREE.Vector4(0, 0, 0, 1)) }
}

export interface WeaponCueAssignment {
  tracks: CinemaCue[][]
  byCue: Map<string, number>
  /** Overflow discharge only: recorded impacts and consequences still render. */
  suppressed: Set<string>
}

/** Assign one actor's chronological firing to real represented gun mounts.
 * A mount stays reserved from .1s before release through the end of flight;
 * another simultaneous beam cannot make it turn while the first still fires.
 * Missing families remain ordinary distant/legacy effects, not suppressed. */
export function assignWeaponCues(rig: WeaponRig, actorCues: readonly CinemaCue[], eligible?: (mountIndex: number, cue: CinemaCue) => boolean): WeaponCueAssignment {
  const mounts = rig.mounts.slice(0, MAX_WEAPON_MOUNTS)
  const tracks: CinemaCue[][] = mounts.map(() => [])
  const byCue = new Map<string, number>(), suppressed = new Set<string>(), seen = new Set<string>()
  const occupiedUntil = mounts.map(() => -Infinity)
  const cursors = new Map<CinemaWeaponFamily, number>()
  const ordered = actorCues.filter(cue => cue.kind === 'weapon' && cue.from && cue.to && !cue.parentId && !cue.secondaryKind &&
    Number.isFinite(cue.time) && Number.isFinite(cue.duration) && cue.duration >= 0).slice().sort((a, b) => a.time - b.time)
  for (const cue of ordered) {
    if (seen.has(cue.id)) continue
    seen.add(cue.id)
    const family = cue.weaponFamily ?? resolveWeaponFamily(cue.weaponName, cue.damageType)
    const matching = mounts.flatMap((mount, index) => mount.family === family ? [index] : [])
    if (!matching.length) continue
    const cursor = cursors.get(family) ?? 0
    let selected = -1
    for (let offset = 0; offset < matching.length; offset++) {
      const candidate = (cursor + offset) % matching.length
      if (occupiedUntil[matching[candidate]] <= cue.time - .1 && (!eligible || eligible(matching[candidate], cue))) {
        selected = candidate
        break
      }
    }
    if (selected < 0) {
      suppressed.add(cue.id)
      continue
    }
    const index = matching[selected]
    occupiedUntil[index] = cue.time + cue.duration
    cursors.set(family, (selected + 1) % matching.length)
    tracks[index].push(cue)
    byCue.set(cue.id, index)
  }
  return { tracks, byCue, suppressed }
}

/** Tag every batch input, including static pieces, before merging geometries.
 * Positions and normals remain in the original construction pose. */
export function tagWeaponGeometry<T extends THREE.BufferGeometry>(geometry: T, index = -1, pivot = new THREE.Vector3(), elevates = true): T {
  const count = geometry.getAttribute('position').count
  const tagged = Number.isInteger(index) && index >= 0 && index < MAX_WEAPON_MOUNTS
  const indices = new Float32Array(count).fill(tagged ? index : -1)
  const pivots = new Float32Array(count * 3)
  if (tagged) for (let i = 0; i < count; i++) pivot.toArray(pivots, i * 3)
  geometry.setAttribute('cinemaMount', new THREE.BufferAttribute(indices, 1))
  geometry.setAttribute('cinemaPivot', new THREE.BufferAttribute(pivots, 3))
  geometry.setAttribute('cinemaElevation', new THREE.BufferAttribute(new Float32Array(count).fill(tagged && elevates ? 1 : 0), 1))
  return geometry
}

const declarations = `
attribute float cinemaMount;
attribute vec3 cinemaPivot;
attribute float cinemaElevation;
uniform vec4 cinemaWeaponTraversals[${MAX_WEAPON_MOUNTS}];
uniform vec4 cinemaWeaponRotations[${MAX_WEAPON_MOUNTS}];
vec4 cinemaWeaponRotation(float index) {
  return cinemaElevation > 0.5 ? cinemaWeaponRotations[int(index)] : cinemaWeaponTraversals[int(index)];
}
vec3 cinemaRotateWeapon(vec3 value, vec4 rotation) {
  return value + 2.0 * cross(rotation.xyz, cross(rotation.xyz, value) + rotation.w * value);
}
`
const positionTransform = `
if (cinemaMount >= 0.0 && cinemaMount < ${MAX_WEAPON_MOUNTS}.0) {
  transformed = cinemaPivot + cinemaRotateWeapon(transformed - cinemaPivot, cinemaWeaponRotation(cinemaMount));
}
`
const normalTransform = `
if (cinemaMount >= 0.0 && cinemaMount < ${MAX_WEAPON_MOUNTS}.0) {
  objectNormal = cinemaRotateWeapon(objectNormal, cinemaWeaponRotation(cinemaMount));
  #ifdef USE_TANGENT
    objectTangent = cinemaRotateWeapon(objectTangent, cinemaWeaponRotation(cinemaMount));
  #endif
}
`
const bindings = new WeakMap<THREE.Material, { rotation: { value: THREE.Vector4[] }; traverse: { value: THREE.Vector4[] } }>()

/** Compose after panel/crystal shader setup. Also works with depth/distance
 * materials, keeping directional and point-light shadows aligned with barrels. */
export function applyWeaponRig<T extends THREE.Material>(material: T, rig: WeaponRig): T {
  const existing = bindings.get(material)
  if (existing) {
    existing.rotation.value = rig.uniforms
    existing.traverse.value = rig.traverseUniforms
    return material
  }
  const uniform = { value: rig.uniforms }, traverse = { value: rig.traverseUniforms }
  bindings.set(material, { rotation: uniform, traverse })
  const previousCompile = material.onBeforeCompile
  // The default cache-key implementation reads onBeforeCompile.toString().
  // Snapshot it before installing the wrapper so the base shader is retained.
  const previousCacheKey = material.customProgramCacheKey()
  material.customProgramCacheKey = () => `${previousCacheKey}|cinema-weapon-rig-v2`
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer)
    shader.uniforms.cinemaWeaponRotations = uniform
    shader.uniforms.cinemaWeaponTraversals = traverse
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${declarations}`)
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${normalTransform}`)
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${positionTransform}`)
  }
  material.needsUpdate = true
  return material
}

/** Attach to mesh.customDepthMaterial/customDistanceMaterial. The mesh owner
 * must dispose both explicitly; ordinary material traversal does not see them. */
export function createWeaponShadowMaterials(rig: WeaponRig): { depth: THREE.MeshDepthMaterial; distance: THREE.MeshDistanceMaterial } {
  return {
    depth: applyWeaponRig(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), rig),
    distance: applyWeaponRig(new THREE.MeshDistanceMaterial(), rig),
  }
}

const forward = new THREE.Vector3(1, 0, 0)
const up = new THREE.Vector3(0, 1, 0)
const minimumAimDot = -Math.sin(Math.PI / 36)

/** Five degrees of depression admits distant targets near the mounting tangent;
 * a surface-mounted battery otherwise traverses its outward hemisphere. */
export function canAimWeaponMount(rig: WeaponRig, index: number, targetLocal: THREE.Vector3): boolean {
  const mount = Number.isInteger(index) && index >= 0 && index < MAX_WEAPON_MOUNTS ? rig.mounts[index] : undefined
  if (!mount) return false
  const direction = targetLocal.clone().sub(mount.pivot), length = direction.length()
  if (!Number.isFinite(length) || length <= 1e-10) return false
  if(!mount.normal)return true
  direction.divideScalar(length)
  const height=direction.dot(mount.normal)
  if(height<minimumAimDot-1e-8)return false
  if(!mount.minimumElevation)return true
  const horizontal=direction.clone().addScaledVector(mount.normal,-height)
  if(horizontal.lengthSq()<1e-12)return height>0
  return Math.asin(THREE.MathUtils.clamp(height,-1,1))+1e-8>=mount.minimumElevation(horizontal.normalize())
}

/** Absolute yaw/elevation about the mounting face. Preserving its outward up
 * vector avoids flipping the gun's base into the hull when traversing aft. */
export function aimWeaponMount(rig: WeaponRig, index: number, targetLocal: THREE.Vector3): boolean {
  const mount = Number.isInteger(index) && index >= 0 && index < MAX_WEAPON_MOUNTS ? rig.mounts[index] : undefined
  if (!mount) return false
  const direction = targetLocal.clone().sub(mount.pivot), length = direction.length()
  const traverse = mount.traverseRotation ??= new THREE.Quaternion()
  if (!Number.isFinite(length) || length <= 1e-10) { mount.rotation.identity(); traverse.identity() }
  else {
    direction.divideScalar(length)
    const normal = mount.normal ?? up
    let height = THREE.MathUtils.clamp(direction.dot(normal), -1, 1)
    const horizontal = direction.clone().addScaledVector(normal, -height)
    const horizontalLength = horizontal.length()
    if (horizontalLength > 1e-10) horizontal.divideScalar(horizontalLength)
    else horizontal.copy(forward)
    if (mount.normal) height=Math.max(height,minimumAimDot,Math.sin(mount.minimumElevation?.(horizontal)??-Math.PI/2))
    const elevation = Math.asin(height)
    if (Math.abs(normal.y) < 1e-8 && Math.abs(normal.z) > 1 - 1e-8) {
      // A true side sponson uses a fixed bearing and a gimballed barrel. Deck
      // yaw/elevation becomes singular when its target crosses the side normal:
      // the projected yaw flips 180 degrees and rolls the housing upside down.
      traverse.identity()
      const clampedDirection = horizontal.multiplyScalar(Math.cos(elevation)).addScaledVector(normal, height).normalize()
      mount.rotation.setFromUnitVectors(forward, clampedDirection)
    } else {
      const yaw = Math.atan2(normal.dot(new THREE.Vector3().crossVectors(forward, horizontal)), forward.dot(horizontal))
      const yawRotation = traverse.setFromAxisAngle(normal, yaw)
      const pitchAxis = new THREE.Vector3().crossVectors(horizontal, normal).normalize()
      mount.rotation.setFromAxisAngle(pitchAxis, elevation).multiply(yawRotation)
    }
  }
  rig.uniforms[index].set(mount.rotation.x, mount.rotation.y, mount.rotation.z, mount.rotation.w)
  rig.traverseUniforms[index].set(traverse.x, traverse.y, traverse.z, traverse.w)
  return true
}

/** CPU counterpart of the vertex shader for projectile release from the
 * actually aimed muzzle. Transform this result through the ship matrixWorld. */
export function weaponMuzzleLocal(rig: WeaponRig, index: number, target = new THREE.Vector3()): THREE.Vector3 | undefined {
  const mount = Number.isInteger(index) && index >= 0 && index < MAX_WEAPON_MOUNTS ? rig.mounts[index] : undefined
  if (!mount) return undefined
  return target.copy(mount.muzzle).sub(mount.pivot).applyQuaternion(mount.rotation).add(mount.pivot)
}
