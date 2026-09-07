import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ShipAppearance } from './appearance'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { buildEmpireHull } from './ship-empires'
import { buildStationHull } from './ship-stations'
import { buildSpecialHull } from './ship-recipes'
import { buildFittedHardware } from './ship-hardware'
import type { CinemaHardware } from './hardware'
import { createWeaponRig, tagWeaponGeometry, applyWeaponRig, createWeaponShadowMaterials } from './ship-weapons'
import { addRetrothrusters } from './ship-thrusters'
import { bindWeaponHullClearance } from './ship-clearance'
import { applyShipSurface } from './ship-surfaces'
import { colorSalvagePart } from './ship-salvage'
import { applyEngineHeat } from './ship-engine-heat'

type Ring = [x: number, halfWidth: number, halfHeight: number, centerY?: number]
type MaterialName = 'hull' | 'armor' | 'dark' | 'metal' | 'accent' | 'glass' | 'windows'

/** Object-space mineral grain stays attached to the shell, with sparse branching seams. */
function crystalDetail(material: THREE.MeshStandardMaterial, beam: number, height: number) {
  // Three folds emissiveIntensity into the emissive uniform. Normalize against
  // this material's active value so scene cloak/capture/KO changes affect veins.
  const activeEmission = Math.max(new THREE.Vector3(material.emissive.r, material.emissive.g, material.emissive.b).length() * material.emissiveIntensity, 1e-8).toFixed(8)
  material.customProgramCacheKey = () => `cinema-grown-crystal-v5-${activeEmission}-${beam}-${height}`
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCinemaCrystal;')
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCinemaCrystal=position;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vCinemaCrystal;
float mineralHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float mineralNoise(vec3 p) {
  vec3 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mineralHash(cell), mineralHash(cell + vec3(1,0,0)), f.x),
                 mix(mineralHash(cell + vec3(0,1,0)), mineralHash(cell + vec3(1,1,0)), f.x), f.y),
             mix(mix(mineralHash(cell + vec3(0,0,1)), mineralHash(cell + vec3(1,0,1)), f.x),
                 mix(mineralHash(cell + vec3(0,1,1)), mineralHash(cell + vec3(1,1,1)), f.x), f.y), f.z);
}`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
vec3 mineralP = vCinemaCrystal * vec3(14.0, 23.0, 19.0);
float mineralGrain = mineralNoise(mineralP * 0.58);
// Connected longitudinal trunks divide into daughter paths as they sweep toward
// the bow. Projection onto the shell keeps every branch on its own curved skin.
float mineralX = vCinemaCrystal.x;
float mineralLane = abs(vCinemaCrystal.z) / ${(beam * .5).toFixed(6)} + vCinemaCrystal.y / ${height.toFixed(6)} * 0.14;
float mineralTrunk = 0.32 + smoothstep(-0.40, 0.12, mineralX) * 0.30 - smoothstep(0.1, 0.46, mineralX) * 0.19;
float mineralBend = (mineralGrain - 0.5) * 0.035;
float mineralFork = smoothstep(-0.19, 0.34, mineralX);
float mineralField = min(abs(mineralLane - mineralTrunk - mineralBend),
  min(abs(mineralLane - mineralTrunk - mineralFork * 0.42 - mineralBend),
      abs(mineralLane - mineralTrunk + mineralFork * 0.28 - mineralBend)));
float mineralSeam = mineralField;
float mineralAA = max(fwidth(mineralField), 0.003);
// Compensate the widening filter footprint and fade unresolved veins rather
// than making the fine network increasingly luminous in distant views.
float mineralCoverage = 0.009 / (0.006 + mineralAA) * (1.0 - smoothstep(0.02, 0.08, mineralAA));
float crystalVein = (1.0 - smoothstep(0.006, 0.006 + mineralAA, mineralSeam)) * (0.68 + mineralGrain * 0.32) * mineralCoverage;
diffuseColor.rgb *= 0.76 + 0.24 * mineralGrain;
diffuseColor.rgb += vec3(0.014, 0.048, 0.065) * crystalVein;`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.014, 0.12, 0.16) * crystalVein * min(1.0, length(emissive) / ${activeEmission});`)
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
    voidborn: { structure: 0x171624, armor: 0x3d3152, metal: 0x655d7c, livery: 0x514360, roughness: .43 },
    crimson: { structure: 0x343236, armor: 0x69383a, metal: 0x646268, livery: 0x401f24, roughness: .62 },
    nebula: { structure: 0x655635, armor: 0xc2ab70, metal: 0x9c844f, livery: 0x294c3a, roughness: .31 },
    outerrim: { structure: 0x586264, armor: 0xa69170, metal: 0x835a3e, livery: 0x526d69, roughness: .75 },
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
  if (pirate || empire === 'outerrim') {
    materials.glass.color.setHex(0x192a2b)
    materials.glass.emissiveIntensity = .035
    materials.glass.roughness = .32
  }
  const salvagePaint = pirate || empire === 'outerrim'
    ? { hull: materials.hull.color.clone(), armor: materials.armor.color.clone() } : undefined
  if(salvagePaint) for(const key of ['hull','armor'] as const) {
    materials[key].color.setHex(0xffffff)
    materials[key].vertexColors=true
  }
  if (empire === 'voidborn' && family !== 'creature') {
    for (const key of ['hull', 'armor'] as const) {
      materials[key].metalness = .36
      materials[key].emissive.setHex(0x244452)
      materials[key].emissiveIntensity = .012
    }
    materials.glass.color.setHex(0x303346)
    materials.glass.emissive.setHex(0x284f60)
    materials.glass.emissiveIntensity = .035
    materials.glass.roughness = .37
    materials.glass.metalness = .3
    if(family==='station') {
      materials.hull.color.setHex(0x312942)
      materials.glass.emissiveIntensity=.18
    }
    for (const key of ['hull', 'armor', 'glass'] as const) crystalDetail(materials[key], width, height)
  } else if (hero && family !== 'creature') {
    const density = family === 'station' ? 3 : family === 'fighter' || family === 'scout' || family === 'drone' ? .75 : 1.5
    for (const key of ['hull', 'armor', 'dark', 'metal', 'accent'] as const) applyShipSurface(materials[key], { kind: key, empire, pirate, seed, density })
  }
  const rig=createWeaponRig()
  const engineHeatCenters: THREE.Vector4[] = []
  group.userData.weaponRig=rig
  let weaponIndex=-1, weaponRoll=0, weaponElevates=false, structuralPart=0
  const wreckPartRoles:Record<number,string>={}
  group.userData.wreckPartRoles=wreckPartRoles
  group.userData.wreckSurface={empire,pirate,seed,density:family==='station'?3:family==='fighter'||family==='scout'||family==='drone'?.75:1.5}
  const batches = new Map<MaterialName, THREE.BufferGeometry[]>()
  const add = (geometry: THREE.BufferGeometry, material: MaterialName, x = 0, y = 0, z = 0, rotation?: THREE.Euler) => {
    if (rotation) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotation))
    geometry.translate(x, y, z)
    // Side and ventral batteries share the same +X firing axis while their
    // mounting bases point into the supporting hull surface.
    if(weaponIndex>=0 && weaponRoll) {
      const pivot=rig.mounts[weaponIndex].pivot
      geometry.translate(-pivot.x,-pivot.y,-pivot.z)
      geometry.rotateX(weaponRoll)
      geometry.translate(pivot.x,pivot.y,pivot.z)
    }
    // All batches use the same position/normal layout, including procedural primitives.
    let flat = geometry
    if (geometry.index) { flat = geometry.toNonIndexed(); geometry.dispose() }
    for (const key of Object.keys(flat.attributes)) if (key !== 'position' && key !== 'normal') flat.deleteAttribute(key)
    if(salvagePaint&&(material==='hull'||material==='armor')) colorSalvagePart(flat,salvagePaint[material],seed,weaponIndex<0)
    tagWeaponGeometry(flat,weaponIndex,weaponIndex>=0?rig.mounts[weaponIndex].pivot:undefined,weaponElevates)
    // Preserve actual construction boundaries through material batching. Wrecks
    // can recover hull/armor/engine components without retaining source meshes.
    const part=material!=='windows' ? ++structuralPart : 0
    if(part)wreckPartRoles[part]=weaponIndex>=0?'hardware':material
    flat.setAttribute('cinemaStructuralPart',new THREE.Float32BufferAttribute(new Float32Array(flat.getAttribute('position').count).fill(part),1))
    const batch = batches.get(material) ?? []
    batch.push(flat)
    batches.set(material, batch)
  }
  const slab = (x: number, y: number, z: number, length: number, w: number, h: number, material: MaterialName = 'armor') => {
    const chamfer = Math.min(length * .1, .015)
    add(loft([[-length / 2, w * .43, h * .38], [-length / 2 + chamfer, w / 2, h / 2], [length / 2 - chamfer, w / 2, h / 2], [length / 2, w * .38, h * .36]]), material, x, y, z)
  }
  const rounded = (x: number, y: number, z: number, length: number, w: number, h: number, material: MaterialName = 'armor') => {
    // Pressure hulls can have generous fillets; gun housings are machined parts
    // with broad flat faces and a small edge break, regardless of their empire.
    const fillet = weaponIndex >= 0 ? .065 : empire === 'solarian' ? .16 : .24
    const segments = hero ? (weaponIndex >= 0 ? 2 : Math.min(length, w, h) < .025 ? 1 : 3) : 1
    add(new RoundedBoxGeometry(length, h, w, segments, Math.min(length, w, h) * fillet), material, x, y, z)
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
    engineHeatCenters.push(new THREE.Vector4(x, y, z, radius))
    rod(x + .025, y, z, radius * 1.4, .1, 'dark')
    rod(x, y, z, radius * 1.18, .045, 'metal')
    if (pirate || empire === 'outerrim') {
      // An open bell makes the throat recede behind a rolled lip. The dark
      // throat and flange seams read as heat-blackened propulsion hardware.
      const bell = new THREE.LatheGeometry([
        new THREE.Vector2(radius * .78, .033), new THREE.Vector2(radius * .80, .042),
        new THREE.Vector2(radius * 1.02, .068), new THREE.Vector2(radius * 1.13, .071),
        new THREE.Vector2(radius * 1.21, .060), new THREE.Vector2(radius * 1.24, .008),
      ], hero ? 20 : 10)
      bell.rotateZ(Math.PI / 2)
      add(bell, 'dark', x, y, z)
      for (const [axial, ringRadius, thickness] of [[-.065, 1.12, .055], [.014, 1.27, .07]] as const) {
        add(new THREE.TorusGeometry(radius * ringRadius, radius * thickness, 5, hero ? 24 : 12), 'metal', x + axial, y, z, new THREE.Euler(0, Math.PI / 2, 0))
      }
      if (hero) for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3
        rod(x + .011, y + Math.sin(angle) * radius * 1.31, z + Math.cos(angle) * radius * 1.31, radius * .055, .012, 'metal')
      }
    } else rod(x - .02, y, z, radius, .025, 'dark')
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

  const h = height / 2, w = width / 2
  const context = { add, slab, rounded, rod, engine, hero, h, w }
  const fitHardware = () => {
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
    const surfaceRay=new THREE.Ray(), a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3(), hit=new THREE.Vector3()
    const hullSurface=(point:THREE.Vector3,outward:THREE.Vector3):THREE.Vector3|undefined => {
      surfaceRay.origin.copy(point).addScaledVector(outward,2)
      surfaceRay.direction.copy(outward).negate()
      let nearest=Infinity, result:THREE.Vector3|undefined
      for(const geometry of surfaces) {
        const position=geometry.getAttribute('position')
        for(let i=0;i<position.count;i+=3) {
          a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2)
          if(surfaceRay.intersectTriangle(a,b,c,false,hit)) {
            const distance=surfaceRay.origin.distanceToSquared(hit)
            if(distance<nearest){nearest=distance;result=hit.clone()}
          }
        }
      }
      return result
    }
    buildFittedHardware(hardware, family, { ...context, deckAt, hullSurface, appearance,
      beginWeapon: (family,pivot,muzzle,constructionRoll=0,normal) => {
        weaponRoll=constructionRoll
        weaponElevates=false
        weaponIndex=rig.mounts.length
        rig.mounts.push({family,pivot,muzzle,normal,rotation:new THREE.Quaternion(),traverseRotation:new THREE.Quaternion()})
      },
      elevateWeapon: () => { weaponElevates=true },
      endWeapon: () => { weaponIndex=-1; weaponRoll=0; weaponElevates=false },
    })
    return deckAt
  }

  if (family === 'station') {
    buildStationHull(appearance, context)
    fitHardware()
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
        // A thick aft root grows into a fine swept tip. The mineral shader gives
        // this volume restrained surface veins instead of a separate glowing rail.
        const segments = hero ? 32 : 16, radial = hero ? 8 : 5
        const fin = new THREE.TubeGeometry(curve, segments, small ? .035 : .049, radial, false)
        const finPositions = fin.getAttribute('position'), center = new THREE.Vector3(), vertex = new THREE.Vector3()
        for (let i = 0; i <= segments; i++) {
          const t = i / segments, taper = .18 + .82 * Math.pow(1 - t, .65)
          curve.getPointAt(t, center)
          for (let j = 0; j <= radial; j++) {
            const index = i * (radial + 1) + j
            vertex.fromBufferAttribute(finPositions, index).sub(center).multiplyScalar(taper).add(center)
            finPositions.setXYZ(index, vertex.x, vertex.y, vertex.z)
          }
        }
        fin.computeVertexNormals()
        add(fin, 'armor')
        const root = new THREE.SphereGeometry(1, hero ? 16 : 8, 8)
        root.scale(.11, h * .58, w * .34)
        add(root, 'armor', -.37, h * .42, side * w * .62)
        // Two thick shell lobes overlap at the body and separate toward the
        // swept rim, leaving one readable opening per side. Their raised lap
        // supplies a grown ridge without adding detached plates or paper fins.
        const rows = hero ? 14 : 7, columns = hero ? 8 : 4
        for (const lobe of [0, 1]) {
        const skinPositions: number[] = [], skinIndices: number[] = []
        const bodyWidth = w * (swollen ? 1.08 : .72), bodyHeight = h * (swollen ? 1.15 : .9)
        for (const skin of [1, -1]) for (let i = 0; i <= rows; i++) {
          for (let j = 0; j <= columns; j++) {
            const u = j / columns, along = i / rows
            const start = lobe === 0 ? 0 : .40 + .17 * u
            const end = lobe === 0 ? .50 - .10 * u : 1
            const t = start + (end - start) * along, outer = curve.getPointAt(.11 + t * .69)
            const longitudinal = Math.max(.03, 1 - Math.pow((outer.x + .04) / .43, 2))
            const innerZ = side * w * (.28 + .12 * Math.sin(t * Math.PI)) * Math.sqrt(longitudinal)
            const innerY = h * .42 + bodyHeight * Math.sqrt(Math.max(0, longitudinal - Math.pow(innerZ / bodyWidth, 2)))
            const point = new THREE.Vector3(outer.x, innerY - .004, innerZ).lerp(outer, u)
            const arch = Math.sin(u * Math.PI) * Math.sin(t * Math.PI)
            const lap = lobe === 0 ? along * along * Math.sin(u * Math.PI) * h * .32 : 0
            point.y += arch * h * .30 + lap + skin * (.004 + arch * .006)
            skinPositions.push(point.x, point.y, point.z)
          }
        }
        const layer = (rows + 1) * (columns + 1)
        const triangle = (a: number, b: number, c: number, flip = false) => {
          if ((side < 0) !== flip) skinIndices.push(a, c, b)
          else skinIndices.push(a, b, c)
        }
        for (let k = 0; k < 2; k++) for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
          const a = k * layer + i * (columns + 1) + j, b = a + columns + 1
          triangle(a, a + 1, b, k === 1)
          triangle(a + 1, b + 1, b, k === 1)
        }
        // Close all four edges, so grazing cameras see a grown rim, not paper.
        const boundary = [
          ...Array.from({ length: columns + 1 }, (_, j) => j),
          ...Array.from({ length: rows }, (_, i) => (i + 1) * (columns + 1) + columns),
          ...Array.from({ length: columns }, (_, j) => rows * (columns + 1) + columns - 1 - j),
          ...Array.from({ length: rows - 1 }, (_, i) => (rows - 1 - i) * (columns + 1)),
        ]
        for (let i = 0; i < boundary.length; i++) {
          const a = boundary[i], b = boundary[(i + 1) % boundary.length]
          triangle(a, a + layer, b)
          triangle(b, a + layer, b + layer)
        }
        const web = new THREE.BufferGeometry()
        web.setAttribute('position', new THREE.Float32BufferAttribute(skinPositions, 3))
        web.setIndex(skinIndices); web.computeVertexNormals()
        add(web, 'armor')
        }
        engine(-.47, -.015, side * w * .48, small ? .03 : .045)
        if (swollen) {
          const pod = new THREE.SphereGeometry(1, hero ? 16 : 8, 10)
          pod.scale(.29, h * .66, w * .34)
          add(pod, 'glass', -.05, -h * .4, side * w * .78)
        }
        if (family === 'carrier') slab(.025, -h * .32, side * w * .91, .4, .022, .026, 'dark')
      }
      const heart = new THREE.SphereGeometry(1, hero ? 16 : 8, hero ? 10 : 6)
      heart.scale(small ? .044 : .063, h * .32, w * .25)
      add(heart, 'glass', -.12, h * 1.28)
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
        for (const rib of [-1, 1]) {
          slab(x + rib * .05, .005, side * w * .82, .018, w * .8, h * 1.88, 'dark')
          if (hero && (pirate || empire === 'outerrim')) {
            slab(x + rib * .05, h * .97, side * w * .82, .03, .037, .011, 'metal')
            slab(x + rib * .05, h * .978, side * w * .82, .013, .018, .005, 'dark')
            slab(x + rib * .05, -h * .55, side * w * 1.225, .030, .010, .032, 'metal')
          }
        }
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
      // Sleeve collars and mounting saddles tie the offset engine to its frame.
      for (const x of [-.39, -.04]) {
        rod(x, -.01, w * 1.06, small ? .058 : .082, .031, 'dark')
        rod(x, -.01, w * 1.06, small ? .061 : .086, .012, 'metal')
        slab(x, -h * .22, w * .83, .047, w * .47, h * .43, 'hull')
      }
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
    const deckAt = fitHardware()
    if (pirate || empire === 'outerrim') {
      // Donor panels sit on supported deck areas, with a dark gasket and a
      // contrasting retaining strip. Fewer, larger repairs tell a clearer
      // construction story than scattered blocks on arbitrary hull slopes.
      const colors: MaterialName[] = ['armor','hull','metal','hull','dark']
      for (let i=0; i<(hero?10:4); i++) {
        const x=-.35+random()*.65, side=i%2?1:-1
        const z=side*w*(.33+random()*.4), length=.09+random()*.09, breadth=.032+random()*.035
        const supports = [deckAt(x,z)]
        for (const fore of [-1,1]) for (const flank of [-1,1]) supports.push(deckAt(x+fore*length*.48,z+flank*breadth*.48))
        const deck = Math.max(...supports)
        if (!Number.isFinite(deck) || supports.some(value => !Number.isFinite(value)) || deck-Math.min(...supports)>.004) continue
        slab(x,deck+.002,z,length+.008,breadth+.008,.004,'dark')
        slab(x,deck+.007,z,length,breadth,.008,colors[i%colors.length])
        slab(x+length*.34,deck+.012,z,.012,breadth*.92,.004, i%2?'metal':'hull')
        if(hero) for (const flank of [-1,1]) rod(x+length*.34,deck+.016,z+flank*breadth*.30,.0025,.004,'metal',false)
      }
      if (pirate) {
        slab(-.12,h*.14,w*.91,.23,.033,h*.8,'metal')
        rod(-.28,h*1.8,-w*.44,.003,.18,'dark',false)
      }
    }
    if (hero && !alien && !appearance.recipe && !pirate && empire !== 'outerrim') {
      // Seeded small-scale topology supplies parallax in close passes.
      for (let i = 0; i < (bespoke ? (small ? 3 : 10) : small ? 8 : 38); i++) {
        const x = -.38 + random() * .54, z = (random() - .5) * width * .5
        const deck=deckAt(x,z)
        if(Number.isFinite(deck)) slab(x, deck + .002, z, .012 + random() * .028, .008 + random() * .016, .004 + random() * .01, i % 3 === 0 ? 'dark' : 'hull')
      }
    }
  }

  if (pirate || empire === 'outerrim') applyEngineHeat(['hull', 'armor', 'dark', 'metal'].map(key => materials[key as MaterialName]), engineHeatCenters)
  const shadows=rig.mounts.length?createWeaponShadowMaterials(rig):undefined
  if(hero&&rig.mounts.length) bindWeaponHullClearance(rig,[...batches.entries()].filter(([key])=>['hull','armor','dark','metal'].includes(key)).flatMap(([,geometries])=>geometries))
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
