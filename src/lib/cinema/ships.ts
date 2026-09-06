import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ShipAppearance } from './appearance'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { buildEmpireHull } from './ship-empires'
import { buildSpecialHull } from './ship-recipes'
import { buildFittedHardware } from './ship-hardware'
import type { CinemaHardware } from './hardware'
import { createWeaponRig, tagWeaponGeometry, applyWeaponRig, createWeaponShadowMaterials } from './ship-weapons'
import { addRetrothrusters } from './ship-thrusters'

type Ring = [x: number, halfWidth: number, halfHeight: number, centerY?: number]
type MaterialName = 'hull' | 'armor' | 'dark' | 'metal' | 'accent' | 'glass' | 'windows'

/** Object-space plating stays welded to moving hulls and needs no image download. */
function surfaceDetail(material: THREE.MeshStandardMaterial, seed: number, density: number) {
  material.customProgramCacheKey = () => 'cinema-hull-machining-v4'
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
float cinemaStroke(float distanceToLine, float halfWidth, float footprint) {
  return clamp((halfWidth - distanceToLine) / max(footprint, 0.0001) + 0.5, 0.0, 1.0);
}
// This height field deliberately contains NO screen derivatives. Sampling it
// at first-order position offsets avoids undefined higher-order derivatives.
float cinemaRelief(vec2 p) {
  vec2 baseUv = p * vec2(12.0, 29.0) * cinemaPanelDensity;
  vec2 uv = baseUv + vec2(mod(floor(baseUv.y), 2.0) * 0.5, 0.0);
  vec2 f = fract(uv);
  vec2 edge = min(f, 1.0 - f);
  float plate = smoothstep(0.006, 0.043, min(edge.x, edge.y));
  vec2 hatchQ = abs(f - vec2(0.48, 0.50)) - vec2(0.25, 0.20);
  float hatchDistance = length(max(hatchQ, vec2(0.0))) + min(max(hatchQ.x, hatchQ.y), 0.0);
  float hasHatch = step(0.77, cinemaHash(floor(uv)));
  float hatch = (1.0 - smoothstep(-0.014, 0.014, hatchDistance)) * hasHatch;
  float hatchRim = (1.0 - smoothstep(0.002, 0.016, abs(hatchDistance))) * hasHatch;
  float boltDistance = length(abs(f - 0.5) - vec2(0.405, 0.36));
  float bolt = 1.0 - smoothstep(0.006, 0.023, boltDistance);
  return plate * 0.00023 - hatch * 0.00008 - hatchRim * 0.000035 - bolt * 0.00006;
}
float cinemaReliefField(vec3 p, vec3 weights) {
  return cinemaRelief(p.zy) * weights.x + cinemaRelief(p.xz) * weights.y + cinemaRelief(p.xy) * weights.z;
}
vec3 cinemaPlate(vec2 p) {
  vec2 baseUv = p * vec2(12.0, 29.0) * cinemaPanelDensity;
  // Derivatives MUST precede the stagger/floor/fract. Differentiating discontinuous
  // cell coordinates turns every row boundary into a broad blurry patch.
  vec2 footprint = max(fwidth(baseUv), vec2(0.0001));
  float pixel = max(footprint.x, footprint.y);
  float resolved = 1.0 - smoothstep(0.16, 0.48, pixel);
  vec2 uv = baseUv + vec2(mod(floor(baseUv.y), 2.0) * 0.5, 0.0);
  vec2 cell = floor(uv), f = fract(uv);
  float identity = cinemaHash(cell);
  vec2 edge = min(f, 1.0 - f);
  float seam = max(cinemaStroke(edge.x, 0.010, footprint.x), cinemaStroke(edge.y, 0.010, footprint.y)) * resolved;
  // Four recessed fasteners, and occasional inspection hatches; these are small
  // physical features, not large random panels painted in contrasting colors.
  float boltDistance = length(abs(f - 0.5) - vec2(0.405, 0.36));
  float bolts = cinemaStroke(boltDistance, 0.017, pixel) * resolved;
  vec2 hatchQ = abs(f - vec2(0.48, 0.50)) - vec2(0.25, 0.20);
  float hatchDistance = length(max(hatchQ, vec2(0.0))) + min(max(hatchQ.x, hatchQ.y), 0.0);
  float hasHatch = step(0.77, identity) * resolved;
  float hatchRim = cinemaStroke(abs(hatchDistance), 0.008, pixel) * hasHatch;
  // Brushed metal modulates roughness, with very little albedo noise. Frequency
  // attenuation removes subpixel grain instead of smearing it across the hull.
  float brushPhase = p.y * 2150.0 + sin(p.x * 41.0) * 0.6;
  float brushFootprint = abs(dFdx(p.y) * 2150.0) + abs(dFdy(p.y) * 2150.0);
  float brushed = sin(brushPhase) * exp2(-brushFootprint * brushFootprint * 0.5);
  float tone = (0.965 + identity * 0.055) * (1.0 - seam * 0.47 - bolts * 0.25 - hatchRim * 0.27);
  tone += brushed * 0.004;
  float markingArea = step(0.90, identity) * smoothstep(0.61, 0.64, f.x) * (1.0 - smoothstep(0.86, 0.89, f.x))
    * smoothstep(0.21, 0.24, f.y) * (1.0 - smoothstep(0.76, 0.79, f.y));
  float stripeDistance = abs(fract((f.x + f.y) * 5.0) - 0.5);
  float stencil = cinemaStroke(stripeDistance, 0.19, (footprint.x + footprint.y) * 5.0) * markingArea * resolved;
  float roughnessChange = (identity - 0.5) * 0.045 + seam * 0.11 + brushed * 0.024;
  return vec3(tone, roughnessChange, stencil);
}`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
// Normalizing before this power is unnecessary: that scale cancels when the
// weights are normalized. Avoid normalize(0) on degenerate/helper invocations.
vec3 cinemaWeights = pow(clamp(abs(vCinemaHullNormal), vec3(0.0), vec3(1.0)), vec3(8.0));
cinemaWeights.y += 1e-8;
cinemaWeights /= max(dot(cinemaWeights, vec3(1.0)), 1e-8);
vec3 cinemaSurface = cinemaPlate(vCinemaHullPosition.zy) * cinemaWeights.x
  + cinemaPlate(vCinemaHullPosition.xz) * cinemaWeights.y
  + cinemaPlate(vCinemaHullPosition.xy) * cinemaWeights.z;
diffuseColor.rgb *= cinemaSurface.x;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.27, 0.09), cinemaSurface.z * 0.62);`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + cinemaSurface.y, 0.22, 0.86);`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Surface-gradient bump mapping using derivative-free finite height differences.
// Per-object distances preserve equal bevel slopes at every ship scale. Detail
// filtering is applied AFTER sampling, never differentiated a second time.
vec3 cinemaViewDx = dFdx(-vViewPosition);
vec3 cinemaViewDy = dFdy(-vViewPosition);
vec3 cinemaLocalDx = dFdx(vCinemaHullPosition);
vec3 cinemaLocalDy = dFdy(vCinemaHullPosition);
cinemaViewDx *= inversesqrt(max(dot(cinemaViewDx, cinemaViewDx), 1e-14));
cinemaViewDy *= inversesqrt(max(dot(cinemaViewDy, cinemaViewDy), 1e-14));
vec3 cinemaR1 = cross(cinemaViewDy, normal);
vec3 cinemaR2 = cross(normal, cinemaViewDx);
float cinemaDet = dot(cinemaViewDx, cinemaR1) * faceDirection;
float cinemaBaseHeight = cinemaReliefField(vCinemaHullPosition, cinemaWeights);
vec2 cinemaHeightGradient = vec2(
  (cinemaReliefField(vCinemaHullPosition + cinemaLocalDx, cinemaWeights) - cinemaBaseHeight) / max(length(cinemaLocalDx), 1e-7),
  (cinemaReliefField(vCinemaHullPosition + cinemaLocalDy, cinemaWeights) - cinemaBaseHeight) / max(length(cinemaLocalDy), 1e-7));
vec3 cinemaFootprint = abs(cinemaLocalDx) + abs(cinemaLocalDy);
float cinemaDetailFootprint = max(cinemaFootprint.x * 12.0, max(cinemaFootprint.y, cinemaFootprint.z) * 29.0) * cinemaPanelDensity;
cinemaHeightGradient *= 1.0 - smoothstep(0.16, 0.48, cinemaDetailFootprint);
cinemaHeightGradient = clamp(cinemaHeightGradient, vec2(-0.6), vec2(0.6));
vec3 cinemaGradient = sign(cinemaDet) * (cinemaHeightGradient.x * cinemaR1 + cinemaHeightGradient.y * cinemaR2);
cinemaGradient *= min(1.0, abs(cinemaDet) * 0.7 / max(length(cinemaGradient), 1e-7));
vec3 cinemaBumpedNormal = abs(cinemaDet) * normal - cinemaGradient;
if (abs(cinemaDet) > 1e-5) normal = cinemaBumpedNormal * inversesqrt(max(dot(cinemaBumpedNormal, cinemaBumpedNormal), 1e-14));`)
  }
}

/** Grown quartz has flowing internal veins rather than machined metal paneling. */
function crystalDetail(material: THREE.MeshStandardMaterial) {
  material.customProgramCacheKey = () => 'cinema-grown-crystal-v2'
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCinemaCrystal;')
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCinemaCrystal=position;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCinemaCrystal;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
float crystalWave = vCinemaCrystal.z * 70.0 + sin(vCinemaCrystal.x * 15.0) * 3.0 + vCinemaCrystal.y * 55.0;
float crystalVein = pow(clamp(0.5 + 0.5 * sin(crystalWave), 0.0, 1.0), 26.0);
float crystalDepth = 0.78 + 0.22 * sin(vCinemaCrystal.x * 44.0 + vCinemaCrystal.y * 29.0);
diffuseColor.rgb *= crystalDepth;
diffuseColor.rgb += vec3(0.025, 0.12, 0.18) * crystalVein;`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.025, 0.27, 0.42) * crystalVein * min(1.0, length(emissive) * 20.0);`)
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
export function createShip(appearance: ShipAppearance, seed: number, detail: 'hero' | 'distant' = 'hero', hardware?: CinemaHardware): THREE.Group {
  const group = new THREE.Group()
  group.name = `${appearance.empire}-${appearance.family}`
  const hero = detail === 'hero'
  const { family, beam: width, height, accent } = appearance
  const empire = appearance.hullEmpire ?? appearance.empire
  const pirate = appearance.empire === 'pirate'
  let rng = seed | 0
  const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) | 0; return (rng >>> 0) / 4294967296 }
  const hullColor = new THREE.Color(appearance.hull)
  const materialIdentity = {
    solarian: { structure: 0x465769, armor: 0x63768a, metal: 0x91a0aa, livery: 0xbda779, roughness: .42 },
    voidborn: { structure: 0x121026, armor: 0x502878, metal: 0x7262a1, livery: 0x684194, roughness: .19 },
    crimson: { structure: 0x343236, armor: 0x813d3e, metal: 0x646268, livery: 0x401f24, roughness: .62 },
    nebula: { structure: 0x655635, armor: 0xc2ab70, metal: 0x9c844f, livery: 0x294c3a, roughness: .31 },
    outerrim: { structure: 0x6d6252, armor: 0xc4a878, metal: 0xa0562e, livery: 0x2fb6c4, roughness: .75 },
    pirate: { structure: 0x25282b, armor: 0x633c31, metal: 0xb06a35, livery: 0xa12620, roughness: .78 },
    neutral: { structure: appearance.hull, armor: hullColor.clone().multiplyScalar(1.24).getHex(), metal: 0x98a1ab, livery: accent, roughness: .43 },
  }[empire]
  if (appearance.recipe === 'comet') { materialIdentity.structure=0xc6c8b8; materialIdentity.armor=0xe0ddc7; materialIdentity.metal=0xbca363 }
  if (appearance.recipe === 'midas') { materialIdentity.structure=0x7b6539; materialIdentity.armor=0xc5ac70; materialIdentity.metal=0xd0b77b }
  const materials: Record<MaterialName, THREE.MeshStandardMaterial> = {
    hull: new THREE.MeshStandardMaterial({ color: materialIdentity.structure, metalness: .62, roughness: materialIdentity.roughness }),
    armor: new THREE.MeshStandardMaterial({ color: materialIdentity.armor, metalness: empire === 'outerrim' ? .3 : .58, roughness: materialIdentity.roughness }),
    dark: new THREE.MeshStandardMaterial({ color: 0x101923, metalness: .65, roughness: .62 }),
    metal: new THREE.MeshStandardMaterial({ color: materialIdentity.metal, metalness: .82, roughness: materialIdentity.roughness }),
    accent: new THREE.MeshStandardMaterial({ color: materialIdentity.livery, metalness: .4, roughness: materialIdentity.roughness }),
    glass: new THREE.MeshStandardMaterial({ color: 0x071f31, metalness: .88, roughness: .12, emissive: accent, emissiveIntensity: .4 }),
    windows: new THREE.MeshStandardMaterial({ color: 0xd8f2ff, emissive: accent, emissiveIntensity: 3.2, toneMapped: false }),
  }
  if (pirate) {
    for (const key of ['hull','armor'] as const) {
      materials[key].color.lerp(new THREE.Color(0x53483e), .22)
      materials[key].roughness = .76
    }
    materials.metal.color.setHex(0x87664b)
  }
  if (empire === 'voidborn' && family !== 'creature') {
    for (const key of ['hull', 'armor'] as const) {
      materials[key].emissive.setHex(0x3fe6ff)
      materials[key].emissiveIntensity = .025
    }
    for (const key of ['hull', 'armor', 'glass'] as const) crystalDetail(materials[key])
  } else if (hero && family !== 'creature') {
    const density = family === 'fighter' || family === 'scout' || family === 'drone' ? .75 : 1.5
    for (const key of ['hull', 'armor', 'dark', 'metal'] as const) surfaceDetail(materials[key], seed, density)
  }
  const rig=createWeaponRig()
  group.userData.weaponRig=rig
  let weaponIndex=-1
  const batches = new Map<MaterialName, THREE.BufferGeometry[]>()
  const add = (geometry: THREE.BufferGeometry, material: MaterialName, x = 0, y = 0, z = 0, rotation?: THREE.Euler) => {
    if (rotation) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotation))
    geometry.translate(x, y, z)
    // All batches use the same position/normal layout, including procedural primitives.
    let flat = geometry
    if (geometry.index) { flat = geometry.toNonIndexed(); geometry.dispose() }
    for (const key of Object.keys(flat.attributes)) if (key !== 'position' && key !== 'normal') flat.deleteAttribute(key)
    tagWeaponGeometry(flat,weaponIndex,weaponIndex>=0?rig.mounts[weaponIndex].pivot:undefined)
    const batch = batches.get(material) ?? []
    batch.push(flat)
    batches.set(material, batch)
  }
  const slab = (x: number, y: number, z: number, length: number, w: number, h: number, material: MaterialName = 'armor') => {
    const chamfer = Math.min(length * .1, .015)
    add(loft([[-length / 2, w * .43, h * .38], [-length / 2 + chamfer, w / 2, h / 2], [length / 2 - chamfer, w / 2, h / 2], [length / 2, w * .38, h * .36]]), material, x, y, z)
  }
  const rounded = (x: number, y: number, z: number, length: number, w: number, h: number, material: MaterialName = 'armor') => {
    add(new RoundedBoxGeometry(length, h, w, hero ? 3 : 1, Math.min(length, w, h) * .24), material, x, y, z)
  }
  const rod = (x: number, y: number, z: number, radius: number, length: number, material: MaterialName = 'metal', alongX = true) => {
    add(new THREE.CylinderGeometry(radius * .8, radius, length, hero ? 8 : 5), material, x, y, z, alongX ? new THREE.Euler(0, 0, Math.PI / 2) : undefined)
  }
  const panel = (x: number, y: number, z: number, length: number, w: number, h: number) => {
    slab(x, y, z, length, w, h)
    if (hero) {
      slab(x - length * .1, y + h * .54, z, length * .62, w * .74, .0025, 'hull')
      slab(x + length * .24, y + h * .58, z, length * .055, w * .72, .003, 'metal')
      // Actual chamfered fasteners catch moving specular light on close passes;
      // they share the metal batch rather than becoming separate draw calls.
      const radius = Math.min(length, w) * .043
      for (const fore of [-1, 1]) for (const side of [-1, 1]) {
        rod(x + fore * length * .34, y + h * .58, z + side * w * .29, radius, .0028, 'metal', false)
      }
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
    plumeMaterial.customProgramCacheKey = () => 'cinema-engine-falloff-v2'
    plumeMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCinemaPlumeUv;')
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCinemaPlumeUv = uv;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCinemaPlumeUv;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
// MSAA fragment centers may lie outside a covered triangle and extrapolate UVs
// beyond the cone tip. Negative fractional powers produce NaN, poisoning bloom.
float engineTail = pow(clamp(1.0 - vCinemaPlumeUv.y, 0.0, 1.0), 2.5);
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
    const context = { add, slab, rounded, rod, engine, hero, h, w }
    const bespoke = buildSpecialHull(appearance.recipe, context) || buildEmpireHull(appearance, context)
    if (!bespoke) {
    const nose = small ? .51 : .49
    add(loft([
      [-.49, w * .57, h * .55], [-.38, w * .9, h * .82],
      [-.18, w, h], [.14, w * (broad ? .95 : .77), h * .85],
      [.36, w * (broad ? .77 : .43), h * .68], [nose, w * (broad ? .4 : .08), h * .26],
    ]), 'hull')
    // Exposed keel, long machine recesses, and separate upper armor silhouette.
    add(loft([[-.44, w * .4, h * .25], [.2, w * .37, h * .2], [.45, .008, h * .1]]), 'dark', 0, -h * .95)
    add(loft([[-.31, w * .7, h * .45], [-.03, w * .65, h * .55], [.35, w * .32, h * .2], [.43, .01, .006]]), 'armor', 0, h * .66)

    if (alien) {
      // A grown body replaces the naval assembly language, while the family
      // determines whether it carries swollen holds, flight bays or sharp fins.
      const swollen = family === 'industrial' || family === 'carrier'
      const body = new THREE.SphereGeometry(1, hero ? 24 : 12, hero ? 14 : 8)
      body.scale(.43, h * (swollen ? 1.15 : .9), w * (swollen ? 1.08 : .72))
      add(body, 'armor', -.04, h * .42)
      for (const side of [-1, 1]) {
        const finReach = small ? 1.25 : 1.1
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-.45, h * .1, side * w * .52),
          new THREE.Vector3(-.27, h * 1.2, side * w * finReach),
          new THREE.Vector3(.08, h * .75, side * w * 1.48),
          new THREE.Vector3(.46, h * .14, side * w * .5),
        ])
        add(new THREE.TubeGeometry(curve, hero ? 24 : 12, small ? .027 : .04, 5, false), 'armor')
        const vein = new THREE.CatmullRomCurve3(curve.points.map(point => point.clone().add(new THREE.Vector3(0, .026, 0))))
        add(new THREE.TubeGeometry(vein, hero ? 24 : 12, small ? .003 : .005, 4, false), 'windows')
        // Swept crystal sails interrupt the profile well beyond hull plating.
        add(loft([[-.32, .005, .01], [-.18, .035, h * 1.1], [.12, .018, h * .5], [.43, .002, .002]]), 'glass', 0, h * .7, side * w * .65, new THREE.Euler(side * .5, side * -.23, 0))
        engine(-.47, -.015, side * w * .48, small ? .03 : .045)
        if (swollen) {
          const pod = new THREE.SphereGeometry(1, hero ? 16 : 8, 10)
          pod.scale(.29, h * .66, w * .34)
          add(pod, 'glass', -.05, -h * .4, side * w * .78)
        }
        if (family === 'carrier') slab(.025, -h * .32, side * w * .91, .4, .022, .026, 'dark')
        if (!small && !swollen) for (let i = 0; i < 3; i++) {
          add(loft([[-.06, .017, .02], [.04, .018, .024], [.13, .001, .002]]), 'glass', -.21 + i * .19, h * 1.18, side * w * .48)
        }
      }
      add(new THREE.OctahedronGeometry(small ? .043 : .068), 'glass', -.12, h * 1.6)
      if (family === 'support') add(new THREE.TorusGeometry(w * .86, .012, 5, hero ? 36 : 16), 'windows', -.07, h * 1.12, 0, new THREE.Euler(Math.PI / 2, 0, .2))
    } else if (small) {
      for (const side of [-1, 1]) {
        const spread = family === 'drone' ? 1.1 : .88
        add(loft([[-.4, .05, .035], [-.29, .13, .025], [.06, .13 * spread, .016], [.29, .004, .006]]), 'armor', -.02, -.02, side * w * .65, new THREE.Euler(0, side * -.32, side * -.08))
        // Armored nacelles stand apart from the wing, giving a mechanical profile.
        add(loft([[-.41, .035, .033], [-.31, .046, .045], [-.10, .036, .033], [.025, .009, .012]]), 'hull', 0, .008, side * w * .57)
        add(loft([[-.34, .027, .02], [-.14, .025, .019], [-.055, .005, .006]]), 'armor', 0, .048, side * w * .57)
        engine(-.41, -.01, side * w * .55, .035)
        if (hero) {
          panel(-.1, .006, side * w * .99, .14, .05, .043)
          for (let i = 0; i < 7; i++) {
            const x = -.30 + i * .023
            slab(x, .073, side * w * .57, .009, .051, .005, 'dark')
            slab(x + .005, .075, side * w * .57, .004, .048, .004, 'metal')
          }
          for (let i = 0; i < 4; i++) {
            panel(-.25 + i * .07, .008, side * w * .81, .052, .039, .008)
            slab(-.22 + i * .07, .014, side * w * .81, .004, .035, .003, 'dark')
          }
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

    }

    if (!small && !alien) {
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
    if (empire === 'outerrim') {
      // An oversized offset powerplant and exposed spine break the fleet symmetry.
      rod(-.20, -.01, w * 1.06, small ? .052 : .075, .53, 'hull')
      engine(-.47, -.01, w * 1.06, small ? .047 : .065)
      for (let i = 0; i < 4; i++) {
        const x = -.36 + i * .12
        rod(x, -.01, w * 1.06, small ? .055 : .079, .024, 'metal')
        slab(x, h * 1.03, -w * .45, .092, w * .50, .016, i % 2 ? 'armor' : 'metal')
      }
      slab(.04, h * .97, w * .15, .44, .035, .014, 'accent')
      slab(-.22, h * .6, -w * 1.07, .19, .042, .043, 'metal')
      rod(-.22, h * 1.35, -w * 1.07, .003, .14, 'metal', false)
      if (hero) for (let i = 0; i < 4; i++) rod(-.25 + i * .045, .043, w * .80, .004, .16, 'dark')
    } else if (empire === 'pirate') {
      // Stolen frames, blackened salvage armor and irregular red/ochre repair
      // plates. This is heavier and more jagged than the Rim's lean fast craft.
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const x = -.32 + i * .18 + (side > 0 ? .035 : 0)
          const lean = (i % 2 ? .13 : -.16) * side
          add(loft([[-.09, .025, .024], [-.065, w * .27, h * .52], [.055, w * .23, h * .40], [.12, .007, .006]]),
            (i + (side > 0 ? 1 : 0)) % 3 === 0 ? 'metal' : 'armor', x, h * .4, side * w * .84, new THREE.Euler(lean, side * .09, -.08))
          slab(x - .02, h * 1.0, side * w * .6, .09, .033, .012, i % 2 ? 'accent' : 'dark')
          if (hero) for (const offset of [-1, 1]) rod(x + offset * .035, h * 1.10, side * w * .61, .006, .009, 'metal', false)
        }
      }
      // The salvaged dorsal mast and one overplated prow give an asymmetric
      // profile even when the viewer cannot resolve rivets or painted panels.
      add(loft([[-.11, .01, .024], [-.03, .025, h * 1.12], [.07, .008, h * .24]]), 'dark', -.25, h * 1.10, -w * .35, new THREE.Euler(.17, 0, -.15))
      slab(.34, h * .85, w * .28, .22, w * .59, .023, 'accent')
      slab(.20, h * .84, -w * .38, .13, w * .41, .02, 'metal')
      rod(-.28, -h * .3, w * 1.10, .023, .34, 'dark')
      rod(-.31, -h * .3, w * 1.10, .026, .06, 'metal')
    }
    } // default empire / role assembly
    // Seat mounts on the actual hull surface, including named exceptions and grown hulls.
    const surfaces = [...batches.entries()].filter(([key])=>['hull','armor','dark','metal'].includes(key)).flatMap(([,pieces])=>pieces)
    const deckAt = (x:number,z:number) => {
      let top = -Infinity
      for(const geometry of surfaces) {
        const p=geometry.getAttribute('position')
        for(let i=0;i<p.count;i+=3) {
          const ax=p.getX(i),az=p.getZ(i),bx=p.getX(i+1),bz=p.getZ(i+1),cx=p.getX(i+2),cz=p.getZ(i+2)
          const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz)
          if(Math.abs(det)<1e-10) continue
          const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det
          const v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det
          if(u>=-1e-5 && v>=-1e-5 && u+v<=1.00001) top=Math.max(top,u*p.getY(i)+v*p.getY(i+1)+(1-u-v)*p.getY(i+2))
        }
      }
      return top
    }
    buildFittedHardware(hardware, family, { ...context, deckAt, appearance,
      beginWeapon: (family,pivot,muzzle) => {
        weaponIndex=rig.mounts.length
        rig.mounts.push({family,pivot,muzzle,rotation:new THREE.Quaternion()})
      },
      endWeapon: () => { weaponIndex=-1 },
    })
    if (pirate || empire === 'outerrim') {
      // A limited palette of donor plates gives readable repairs without extra draw calls.
      const colors: MaterialName[] = ['armor','metal','hull','accent','dark']
      for (let i=0; i<(hero?18:5); i++) {
        const x=-.35+random()*.65, side=i%2?1:-1
        const z=side*w*(.33+random()*.4), deck=deckAt(x,z)
        if(Number.isFinite(deck)) slab(x,deck+.002,z,.055+random()*.11,.025+random()*.044,.008+random()*.011,colors[i%colors.length])
      }
      if (pirate) {
        slab(-.12,h*.14,w*.91,.23,.033,h*.8,'metal')
        rod(-.28,h*1.8,-w*.44,.003,.18,'dark',false)
      }
    }
    if (hero && !alien && !appearance.recipe) {
      // Seeded small-scale topology supplies parallax in close passes.
      for (let i = 0; i < (bespoke ? (small ? 3 : 10) : small ? 8 : 38); i++) {
        const x = -.38 + random() * .54, z = (random() - .5) * width * .5
        const deck=deckAt(x,z)
        if(Number.isFinite(deck)) slab(x, deck + .002, z, .012 + random() * .028, .008 + random() * .016, .004 + random() * .01, i % 3 === 0 ? 'dark' : 'hull')
      }
    }
  }

  const shadows=rig.mounts.length?createWeaponShadowMaterials(rig):undefined
  for (const [key, geometries] of batches) {
    const merged = mergeGeometries(geometries, false)
    for (const geometry of geometries) geometry.dispose()
    if (merged) {
      if(rig.mounts.length) applyWeaponRig(materials[key],rig)
      const mesh = new THREE.Mesh(merged, materials[key])
      if(shadows) { mesh.customDepthMaterial=shadows.depth;mesh.customDistanceMaterial=shadows.distance;mesh.frustumCulled=false }
      mesh.name = key
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }
  }
  // Families may not use every palette entry; dispose those immediately.
  for (const key of Object.keys(materials) as MaterialName[]) if (!batches.has(key)) materials[key].dispose()
  if(family!=='station' && family!=='creature') addRetrothrusters(group,appearance,seed,hero)
  return group
}
