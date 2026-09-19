import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { applyEngineHeat } from './ship-engine-heat'
import { applyShipSurface } from './ship-surfaces'
import { applyWeaponRig, createWeaponRig } from './ship-weapons'

const compile = (material: THREE.MeshStandardMaterial) => {
  const shader = { ...THREE.ShaderLib.standard, uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms) }
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
  return shader
}

test('engine heat has a bounded field shared within one model and isolated across models', () => {
  const a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial(), other = new THREE.MeshStandardMaterial()
  try {
    const engines = Array.from({ length: 7 }, (_, i) => new THREE.Vector4(-.45, i * .01, .15, .02 + i * .01))
    applyEngineHeat([a, b], engines)
    applyEngineHeat([other], engines)
    const shaderA = compile(a), shaderB = compile(b), shaderOther = compile(other)
    expect(shaderA.uniforms.cinemaHeatCenters).toBe(shaderB.uniforms.cinemaHeatCenters)
    expect(shaderA.uniforms.cinemaHeatCenters).not.toBe(shaderOther.uniforms.cinemaHeatCenters)
    const centers = shaderA.uniforms.cinemaHeatCenters.value as THREE.Vector4[]
    expect(centers).toHaveLength(4)
    expect(shaderA.uniforms.cinemaHeatCount.value).toBe(4)
    expect(Math.min(...centers.map(center => center.w))).toBeGreaterThanOrEqual(.05)
    engines.forEach(center => center.set(100, 100, 100, 100))
    expect(centers.every(center => Math.abs(center.x) < 1 && center.w < .1)).toBe(true)
  } finally { a.dispose(); b.dispose(); other.dispose() }
})

test('local engine heat composes with surface and weapon callbacks in both detail levels', () => {
  for (const hero of [true, false]) {
    const material = new THREE.MeshStandardMaterial()
    if (hero) applyShipSurface(material, { kind: 'metal', empire: 'outerrim', seed: 9 })
    applyEngineHeat([material], [new THREE.Vector4(-.47, 0, .15, .05)])
    applyWeaponRig(material, createWeaponRig())
    try {
      const shader = compile(material)
      expect(shader.uniforms.cinemaHeatCount.value).toBe(1)
      expect(shader.vertexShader).toContain('vCinemaHeatPosition = position;')
      expect(shader.vertexShader).toContain('cinemaRotateWeapon')
      expect(shader.fragmentShader).toContain('varying vec3 vCinemaHeatPosition;')
      expect(material.customProgramCacheKey()).toContain('cinema-engine-heat-v1')
      if (hero) expect(shader.uniforms.cinemaSurfaceAtlas.value).toBeInstanceOf(THREE.DataTexture)
      else expect(shader.uniforms.cinemaSurfaceAtlas).toBeUndefined()
    } finally { material.dispose() }
  }
})
