import * as THREE from 'three'
import type { GlyphArchetype } from '../battle/shipGlyphs'
import type { SpecialHullContext, SpecialHullMaterial } from './ship-recipes'

// Skin, glow, accent. The whale follows the home-page wildlife art: violet,
// iridescent and speckled with cyan light. The jelly follows the nitrogen
// bladder art: a pale blue-grey sac with a red-orange underside.
const palettes = {
  whale: [0x4b4a9a, 0x8ff3ff, 0x9fb6e8], jelly: [0xa8c6cf, 0xff7d5c, 0xc0604a],
  lobster: [0x8c3a26, 0xffb347, 0xd88a4a], bug: [0x3b4a32, 0xb6ff6a, 0x6d8a4f],
  ray: [0x1f3e5c, 0x5fe6ff, 0x8fb0c8], eel: [0x3a2c5e, 0xc890ff, 0x7a5aa8],
  creature: [0x5c4a3e, 0x7fffd4, 0x8a6a52],
} satisfies Record<string, [number, number, number]>
type Creature = keyof typeof palettes
/** [skin, glow, accent] for a body plan; unknown plans get the generic grazer. */
export const creatureColors = (body?: string) => palettes[body && body in palettes ? body as Creature : 'creature']

// GLSL displacement per body, in model units (+X head). `t` is the swim clock.
const swimmers: Record<Creature, string> = {
  whale: 'transformed.y += sin(position.x * 6.0 - t * 2.2) * 0.035 * smoothstep(0.1, -0.5, position.x);',
  jelly: 'float bell = smoothstep(-0.15, 0.1, position.x); transformed.yz *= 1.0 + 0.07 * sin(t * 2.6) * bell;' +
    'transformed.y += sin(position.x * 12.0 - t * 3.0) * 0.025 * (1.0 - bell);',
  lobster: 'transformed.y += sin(t * 2.0) * 0.04 * smoothstep(-0.1, -0.5, position.x);',
  bug: 'transformed.y += sin(t * 9.0) * max(0.0, abs(position.z) - 0.05) * 0.5;',
  ray: 'transformed.y += sin(position.x * 7.0 - t * 2.5) * abs(position.z) * 0.3;',
  eel: 'transformed.z += sin(position.x * 9.0 - t * 3.0) * 0.045 * (0.3 + 0.5 - position.x);',
  creature: 'transformed.z += sin(position.x * 7.0 - t * 1.8) * 0.02;',
}

/**
 * Wildlife shares the hull material batches, so wrecks and distant fleets work
 * unchanged. Every material bends with the shared `clock`: creatures swim.
 */
export function buildCreatureBody(body: GlyphArchetype | undefined, seed: number, c: SpecialHullContext,
  materials: Record<SpecialHullMaterial, THREE.MeshStandardMaterial>, clock: { value: number }): void {
  const kind: Creature = body && body in palettes ? body as Creature : 'creature'
  const { add, hero } = c
  const [skin, glow, accent] = creatureColors(kind)
  for (const material of Object.values(materials)) {
    material.metalness = .05
    material.roughness = .55
    material.customProgramCacheKey = () => `cinema-creature-swim-${kind}`
    material.onBeforeCompile = shader => {
      shader.uniforms.cinemaSwim = clock
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float cinemaSwim;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n{ float t = cinemaSwim; ${swimmers[kind]} }`)
    }
  }
  materials.hull.color.setHex(skin)
  materials.armor.color.setHex(skin).multiplyScalar(.7)
  materials.accent.color.setHex(accent)
  materials.dark.color.setHex(0x1a0f14)
  materials.glass.color.setHex(skin).lerp(new THREE.Color(glow), .3)
  for (const key of ['hull', 'armor', 'accent', 'glass'] as const) materials[key].emissive.setHex(glow)
  materials.hull.emissiveIntensity = materials.armor.emissiveIntensity = materials.accent.emissiveIntensity = .05
  materials.glass.emissiveIntensity = .35
  materials.glass.transparent = true
  materials.glass.opacity = .6
  materials.windows.color.setHex(glow)
  materials.windows.emissive.setHex(glow)

  let rng = seed | 0
  const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) | 0; return (rng >>> 0) / 4294967296 }
  const segments = hero ? 24 : 10
  const blob = (x: number, y: number, z: number, rx: number, ry: number, rz: number, material: SpecialHullMaterial = 'hull', rotation?: THREE.Euler) => {
    const geometry = new THREE.SphereGeometry(1, segments, segments / 2)
    geometry.scale(rx, ry, rz)
    add(geometry, material, x, y, z, rotation)
  }
  // Body of revolution along +X from [x, radius] pairs, nose first.
  const lathe = (profile: [number, number][], material: SpecialHullMaterial, squash = 1) => {
    const geometry = new THREE.LatheGeometry(profile.map(([x, r]) => new THREE.Vector2(r, x)), segments)
    geometry.rotateZ(-Math.PI / 2)
    geometry.scale(1, 1, squash)
    add(geometry, material)
  }
  const radiusAt = (profile: [number, number][], x: number) => {
    for (let i = 1; i < profile.length; i++) {
      const [x0, r0] = profile[i - 1], [x1, r1] = profile[i]
      if (x <= x0 && x >= x1) return r0 + (r1 - r0) * (x0 - x) / (x0 - x1)
    }
    return 0
  }
  // Tapered limb through the given points; tentacles, legs, antennae, tails.
  const limb = (points: [number, number, number][], radius: number, material: SpecialHullMaterial = 'armor', tip = .15) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
    const steps = hero ? 16 : 6, radial = hero ? 6 : 4
    const geometry = new THREE.TubeGeometry(curve, steps, radius, radial, false)
    const position = geometry.getAttribute('position'), center = new THREE.Vector3(), vertex = new THREE.Vector3()
    for (let i = 0; i <= steps; i++) {
      curve.getPointAt(i / steps, center)
      for (let j = 0; j <= radial; j++) {
        const index = i * (radial + 1) + j
        vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(1 - (1 - tip) * i / steps).add(center)
        position.setXYZ(index, vertex.x, vertex.y, vertex.z)
      }
    }
    geometry.computeVertexNormals()
    add(geometry, material)
  }
  const light = (x: number, y: number, z: number, radius: number) => add(new THREE.IcosahedronGeometry(radius, hero ? 1 : 0), 'windows', x, y, z)
  const eyes = (x: number, y: number, z: number, radius: number) => { for (const side of [-1, 1]) light(x, y, side * z, radius) }

  if (kind === 'whale') {
    const profile: [number, number][] = [[.5, 0], [.485, .07], [.43, .115], [.3, .14], [.1, .145], [-.1, .12], [-.28, .072], [-.4, .035], [-.46, .02], [-.47, 0]]
    lathe(profile, 'hull', .9)
    blob(.17, -.065, 0, .3, .07, .11, 'accent')
    for (const side of [-1, 1]) {
      blob(.12, -.08, side * .15, .11, .012, .055, 'glass', new THREE.Euler(side * .45, side * .55, 0))
      blob(-.5, 0, side * .075, .065, .01, .085, 'glass', new THREE.Euler(0, side * -.5, 0))
    }
    blob(-.17, .115, 0, .06, .045, .01, 'glass', new THREE.Euler(0, 0, -.5))
    eyes(.33, -.01, .118, .013)
    // Bioluminescent speckles along the back, as in the wildlife art.
    for (let i = 0; i < (hero ? 48 : 12); i++) {
      const x = .4 - random() * .8, a = (random() - .5) * 2.2, r = radiusAt(profile, x)
      light(x, Math.cos(a) * r, Math.sin(a) * r * .9, .004 + random() * .004)
    }
  } else if (kind === 'jelly') {
    const profile: [number, number][] = [[.34, 0], [.32, .09], [.26, .16], [.14, .2], [.02, .19], [-.08, .14], [-.12, .07], [-.11, 0]]
    lathe(profile, 'hull')
    limb([[.33, 0, 0], [.39, 0, 0], [.43, .01, 0]], .025, 'armor', .6)
    for (let i = 0; i < (hero ? 14 : 5); i++) {
      const x = .3 - random() * .38, a = random() * Math.PI * 2, r = radiusAt(profile, x)
      add(new THREE.IcosahedronGeometry(.012 + random() * .018, 1), 'armor', x, Math.cos(a) * r, Math.sin(a) * r)
    }
    eyes(.2, .05, .17, .018)
    add(new THREE.TorusGeometry(.115, .012, 6, hero ? 32 : 12), 'windows', -.1, 0, 0, new THREE.Euler(0, Math.PI / 2, 0))
    const count = hero ? 8 : 5
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2, y = Math.cos(a) * .1, z = Math.sin(a) * .1
      limb([[-.1, y, z], [-.22, y * 1.2, z * 1.2 + .02], [-.36, y * .9, z * .9 - .02], [-.5, y * 1.1, z * 1.1]], .016, 'accent')
    }
  } else if (kind === 'lobster') {
    for (let i = 0; i < 7; i++) {
      const x = .22 - i * .1, scale = 1 - i * .09
      blob(x, 0, 0, .085, .085 * scale, .13 * scale, i % 2 ? 'hull' : 'armor')
    }
    blob(-.45, 0, 0, .05, .01, .1, 'glass')
    eyes(.31, .05, .05, .014)
    for (const side of [-1, 1]) {
      limb([[.25, 0, side * .1], [.33, 0, side * .2], [.42, 0, side * .19]], .025, 'armor', .7)
      blob(.46, .015, side * .19, .06, .022, .035, 'accent', new THREE.Euler(0, side * .2, .2))
      blob(.46, -.015, side * .19, .055, .018, .03, 'accent', new THREE.Euler(0, side * .2, -.2))
      limb([[.3, .03, side * .03], [.45, .06, side * .12], [.5, .04, side * .26]], .005, 'armor')
      for (let i = 0; i < 4; i++) limb([[.12 - i * .08, -.03, side * .1], [.12 - i * .08, -.07, side * .2], [.1 - i * .08, -.13, side * .24]], .012, 'armor', .4)
    }
  } else if (kind === 'bug') {
    blob(.32, 0, 0, .07, .06, .065, 'armor')
    blob(.17, .01, 0, .1, .075, .08)
    blob(-.17, 0, 0, .27, .09, .1, 'hull')
    eyes(.37, .02, .045, .02)
    for (const side of [-1, 1]) {
      blob(.08, .07, side * .2, .14, .006, .2, 'glass', new THREE.Euler(0, side * .5, side * .12))
      blob(-.08, .06, side * .17, .12, .006, .15, 'glass', new THREE.Euler(0, side * .9, side * .1))
      limb([[.36, .05, side * .02], [.43, .11, side * .07], [.48, .1, side * .14]], .006, 'armor', .3)
      for (let i = 0; i < 3; i++) limb([[.2 - i * .05, -.04, side * .05], [.22 - i * .1, -.06, side * .15], [.18 - i * .14, -.14, side * .19]], .01, 'dark', .4)
    }
    for (let i = 0; i < 5; i++) light(-.04 - i * .07, .085 - Math.abs(i - 2) * .006, 0, .01)
  } else if (kind === 'ray') {
    blob(.04, 0, 0, .3, .045, .42, 'hull')
    blob(.06, .03, 0, .22, .04, .1, 'armor')
    blob(.04, -.02, 0, .26, .03, .3, 'accent')
    limb([[-.22, 0, 0], [-.36, .005, 0], [-.52, .01, 0]], .014, 'armor', .2)
    light(-.52, .01, 0, .012)
    eyes(.27, .03, .07, .013)
    for (const side of [-1, 1]) {
      blob(.33, -.01, side * .06, .06, .012, .02, 'armor', new THREE.Euler(0, side * .3, 0))
      for (let i = 0; i < 6; i++) {
        const a = .25 + i * .2, edge = new THREE.Vector2(Math.cos(a) * .3, Math.sin(a) * .42)
        light(.04 + edge.x * .88 - .12, .02, side * edge.y * .88, .007)
      }
    }
  } else if (kind === 'eel') {
    const spine: [number, number, number][] = [[.42, 0, 0], [.25, .01, .02], [.05, 0, -.02], [-.15, -.01, .02], [-.35, 0, -.01], [-.52, .01, 0]]
    limb(spine, .065, 'hull', .1)
    blob(.42, 0, 0, .1, .055, .06, 'armor')
    blob(.47, -.025, 0, .05, .015, .045, 'dark')
    eyes(.46, .025, .04, .011)
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) light(.3 - i * .09, -.005, side * (.058 - i * .005), .007)
    limb([[.2, .06, 0], [-.1, .055, 0], [-.45, .02, 0]], .012, 'glass', .3)
  } else {
    // Unknown species: a segmented, spined grazer. It reads as alive without
    // claiming the anatomy of any named body plan.
    for (let i = 0; i < 9; i++) {
      const x = -.4 + i * .092, radius = Math.sin((i + 1) / 11 * Math.PI) * .145
      const geometry = new THREE.IcosahedronGeometry(radius, hero ? 1 : 0)
      geometry.scale(1.1, .76, 1)
      add(geometry, i % 3 === 0 ? 'armor' : 'hull', x, Math.sin(i * .7) * .018)
      for (const side of [-1, 1]) add(new THREE.ConeGeometry(.027, .15, 4), 'armor', x, .025, side * radius, new THREE.Euler(side * .9, 0, .5))
    }
    eyes(.36, .07, .068, .016)
  }
}
