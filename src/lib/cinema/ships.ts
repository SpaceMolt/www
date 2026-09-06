import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ShipAppearance } from './appearance'

type Ring = [x: number, halfWidth: number, halfHeight: number, centerY?: number]
type MaterialName = 'hull' | 'armor' | 'dark' | 'metal' | 'accent' | 'glass' | 'windows'

/** Object-space plating stays welded to moving hulls and needs no image download. */
function surfaceDetail(material: THREE.MeshStandardMaterial, seed: number, density: number) {
  material.customProgramCacheKey = () => 'cinema-hull-panels-v1'
  material.onBeforeCompile = shader => {
    shader.uniforms.cinemaPanelSeed = { value: (seed >>> 0) % 8192 }
    shader.uniforms.cinemaPanelDensity = { value: density }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vCinemaHullPosition;
varying vec3 vCinemaHullNormal;`)
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vCinemaHullPosition = position;
vCinemaHullNormal = normal;`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vCinemaHullPosition;
varying vec3 vCinemaHullNormal;
uniform float cinemaPanelSeed;
uniform float cinemaPanelDensity;
float cinemaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + cinemaPanelSeed) * 43758.5453); }
vec3 cinemaPlate(vec2 p) {
  vec2 uv = p * vec2(18.0, 31.0) * cinemaPanelDensity;
  float row = floor(uv.y);
  uv.x += mod(row, 2.0) * 0.43;
  uv.x *= 0.75 + floor(cinemaHash(vec2(row, 23.0)) * 3.0) * 0.35;
  vec2 cell = floor(uv), f = fract(uv);
  float h = cinemaHash(cell);
  vec2 edge = min(f, 1.0 - f);
  float d = min(edge.x, edge.y);
  float aa = clamp(max(fwidth(uv.x), fwidth(uv.y)) * 0.7, 0.005, 0.3);
  float seam = 1.0 - smoothstep(0.016 - aa, 0.016 + aa, d);
  float wear = smoothstep(0.016, 0.028 + aa, d) * (1.0 - smoothstep(0.04, 0.07 + aa, d));
  float tone = mix(0.72, 1.13, h) * (1.0 - seam * 0.68) + wear * 0.19;
  // A few access panels have inset recesses and diagonal ochre hazard marks.
  float inset = step(0.63, h) * step(0.17, f.x) * step(f.x, 0.79) * step(0.24, f.y) * step(f.y, 0.73);
  tone *= 1.0 - inset * 0.12;
  float scratch = pow(max(0.0, sin(p.x * 1811.0 + sin(p.y * 327.0) * 2.0)), 24.0);
  scratch *= 1.0 - smoothstep(0.002, 0.013, length(fwidth(p)));
  tone += scratch * 0.055;
  float stencil = step(0.86, h) * step(0.64, f.x) * step(f.x, 0.91) * step(0.17, f.y) * step(f.y, 0.79);
  stencil *= smoothstep(0.35, 0.55, fract((f.x + f.y) * 7.0));
  return vec3(tone, (h - 0.4) * 0.22 + seam * 0.23, stencil);
}`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
vec3 cinemaWeights = pow(abs(normalize(vCinemaHullNormal)), vec3(8.0));
cinemaWeights /= max(dot(cinemaWeights, vec3(1.0)), 0.0001);
vec3 cinemaSurface = cinemaPlate(vCinemaHullPosition.zy) * cinemaWeights.x
  + cinemaPlate(vCinemaHullPosition.xz) * cinemaWeights.y
  + cinemaPlate(vCinemaHullPosition.xy) * cinemaWeights.z;
diffuseColor.rgb *= cinemaSurface.x;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.27, 0.09), cinemaSurface.z * 0.62);`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + cinemaSurface.y, 0.22, 0.86);`)
  }
}

/** Faceted octagonal cross sections give the hull actual volume and chamfered edges. */
function loft(rings: Ring[]): THREE.BufferGeometry {
  const vertices: number[] = []
  for (const [x, w, h, cy = 0] of rings) {
    for (const [z, y] of [[.66, 1], [-.66, 1], [-1, .5], [-1, -.5], [-.66, -1], [.66, -1], [1, -.5], [1, .5]]) {
      vertices.push(x, cy + y * h, z * w)
    }
  }
  const indices: number[] = []
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j, b = i * 8 + (j + 1) % 8, c = a + 8, d = b + 8
      indices.push(a, c, b, b, c, d)
    }
  }
  for (let j = 1; j < 7; j++) indices.push(0, j, j + 1)
  const end = (rings.length - 1) * 8
  for (let j = 1; j < 7; j++) indices.push(end, end + j + 1, end + j)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  const flat = geometry.toNonIndexed()
  geometry.dispose()
  flat.computeVertexNormals()
  return flat
}

/**
 * +X is bow, +Y is dorsal. Every returned geometry/material belongs to this group.
 * Static details are merged by material (seven draw calls, regardless of panel count).
 * engine meshes remain separate with userData.engine=true and baseIntensity for animation.
 * Dispose unique geometry/material instances by traversing the group on teardown.
 */
export function createShip(appearance: ShipAppearance, seed: number, detail: 'hero' | 'distant' = 'hero'): THREE.Group {
  const group = new THREE.Group()
  group.name = `${appearance.empire}-${appearance.family}`
  const hero = detail === 'hero'
  const { family, empire, beam: width, height, accent } = appearance
  let rng = seed | 0
  const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) | 0; return (rng >>> 0) / 4294967296 }
  const hullColor = new THREE.Color(appearance.hull)
  const materials: Record<MaterialName, THREE.MeshStandardMaterial> = {
    hull: new THREE.MeshStandardMaterial({ color: hullColor, metalness: .72, roughness: .43 }),
    armor: new THREE.MeshStandardMaterial({ color: hullColor.clone().multiplyScalar(1.24), metalness: .63, roughness: .36 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x101923, metalness: .65, roughness: .62 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x98a1ab, metalness: .88, roughness: .3 }),
    accent: new THREE.MeshStandardMaterial({ color: accent, metalness: .35, roughness: .37, emissive: accent, emissiveIntensity: .25 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x071f31, metalness: .88, roughness: .12, emissive: accent, emissiveIntensity: .4 }),
    windows: new THREE.MeshStandardMaterial({ color: 0xd8f2ff, emissive: accent, emissiveIntensity: 3.2, toneMapped: false }),
  }
  if (hero && family !== 'creature') {
    const density = family === 'fighter' || family === 'scout' || family === 'drone' ? .75 : 1.5
    for (const key of ['hull', 'armor', 'dark', 'metal'] as const) surfaceDetail(materials[key], seed, density)
  }
  const batches = new Map<MaterialName, THREE.BufferGeometry[]>()
  const add = (geometry: THREE.BufferGeometry, material: MaterialName, x = 0, y = 0, z = 0, rotation?: THREE.Euler) => {
    if (rotation) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotation))
    geometry.translate(x, y, z)
    // All batches use the same position/normal layout, including procedural primitives.
    let flat = geometry
    if (geometry.index) { flat = geometry.toNonIndexed(); geometry.dispose() }
    for (const key of Object.keys(flat.attributes)) if (key !== 'position' && key !== 'normal') flat.deleteAttribute(key)
    const batch = batches.get(material) ?? []
    batch.push(flat)
    batches.set(material, batch)
  }
  const slab = (x: number, y: number, z: number, length: number, w: number, h: number, material: MaterialName = 'armor') => {
    const chamfer = Math.min(length * .1, .015)
    add(loft([[-length / 2, w * .43, h * .38], [-length / 2 + chamfer, w / 2, h / 2], [length / 2 - chamfer, w / 2, h / 2], [length / 2, w * .38, h * .36]]), material, x, y, z)
  }
  const rod = (x: number, y: number, z: number, radius: number, length: number, material: MaterialName = 'metal', alongX = true) => {
    add(new THREE.CylinderGeometry(radius * .8, radius, length, hero ? 8 : 5), material, x, y, z, alongX ? new THREE.Euler(0, 0, Math.PI / 2) : undefined)
  }
  const panel = (x: number, y: number, z: number, length: number, w: number, h: number) => {
    slab(x, y, z, length, w, h)
    if (hero) {
      slab(x - length * .1, y + h * .54, z, length * .62, w * .74, .0025, 'hull')
      slab(x + length * .24, y + h * .58, z, length * .055, w * .72, .003, 'metal')
    }
  }
  const engine = (x: number, y: number, z: number, radius: number) => {
    rod(x + .025, y, z, radius * 1.4, .1, 'dark')
    rod(x, y, z, radius * 1.18, .045, 'metal')
    rod(x - .02, y, z, radius, .025, 'dark')
    const glowMaterial = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false })
    const core = new THREE.Mesh(new THREE.CircleGeometry(radius * .79, hero ? 20 : 8), glowMaterial)
    core.rotation.y = -Math.PI / 2
    core.position.set(x - .034, y, z)
    core.userData.engine = true
    core.userData.baseIntensity = 1
    group.add(core)
    const plumeMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    plumeMaterial.customProgramCacheKey = () => 'cinema-engine-falloff-v1'
    plumeMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCinemaPlumeUv;')
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCinemaPlumeUv = uv;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCinemaPlumeUv;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
float engineTail = pow(1.0 - vCinemaPlumeUv.y, 2.5);
float engineFilament = 0.72 + 0.28 * sin(vCinemaPlumeUv.x * 37.699);
diffuseColor.a *= engineTail * engineFilament * 0.65;`)
    }
    const plume = new THREE.Mesh(new THREE.ConeGeometry(radius * .7, radius * 5.5, 12, 1, true), plumeMaterial)
    plume.rotation.z = Math.PI / 2
    plume.position.set(x - .035 - radius * 2.75, y, z)
    plume.userData.engine = true
    plume.userData.plume = true
    plume.userData.baseIntensity = .3
    group.add(plume)
  }
  const turret = (x: number, y: number, z: number, size: number, twin = true) => {
    rod(x, y, z, size * .48, size * .2, 'dark', false)
    slab(x, y + size * .26, z, size, size * .8, size * .45, 'hull')
    const offsets = twin ? [-.19, .19] : [0]
    for (const offset of offsets) {
      rod(x + size * .7, y + size * .31, z + size * offset, size * .06, size * 1.2)
      rod(x + size * 1.2, y + size * .31, z + size * offset, size * .077, size * .18, 'dark')
    }
  }

  if (family === 'station') {
    add(new THREE.CylinderGeometry(.12, .17, .62, 10), 'hull')
    add(new THREE.TorusGeometry(.35, .04, 6, hero ? 48 : 20), 'armor', 0, .08, 0, new THREE.Euler(Math.PI / 2, 0, 0))
    add(new THREE.TorusGeometry(.24, .022, 6, hero ? 40 : 16), 'dark', 0, -.16, 0, new THREE.Euler(Math.PI / 2, 0, 0))
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3
      slab(Math.cos(a) * .21, .08, Math.sin(a) * .21, .22, .055, .045)
      slab(Math.cos(a) * .35, .08, Math.sin(a) * .35, .16, .08, .12)
      if (hero) for (let j = 0; j < 4; j++) slab(Math.cos(a) * .35, .04 + j * .019, Math.sin(a) * .35 + .042, .085, .004, .004, 'windows')
    }
    rod(0, .36, 0, .006, .2, 'metal', false)
  } else if (family === 'creature') {
    materials.hull.roughness = .68
    materials.hull.metalness = .1
    for (let i = 0; i < 9; i++) {
      const x = -.4 + i * .092, radius = Math.sin((i + 1) / 11 * Math.PI) * .145
      const geometry = new THREE.IcosahedronGeometry(radius, hero ? 1 : 0)
      geometry.scale(1.1, .76, 1)
      add(geometry, i % 3 === 0 ? 'armor' : 'hull', x, Math.sin(i * .7) * .018)
      for (const side of [-1, 1]) add(new THREE.ConeGeometry(.027, .15, 4), 'armor', x, .025, side * radius, new THREE.Euler(side * .9, 0, .5))
    }
    for (const side of [-1, 1]) add(new THREE.IcosahedronGeometry(.016, 1), 'windows', .36, .07, side * .068)
  } else {
    const small = family === 'fighter' || family === 'scout' || family === 'drone'
    const alien = empire === 'voidborn'
    const broad = empire === 'crimson'
    const h = height / 2, w = width / 2
    const nose = small ? .51 : .49
    add(loft([
      [-.49, w * .57, h * .55], [-.38, w * .9, h * .82],
      [-.18, w, h], [.14, w * (broad ? .95 : .77), h * .85],
      [.36, w * (broad ? .77 : .43), h * .68], [nose, w * (broad ? .4 : .08), h * .26],
    ]), 'hull')
    // Exposed keel, long machine recesses, and separate upper armor silhouette.
    add(loft([[-.44, w * .4, h * .25], [.2, w * .37, h * .2], [.45, .008, h * .1]]), 'dark', 0, -h * .95)
    add(loft([[-.31, w * .7, h * .45], [-.03, w * .65, h * .55], [.35, w * .32, h * .2], [.43, .01, .006]]), 'armor', 0, h * .66)

    if (small) {
      for (const side of [-1, 1]) {
        const spread = family === 'drone' ? 1.1 : .88
        add(loft([[-.4, .05, .035], [-.29, .13, .025], [.06, .13 * spread, .016], [.29, .004, .006]]), 'armor', -.02, -.02, side * w * .65, new THREE.Euler(0, side * -.32, side * -.08))
        rod(.11, -.015, side * w * .97, .012, .34, 'dark')
        rod(.29, -.015, side * w * .97, .008, .07, 'metal')
        // Armored nacelles stand apart from the wing, giving a mechanical profile.
        add(loft([[-.41, .035, .033], [-.31, .046, .045], [-.10, .036, .033], [.025, .009, .012]]), 'hull', 0, .008, side * w * .57)
        add(loft([[-.34, .027, .02], [-.14, .025, .019], [-.055, .005, .006]]), 'armor', 0, .048, side * w * .57)
        engine(-.41, -.01, side * w * .55, .035)
        if (hero) {
          panel(-.1, .006, side * w * .99, .14, .05, .043)
          rod(.12, -.005, side * w * .98, .017, .15, 'hull')
          for (let i = 0; i < 7; i++) {
            const x = -.30 + i * .023
            slab(x, .073, side * w * .57, .009, .051, .005, 'dark')
            slab(x + .005, .075, side * w * .57, .004, .048, .004, 'metal')
          }
          for (let i = 0; i < 4; i++) {
            panel(-.25 + i * .07, .008, side * w * .81, .052, .039, .008)
            slab(-.22 + i * .07, .014, side * w * .81, .004, .035, .003, 'dark')
          }
          rod(.345, -.02, side * w * .97, .0055, .06, 'dark')
          rod(.373, -.02, side * w * .97, .007, .01, 'metal')
          slab(-.36, .014, side * w * .82, .019, .015, .007, 'windows')
          // Dorsal fins and exposed hydraulic lines add readable vertical structure.
          add(loft([[-.37, .004, .016], [-.26, .006, .078], [-.11, .004, .012]]), 'armor', 0, .055, side * w * .59)
          rod(-.2, .03, side * w * .74, .004, .22, 'metal')
        }
      }
      // Canopy frame is larger than the inset glazing and remains visible in backlight.
      add(loft([[-.10, .049, .019], [.026, .056, .04], [.235, .023, .019], [.28, .005, .005]]), 'dark', 0, h + .015)
      add(loft([[-.08, .045, .018], [.03, .05, .036], [.22, .019, .016], [.26, .003, .004]]), 'glass', 0, h + .018)
      if (hero) {
        for (let i = 0; i < 5; i++) slab(-.29 + i * .026, h * 1.12, 0, .012, .07, .006, 'dark')
        for (const x of [-.045, .09]) slab(x, h + .048, 0, .009, .075, .006, 'metal')
        slab(.083, h + .054, 0, .20, .007, .005, 'hull')
        panel(.325, h * .72, 0, .105, .052, .018)
        slab(.38, h * .88, 0, .05, .016, .004, 'accent')
        for (const side of [-1, 1]) {
          for (let i = 0; i < 5; i++) slab(.17 + i * .035, h * .64, side * .041, .018, .009, .008, 'dark')
          rod(.30, -h * .55, side * .048, .006, .10, 'metal')
        }
      }
    } else if (family === 'industrial') {
      // Repeated pressure vessels and cargo cradles make industrial roles legible.
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
        const x = -.31 + i * .18
        slab(x, 0, side * w * .81, .15, w * .76, h * 1.8, i % 2 ? 'hull' : 'armor')
        for (const rib of [-1, 1]) slab(x + rib * .05, .005, side * w * .82, .018, w * .8, h * 1.88, 'dark')
        if (hero) slab(x, h * .98, side * w * .82, .09, .012, .005, 'accent')
      }
      slab(.35, h * .65, 0, .19, w, h, 'armor')
      slab(.38, h * 1.16, 0, .08, w * .8, .008, 'glass')
      engine(-.49, -.02, -w * .6, .049)
      engine(-.49, -.02, w * .6, .049)
    } else if (family === 'carrier') {
      // Open, luminous flight corridor between two armored outriggers.
      slab(0, h * .1, 0, .82, w * .85, .015, 'dark')
      for (const side of [-1, 1]) {
        add(loft([[-.49, w * .27, h * .68], [-.35, w * .34, h], [.25, w * .3, h * .7], [.44, w * .13, h * .5]]), 'armor', 0, h * .25, side * w * .86)
        slab(-.04, h * .2, side * w * .45, .71, .007, .006, 'windows')
        engine(-.49, 0, side * w * .88, .053)
        for (let i = 0; i < (hero ? 7 : 3); i++) slab(-.33 + i * .09, h * .2, side * w * .26, .028, .007, .003, 'windows')
      }
    } else if (family === 'support') {
      for (const side of [-1, 1]) {
        rod(-.03, -.02, side * w * .8, .063, .61, 'armor')
        for (let i = 0; i < 5; i++) rod(-.27 + i * .11, -.02, side * w * .8, .066, .014, 'dark')
        engine(-.4, -.02, side * w * .8, .041)
      }
      add(new THREE.SphereGeometry(.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', -.07, h * 1.8)
      rod(-.07, h * 1.3, 0, .008, .19, 'metal', false)
    } else {
      // Main armored battle hull: separated side casemates and broadside machinery.
      const count = hero ? 5 : 3
      for (const side of [-1, 1]) {
        slab(-.035, -.002, side * w * .88, .77, .038, h * .95, 'dark')
        for (let i = 0; i < count; i++) {
          const x = -.32 + i * .66 / count
          panel(x, h * .17, side * w * .87, .54 / count, .057, h * 1.45)
          if (hero) {
            for (let j = 0; j < 3; j++) rod(x, -.018 + j * .019, side * (w + .005), .005, .057, 'metal')
            slab(x, h * 1.05, side * w * .47, .067, .039, .027, i % 2 ? 'hull' : 'armor')
          }
        }
        engine(-.49, -.007, side * w * .55, family === 'capital' ? .055 : .043)
      }
      engine(-.48, h * .14, 0, family === 'capital' ? .055 : .037)
      const guns = family === 'capital' ? 4 : 3
      for (let i = 0; i < guns; i++) turret(.27 - i * .17, h * 1.15, 0, family === 'capital' ? .075 : .06)
      if (hero) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) turret(-.18 + i * .17, h * .83, side * w * .72, .04, false)
    }

    if (!small) {
      // Naval bridge rises aft of the weapon line, with a luminous inset wraparound.
      slab(-.23, h * 1.45, 0, .16, w * .7, h * .8, 'hull')
      slab(-.245, h * 1.97, 0, .12, w * .61, h * .3, 'dark')
      slab(-.235, h * 2.16, 0, .15, w * .87, .023, 'armor')
      slab(-.171, h * 1.99, 0, .006, w * .56, .012, 'glass')
      if (hero) {
        for (const side of [-1, 1]) {
          for (let i = 0; i < 8; i++) slab(-.295 + i * .014, h * 1.99, side * w * .315, .006, .004, .005, 'windows')
          rod(-.25, h * 2.45, side * .035, .002, .1, 'metal', false)
          for (let i = 0; i < 12; i++) slab(-.35 + i * .058, -h * .14, side * w * .93, .011, .003, .004, 'windows')
        }
        rod(-.22, h * 2.8, 0, .002, .12, 'metal', false)
        slab(-.22, h * 3.1, 0, .035, .065, .012, 'dark')
      }
    }

    // Empire construction language changes silhouette, not just paint.
    if (alien) {
      for (const side of [-1, 1]) {
        add(loft([[-.48, .008, .015], [-.21, .034, .05], [.16, .027, .024], [.47, .002, .002]]), 'armor', -.02, h * .55, side * w * 1.04, new THREE.Euler(0, side * .12, side * .15))
        add(loft([[-.4, .008, .005], [-.12, .013, .009], [.39, .002, .002]]), 'windows', 0, h * .63, side * w * 1.1)
      }
      add(new THREE.OctahedronGeometry(.06), 'glass', -.14, h * 1.6)
    } else if (empire === 'solarian') {
      for (const side of [-1, 1]) slab(.13, h * 1.15, side * w * .43, .43, .012, .004, 'accent')
      slab(.31, h * .7, 0, .07, w * .8, .008, 'metal')
    } else if (broad) {
      slab(.37, .005, 0, .19, w * 1.4, h * 1.3, 'armor')
      for (const side of [-1, 1]) slab(.4, h * .7, side * w * .4, .13, .02, .006, 'accent')
    } else if (empire === 'nebula') {
      for (const side of [-1, 1]) add(loft([[-.43, .02, .02], [-.21, .035, .038], [.22, .025, .021], [.38, .003, .003]]), 'metal', 0, h * .6, side * w * .8)
    } else if (empire === 'outerrim') {
      slab(-.09, h * .4, w * 1.08, .29, .068, .06, 'hull')
      rod(-.1, h * .87, w * 1.07, .009, .26, 'metal')
      if (hero) for (let i = 0; i < 4; i++) slab(-.19 + i * .055, h * .93, w * 1.07, .017, .07, .005, 'accent')
    }
    if (hero) {
      // Seeded small-scale topology supplies parallax in close passes.
      for (let i = 0; i < (small ? 8 : 38); i++) {
        const x = -.38 + random() * .54, z = (random() - .5) * width * .5
        slab(x, h * 1.02, z, .012 + random() * .028, .008 + random() * .016, .004 + random() * .01, i % 3 === 0 ? 'dark' : 'hull')
      }
    }
  }

  for (const [key, geometries] of batches) {
    const merged = mergeGeometries(geometries, false)
    for (const geometry of geometries) geometry.dispose()
    if (merged) {
      const mesh = new THREE.Mesh(merged, materials[key])
      mesh.name = key
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }
  }
  // Families may not use every palette entry; dispose those immediately.
  for (const key of Object.keys(materials) as MaterialName[]) if (!batches.has(key)) materials[key].dispose()
  return group
}
