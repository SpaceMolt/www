import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { aimWeaponMount, canAimWeaponMount, applyWeaponRig, assignWeaponCues, createWeaponRig, createWeaponShadowMaterials, tagWeaponGeometry, weaponMuzzleLocal } from './ship-weapons'
import type { CinemaCue } from './types'
import { createShip } from './ships'
import { resolveAppearance } from './appearance'

const mount = (rig: ReturnType<typeof createWeaponRig>) => {
  rig.mounts.push({ family: 'laser', pivot: new THREE.Vector3(2, 3, 4), muzzle: new THREE.Vector3(4, 3, 4), rotation: new THREE.Quaternion() })
  return rig
}
const shaderFor = (name: 'standard' | 'depth' | 'distance') => ({ ...THREE.ShaderLib[name], uniforms: { ...THREE.ShaderLib[name].uniforms } })

describe('batched weapon aiming', () => {
  test('reserves separate exact-family mounts for overlapping shots with different targets or hit outcomes', () => {
    const rig = mount(createWeaponRig())
    rig.mounts.push({ ...rig.mounts[0], pivot: new THREE.Vector3(2, 3, -4), muzzle: new THREE.Vector3(4, 3, -4), rotation: new THREE.Quaternion() })
    const a: CinemaCue = { id: 'cue:0', kind: 'weapon', time: 1, duration: 2, tick: 1, intensity: 1, from: 'a', to: 'b', hit: true, weaponFamily: 'laser' }
    const b: CinemaCue = { ...a, id: 'cue:2', time: 1.2, to: 'c', hit: false }
    const assigned = assignWeaponCues(rig, [a, b])
    expect(assigned.byCue.get(a.id)).not.toBe(assigned.byCue.get(b.id))
    expect(assigned.byCue.size).toBe(2)
    expect(assigned.suppressed.size).toBe(0)
    expect(assigned.tracks.flat()).toEqual([a, b])
  })
  test('suppresses overflow discharge without stealing active mounts or suppressing unrepresented families', () => {
    const rig = mount(createWeaponRig())
    const a: CinemaCue = { id: 'one', kind: 'weapon', time: 1, duration: 2, tick: 1, intensity: 1, from: 'a', to: 'b', hit: true, weaponFamily: 'laser' }
    const b: CinemaCue = { ...a, id: 'overlap', time: 2, hit: false }
    const absent: CinemaCue = { ...b, id: 'absent-family', weaponFamily: 'railgun' }
    const derived: CinemaCue = { ...b, id: 'derived', secondaryKind: 'chain' }
    const assigned = assignWeaponCues(rig, [a, b, absent, derived])
    expect(assigned.byCue).toEqual(new Map([['one', 0]]))
    expect(assigned.tracks).toEqual([[a]])
    expect([...assigned.suppressed]).toEqual(['overlap'])
    expect(assignWeaponCues(createWeaponRig(), [a, b]).suppressed.size).toBe(0)
  })
  test('keeps the release safety margin, reuses a freed mount, and leaves source cue order untouched', () => {
    const rig = mount(createWeaponRig())
    const a: CinemaCue = { id: 'one', kind: 'weapon', time: 1, duration: 2, tick: 1, intensity: 1, from: 'a', to: 'b', weaponFamily: 'laser' }
    const tooSoon = { ...a, id: 'margin', time: 3.05 }
    const later = { ...a, id: 'later', time: 3.2 }
    const source = [later, a, tooSoon]
    const assigned = assignWeaponCues(rig, source)
    expect(assigned.tracks).toEqual([[a, later]])
    expect([...assigned.suppressed]).toEqual(['margin'])
    expect(source).toEqual([later, a, tooSoon])
    expect(assignWeaponCues(rig, source)).toEqual(assigned)
  })
  test('aims behind, sideways, and above from the actual pivot while preserving barrel length', () => {
    const rig = mount(createWeaponRig())
    for (const target of [new THREE.Vector3(-8, 3, 4), new THREE.Vector3(2, 3, 14), new THREE.Vector3(2, 13, 4), new THREE.Vector3(-5, 10, -8)]) {
      aimWeaponMount(rig, 0, target)
      const actual = weaponMuzzleLocal(rig, 0)!.sub(rig.mounts[0].pivot)
      expect(actual.length()).toBeCloseTo(2, 10)
      expect(actual.normalize().distanceTo(target.clone().sub(rig.mounts[0].pivot).normalize())).toBeLessThan(1e-10)
      expect(rig.uniforms[0].toArray()).toEqual(rig.mounts[0].rotation.toArray())
    }
  })
  test('seeking is history-independent and coincident targets restore a finite neutral rotation', () => {
    const rig = mount(createWeaponRig()), target = new THREE.Vector3(-5, 10, -8)
    aimWeaponMount(rig, 0, target)
    const first = rig.uniforms[0].clone(), firstTraverse = rig.traverseUniforms[0].clone()
    aimWeaponMount(rig, 0, new THREE.Vector3(5, -8, 2))
    aimWeaponMount(rig, 0, target)
    expect(rig.uniforms[0].equals(first)).toBe(true)
    expect(rig.traverseUniforms[0].equals(firstTraverse)).toBe(true)
    aimWeaponMount(rig, 0, rig.mounts[0].pivot)
    expect(rig.uniforms[0].toArray()).toEqual([0, 0, 0, 1])
    expect(rig.traverseUniforms[0].toArray()).toEqual([0, 0, 0, 1])
    expect(weaponMuzzleLocal(rig, 0)!.toArray()).toEqual([4, 3, 4])
    expect(aimWeaponMount(rig, 12, target)).toBe(false)
    expect(weaponMuzzleLocal(rig, 12)).toBeUndefined()
  })
  test('tags geometry without moving static or rest-pose vertices and clamps invalid mount indices', () => {
    const geometry = new THREE.BoxGeometry(.5, .2, .3)
    const positions = Array.from(geometry.getAttribute('position').array)
    tagWeaponGeometry(geometry, 0, new THREE.Vector3(2, 3, 4))
    expect(Array.from(geometry.getAttribute('position').array)).toEqual(positions)
    expect(geometry.getAttribute('cinemaMount').getX(0)).toBe(0)
    expect([0, 1, 2].map(i => geometry.getAttribute('cinemaPivot').array[i])).toEqual([2, 3, 4])
    tagWeaponGeometry(geometry, 12, new THREE.Vector3(2, 3, 4))
    expect(Array.from(geometry.getAttribute('cinemaMount').array).every(index => index === -1)).toBe(true)
    expect(Array.from(geometry.getAttribute('cinemaPivot').array).every(value => value === 0)).toBe(true)
    geometry.dispose()
  })
  test('shader quaternion values rotate normals and tagged positions consistently with the CPU muzzle', () => {
    const rig = mount(createWeaponRig()), target = new THREE.Vector3(-2, 9, 1)
    aimWeaponMount(rig, 0, target)
    const q = rig.uniforms[0], xyz = new THREE.Vector3(q.x, q.y, q.z)
    const rotate = (v: THREE.Vector3) => v.clone().add(xyz.clone().cross(xyz.clone().cross(v).addScaledVector(v, q.w)).multiplyScalar(2))
    const muzzle = rotate(new THREE.Vector3(2, 0, 0)).add(rig.mounts[0].pivot)
    expect(muzzle.distanceTo(weaponMuzzleLocal(rig, 0)!)).toBeLessThan(1e-10)
    expect(rotate(new THREE.Vector3(1, 0, 0)).distanceTo(target.sub(rig.mounts[0].pivot).normalize())).toBeLessThan(1e-10)
  })
  test('composes with prior material shaders and cache keys and binds live rig uniforms', () => {
    const rig = mount(createWeaponRig()), material = new THREE.MeshStandardMaterial()
    material.customProgramCacheKey = () => 'existing-panels-v4'
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n// original local plating')
      shader.fragmentShader += '\n// original crystal details'
      shader.uniforms.existing = { value: 7 }
    }
    applyWeaponRig(material, rig)
    const shader = shaderFor('standard')
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
    expect(shader.vertexShader).toContain('// original local plating')
    expect(shader.fragmentShader).toContain('// original crystal details')
    expect(shader.uniforms.existing.value).toBe(7)
    expect(shader.uniforms.cinemaWeaponRotations.value).toBe(rig.uniforms)
    expect(shader.uniforms.cinemaWeaponTraversals.value).toBe(rig.traverseUniforms)
    expect(shader.vertexShader).toContain('cinemaElevation > 0.5 ? cinemaWeaponRotations')
    expect(shader.vertexShader).toContain('objectNormal = cinemaRotateWeapon')
    expect(shader.vertexShader).toContain('transformed = cinemaPivot + cinemaRotateWeapon')
    expect(material.customProgramCacheKey()).toContain('existing-panels-v4')
    aimWeaponMount(rig, 0, new THREE.Vector3(2, 8, 4))
    expect(shader.uniforms.cinemaWeaponRotations.value[0]).toBe(rig.uniforms[0])
    material.dispose()
  })
  test('patches depth and point-light distance passes with the same vertex motion and uniforms', () => {
    const rig = mount(createWeaponRig()), shadows = createWeaponShadowMaterials(rig)
    for (const [material, name] of [[shadows.depth, 'depth'], [shadows.distance, 'distance']] as const) {
      const shader = shaderFor(name)
      material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
      expect(shader.vertexShader).toContain('transformed = cinemaPivot + cinemaRotateWeapon')
      expect(shader.uniforms.cinemaWeaponRotations.value).toBe(rig.uniforms)
    expect(shader.uniforms.cinemaWeaponTraversals.value).toBe(rig.traverseUniforms)
    expect(shader.vertexShader).toContain('cinemaElevation > 0.5 ? cinemaWeaponRotations')
      material.dispose()
    }
    expect(shadows.depth.depthPacking).toBe(THREE.RGBADepthPacking)
  })
  test('applying a rig twice never duplicates shader declarations and distinct ships keep separate uniforms', () => {
    const a = mount(createWeaponRig()), b = mount(createWeaponRig()), material = new THREE.MeshStandardMaterial()
    applyWeaponRig(material, a)
    applyWeaponRig(material, a)
    const shader = shaderFor('standard')
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
    expect(shader.vertexShader.match(/uniform vec4 cinemaWeaponRotations/g)).toHaveLength(1)
    aimWeaponMount(a, 0, new THREE.Vector3(2, 8, 4))
    expect(b.uniforms[0].toArray()).toEqual([0, 0, 0, 1])
    material.dispose()
  })
})


test('surface mounts permit modest depression but clamp hull-directed aim while keeping their base upright', () => {
  const rig = createWeaponRig()
  rig.mounts.push({ family: 'railgun', pivot: new THREE.Vector3(), muzzle: new THREE.Vector3(1, 0, 0), rotation: new THREE.Quaternion(), normal: new THREE.Vector3(0, 1, 0) })
  expect(canAimWeaponMount(rig, 0, new THREE.Vector3(10, -.5, 0))).toBe(true)
  expect(canAimWeaponMount(rig, 0, new THREE.Vector3(10, -3, 0))).toBe(false)
  aimWeaponMount(rig, 0, new THREE.Vector3(10, -3, 0))
  expect(weaponMuzzleLocal(rig, 0)!.y).toBeCloseTo(-Math.sin(Math.PI / 36), 8)
  aimWeaponMount(rig, 0, new THREE.Vector3(-10, 0, 0))
  expect(new THREE.Vector3(0, 1, 0).applyQuaternion(rig.mounts[0].rotation).distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-10)
  expect(weaponMuzzleLocal(rig, 0)!.x).toBeCloseTo(-1, 10)
  expect(canAimWeaponMount(rig, 0, new THREE.Vector3())).toBe(false)
})

test('cue assignment respects physical firing eligibility and retains impacts for blocked discharge', () => {
  const rig = mount(createWeaponRig())
  rig.mounts.push({ ...rig.mounts[0], rotation: new THREE.Quaternion() })
  const cue: CinemaCue = { id: 'outside-arc', kind: 'weapon', time: 1, duration: 1, tick: 1, intensity: 1, from: 'a', to: 'b', weaponFamily: 'laser', hit: true }
  const assigned = assignWeaponCues(rig, [cue], index => index === 1)
  expect(assigned.byCue.get(cue.id)).toBe(1)
  expect(assigned.suppressed.size).toBe(0)
  const blocked = assignWeaponCues(rig, [cue], () => false)
  expect([...blocked.suppressed]).toEqual([cue.id])
  expect(blocked.byCue.size).toBe(0)
  expect(cue.hit).toBe(true)
})

test('diagonal mounting bases traverse in their own plane while barrels elevate independently', () => {
  for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const normal = new THREE.Vector3(0, y, z).normalize()
    const rig = createWeaponRig()
    rig.mounts.push({ family: 'railgun', pivot: new THREE.Vector3(.2, .15, .12), muzzle: new THREE.Vector3(.5, .15, .12), rotation: new THREE.Quaternion(), normal })
    for (const yaw of [-135, -45, 0, 60, 160]) for (const pitch of [-5, 0, 35, 70]) {
      const tangent = new THREE.Vector3(1, 0, 0).applyAxisAngle(normal, THREE.MathUtils.degToRad(yaw))
      const elevation = THREE.MathUtils.degToRad(pitch)
      const direction = tangent.multiplyScalar(Math.cos(elevation)).addScaledVector(normal, Math.sin(elevation))
      aimWeaponMount(rig, 0, rig.mounts[0].pivot.clone().addScaledVector(direction, 10))
      // Before the split every triangle used uniforms, including the base.
      const uniform = rig.traverseUniforms?.[0] ?? rig.uniforms[0]
      const baseRotation = new THREE.Quaternion(uniform.x, uniform.y, uniform.z, uniform.w)
      expect(normal.clone().applyQuaternion(baseRotation).distanceTo(normal)).toBeLessThan(1e-10)
      expect(Math.abs(new THREE.Vector3(1, 0, 0).applyQuaternion(baseRotation).dot(normal))).toBeLessThan(1e-10)
      const muzzle = weaponMuzzleLocal(rig, 0)!.sub(rig.mounts[0].pivot)
      expect(muzzle.length()).toBeCloseTo(.3, 10)
      expect(muzzle.normalize().distanceTo(direction)).toBeLessThan(1e-10)
    }
  }
})

test('base and barrel geometry retain separate articulation tags through every material pass', () => {
  const base = tagWeaponGeometry(new THREE.BoxGeometry(1, 1, 1), 0, new THREE.Vector3(), false)
  const barrel = tagWeaponGeometry(new THREE.BoxGeometry(2, .1, .1), 0, new THREE.Vector3(), true)
  try {
    expect(Array.from(base.getAttribute('cinemaElevation').array).every(value => value === 0)).toBe(true)
    expect(Array.from(barrel.getAttribute('cinemaElevation').array).every(value => value === 1)).toBe(true)
  } finally { base.dispose(); barrel.dispose() }
})

test('side batteries track through broadside without rolling the gun upside down', () => {
  for (const side of [-1, 1]) {
    const rig = createWeaponRig(), normal = new THREE.Vector3(0, 0, side)
    rig.mounts.push({ family: 'beam', pivot: new THREE.Vector3(), muzzle: new THREE.Vector3(1, 0, 0), normal, rotation: new THREE.Quaternion() })
    let previous: THREE.Quaternion | undefined
    for (const degrees of [60, 80, 89, 90, 91, 100, 120]) {
      const angle = degrees * Math.PI / 180, target = new THREE.Vector3(Math.cos(angle), 0, side * Math.sin(angle))
      aimWeaponMount(rig, 0, target.clone().multiplyScalar(10))
      expect(weaponMuzzleLocal(rig, 0)!.normalize().distanceTo(target)).toBeLessThan(1e-8)
      // A broadside sweep is around ship-up. The beam housing must retain its
      // top/bottom orientation on both sides of the exact broadside heading.
      expect(new THREE.Vector3(0, 1, 0).applyQuaternion(rig.mounts[0].rotation).distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-8)
      expect(normal.clone().applyQuaternion(rig.mounts[0].traverseRotation!).distanceTo(normal)).toBeLessThan(1e-8)
      if (previous && degrees >= 89 && degrees <= 91) expect(previous.angleTo(rig.mounts[0].rotation)).toBeLessThan(.17)
      previous = rig.mounts[0].rotation.clone()
    }
  }
})

test('side gimbals keep a fixed base and deterministic aim behind and above while respecting clearance', () => {
  for (const side of [-1, 1]) {
    const rig = createWeaponRig(), normal = new THREE.Vector3(0, 0, side), pivot = new THREE.Vector3(.3, .2, -.1)
    rig.mounts.push({ family: 'laser', pivot, muzzle: pivot.clone().add(new THREE.Vector3(1, 0, 0)), normal, rotation: new THREE.Quaternion() })
    for (const offset of [new THREE.Vector3(-10, 0, side), new THREE.Vector3(0, 10, side), new THREE.Vector3(0, -10, side), new THREE.Vector3(-10, 0, 0)]) {
      const target = pivot.clone().add(offset)
      expect(canAimWeaponMount(rig, 0, target)).toBe(true)
      aimWeaponMount(rig, 0, target)
      const expected = rig.mounts[0].rotation.clone()
      expect(weaponMuzzleLocal(rig, 0)!.sub(pivot).normalize().distanceTo(offset.clone().normalize())).toBeLessThan(1e-8)
      expect(rig.mounts[0].traverseRotation!.angleTo(new THREE.Quaternion())).toBeLessThan(1e-8)
      aimWeaponMount(rig, 0, pivot.clone().add(new THREE.Vector3(7, -3, side * 9)))
      aimWeaponMount(rig, 0, target)
      expect(rig.mounts[0].rotation.toArray()).toEqual(expected.toArray())
      expect(rig.uniforms[0].toArray()).toEqual(expected.toArray())
    }
    const inward = pivot.clone().addScaledVector(normal, -10)
    expect(canAimWeaponMount(rig, 0, inward)).toBe(false)
    aimWeaponMount(rig, 0, inward)
    expect(weaponMuzzleLocal(rig, 0)!.sub(pivot).dot(normal)).toBeCloseTo(-Math.sin(Math.PI / 36), 8)
    rig.mounts[0].minimumElevation = () => .3
    const tangent = pivot.clone().add(new THREE.Vector3(10, 0, 0))
    expect(canAimWeaponMount(rig, 0, tangent)).toBe(false)
    aimWeaponMount(rig, 0, tangent)
    expect(weaponMuzzleLocal(rig, 0)!.sub(pivot).dot(normal)).toBeCloseTo(Math.sin(.3), 8)
  }
})


test('assembled guns mark the traversing body separately from the elevated weapon components', () => {
  const group = createShip(resolveAppearance('Battlecruiser', 'crimson', 4, 'Combat', 4), 12, 'hero', { source: 'modules', weapons: { railgun: 1 }, cargo: 0, mining: 0, salvage: 0, sensor: 0, defense: 0, utility: 0 })
  const rig = group.userData.weaponRig as ReturnType<typeof createWeaponRig>
  const materials = new Set<THREE.Material>()
  try {
    expect(rig.mounts).toHaveLength(1)
    const mount = rig.mounts[0], normal = mount.normal!
    aimWeaponMount(rig, 0, mount.pivot.clone().add(new THREE.Vector3(2, 0, 0)).addScaledVector(normal, 3))
    const baseUniform = rig.traverseUniforms[0], baseRotation = new THREE.Quaternion(baseUniform.x, baseUniform.y, baseUniform.z, baseUniform.w)
    let baseCount = 0, barrelCount = 0, heightError = 0
    for (const mesh of group.children as THREE.Mesh[]) {
      const geometry = mesh.geometry, tags = geometry.getAttribute('cinemaMount'), elevation = geometry.getAttribute('cinemaElevation'), positions = geometry.getAttribute('position')
      if (!tags) continue
      for (let i = 0; i < tags.count; i++) if (tags.getX(i) === 0) {
        if (elevation.getX(i) > .5) barrelCount++
        else {
          baseCount++
          const local = new THREE.Vector3().fromBufferAttribute(positions, i).sub(mount.pivot)
          const before = local.dot(normal)
          heightError = Math.max(heightError, Math.abs(local.applyQuaternion(baseRotation).dot(normal) - before))
        }
      }
    }
    expect(baseCount).toBeGreaterThan(100)
    expect(barrelCount).toBeGreaterThan(100)
    expect(heightError).toBeLessThan(1e-8)
  } finally {
    for (const mesh of group.children as THREE.Mesh[]) {
      mesh.geometry.dispose()
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material)
      if (mesh.customDepthMaterial) materials.add(mesh.customDepthMaterial)
      if (mesh.customDistanceMaterial) materials.add(mesh.customDistanceMaterial)
    }
    materials.forEach(material => material.dispose())
  }
})
