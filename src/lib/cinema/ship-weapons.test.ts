import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { aimWeaponMount, applyWeaponRig, assignWeaponCues, createWeaponRig, createWeaponShadowMaterials, tagWeaponGeometry, weaponMuzzleLocal } from './ship-weapons'
import type { CinemaCue } from './types'

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
    const first = rig.uniforms[0].clone()
    aimWeaponMount(rig, 0, new THREE.Vector3(5, -8, 2))
    aimWeaponMount(rig, 0, target)
    expect(rig.uniforms[0].equals(first)).toBe(true)
    aimWeaponMount(rig, 0, rig.mounts[0].pivot)
    expect(rig.uniforms[0].toArray()).toEqual([0, 0, 0, 1])
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
