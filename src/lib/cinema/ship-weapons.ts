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
}

export interface WeaponRig {
  mounts: WeaponMount[]
  /** Stable vector objects shared by all hull and shadow material uniforms. */
  uniforms: THREE.Vector4[]
}

export function createWeaponRig(): WeaponRig {
  return { mounts: [], uniforms: Array.from({ length: MAX_WEAPON_MOUNTS }, () => new THREE.Vector4(0, 0, 0, 1)) }
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
export function assignWeaponCues(rig: WeaponRig, actorCues: readonly CinemaCue[]): WeaponCueAssignment {
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
      if (occupiedUntil[matching[candidate]] <= cue.time - .1) {
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
export function tagWeaponGeometry<T extends THREE.BufferGeometry>(geometry: T, index = -1, pivot = new THREE.Vector3()): T {
  const count = geometry.getAttribute('position').count
  const tagged = Number.isInteger(index) && index >= 0 && index < MAX_WEAPON_MOUNTS
  const indices = new Float32Array(count).fill(tagged ? index : -1)
  const pivots = new Float32Array(count * 3)
  if (tagged) for (let i = 0; i < count; i++) pivot.toArray(pivots, i * 3)
  geometry.setAttribute('cinemaMount', new THREE.BufferAttribute(indices, 1))
  geometry.setAttribute('cinemaPivot', new THREE.BufferAttribute(pivots, 3))
  return geometry
}

const declarations = `
attribute float cinemaMount;
attribute vec3 cinemaPivot;
uniform vec4 cinemaWeaponRotations[${MAX_WEAPON_MOUNTS}];
vec3 cinemaRotateWeapon(vec3 value, vec4 rotation) {
  return value + 2.0 * cross(rotation.xyz, cross(rotation.xyz, value) + rotation.w * value);
}
`
const positionTransform = `
if (cinemaMount >= 0.0 && cinemaMount < ${MAX_WEAPON_MOUNTS}.0) {
  transformed = cinemaPivot + cinemaRotateWeapon(transformed - cinemaPivot, cinemaWeaponRotations[int(cinemaMount)]);
}
`
const normalTransform = `
if (cinemaMount >= 0.0 && cinemaMount < ${MAX_WEAPON_MOUNTS}.0) {
  objectNormal = cinemaRotateWeapon(objectNormal, cinemaWeaponRotations[int(cinemaMount)]);
  #ifdef USE_TANGENT
    objectTangent = cinemaRotateWeapon(objectTangent, cinemaWeaponRotations[int(cinemaMount)]);
  #endif
}
`
const bindings = new WeakMap<THREE.Material, { value: THREE.Vector4[] }>()

/** Compose after panel/crystal shader setup. Also works with depth/distance
 * materials, keeping directional and point-light shadows aligned with barrels. */
export function applyWeaponRig<T extends THREE.Material>(material: T, rig: WeaponRig): T {
  const existing = bindings.get(material)
  if (existing) {
    existing.value = rig.uniforms
    return material
  }
  const uniform = { value: rig.uniforms }
  bindings.set(material, uniform)
  const previousCompile = material.onBeforeCompile
  // The default cache-key implementation reads onBeforeCompile.toString().
  // Snapshot it before installing the wrapper so the base shader is retained.
  const previousCacheKey = material.customProgramCacheKey()
  material.customProgramCacheKey = () => `${previousCacheKey}|cinema-weapon-rig-v1`
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer)
    shader.uniforms.cinemaWeaponRotations = uniform
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

/** Absolute +X-to-target rotation; seeking and playback order never affect aim.
 * A coincident or invalid target returns the neutral pose rather than stale aim. */
export function aimWeaponMount(rig: WeaponRig, index: number, targetLocal: THREE.Vector3): boolean {
  const mount = Number.isInteger(index) && index >= 0 && index < MAX_WEAPON_MOUNTS ? rig.mounts[index] : undefined
  if (!mount) return false
  const direction = targetLocal.clone().sub(mount.pivot), lengthSquared = direction.lengthSq()
  if (!Number.isFinite(lengthSquared) || lengthSquared <= 1e-20) mount.rotation.identity()
  else mount.rotation.setFromUnitVectors(forward, direction.multiplyScalar(1 / Math.sqrt(lengthSquared)))
  rig.uniforms[index].set(mount.rotation.x, mount.rotation.y, mount.rotation.z, mount.rotation.w)
  return true
}

/** CPU counterpart of the vertex shader for projectile release from the
 * actually aimed muzzle. Transform this result through the ship matrixWorld. */
export function weaponMuzzleLocal(rig: WeaponRig, index: number, target = new THREE.Vector3()): THREE.Vector3 | undefined {
  const mount = Number.isInteger(index) && index >= 0 && index < MAX_WEAPON_MOUNTS ? rig.mounts[index] : undefined
  if (!mount) return undefined
  return target.copy(mount.muzzle).sub(mount.pivot).applyQuaternion(mount.rotation).add(mount.pivot)
}
