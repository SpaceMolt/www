import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { applyShipSurface, createShipSurfaceAtlas } from './ship-surfaces'
import { applyWeaponRig, createWeaponRig } from './ship-weapons'

const compile = (material: THREE.MeshStandardMaterial) => {
  const shader = { ...THREE.ShaderLib.standard, uniforms: { ...THREE.ShaderLib.standard.uniforms } }
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
  return shader
}

test('packed manufacturing atlas is deterministic, varied, and mipmapped linear data', () => {
  const a = createShipSurfaceAtlas(17), b = createShipSurfaceAtlas(17), c = createShipSurfaceAtlas(18)
  try {
    expect(a.image.width).toBe(256)
    expect(a.image.height).toBe(256)
    expect(a.image.data).toEqual(b.image.data)
    expect(a.image.data).not.toEqual(c.image.data)
    expect(a.colorSpace).toBe(THREE.NoColorSpace)
    expect(a.minFilter).toBe(THREE.LinearMipmapLinearFilter)
    expect(a.generateMipmaps).toBe(true)
    const data = a.image.data as Uint8Array, channels = [new Set<number>(), new Set<number>(), new Set<number>()]
    let exposed = 0, dark = 0
    for (let i = 0; i < data.length; i += 4) {
      channels.forEach((values, channel) => values.add(data[i + channel]))
      if (data[i + 3] > 100) exposed++
      if (data[i] < 160) dark++
    }
    channels.forEach(values => expect(values.size).toBeGreaterThan(20))
    expect(exposed).toBeGreaterThan(0)
    expect(exposed / 65536).toBeLessThan(.04)
    expect(dark / 65536).toBeLessThan(.16)
  } finally { a.dispose(); b.dispose(); c.dispose() }
})

test('painted armor and bare metal retain distinct PBR responses', () => {
  const armor = applyShipSurface(new THREE.MeshStandardMaterial(), { kind: 'armor', seed: 2 })
  const metal = applyShipSurface(new THREE.MeshStandardMaterial(), { kind: 'metal', seed: 2 })
  try {
    expect(metal.metalness - armor.metalness).toBeGreaterThan(.5)
    expect(armor.roughness).toBeGreaterThan(metal.roughness)
    const shader = compile(armor)
    expect(shader.fragmentShader).toContain('roughnessFactor')
    expect(shader.fragmentShader).toContain('cinemaPacked.a')
  } finally { armor.dispose(); metal.dispose() }
})

test('Nebula gold is metallic while its green accent remains painted', () => {
  const armor = applyShipSurface(new THREE.MeshStandardMaterial(), { kind: 'armor', empire: 'nebula' })
  const hull = applyShipSurface(new THREE.MeshStandardMaterial(), { kind: 'hull', empire: 'nebula' })
  const accent = applyShipSurface(new THREE.MeshStandardMaterial(), { kind: 'accent', empire: 'nebula' })
  try {
    expect(armor.metalness).toBeGreaterThanOrEqual(.7)
    expect(armor.roughness).toBeCloseTo(.38, 4)
    expect(hull.metalness).toBeGreaterThan(.6)
    expect(accent.metalness).toBeLessThan(.2)
  } finally { armor.dispose(); hull.dispose(); accent.dispose() }
})

test('broad clean panels vary in finish without relying on dirt or exposed chips', () => {
  const atlas = createShipSurfaceAtlas(17), data = atlas.image.data as Uint8Array
  let minTone = 255, maxTone = 0, minRoughness = 255, maxRoughness = 0
  try {
    for (let i = 0; i < data.length; i += 4) if (data[i + 1] >= 180 && data[i + 3] === 0) {
      minTone = Math.min(minTone, data[i]); maxTone = Math.max(maxTone, data[i])
      minRoughness = Math.min(minRoughness, data[i + 2]); maxRoughness = Math.max(maxRoughness, data[i + 2])
    }
    expect(maxTone - minTone).toBeGreaterThan(28)
    expect(maxRoughness - minRoughness).toBeGreaterThan(80)
  } finally { atlas.dispose() }
})

test('shared atlas survives one owner and disposes exactly once with its last material', () => {
  const a = applyShipSurface(new THREE.MeshStandardMaterial(), { kind: 'hull', seed: 901 })
  const b = applyShipSurface(new THREE.MeshStandardMaterial(), { kind: 'metal', seed: 905 })
  const texture = compile(a).uniforms.cinemaSurfaceAtlas.value as THREE.DataTexture
  expect(compile(b).uniforms.cinemaSurfaceAtlas.value).toBe(texture)
  let disposals = 0
  texture.addEventListener('dispose', () => { disposals++ })
  applyShipSurface(a, { kind: 'hull', seed: 901 })
  a.dispose(); a.dispose()
  expect(disposals).toBe(0)
  b.dispose()
  expect(disposals).toBe(1)
  const replacement = applyShipSurface(new THREE.MeshStandardMaterial(), { kind: 'hull', seed: 901 })
  expect(compile(replacement).uniforms.cinemaSurfaceAtlas.value).not.toBe(texture)
  replacement.dispose()
})

test('surface shader composes with earlier detail and later articulation while sampling rest coordinates', () => {
  const material = new THREE.MeshStandardMaterial()
  material.customProgramCacheKey = () => 'existing-detail'
  material.onBeforeCompile = shader => { shader.fragmentShader += '\n// original detail retained' }
  applyShipSurface(material, { kind: 'hull', empire: 'solarian', seed: 3 })
  applyWeaponRig(material, createWeaponRig())
  try {
    const shader = compile(material)
    expect(shader.fragmentShader).toContain('original detail retained')
    expect(material.customProgramCacheKey()).toContain('existing-detail')
    expect(material.customProgramCacheKey()).toContain('cinema-surface-atlas-v1')
    expect(shader.vertexShader).toContain('vCinemaSurfacePosition = position;')
    expect(shader.vertexShader).toContain('cinemaRotateWeapon')
    expect(shader.fragmentShader).toContain('textureGrad(')
    expect(shader.fragmentShader).not.toMatch(/dFd[xy]\(cinema(LocalD|ViewD)/)
  } finally { material.dispose() }
})
