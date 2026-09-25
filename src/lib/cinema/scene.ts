import { createHullContactProfile, type HullContactProfile } from './hull-contact'
import { cinemaHullWorldSize } from './ship-scale'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CinemaAudio } from './audio'
import { buildAudioSchedule, audioCueRange } from './audioSchedule'
import { prioritizeCinemaEffects, selectCinemaPulseCue } from './effectPriority'
import { cueRange, cueLifetime, weaponImpactAge } from './playback'
import { sampleCinemaHealth } from './director'
import { buildCinemaCascades, sampleCinemaCascade } from './cascades'
import { buildFleetFormation } from './formation'
import { sampleShipMotion, fleetMotionSpacing, type ShipMotionOptions } from './motion'
import { createBoardingMotionSampler } from './boarding-motion'
import { type CameraBody, type StoryCameraOptions } from './camera'
import { buildShotPlan, measureShotVisibility, samplePlannedCamera, type ShotPlan } from './shot-planner'
import { addHullMarkings } from './hull-markings'
import { buildCameraTakes } from './camera-takes'
import { cinemaRenderSettings, initialCinemaQuality } from './quality'
import { weaponVisual, mixColor } from './weaponVisuals'
import { boardingVisual } from './boardingVisuals'
import { getWeaponColor, resolveWeaponFamily } from './weapons'
import { createShip } from './ships'
import { createShipWreckage, sampleWreckFragment, WRECK_BREAKUP_DELAY } from './ship-wreckage'
import { bakeShipTemplateGeometry } from './ship-template'
import { aimWeaponMount, canAimWeaponMount, weaponMuzzleLocal, assignWeaponCues, type WeaponRig } from './ship-weapons'
import { updateRetrothrusters } from './ship-thrusters'
import { resolveAppearance, type ShipAppearance } from './appearance'
import { resolveStationAppearance } from './station-appearance'
import type { CinemaFilm, CinemaShip, CinemaCue, CinemaShot } from './types'

export type CinemaQuality = 'auto' | 'high' | 'medium' | 'low'
export interface CinemaOptions {
  onTime?: (seconds: number) => void
  onEnd?: () => void
  onError?: (error: string) => void
  onQuality?: (quality: string) => void
  quality?: CinemaQuality
  reducedMotion?: boolean
  muted?: boolean
  volume?: number
}
export interface CinemaController {
  seek: (seconds: number) => void
  setPlaying: (playing: boolean) => void
  setMuted: (muted: boolean) => void
  setVolume: (volume: number) => void
  setQuality: (quality: CinemaQuality) => void
  setReducedMotion: (reduced: boolean) => void
  capture: { frame: (seconds: number) => void; audio: (sampleRate?: number) => Promise<AudioBuffer> }
  dispose: () => void
}

function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return h >>> 0
}
function random(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
}
const clamp = THREE.MathUtils.clamp
const DUST_BOX = 700
const FIRE_NOISE = `float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float n(vec3 p){vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fb(vec3 p){float v=0.;float a=.5;for(int i=0;i<4;i++){v+=n(p)*a;p=p*2.03+1.7;a*=.5;}return v;}`
const SIDE_COLORS = [0x4fc4ff, 0xff5a32, 0x7dff8e, 0xffcd45, 0xd68cff]


function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.07, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.3)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.06)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

interface Actor {
  ship: CinemaShip
  appearance: ShipAppearance
  model: THREE.Group | null
  contactHull?: HullContactProfile
  contactBounds?: THREE.Box3
  position: THREE.Vector3
  rotation: number
  bank: number
  thrust: number
  retroThrust: number
  size: number
  angle: number
  lane: number
  seed: number
  engineMaterials: { material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial; intensity: number }[]
  color: number
}

/** The cinema owns its GPU and audio resources; nothing is shared with the tactical viewer. */
export function mountCinema(canvas: HTMLCanvasElement, film: CinemaFilm, appearances: Record<string, ShipAppearance>, options: CinemaOptions = {}): CinemaController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false })
  const cleanups: (() => void)[] = [() => renderer.dispose()]
  try {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.3
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.info.autoReset = false
  const scene = new THREE.Scene()
  cleanups.push(() => {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite) {
        if ('geometry' in object) geometries.add(object.geometry)
        if (object.customDepthMaterial) materials.add(object.customDepthMaterial)
        if (object.customDistanceMaterial) materials.add(object.customDistanceMaterial)
        if (object instanceof THREE.InstancedMesh) object.dispose()
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
      }
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
  })
  scene.background = new THREE.Color(0x02050b)
  scene.fog = new THREE.FogExp2(0x08151f, 0.00010)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 14000)
  const audio = new CinemaAudio()
  cleanups.push(() => audio.dispose())
  audio.setMuted(options.muted ?? true)
  audio.setVolume(options.volume ?? 0.65)
  const sceneTarget = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)})
  cleanups.push(()=>sceneTarget.dispose())
  const composer = new EffectComposer(renderer)
  cleanups.push(() => { for (const pass of composer.passes) pass.dispose(); composer.dispose() })
  // Resolve scene MSAA once. Bloom blends only into ordinary color targets.
  const scenePass = new TexturePass(sceneTarget.texture)
  // Bound HDR input before the blur pyramid can spread one invalid sample.
  scenePass.material.fragmentShader = `uniform sampler2D tDiffuse; uniform float opacity; varying vec2 vUv;
    float finiteRadiance(float c){return c >= 0.0 ? min(c, 24.0) : 0.0;}
    void main(){vec4 c=texture2D(tDiffuse,vUv);gl_FragColor=vec4(finiteRadiance(c.r),finiteRadiance(c.g),finiteRadiance(c.b),1.0)*opacity;}`
  composer.addPass(scenePass)
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.48, 0.45, 0.95)
  composer.addPass(bloom)
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.018 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float amount; varying vec2 vUv;
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb; vec2 p=vUv-.5;
      float vignette=1.-smoothstep(.22,.76,length(p))*.16;
      float grain=fract(sin(dot(vUv*vec2(1920.,1080.)+mod(time,73.),vec2(12.9898,78.233)))*43758.5453)-.5;
      // Filmic split: cool shadows, warm highlights, gently lifted midtones.
      float l=dot(c,vec3(.2126,.7152,.0722));
      c*=mix(vec3(.9,1.,1.12),vec3(1.08,1.,.9),smoothstep(.02,.9,l));
      c*=1.+.35*exp(-l*6.)*smoothstep(0.,.03,l);
      c*=vignette; c+=grain*amount; gl_FragColor=vec4(max(c,vec3(0.)),1.);}`,
  })
  composer.addPass(grade)
  composer.addPass(new OutputPass())

  // Warm key from the visible star, a cold camera-opposed rim that separates
  // silhouettes from black space, and a faint cool fill for the shadow side.
  scene.add(new THREE.HemisphereLight(0x8fa6c4, 0x07080d, .5))
  const sun = new THREE.DirectionalLight(0xffd3a1, 5.2)
  scene.add(sun); scene.add(sun.target)
  const starSeed = random(film.seed ^ 0x5f3759df), starAzimuth = starSeed() * Math.PI * 2
  const sunDirection = new THREE.Vector3(Math.cos(starAzimuth), .28 + starSeed() * .3, Math.sin(starAzimuth)).normalize()
  cleanups.push(()=>sun.shadow.dispose())
  sun.castShadow=true; sun.shadow.bias=-.00008; sun.shadow.normalBias=.025
  sun.shadow.camera.near=10;sun.shadow.camera.far=3000
  const rim = new THREE.DirectionalLight(0x86b8ff, 2.6)
  scene.add(rim); scene.add(rim.target)
  const fill = new THREE.DirectionalLight(0x6f8fc0, .5)
  scene.add(fill); scene.add(fill.target)
  // A restrained stellar reflection field lets machined metal reveal its
  // roughness and tiny bevels without placing studio scenery in the battle.
  const reflectionScene = new THREE.Scene()
  const reflectionMaterial = new THREE.ShaderMaterial({side:THREE.BackSide,
    vertexShader:'varying vec3 d; void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 d;void main(){vec3 n=normalize(d);
      float key=pow(max(0.,dot(n,normalize(vec3(-.7,.6,.35)))),24.);
      float rim=pow(max(0.,dot(n,normalize(vec3(.5,.2,-.7)))),8.);
      vec3 c=vec3(.014,.023,.034)+vec3(4.,3.4,2.7)*key+vec3(.18,.38,.65)*rim;
      gl_FragColor=vec4(c,1.);}`})
  const reflectionShell = new THREE.Mesh(new THREE.SphereGeometry(10,24,16),reflectionMaterial)
  reflectionScene.add(reflectionShell)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const reflectionMap = pmrem.fromScene(reflectionScene,.025,.1,50)
  scene.environment=reflectionMap.texture; scene.environmentIntensity=.45
  pmrem.dispose();reflectionShell.geometry.dispose();reflectionMaterial.dispose()
  cleanups.push(()=>reflectionMap.dispose())
  const glow = glowTexture()
  cleanups.push(() => glow.dispose())
  const rng = random(film.seed)

  // A volumetric-looking nebula projected on the celestial sphere: no downloaded skybox.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8500, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { seed: { value: (film.seed % 991) / 30 } },
    vertexShader: 'varying vec3 vWorld; void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vWorld; uniform float seed;
      float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float n(vec3 p){vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fb(vec3 p){float v=0.;float a=.5;for(int i=0;i<5;i++){v+=n(p)*a;p=p*2.03+1.7;a*=.5;}return v;}
      void main(){vec3 d=normalize(vWorld);vec3 p=d*3.+seed;float f=fb(p);float band=exp(-pow((d.y+.12+d.x*.28)*3.8,2.));float cloud=pow(f,3.)*band;
      vec3 color=vec3(.002,.004,.009)+cloud*1.7*mix(vec3(.035,.095,.13),vec3(.22,.075,.027),smoothstep(-.3,.8,d.x));
      color*=.6+fb(p*3.)*.8;gl_FragColor=vec4(color,1.);}`,
  }))
  scene.add(sky)
  const starPositions = new Float32Array(6000 * 3)
  const starColors = new Float32Array(6000 * 3)
  for (let i = 0; i < 6000; i++) {
    const angle = rng() * Math.PI * 2, y = rng() * 2 - 1, radial = Math.sqrt(1 - y * y), radius = 5000 + rng() * 2500
    starPositions.set([Math.cos(angle) * radial * radius, y * radius, Math.sin(angle) * radial * radius], i * 3)
    const v = 0.3 + rng() * 1.3
    starColors.set([v * (0.7 + rng() * 0.3), v * (0.8 + rng() * 0.2), v], i * 3)
  }
  const starsGeometry = new THREE.BufferGeometry()
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  starsGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
  const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ size: 3.2, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true, depthWrite: false })); scene.add(stars)

  // A distant world at sky distance: it follows the camera, so its scale never
  // competes with hulls. Seeded gas giant or banded rocky world with a soft
  // terminator, cloud noise and a lit atmospheric limb.
  const worldSeed = random(film.seed ^ 0x2545f491)
  const gasGiant = worldSeed() < .55
  const worldAzimuth = starAzimuth + Math.PI * (.4 + worldSeed() * .3) * (worldSeed() < .5 ? 1 : -1)
  const planetOffset = new THREE.Vector3(Math.cos(worldAzimuth), -.22 - worldSeed() * .25, Math.sin(worldAzimuth)).normalize().multiplyScalar(6400)
  const palettes = [[0x9a6b45,0xd9b58a,0x5a3524,0xffb27a],[0x3d5f86,0x9cc3e0,0x1d2c48,0x7fc4ff],[0x6b7f5a,0xc7b98f,0x2c3a2e,0x9fdcff],[0x7a4a6e,0xd6a0b8,0x3a2340,0xffa0d0],[0x8c8f96,0xd8dce2,0x44474d,0xb8d8ff]]
  const palette = palettes[Math.floor(worldSeed() * palettes.length)]
  const planetRadius = 700 + worldSeed() * 650
  const planetNoise = `float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float n(vec3 p){vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fb(vec3 p){float v=0.;float a=.5;for(int i=0;i<5;i++){v+=n(p)*a;p=p*2.03+1.7;a*=.5;}return v;}`
  const planet = new THREE.Mesh(new THREE.SphereGeometry(planetRadius, 96, 64), new THREE.ShaderMaterial({
    uniforms: { light: { value: sunDirection }, seed: { value: worldSeed() * 40 }, gas: { value: gasGiant ? 1 : 0 },
      c1: { value: new THREE.Color(palette[0]) }, c2: { value: new THREE.Color(palette[1]) }, c3: { value: new THREE.Color(palette[2]) }, air: { value: new THREE.Color(palette[3]) } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vec4 w=modelMatrix*vec4(position,1.);vN=normal;vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `varying vec3 vN;varying vec3 vV;uniform vec3 light,c1,c2,c3,air;uniform float seed,gas;${planetNoise}
      void main(){vec3 n=normalize(vN);float warp=fb(n*3.+seed);
      float pattern=gas>.5?sin(n.y*(16.+seed*.1)+warp*5.)*.5+.5:smoothstep(.46,.56,fb(n*2.2+seed));
      vec3 albedo=mix(c1,c2,pattern);albedo=mix(albedo,c3,smoothstep(.4,.8,fb(n*7.+seed*1.3))*.55);
      float clouds=gas>.5?smoothstep(.62,.8,fb(vec3(n.x*2.,n.y*14.,n.z*2.)+seed)):smoothstep(.52,.72,fb(n*4.5+seed*.7));
      albedo=mix(albedo,vec3(.92,.94,.96),clouds*.65);
      float nl=dot(n,light),lit=smoothstep(-.06,.45,nl);
      float rim=pow(1.-max(0.,dot(n,vV)),2.5);
      vec3 c=albedo*lit*.42+air*rim*smoothstep(-.25,.4,nl)*.6+albedo*.006;
      gl_FragColor=vec4(c,1.);}`,
  }))
  scene.add(planet)
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(planetRadius * 1.035, 64, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    uniforms: { light: { value: sunDirection }, air: { value: new THREE.Color(palette[3]) } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vec4 w=modelMatrix*vec4(position,1.);vN=normal;vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'varying vec3 vN;varying vec3 vV;uniform vec3 light,air;void main(){vec3 n=normalize(vN);float edge=pow(max(0.,1.+dot(n,vV)*1.6),3.);gl_FragColor=vec4(air,clamp(edge,0.,1.)*smoothstep(-.3,.5,dot(n,light))*.3);}',
  }))
  scene.add(atmosphere)
  const solar = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0xffd6a0).multiplyScalar(.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  solar.scale.set(1600, 1600, 1); scene.add(solar)
  const solarCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0xfff4e0).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  solarCore.scale.set(180, 180, 1); scene.add(solarCore)

  const sides = [...new Set(film.ships.map(s => s.sideIndex))]
  // One accent per side on engines, trails and weapon fire: the protagonist's
  // side reads cool, its adversary hot, any further sides take the rest.
  const sideOf = (id?: string) => film.ships.find(ship => ship.id === id)?.sideIndex
  const colorOrder = [...new Set([sideOf(film.story?.protagonistId), sideOf(film.story?.adversaryId), ...sides].filter((side): side is number => side !== undefined))]
  const sideColor = new Map(colorOrder.map((side, index) => [side, SIDE_COLORS[index % SIDE_COLORS.length]]))
  const shipRanks = new Map<string, number>()
  const sideCounts = new Map<number, number>()
  for (const ship of film.ships) {
    const key = `${ship.sideIndex}:${ship.playerId}`
    if (!shipRanks.has(key)) { shipRanks.set(key, sideCounts.get(ship.sideIndex) ?? 0); sideCounts.set(ship.sideIndex, (sideCounts.get(ship.sideIndex) ?? 0) + 1) }
  }
  // Hero detail is reserved for participants the director actually follows.
  const featured = new Set(film.shots.flatMap(s => [s.subject, s.target]).filter(Boolean))
  const boardingParticipants = new Set(film.cues.filter(cue=>cue.kind==='boarding').flatMap(cue=>[cue.from,cue.to]).filter(Boolean))
  const priority = [...film.ships].sort((a, b) => Number(boardingParticipants.has(b.id))-Number(boardingParticipants.has(a.id)) || Number(featured.has(b.id)) - Number(featured.has(a.id)))
  const detailed = new Set(priority.slice(0, 28).map(s => s.id))
  let markingMilliseconds = 0
  const actors = film.ships.map((ship): Actor => {
    const known = ship.kind==='station' ? resolveStationAppearance(ship.playerId) : appearances[ship.shipClass]
    const appearance = ['station', 'creature', 'drone'].includes(ship.kind) ? { ...(known ?? resolveAppearance(ship.shipClass)), family: ship.kind as ShipAppearance['family'] } : known ?? resolveAppearance(ship.shipClass)
    // Installations dwarf the capitals they host.
    const size = cinemaHullWorldSize(appearance) * (ship.kind === 'station' ? 3 : 1)
    const seed = hash(ship.id)
    const side = sides.indexOf(ship.sideIndex)
    const angle = side / Math.max(2, sides.length) * Math.PI * 2
    const lane = shipRanks.get(`${ship.sideIndex}:${ship.playerId}`) ?? 0
    const model = detailed.has(ship.id) ? createShip(appearance, seed, 'hero', ship.hardware) : null
    let contactHull: HullContactProfile | undefined
    let contactBounds: THREE.Box3 | undefined
    if (model) {
      const points: THREE.Vector3[] = []
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !['hull', 'armor', 'dark', 'metal'].includes(object.name)) return
        const vertices = object.geometry.getAttribute('position'), mounts = object.geometry.getAttribute('cinemaMount')
        for (let i = 0; i < vertices.count; i++) {
          if (mounts && mounts.getX(i) >= 0) continue
          points.push(new THREE.Vector3().fromBufferAttribute(vertices, i).multiplyScalar(size))
        }
      })
      if (points.length) {
        contactBounds = new THREE.Box3().setFromPoints(points)
        if (boardingParticipants.size) contactHull = createHullContactProfile(points, boardingParticipants.has(ship.id))
      }
    }
    const engineMaterials: { material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial; intensity: number }[] = []
    if (model) {
      if (!['creature','drone'].includes(ship.kind)) {
        const started=performance.now()
        addHullMarkings(model, {name:ship.name,worldSize:size,empire:appearance.empire,seed})
        markingMilliseconds+=performance.now()-started
      }
      model.scale.setScalar(size)
      // Muted, weathered paint: pull hull colors a fifth of the way toward grey.
      const muted = new Set<THREE.Material>()
      model.traverse(object => {
        const material = object instanceof THREE.Mesh ? object.material : undefined
        if (!(material instanceof THREE.MeshStandardMaterial) || object.userData.engine || muted.has(material)) return
        muted.add(material); const l = material.color.r * .2126 + material.color.g * .7152 + material.color.b * .0722
        material.color.lerp(new THREE.Color(l, l, l), .22)
      })
      model.traverse(object => {
        if (object instanceof THREE.Mesh && object.userData.engine && !object.userData.retrothruster) {
          const material = object.material
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
            engineMaterials.push({ material, intensity: object.userData.baseIntensity ?? 1 })
            if (material instanceof THREE.MeshBasicMaterial) {
              material.color.setHex(object.userData.plume ? sideColor.get(ship.sideIndex)! : mixColor(sideColor.get(ship.sideIndex)!, 0xffffff, .35)).multiplyScalar(object.userData.plume ? .9 : 1)
              // Nozzle cores glow from a hot center instead of reading as flat painted disks.
              if (!object.userData.plume) Object.assign(material, { map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
            } else material.emissive.setHex(sideColor.get(ship.sideIndex)!)
          }
        }
      })
      scene.add(model)
    }
    return { ship, appearance, model, contactHull, contactBounds, position: new THREE.Vector3(), rotation: 0, bank: 0, thrust: 1, retroThrust: 0, size, angle, lane, seed, engineMaterials, color: sideColor.get(ship.sideIndex)! }
  })
  const fleetSpacing = new Map(sides.map(side => [side, fleetMotionSpacing(actors.filter(a=>a.ship.sideIndex===side && a.ship.kind!=='station').map(a=>({size:a.size,beam:a.appearance.beam})))]))
  const fleetDepth = new Map(sides.map(side => [side, Math.max(130,...actors.filter(a=>a.ship.sideIndex===side && a.ship.kind!=='station').map(a=>a.size*1.25+55))]))
  const formations = new Map(sides.flatMap(side => [...buildFleetFormation(actors.filter(actor => actor.ship.sideIndex === side).map(actor => ({
    id: actor.ship.id, playerId: actor.ship.playerId, size: actor.size, beam: actor.appearance.beam, kind: actor.ship.kind, family: actor.appearance.family,
  })), sides.length)]))
  const byId = new Map(actors.map(a => [a.ship.id, a]))
  // Only the bounded detailed cast owns wreck geometry; each actor is one draw
  // regardless of how many original hull components survive its breakup.
  const wrecks = actors.filter(actor=>actor.model && actor.ship.fate==='destroyed').map(actor=>{
    const wreck=createShipWreckage(actor.model!,actor.seed)
    wreck.mesh.scale.setScalar(actor.size);scene.add(wreck.mesh)
    cleanups.push(()=>wreck.dispose())
    const burning=[...wreck.fragments].sort((a,b)=>b.count-a.count).slice(0,actor.size<40?2:actor.size<150?3:4)
    return {actor,wreck,burning}
  })
  const gunTracks = new Map<string, CinemaCue[][]>()
  const cueMount = new Map<string, number>(), suppressedGuns = new Set<string>()
  // Distant actors remain real participants, rendered with a bounded number of draw calls.
  const distantGroups = new Map<string,{mesh:THREE.InstancedMesh;count:number}>()
  const distantKey = (actor: Actor) => `${actor.appearance.empire}:${actor.appearance.hullEmpire}:${actor.appearance.family}:${actor.appearance.recipe ?? 'standard'}`
  for (const key of new Set(actors.filter(actor=>!actor.model).map(distantKey))) {
    const members = actors.filter(actor=>!actor.model && distantKey(actor)===key)
    const example = members[0]
    const template = createShip(example.appearance, 31, 'distant')
    template.updateMatrixWorld(true)
    const pieces:THREE.BufferGeometry[]=[]
    template.traverse(object=>{
      if(object instanceof THREE.Mesh && !object.userData.engine) {
        const material = (Array.isArray(object.material)?object.material[0]:object.material) as THREE.MeshStandardMaterial
        pieces.push(bakeShipTemplateGeometry(object.geometry,material,object.matrixWorld))
      }
    })
    const geometry=mergeGeometries(pieces)!
    for(const piece of pieces)piece.dispose()
    template.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose()}})
    const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:.35,roughness:.6}),members.length)
    // Dither per-instance cloak visibility without changing the shared fleet material.
    geometry.setAttribute('cinemaVisibility',new THREE.InstancedBufferAttribute(new Float32Array(members.length).fill(1),1).setUsage(THREE.DynamicDrawUsage))
    mesh.material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float cinemaVisibility; varying float vCinemaVisibility;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCinemaVisibility=cinemaVisibility;')
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCinemaVisibility;').replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if(vCinemaVisibility<.999 && fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)>vCinemaVisibility) discard;`)
    }
    mesh.material.customProgramCacheKey=()=> 'cinema-fleet-cloak-v1'
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh)
    distantGroups.set(key,{mesh,count:0})
  }
  const dummy = new THREE.Object3D(), tint = new THREE.Color()
  const engineSprites: THREE.Sprite[] = []
  for (let i = 0; i < 160; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x75dfff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    sprite.visible = false; scene.add(sprite); engineSprites.push(sprite)
  }
  // Blinking side-colored running lights at the beam tips of detailed hulls.
  const navLights = Array.from({ length: 64 }, () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    sprite.visible = false; scene.add(sprite); return sprite
  })
  // Near-field particulate and exhaust give tracked shots visible parallax.
  // Particles wrap in a box around the camera, so every shot has a near field.
  const dustGeometry = new THREE.BufferGeometry()
  const dustPositions = new Float32Array(1400 * 3)
  for (let i=0;i<dustPositions.length;i++) dustPositions[i]=rng()*DUST_BOX
  dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3))
  const dust = new THREE.Points(dustGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{box:{value:DUST_BOX},scale:{value:300}},
    vertexShader:`uniform float box;uniform float scale;varying float vFade;void main(){vec3 p=mod(position-cameraPosition,box)-box*.5+cameraPosition;
      vec4 v=viewMatrix*vec4(p,1.);float d=-v.z;vFade=smoothstep(4.,30.,d)*(1.-smoothstep(box*.25,box*.5,d));gl_PointSize=clamp(scale*1.6/max(d,1.),1.,6.);gl_Position=projectionMatrix*v;}`,
    fragmentShader:'varying float vFade;void main(){vec2 c=gl_PointCoord-.5;gl_FragColor=vec4(vec3(.55,.62,.7)*vFade*smoothstep(.25,0.,dot(c,c)),1.);}'}))
  dust.frustumCulled=false;scene.add(dust)
  const trails = new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.1,blending:THREE.AdditiveBlending,depthWrite:false}),240)
  trails.frustumCulled=false; trails.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(trails)
  const beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), 320)
  beams.frustumCulled = false; beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(beams)
  // Physical boarding hardware uses opaque lit metal, never the additive
  // weapon pool. One bounded draw covers all active rails and clamps.
  const boardingStructures = new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,8),
    new THREE.MeshStandardMaterial({color:0xffffff,metalness:.4,roughness:.6}),32)
  boardingStructures.count=0;boardingStructures.frustumCulled=false
  boardingStructures.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(boardingStructures)
  // Missile smoke: dim grey, normally blended so it occludes stars instead of glowing.
  // Instance color carries opacity (the shader multiplies the grey by it).
  const smoke = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshBasicMaterial({ color: 0x5b5f66, transparent: true, opacity: .45, depthWrite: false }), 192)
  smoke.frustumCulled = false; smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(smoke)
  const projectiles = new THREE.InstancedMesh(new THREE.ConeGeometry(.5, 2.8, 7), new THREE.MeshStandardMaterial({color:0xffffff,metalness:.75,roughness:.35}),96)
  projectiles.frustumCulled=false;projectiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(projectiles)
  const sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .4, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .55, roughness: .6 }), 800)
  sparks.frustumCulled = false; sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(sparks)
  const flashes: THREE.Sprite[] = []
  const shields: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>[] = []
  for (let i = 0; i < 96; i++) {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    flash.visible = false; scene.add(flash); flashes.push(flash)
  }
  for (let i = 0; i < 32; i++) {
    // Local hits ripple out from the impact point across a hex lattice; `whole`
    // lights the complete shell for big hits, knockouts and cloaks.
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { opacity: { value: 0 }, time: { value: 0 }, color: { value: new THREE.Color(0x66dcff) }, hit: { value: new THREE.Vector3(1, 0, 0) }, local: { value: 0 }, whole: { value: 1 } },
      vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-p.xyz);vP=position;gl_Position=projectionMatrix*p;}',
      fragmentShader: `varying vec3 vN;varying vec3 vV;varying vec3 vP;uniform float opacity,time,local,whole;uniform vec3 color,hit;
        void main(){float rim=pow(1.-abs(dot(vN,vV)),2.);float band=pow(max(0.,sin(vP.x*22.-time*12.)),12.);
        vec3 d=normalize(vP);float angle=acos(clamp(dot(d,hit),-1.,1.));
        vec2 q=vec2(atan(d.z,d.x)*5.,d.y*8.);q.x+=floor(q.y)*.5;vec2 cell=abs(fract(q)-.5);float lattice=smoothstep(.38,.5,max(cell.x,cell.y));
        float wave=exp(-pow((angle-time*1.4)*7.,2.))*(1.-smoothstep(.15,.7,time))*(1.-smoothstep(.25,.6,angle));float spot=exp(-angle*angle*14.)*exp(-time*5.);
        float a=local*(spot*1.4+wave*(.3+lattice*.4))+whole*(rim*.6+band*.35);
        gl_FragColor=vec4(color*(1.+spot*1.2),a*opacity);}`,
    }))
    shield.visible = false; scene.add(shield); shields.push(shield)
  }
  // Explosion fireballs: noise-textured shells with a white-yellow-orange-red
  // temperature ramp. Additive, so they read as light, never as smoke.
  const fireballs = Array.from({ length: 32 }, () => {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { age: { value: 0 }, seed: { value: 0 }, heat: { value: 1 } },
      vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-p.xyz);vP=position;gl_Position=projectionMatrix*p;}',
      fragmentShader: `varying vec3 vN;varying vec3 vV;varying vec3 vP;uniform float age,seed,heat;${FIRE_NOISE}
        void main(){float f=fb(vP*4.2+vec3(seed,-age*1.6,seed*.5));float core=pow(max(0.,dot(normalize(vN),normalize(vV))),1.3);
        float t=clamp(core*(1.3-age*.42)+(f-.5)*1.1,0.,1.6)*heat;
        vec3 c=mix(vec3(.35,.04,.01),vec3(1.,.38,.06),smoothstep(.12,.5,t));c=mix(c,vec3(1.,.82,.42),smoothstep(.5,.9,t));c=mix(c,vec3(1.),smoothstep(.95,1.35,t));
        float a=smoothstep(.06,.4,t)*(1.-smoothstep(1.4,3.4,age));
        gl_FragColor=vec4(c*(1.2+3.*smoothstep(.9,1.4,t)),a);}`,
    }))
    ball.visible = false; scene.add(ball); return ball
  })
  // Flat expanding shockwave discs, brightest at their leading edge.
  const blastRings = Array.from({ length: 10 }, () => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.55, 1, 96, 1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { opacity: { value: 0 }, color: { value: new THREE.Color() } },
      vertexShader: 'varying float r;void main(){r=length(position.xy);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying float r;uniform float opacity;uniform vec3 color;void main(){float edge=smoothstep(.8,.98,r)*(1.-smoothstep(.98,1.,r));gl_FragColor=vec4(color*(1.+edge*2.),edge*edge*opacity);}',
    }))
    ring.visible = false; scene.add(ring); return ring
  })
  const shockwaves = Array.from({ length: 12 }, () => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .006, 5, 72), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    ring.visible = false; scene.add(ring); return ring
  })
  // Dedicated cascade resources keep fleet-wide effects from exhausting the
  // close-up impact pools. A sphere reads across all formation layers.
  const cascadeWaves = Array.from({ length: 4 }, () => {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { opacity: { value: 0 }, color: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 n;varying vec3 v;varying vec3 p;void main(){vec4 q=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-q.xyz);p=position;gl_Position=projectionMatrix*q;}',
      fragmentShader: 'varying vec3 n;varying vec3 v;varying vec3 p;uniform float opacity;uniform vec3 color;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),5.);float bands=.7+.3*sin(p.y*35.+p.x*18.);gl_FragColor=vec4(color,rim*bands*opacity);}',
    }))
    shell.visible=false;scene.add(shell);return shell
  })
  const cascadeFlashes = Array.from({ length: 32 }, () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}))
    sprite.visible=false;scene.add(sprite);return sprite
  })
  const cascadeArcs = new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,4),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),128)
  cascadeArcs.frustumCulled=false;cascadeArcs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(cascadeArcs)
  const pulseLight = new THREE.PointLight(0x66dcff, 0, 320, 2); scene.add(pulseLight)
  // Muzzle flashes spill light onto the firing hull. A fixed pool keeps shader programs stable.
  const muzzleLights = Array.from({ length: 2 }, () => { const light = new THREE.PointLight(0xffffff, 0, 100, 2); scene.add(light); return light })
  let time = 0, playing = false, disposed = false, reduced = options.reducedMotion ?? false
  let requestedQuality: CinemaQuality = options.quality ?? 'auto'
  let actualQuality = requestedQuality === 'auto' ? initialCinemaQuality(canvas.clientWidth || window.innerWidth) : requestedQuality
  let raf = 0, last = performance.now(), reportAt = 0, sampleFrames = 0, sampleElapsed = 0, qualityAge = 0
  const audioCues = buildAudioSchedule(film.cues)
  const cuesById = new Map(film.cues.map(cue=>[cue.id,cue]))
  const effectWindow = film.cues.reduce((max, cue) => Math.max(max, cue.duration + 2), 7)
  let shotPlan: ShotPlan | undefined
  let shotPlanKey = ''
  const cameraTakes = buildCameraTakes(film.story?.sequences ?? [], film.shots)
  const boardingTakes = new Set((film.story?.sequences ?? []).filter(sequence=>
    cuesById.get(sequence.causeCueId ?? '')?.kind==='boarding').map(sequence=>cameraTakes.get(sequence.id)?.id))
  const cameraTarget = new THREE.Vector3(), cameraPosition = new THREE.Vector3()
  const pointA = new THREE.Vector3(), pointB = new THREE.Vector3(), pointC = new THREE.Vector3(), pointQuaternion = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3(), viewForward = new THREE.Vector3(), viewRight = new THREE.Vector3(), keyDirection = new THREE.Vector3()
  const motionOptions = (actor: Actor): ShipMotionOptions => ({ size: actor.size, angle: actor.angle, lane: actor.lane, seed: actor.seed,
    formation: formations.get(actor.ship.id), fleetCount: sides.length, sideCount: sideCounts.get(actor.ship.sideIndex) ?? 1, spacing: fleetSpacing.get(actor.ship.sideIndex) ?? 90, depth: fleetDepth.get(actor.ship.sideIndex) ?? 130 })
  const boardingMotion = createBoardingMotionSampler(film.cues,
    actors.map(actor=>({id:actor.ship.id,start:actor.ship.start,end:actor.ship.end,radius:actor.size*.78,kind:actor.ship.kind,hull:actor.contactHull})),
    (id,at)=>{const actor=byId.get(id)!;const pose=sampleShipMotion(actor.ship,at,motionOptions(actor));return reduced?{...pose,bank:0}:pose})
  const motionAt = (actor: Actor, at: number) => boardingMotion(actor.ship.id,at)
  const positionAt = (actor: Actor, t: number) => {
    const motion = motionAt(actor,t)
    actor.position.set(motion.x,motion.y,motion.z)
    actor.rotation=motion.yaw; actor.bank=motion.bank; actor.thrust=motion.thrust; actor.retroThrust=motion.retroThrust
    return actor.position
  }
  const cascadePlans = buildCinemaCascades(film.cues,(id,at)=>{
    const actor=byId.get(id)
    return actor ? motionAt(actor,at) : undefined
  }).filter(plan=>plan.kind==='chain' || plan.recipients.length>=6)
  const cascadeGroups = new Set(cascadePlans.map(plan=>`${plan.sourceCueId}:${plan.kind==='chain'?'chain':'area'}`))
  const cascadeCollateral = new Set(film.cues.filter(cue=>cue.hit===true && cue.parentId &&
    ['aoe','ammo_splash','chain'].includes(cue.secondaryKind??'') &&
    cascadeGroups.has(`${cue.parentId}:${cue.secondaryKind==='chain'?'chain':'area'}`)).map(cue=>cue.id))
  const isVisible = (actor: Actor, t: number) => t >= actor.ship.start && (t <= actor.ship.end || !['escaped', 'withdrawn'].includes(actor.ship.fate) || t < actor.ship.end + 2.5)
  const cameraBodyAt = (id: string | undefined, at: number): CameraBody | undefined => {
    const actor=id ? byId.get(id) : undefined
    if (!actor) return undefined
    const motion=motionAt(actor,at)
    return {id:actor.ship.id,size:actor.size,side:actor.ship.sideIndex,position:new THREE.Vector3(motion.x,motion.y,motion.z),
      ...(actor.contactBounds ? {contactHull:{min:actor.contactBounds.min,max:actor.contactBounds.max,yaw:motion.yaw,bank:reduced?0:motion.bank}} : {})}
  }
  const cameraBodiesAt = (at: number) => actors.filter(actor=>isVisible(actor,at) &&
    !(actor.ship.fate==='destroyed' && at>actor.ship.end+.32)).map(actor=>cameraBodyAt(actor.ship.id,at)!)
  const lossAt = new Map(film.cues.filter(cue=>(cue.kind==='death'||cue.kind==='knockout')&&cue.to).map(cue=>[cue.to!,cue.time]))
  const cameraOptionsAt = (shot: CinemaShot, at: number): StoryCameraOptions => {
    const storySequence=film.story?.sequences.find(sequence=>sequence.id===shot.sequenceId)
    const take=storySequence ? cameraTakes.get(storySequence.id) : undefined
    const sequence=storySequence && take ? {...storySequence,start:take.start,end:take.end} : storySequence
    const subject=cameraBodyAt(shot.subject,at) ?? cameraBodiesAt(at)[0] ?? {id:'empty',size:60,position:new THREE.Vector3()}
    const target=cameraBodyAt(shot.target,at)
    const referenceTime=sequence?.start ?? shot.start
    const axisFrom=cameraBodyAt(shot.axis?.from ?? subject.id,referenceTime)?.position ?? subject.position
    const axisTo=cameraBodyAt(shot.axis?.to ?? target?.id,referenceTime)?.position ?? subject.position.clone().add(new THREE.Vector3(100,0,0))
    // Membership is fixed at the shot's first frame, so an arrival or loss
    // mid-shot cannot flip the composition; positions follow the playhead.
    const members=actors.filter(actor=>isVisible(actor,shot.start) &&
      !(actor.ship.fate==='destroyed' && shot.start>actor.ship.end+(shot.battlefield?7:.32)))
    const battlefield=members.map(actor=>cameraBodyAt(actor.ship.id,at)!)
    const battlefieldAtStart=members.map(actor=>cameraBodyAt(actor.ship.id,shot.start)!)
    const dying=[shot.subject,shot.target].find(id=>{const end=lossAt.get(id??'');return end!==undefined && end>=shot.start-.2 && end<=shot.end})
    const prize=!!target && byId.get(target.id)?.ship.fate==='captured' && at>=byId.get(target.id)!.ship.end
    return {shot,sequence,time:at,aspect:camera.aspect,subject,target,battlefield,battlefieldAtStart,axisFrom,axisTo,reduced,boarding:!!take && boardingTakes.has(take.id),dying,prize}
  }
  const setResolution = () => {
    const width = canvas.clientWidth || 1280, height = canvas.clientHeight || 720
    const settings=cinemaRenderSettings(actualQuality,window.devicePixelRatio || 1,renderer.capabilities.maxSamples,
      {width,height,maxTextureSize:renderer.capabilities.maxTextureSize})
    renderer.setDrawingBufferSize(width,height,settings.pixelRatio)
    if(sceneTarget.samples!==settings.samples){sceneTarget.samples=settings.samples;sceneTarget.dispose()}
    sceneTarget.setSize(Math.floor(width*settings.pixelRatio),Math.floor(height*settings.pixelRatio))
    composer.setPixelRatio(settings.pixelRatio); composer.setSize(width,height)
    camera.aspect=width/height;camera.updateProjectionMatrix()
    bloom.enabled=settings.bloom
    // Three's material fast path does not invalidate programs when global shadows change.
    if(renderer.shadowMap.enabled!==settings.shadows){
      renderer.shadowMap.enabled=settings.shadows
      scene.traverse(object=>{if(object instanceof THREE.Mesh){for(const material of Array.isArray(object.material)?object.material:[object.material])material.needsUpdate=true}})
    }
    if(sun.shadow.mapSize.x!==settings.shadowMapSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.setScalar(settings.shadowMapSize)}
    options.onQuality?.(actualQuality)
  }
  const resize = new ResizeObserver(() => { setResolution(); if (!playing) safeDraw() }); cleanups.push(() => resize.disconnect()); resize.observe(canvas); setResolution()

  const aimPoint = (cue: CinemaCue, output: THREE.Vector3, at?: number) => {
    const target=byId.get(cue.to??'')
    if(!target) return output.set(0,0,0)
    if(at===undefined) output.copy(target.position)
    else {const pose=motionAt(target,at);output.set(pose.x,pose.y,pose.z)}
    output.y+=target.size*.06
    if(!cue.hit){output.y+=target.size*.8;output.z+=target.size*(hash(cue.id)%2?.7:-.7)}
    return output
  }
  // Reserve an actual gun with a clear outward firing arc for the whole cue.
  // Sampling both banking modes also keeps toggling reduced motion deterministic.
  for(const actor of actors) {
    const rig=actor.model?.userData.weaponRig as WeaponRig|undefined
    if(!rig?.mounts.length) continue
    const localTargets=new Map<string,THREE.Vector3[]>()
    const inverse=new THREE.Matrix4(), rotation=new THREE.Quaternion()
    const eligible=(index:number,cue:CinemaCue) => {
      let targets=localTargets.get(cue.id)
      if(!targets) {
        targets=[]
        for(const phase of [0,.5,1]) {
          const at=cue.time+cue.duration*phase, pose=motionAt(actor,at)
          for(const bank of [0,pose.bank]) {
            rotation.setFromEuler(new THREE.Euler(bank,pose.yaw,0,'YXZ'))
            inverse.compose(new THREE.Vector3(pose.x,pose.y,pose.z),rotation,new THREE.Vector3(actor.size,actor.size,actor.size)).invert()
            targets.push(aimPoint(cue,new THREE.Vector3(),at).applyMatrix4(inverse))
          }
        }
        localTargets.set(cue.id,targets)
      }
      return targets.every(target=>canAimWeaponMount(rig,index,target))
    }
    const assigned=assignWeaponCues(rig,film.cues.filter(cue=>cue.from===actor.ship.id),eligible)
    gunTracks.set(actor.ship.id,assigned.tracks)
    for(const [id,index] of assigned.byCue) cueMount.set(id,index)
    for(const id of assigned.suppressed) suppressedGuns.add(id)
  }
  const previousAim=new THREE.Quaternion(), previousTraverse=new THREE.Quaternion(), aimTarget=new THREE.Vector3(), frozenInverse=new THREE.Matrix4(), frozenRotation=new THREE.Quaternion()
  function updateGuns() {
    for(const actor of actors) {
      const model=actor.model, tracks=gunTracks.get(actor.ship.id)
      if(!model||!tracks) continue
      model.updateMatrixWorld(true)
      const rig=model.userData.weaponRig as WeaponRig
      const retired=time>=actor.ship.end && actor.ship.fate!=='survived'
      const aimAt=retired?actor.ship.end:time
      if(retired) {
        const pose=motionAt(actor,Math.max(actor.ship.start,actor.ship.end-.00001))
        frozenRotation.setFromEuler(new THREE.Euler(reduced?0:pose.bank,pose.yaw,0,'YXZ'))
        frozenInverse.compose(new THREE.Vector3(pose.x,pose.y,pose.z),frozenRotation,new THREE.Vector3(actor.size,actor.size,actor.size)).invert()
      }
      const targetLocal=(cue:CinemaCue)=>retired?aimPoint(cue,aimTarget,aimAt).applyMatrix4(frozenInverse):model.worldToLocal(aimPoint(cue,aimTarget))
      for(let index=0;index<tracks.length;index++) {
        const track=tracks[index]
        let low=0,high=track.length
        while(low<high){const mid=(low+high)>>>1;if(track[mid].time<=aimAt)low=mid+1;else high=mid}
        const previous=track[low-1], next=track[low]
        const approaching=next && aimAt>=next.time-1.2 && (!previous || aimAt>=previous.time+previous.duration)
        if(previous) aimWeaponMount(rig,index,targetLocal(previous))
        else {
          rig.mounts[index].rotation.identity();rig.uniforms[index].set(0,0,0,1)
          const base=rig.mounts[index].traverseRotation??=new THREE.Quaternion()
          base.identity();rig.traverseUniforms[index].set(0,0,0,1)
        }
        if(approaching) {
          previousAim.copy(rig.mounts[index].rotation)
          previousTraverse.copy(rig.mounts[index].traverseRotation!)
          aimWeaponMount(rig,index,targetLocal(next))
          const t=clamp((aimAt-next.time+1.2)/1.1,0,1), blend=t*t*(3-2*t)
          rig.mounts[index].rotation.slerpQuaternions(previousAim,rig.mounts[index].rotation.clone(),blend)
          const q=rig.mounts[index].rotation;rig.uniforms[index].set(q.x,q.y,q.z,q.w)
          const base=rig.mounts[index].traverseRotation!
          base.slerpQuaternions(previousTraverse,base.clone(),blend)
          rig.traverseUniforms[index].set(base.x,base.y,base.z,base.w)
        }
      }
    }
  }

  function draw() {
    let engineCount = 0, trailCount = 0
    const activeCues = [...cueRange(film.cues, time - effectWindow, time + .00001)]
    const cloakById = new Map<string,number>()
    for(const cue of activeCues)if(cue.kind==='cloak' && cue.to && time>=cue.time && time<cue.time+cue.duration){
      const phase=(time-cue.time)/Math.max(.01,cue.duration)
      cloakById.set(cue.to,Math.sin(phase*Math.PI))
    }
    for(const group of distantGroups.values())group.count=0
    for (const actor of actors) {
      positionAt(actor, time)
      const visible = isVisible(actor, time)
      const cloak=cloakById.get(actor.ship.id) ?? 0

      if (actor.model) {
        actor.model.visible = visible && !(actor.ship.fate === 'destroyed' && time >= actor.ship.end + WRECK_BREAKUP_DELAY)
        actor.model.position.copy(actor.position)
        actor.model.rotation.set(reduced ? 0 : actor.bank, actor.rotation, 0, 'YXZ')
        updateRetrothrusters(actor.model,actor.retroThrust*(1-cloak*.95))
        for (const { material, intensity } of actor.engineMaterials) { if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = actor.thrust * (2.4 + Math.sin(time * 8 + actor.seed) * .3) * (1-cloak*.95); else { material.transparent = true; material.opacity = actor.thrust * intensity * (.7 + Math.sin(time * 8 + actor.seed) * .06) * (1-cloak*.95) } }
      } else if (visible && !(actor.ship.fate === 'destroyed' && time > actor.ship.end + .32)) {
        dummy.position.copy(actor.position); dummy.rotation.set(reduced ? 0 : actor.bank, actor.rotation, 0, 'YXZ'); dummy.scale.setScalar(actor.size); dummy.updateMatrix()
        const group=distantGroups.get(distantKey(actor))!
        group.mesh.setMatrixAt(group.count, dummy.matrix); (group.mesh.geometry.getAttribute('cinemaVisibility') as THREE.InstancedBufferAttribute).setX(group.count,1-cloak*.95); group.mesh.setColorAt(group.count++, tint.setHex(0xffffff).multiplyScalar(1 - (time >= actor.ship.end && actor.ship.fate === 'knocked_out' ? .72 : 1 - sampleCinemaHealth(actor.ship,time).hull) * .55))
      }
      if (visible && actor.thrust > 0 && engineCount < engineSprites.length && (actor.model || !(actor.ship.fate === 'destroyed' && time > actor.ship.end))) {
        const sprite = engineSprites[engineCount++]
        sprite.visible = true; sprite.position.copy(actor.position).add(new THREE.Vector3(-Math.cos(actor.rotation) * actor.size * 0.49, 0, Math.sin(actor.rotation) * actor.size * 0.49))
        sprite.scale.setScalar(actor.size * actor.thrust * (.2 + Math.sin(time * 6 + actor.seed) * .01))
        sprite.material.color.setHex(actor.color).multiplyScalar(.9);sprite.material.opacity=1-cloak*.95
      }
    }
    updateGuns()
    if (!reduced) for (const actor of actors) {
      if (!actor.model || actor.ship.kind==='station' || time < actor.ship.start || time > actor.ship.end+5) continue

      for (let segment=0;segment<4 && trailCount<240;segment++) {
        const now=time-segment*.3, before=now-.3
        if (before<actor.ship.start || now>actor.ship.end) continue
        const head=motionAt(actor,now), tail=motionAt(actor,before)
        if (head.thrust < .4 || tail.thrust < .4) continue
        pointA.set(head.x-Math.cos(head.yaw)*actor.size*.51,head.y,head.z+Math.sin(head.yaw)*actor.size*.51)
        pointB.set(tail.x-Math.cos(tail.yaw)*actor.size*.51,tail.y,tail.z+Math.sin(tail.yaw)*actor.size*.51)
        direction.copy(pointB).sub(pointA)
        dummy.position.copy(pointA).add(pointB).multiplyScalar(.5); dummy.quaternion.setFromUnitVectors(up,direction.clone().normalize())
        dummy.scale.set(actor.size*.0025*(1-segment/5),direction.length(),actor.size*.0025*(1-segment/5));dummy.updateMatrix()
        trails.setMatrixAt(trailCount,dummy.matrix); trails.setColorAt(trailCount++,tint.setHex(actor.color).multiplyScalar((1-segment/5)*.5))
      }
    }
    trails.count=trailCount;trails.instanceMatrix.needsUpdate=true;if(trails.instanceColor)trails.instanceColor.needsUpdate=true
    for(const group of distantGroups.values()){group.mesh.count=group.count;group.mesh.instanceMatrix.needsUpdate=true;group.mesh.geometry.getAttribute('cinemaVisibility').needsUpdate=true;if(group.mesh.instanceColor)group.mesh.instanceColor.needsUpdate=true}
    for (let i = engineCount; i < engineSprites.length; i++) engineSprites[i].visible = false

    let shotIndex = film.shots.findIndex(s => time >= s.start && time < s.end)
    if (shotIndex < 0) shotIndex = Math.max(0, film.shots.length - 1)
    const shot = film.shots[shotIndex]
    const cameraOptions=cameraOptionsAt(shot,time)
    const {subject,target,sequence}=cameraOptions
    const subjectActor=byId.get(subject.id), targetActor=target ? byId.get(target.id) : undefined
    const battlefield=cameraOptions.battlefield ?? []
    const planKey=`${camera.aspect.toFixed(4)}:${reduced}`
    if (!shotPlan || shotPlanKey!==planKey) {
      const started=performance.now()
      shotPlan=buildShotPlan(film,{optionsAt:cameraOptionsAt,bodiesAt:cameraBodiesAt})
      if(process.env.NODE_ENV==='development') {canvas.dataset.cinemaPlanningMs=(performance.now()-started).toFixed(1);canvas.dataset.cinemaMarkingMs=markingMilliseconds.toFixed(1)}
      shotPlanKey=planKey
    }
    const frame=samplePlannedCamera(shotPlan,shot,cameraOptions,cameraBodiesAt(time))
    if(!reduced){
      // Handheld drift plus a decaying shake from nearby losses and hull hits.
      // Both rotate the aim only, so hull clearance is unchanged; both are
      // functions of absolute time, so seeking reproduces the frame.
      let shake=0
      for(const cue of activeCues){
        const victim=byId.get(cue.to??''), age=time-cue.time
        if(!victim||age<0)continue
        const near=Math.min(1,victim.size*2.5/Math.max(1,frame.position.distanceTo(victim.position)))
        if((cue.kind==='death'||cue.kind==='knockout')&&age<1.6)shake=Math.max(shake,Math.exp(-age*3.2)*near*(cue.kind==='death'?1:.6))
        else if(cue.kind==='weapon'&&cue.hit&&(cue.hullDamage??0)>0){const impact=weaponImpactAge(cue,time);if(impact>=0&&impact<.5)shake=Math.max(shake,.22*Math.exp(-impact*9)*near)}
      }
      const reach=frame.position.distanceTo(frame.target), wobble=.0035+shake*.035
      frame.target.x+=reach*wobble*(Math.sin(time*.9+1.3)*.6+Math.sin(time*(2.3+shake*20)+.4)*(.4+shake))
      frame.target.y+=reach*wobble*(Math.sin(time*.7+2.1)*.6+Math.sin(time*(2.9+shake*23)+1.7)*(.4+shake))
    }
    cameraPosition.copy(frame.position);cameraTarget.copy(frame.target)
    camera.position.copy(frame.position);sky.position.copy(camera.position);stars.position.copy(camera.position);planet.position.copy(camera.position).add(planetOffset);atmosphere.position.copy(planet.position);solar.position.copy(camera.position).addScaledVector(sunDirection,7000);solarCore.position.copy(solar.position);camera.fov=frame.fov;camera.far=Math.max(14000,...battlefield.map(body=>camera.position.distanceTo(body.position)+body.size*2+500));camera.lookAt(frame.target);camera.updateProjectionMatrix()
    const shadowRadius=Math.max(90,subject.size*1.1)
    // Key leans toward the camera's side of the star so visible faces stay lit.
    camera.getWorldDirection(viewForward);viewRight.crossVectors(viewForward,up).normalize()
    const keySide=Math.sign(viewRight.dot(sunDirection))||1
    keyDirection.copy(viewRight).multiplyScalar(keySide*.6).addScaledVector(viewForward,-.55).addScaledVector(up,.6).normalize().multiplyScalar(.5).addScaledVector(sunDirection,.5).normalize()
    sun.position.copy(subject.position).addScaledVector(keyDirection,1400);sun.target.position.copy(subject.position)
    rim.position.copy(subject.position).addScaledVector(viewForward,450).addScaledVector(up,300).addScaledVector(viewRight,-keySide*420);rim.target.position.copy(subject.position)
    fill.position.copy(subject.position).addScaledVector(viewForward,-500).addScaledVector(up,-250).addScaledVector(viewRight,-keySide*400);fill.target.position.copy(subject.position)
    Object.assign(sun.shadow.camera,{left:-shadowRadius,right:shadowRadius,top:shadowRadius,bottom:-shadowRadius})
    sun.shadow.camera.updateProjectionMatrix()
    if(process.env.NODE_ENV==='development'){
      const planned = shotPlan?.shots.get(shot)
      canvas.dataset.cinemaTransition=planned ? planned.transition.kind+': '+planned.transition.reason : ''
      canvas.dataset.cinemaGoal=planned?.goal ?? ''
      canvas.dataset.cinemaCandidate=String(planned?.candidate ?? 0)
      canvas.dataset.cinemaScore=planned?.score.toFixed(1) ?? ''
      canvas.dataset.cinemaCoverage=planned?.readableIds.join(',') ?? ''
      canvas.dataset.cinemaConcerns=planned?.concerns.join('; ') ?? ''
      canvas.dataset.cinemaShot=shot.role ?? shot.kind
      canvas.dataset.cinemaSubject=subjectActor?.ship.name ?? ''
      canvas.dataset.cinemaTarget=targetActor?.ship.name ?? ''
      canvas.dataset.cinemaSequence=sequence?.id ?? 'opening'
      canvas.dataset.cinemaPixelRatio=String(renderer.getPixelRatio())
      canvas.dataset.cinemaSamples=String(sceneTarget.samples)
      canvas.dataset.cinemaCamera=frame.position.toArray().map(value=>value.toFixed(1)).join(',')
      canvas.dataset.cinemaFocus=frame.target.toArray().map(value=>value.toFixed(1)).join(',')
      // Projected hull size as a fraction of the frame (planner measure), for capture review.
      const sized=cameraBodiesAt(time)
      canvas.dataset.cinemaSubjectSize=measureShotVisibility(frame,camera.aspect,subject,sized).size.toFixed(3)
      canvas.dataset.cinemaTargetSize=target?measureShotVisibility(frame,camera.aspect,target,sized).size.toFixed(3):''
      canvas.dataset.cinemaBodies=[subject,target].filter(Boolean).map(body=>body!.id.slice(0,6)+':'+body!.size.toFixed(0)+'@'+body!.position.toArray().map(value=>value.toFixed(0)).join(',')).join(' ')
    }

    let fireballCount = 0, blastRingCount = 0, boardingStructureCount = 0, beamCount = 0, sparkCount = 0, flashCount = 0, shieldCount = 0, shockwaveCount = 0, projectileCount = 0
    pulseLight.intensity = 0
    let muzzleCount = 0
    for (const light of muzzleLights) light.intensity = 0
    // One screen pixel in world units at the camera depth of `point`.
    const pixelScale = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, canvas.clientHeight || 720)
    const pixelAt = (point: THREE.Vector3) => Math.max(0, pointC.copy(point).sub(camera.position).dot(viewForward)) * pixelScale
    // Engines stay readable as points of side-colored light from any range.
    for (let i = 0; i < engineCount; i++) engineSprites[i].scale.setScalar(Math.max(engineSprites[i].scale.x, pixelAt(engineSprites[i].position) * 7))
    let navCount = 0
    for (const actor of actors) {
      const bounds = actor.contactBounds
      if (!actor.model?.visible || !bounds || navCount > navLights.length - 2 || (time >= actor.ship.end && ['destroyed','knocked_out','captured'].includes(actor.ship.fate))) continue
      actor.model.updateMatrixWorld()
      for (const tip of [bounds.min.z, bounds.max.z]) {
        const phase = (time * .7 + (actor.seed % 1000) / 1000 + (tip > 0 ? .5 : 0)) % 1
        const light = navLights[navCount++]; light.visible = true
        light.position.set((bounds.min.x + bounds.max.x) * .5 / actor.size, bounds.max.y * .9 / actor.size, tip * 1.02 / actor.size)
        actor.model.localToWorld(light.position)
        light.scale.setScalar(Math.max(actor.size * .05, pixelAt(light.position) * 5) * (phase < .1 ? 1 : .45))
        light.material.color.setHex(actor.color).multiplyScalar(phase < .1 ? 4 : 1.2)
      }
    }
    for (let i = navCount; i < navLights.length; i++) navLights[i].visible = false
    const addBeam = (a: THREE.Vector3, b: THREE.Vector3, width: number, color: number, brightness = 2.2) => {
      if (beamCount >= (actualQuality === 'low' ? 96 : 320)) return
      direction.copy(b).sub(a)
      dummy.position.copy(a).add(b).multiplyScalar(0.5)
      // Bolts keep a readable screen thickness at any range.
      width = Math.max(width, pixelAt(dummy.position) * .9)
      dummy.quaternion.setFromUnitVectors(up, direction.clone().normalize())
      dummy.scale.set(width, Math.max(0.01, direction.length()), width); dummy.updateMatrix()
      beams.setMatrixAt(beamCount, dummy.matrix); beams.setColorAt(beamCount++, tint.setHex(color).multiplyScalar(brightness))
    }
    let smokeCount = 0
    const addSmoke = (a: THREE.Vector3, b: THREE.Vector3, width: number, opacity: number) => {
      if (smokeCount >= 192) return
      direction.copy(b).sub(a)
      dummy.position.copy(a).add(b).multiplyScalar(.5); dummy.quaternion.setFromUnitVectors(up, direction.clone().normalize())
      dummy.scale.set(Math.max(width, pixelAt(dummy.position) * 1.5), Math.max(.01, direction.length()), Math.max(width, pixelAt(dummy.position) * 1.5)); dummy.updateMatrix()
      smoke.setMatrixAt(smokeCount, dummy.matrix); smoke.setColorAt(smokeCount++, tint.setScalar(opacity))
    }
    const addFlash = (position: THREE.Vector3, radius: number, color: number, opacity: number, brightness = 2) => {
      if (flashCount >= flashes.length) return
      const sprite = flashes[flashCount++]
      sprite.visible = true; sprite.position.copy(position); sprite.scale.setScalar(Math.max(radius, pixelAt(position) * 6))
      sprite.material.color.setHex(color).multiplyScalar(brightness); sprite.material.opacity = clamp(opacity, 0, reduced ? 0.35 : 1)
    }
    for (const actor of actors) {
      if (!isVisible(actor,time) || !actor.model) continue
      const health=sampleCinemaHealth(actor.ship,time)
      const destroyed=time>=actor.ship.end && actor.ship.fate==='destroyed'
      const disabled = time >= actor.ship.end && ['destroyed', 'knocked_out'].includes(actor.ship.fate)
      const damage=destroyed ? 1 : disabled ? .72 : 1-health.hull
      actor.model.traverse(object=> {
        if(object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.engine){
          const material=object.material
          const cloak=cloakById.get(actor.ship.id) ?? 0
          material.userData.uncloaked ??= {opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite}
          const original=material.userData.uncloaked
          const transparent=original.transparent || cloak>.01
          if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true}
          material.opacity=original.opacity*(1-cloak*.88);material.depthWrite=cloak>.01?false:original.depthWrite
          material.userData.originalColor ??= material.color.clone()
          material.color.copy(material.userData.originalColor).multiplyScalar(1-damage*.55)
          material.userData.originalEmissive ??= material.emissiveIntensity
          material.emissiveIntensity = disabled ? 0 : material.userData.originalEmissive*(1-cloak*.95)
        }
      })
      if(flashCount < flashes.length - 12 && damage>.5 && actor.ship.fate!=='knocked_out' && actor.ship.fate!=='captured'){
        pointA.copy(actor.position);pointA.y+=actor.size*.08
        addFlash(pointA,actor.size*.28,0xff873e,(.12+Math.sin(time*5+actor.seed)*.04)*damage)
      }
    }
    let cascadeWaveCount=0,cascadeFlashCount=0,cascadeArcCount=0
    const cascadeLine=(a:THREE.Vector3,b:THREE.Vector3,width:number,color:number,opacity:number)=>{
      if(cascadeArcCount>=128)return
      direction.copy(b).sub(a)
      dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,direction.clone().normalize())
      dummy.scale.set(width,Math.max(.01,direction.length()),width);dummy.updateMatrix()
      cascadeArcs.setMatrixAt(cascadeArcCount,dummy.matrix);cascadeArcs.setColorAt(cascadeArcCount++,tint.setHex(color).multiplyScalar(opacity*1.5))
    }
    for(const plan of cascadePlans){
      if(time<plan.time || time>=plan.time+plan.duration)continue
      const cascade=sampleCinemaCascade(plan,time,(actualQuality==='low'?16:32)-cascadeFlashCount)
      const source=cuesById.get(plan.sourceCueId)
      const color=getWeaponColor(source?.weaponFamily??resolveWeaponFamily(source?.weaponName,plan.damageType),plan.damageType)
      if(cascade.wave && cascadeWaveCount<cascadeWaves.length){
        const shell=cascadeWaves[cascadeWaveCount++];shell.visible=true
        shell.position.set(cascade.wave.center.x,cascade.wave.center.y,cascade.wave.center.z)
        shell.scale.setScalar(Math.max(1,cascade.wave.radius));shell.material.uniforms.color.value.setHex(color)
        shell.material.uniforms.opacity.value=cascade.wave.opacity*(reduced?.04:.1)
      }
      for(const pulse of cascade.pulses){
        const actor=byId.get(pulse.actorId)
        if(!actor)continue
        const pulseColor=pulse.fate==='knockout'?0x98d8ff:pulse.fate==='death'?0xffa65d:color
        const flash=cascadeFlashes[cascadeFlashCount++];flash.visible=true;flash.position.copy(actor.position)
        flash.scale.setScalar(actor.size*(pulse.fate==='hit'?1.8:3.2)*(1+pulse.age*2))
        flash.material.color.setHex(pulseColor);flash.material.opacity=pulse.opacity*(reduced?.2:.85)
        if(!reduced)for(let branch=0;branch<3;branch++){
          const phase=branch*2.1+pulse.age*15
          pointA.set(Math.cos(phase)*actor.size*.5,Math.sin(phase*2)*actor.size*.2,Math.sin(phase)*actor.size*.3).applyAxisAngle(up,actor.rotation).add(actor.position)
          pointB.set(Math.cos(phase+1.4)*actor.size*.5,Math.sin(phase*2+2.8)*actor.size*.2,Math.sin(phase+1.4)*actor.size*.3).applyAxisAngle(up,actor.rotation).add(actor.position)
          cascadeLine(pointA,pointB,Math.max(.18,actor.size*.006),pulseColor,pulse.opacity)
        }
      }
      if(!reduced)for(const link of cascade.links){
        const from=byId.get(link.fromActorId),to=byId.get(link.toActorId)
        if(from&&to)cascadeLine(from.position,to.position,.5,color,link.opacity)
      }
    }
    cascadeArcs.count=cascadeArcCount;cascadeArcs.instanceMatrix.needsUpdate=true;if(cascadeArcs.instanceColor)cascadeArcs.instanceColor.needsUpdate=true
    for(let i=cascadeWaveCount;i<cascadeWaves.length;i++)cascadeWaves[i].visible=false
    for(let i=cascadeFlashCount;i<cascadeFlashes.length;i++)cascadeFlashes[i].visible=false
    const effectFocus = { subjectId: subject.id, causeCueId: sequence?.causeCueId, eventCueId: sequence?.eventCueId }
    const pulseCue = selectCinemaPulseCue(activeCues, time, effectFocus)
    for (const cue of prioritizeCinemaEffects(activeCues, effectFocus)) {
      const age = time - cue.time
      if (age < 0 || age > cueLifetime(cue)) continue
      const from = cue.from ? byId.get(cue.from) : undefined
      const to = cue.to ? byId.get(cue.to) : undefined
      const destination = to ?? from
      if (!destination) continue
      const color = getWeaponColor(cue.weaponFamily ?? resolveWeaponFamily(cue.weaponName,cue.damageType),cue.damageType)
      const seed = hash(cue.id)
      if (cue.kind === 'boarding' && from && to) {
        const contact = boardingMotion(from.ship.id, time).boardingContact
        if (!contact) continue
        const sockets = contact ? { from: new THREE.Vector3(contact.actor.x, contact.actor.y, contact.actor.z), to: new THREE.Vector3(contact.target.x, contact.target.y, contact.target.z) } : undefined
        const visual=boardingVisual(cue,age,from.position,to.position,from.size,to.size,reduced,sockets)
        for(const rail of visual.structuralLines){
          if(boardingStructureCount>=32)break
          direction.copy(rail.to).sub(rail.from)
          const length=direction.length()
          if(length<.001)continue
          dummy.position.copy(rail.from).add(rail.to).multiplyScalar(.5)
          dummy.quaternion.setFromUnitVectors(up,direction.divideScalar(length))
          dummy.scale.set(rail.width,length,rail.width);dummy.updateMatrix()
          boardingStructures.setMatrixAt(boardingStructureCount,dummy.matrix)
          boardingStructures.setColorAt(boardingStructureCount++,tint.setHex(rail.color))
        }
        for(const beam of visual.lines)addBeam(beam.from,beam.to,beam.width,beam.color)
        for(const flash of visual.glows)addFlash(flash.position,flash.radius,flash.color,flash.opacity)
        for(const wave of visual.rings){
          if(shockwaveCount>=shockwaves.length)break
          const ring=shockwaves[shockwaveCount++];ring.visible=true;ring.position.copy(wave.position);ring.quaternion.copy(camera.quaternion)
          ring.scale.setScalar(wave.radius);ring.material.color.setHex(wave.color);ring.material.opacity=wave.opacity
        }
      } else if (cue.kind === 'weapon' && from && to) {
        if(cascadeCollateral.has(cue.id))continue
        pointA.copy(from.position).add(new THREE.Vector3(Math.cos(from.rotation)*from.size*.42,from.size*.12,-Math.sin(from.rotation)*from.size*.42))
        aimPoint(cue,pointB)
        const mount=cueMount.get(cue.id),rig=from.model?.userData.weaponRig as WeaponRig|undefined
        if(mount!==undefined && rig && from.model && weaponMuzzleLocal(rig,mount,pointA)) from.model.localToWorld(pointA)
        if(cue.secondaryKind==='retaliation'||/galvanic hull grid/i.test(cue.weaponName??''))pointA.copy(from.position)
        const parent=cuesById.get(cue.parentId ?? '')
        const collateralOrigin=parent?.to ? byId.get(parent.to)?.position : undefined
        const outsideArc=mount!==undefined && rig && from.model && !canAimWeaponMount(rig,mount,from.model.worldToLocal(pointB.clone()))
        const visual=suppressedGuns.has(cue.id)||outsideArc?{lines:[],glows:[],rings:[],projectiles:[]}:weaponVisual(cue,age,pointA,pointB,from.size,to.size,reduced,collateralOrigin,from.color)
        if(visual.lines.length && age<.18 && !reduced && muzzleCount<muzzleLights.length){
          const light=muzzleLights[muzzleCount++];light.position.copy(pointA);light.color.setHex(mixColor(color,from.color,.6))
          light.intensity=from.size*from.size*6*(1-age/.18);light.distance=from.size*1.2
        }
        for(const beam of visual.lines){
          if(beam.smoke){addSmoke(beam.from,beam.to,beam.width,beam.brightness??1);continue}
          addBeam(beam.from,beam.to,beam.width,beam.color,2.2*(beam.brightness??1))
        }
        for(const flash of visual.glows)addFlash(flash.position,flash.radius,flash.color,flash.opacity)
        for(const wave of visual.rings){
          if(shockwaveCount>=shockwaves.length)break
          const ring=shockwaves[shockwaveCount++];ring.visible=true;ring.position.copy(wave.position);ring.quaternion.copy(camera.quaternion)
          ring.scale.setScalar(wave.radius);ring.material.color.setHex(wave.color);ring.material.opacity=wave.opacity
        }
        for(const projectile of visual.projectiles){
          if(projectileCount>=96)break
          dummy.position.copy(projectile.position);dummy.quaternion.setFromUnitVectors(up,projectile.direction);dummy.scale.setScalar(projectile.size);dummy.updateMatrix()
          projectiles.setMatrixAt(projectileCount,dummy.matrix);projectiles.setColorAt(projectileCount++,tint.setHex(projectile.color))
        }
        const impactAge = weaponImpactAge(cue, time)
        if (cue.hit && impactAge >= 0 && impactAge < 1.2) {
          const damage = (cue.hullDamage ?? 0) + (cue.shieldDamage ?? 0)
          if (damage > 0 && cue.hullDamage) {
            addFlash(pointB, to.size * .5 * (1 + impactAge), mixColor(color, from.color, .5), (1 - impactAge / 1.2) * .8, 2.4)
            if (impactAge < .18) addFlash(pointB, to.size * .28, 0xffffff, 1 - impactAge / .18, 5)
          }
          // A stopped volley lights the shield, never a penetrating hull explosion.
          if (((cue.shieldDamage ?? 0) > 0 || damage === 0) && !(time >= to.ship.end && ['destroyed', 'knocked_out'].includes(to.ship.fate))) {
            if (shieldCount < shields.length) {
              const shield = shields[shieldCount++]; shield.visible = true; shield.position.copy(to.position); shield.rotation.set(0, to.rotation, 0)
              shield.scale.set(to.size * 0.6, to.size * 0.32, to.size * 0.43)
              shield.updateMatrixWorld()
              const big = cue.critical || (cue.shieldDamage ?? 0) >= 25 ? Math.exp(-impactAge * 8) * .5 : 0
              // The struck face is the one toward the shooter.
              shield.material.uniforms.hit.value.copy(shield.worldToLocal(pointC.copy(from.position))).normalize()
              shield.material.uniforms.local.value = 1; shield.material.uniforms.whole.value = big
              shield.material.uniforms.opacity.value = (1 - impactAge / 1.2) * (reduced ? 0.3 : 1)
              shield.material.uniforms.time.value = impactAge; shield.material.uniforms.color.value.setHex(mixColor(0x62ceff, to.color, .35))
            }
          }
          if ((cue.hullDamage ?? 0) > 0 && sparkCount < 720) {
            if (!reduced && impactAge < .3) for (let j = 0; j < 4; j++) {
              // Hot spark streaks thrown off the struck hull.
              const r = random(seed + j * 31)
              pointA.set(r() - .5, r() - .3, r() - .5).normalize().multiplyScalar(to.size * .5 * Math.sqrt(impactAge / .3)).add(pointB)
              pointC.copy(pointA).lerp(pointB, .5)
              addBeam(pointC, pointA, to.size * .004 * (1 - impactAge / .3), 0xffc27a, 4)
            }
            for (let j = 0; j < 8; j++) {
              const r = random(seed + j * 13), velocity = new THREE.Vector3(r() - 0.5, r() - 0.2, r() - 0.5).multiplyScalar(20)
              dummy.position.copy(pointB).addScaledVector(velocity, impactAge)
              dummy.rotation.set(j + age, j * 2, age * 3); dummy.scale.setScalar((1 - impactAge / 1.2) * 0.8); dummy.updateMatrix()
              sparks.setMatrixAt(sparkCount, dummy.matrix); sparks.setColorAt(sparkCount++, tint.setHex(0xffc074))
            }
          }
        }
      } else if (cue.kind === 'death' || cue.kind === 'knockout' || cue.kind === 'capture') {
        const death = cue.kind === 'death', radius = destination.size
        const effectColor = death ? 0xffa058 : cue.kind === 'capture' ? 0x8cf1cd : 0x8acbff
        const knockout = cue.kind === 'knockout'
        // Flashes never exceed about an eighth of the frame height, however close the camera is.
        const flashCap = pixelAt(destination.position) * (canvas.clientHeight || 720) / 4
        // Knockouts leave an intact unpowered hull; destruction breaks into fragments.
        if (!death && age < 3.8) {
          addFlash(destination.position, Math.min(radius * (1.2 + age * .6), flashCap * (knockout ? 2 : 1)), effectColor, Math.exp(-age * 1.3) * (knockout ? .7 : .3), knockout ? 2 : 1)
          if (age < .15) addFlash(destination.position, Math.min(radius, flashCap), 0xffffff, 1 - age / .15, 2.5)
        }
        if (death) {
          // Seeded variant: flame temperature, number of secondary blasts and
          // their timing, all scaled by hull size. The hull fractures at once
          // and its largest pieces keep burning (see the wreck pass below).
          const r = random(seed ^ 0x9e3779b9), heat = [0xffa04a, 0xffc978, 0xff7036, 0xffb060][seed % 4]
          const pops = radius < 40 ? 2 : radius < 150 ? 4 : 6
          if (age < .12) addFlash(destination.position, Math.min(radius * .9, flashCap), 0xffffff, 1 - age / .12, 3)
          if (age < 1) addFlash(destination.position, Math.min(radius * .4, flashCap * .8), heat, (1 - age) * .22, 1.3)
          for (let lobe = 0; lobe <= pops; lobe++) {
            // Lobe 0 is the main blast; the rest are secondary pops across the hull.
            const at = lobe ? .18 + r() * (radius < 150 ? 1.1 : 1.8) : 0, lobeAge = age - at
            const offset = pointA.set(r() - .5, (r() - .5) * .5, r() - .5).multiplyScalar(radius * .7).clone()
            const size = lobe ? radius * (.1 + r() * .12) : radius * .34
            if (lobeAge < 0 || lobeAge >= 2.2 || fireballCount >= fireballs.length) continue
            const ball = fireballs[fireballCount++]; ball.visible = true
            ball.position.copy(destination.position).add(lobe ? offset.applyAxisAngle(up, destination.rotation) : offset.set(0, 0, 0))
            ball.scale.setScalar(size * (.3 + .7 * (1 - Math.exp(-lobeAge * 4))))
            ball.rotation.set(seed % 7 + lobe, seed % 5 + lobe, 0)
            ball.material.uniforms.age.value = lobeAge * 1.6; ball.material.uniforms.seed.value = seed % 97 + lobe * 13
            ball.material.uniforms.heat.value = (reduced ? .55 : lobe ? .72 : .8)
            if (lobe && lobeAge < .08) addFlash(ball.position, Math.min(size * 1.4, flashCap * .5), 0xffffff, 1 - lobeAge / .08, 2.2)
          }
        }
        if (!reduced && age < 1.4 && death && radius >= 150 && blastRingCount < blastRings.length) {
          const ring = blastRings[blastRingCount++]; ring.visible = true; ring.position.copy(destination.position)
          // Face the camera, tilted a little: a spherical blast front, not a planetary ring.
          ring.quaternion.copy(camera.quaternion).multiply(pointQuaternion.setFromEuler(new THREE.Euler((seed % 5 - 2) * .15, (seed % 3 - 1) * .2, 0)))
          ring.scale.setScalar(radius * (.4 + age * (death ? 1.6 : 1.2)))
          ring.material.uniforms.color.value.setHex(death ? 0xffc890 : effectColor)
          ring.material.uniforms.opacity.value = Math.pow(1 - age / 1.4, 2) * .22
        }
        // Knockouts keep their electrical identity; only captures light a shell.
        if (cue.kind === 'capture' && shieldCount < shields.length && age < 3.2) {
          const shield = shields[shieldCount++]; shield.visible = true; shield.position.copy(destination.position); shield.rotation.y = destination.rotation
          if (death) shield.scale.setScalar(radius * (.5 + age * 1.4))
          else shield.scale.set(radius * (.68 + age * .12), radius * .38, radius * .5)
          shield.material.uniforms.opacity.value = Math.exp(-age * 1.2) * (reduced ? .05 : .12)
          shield.material.uniforms.local.value = 0; shield.material.uniforms.whole.value = 1
          shield.material.uniforms.time.value = age * (knockout ? 3 : 1); shield.material.uniforms.color.value.setHex(effectColor)
        }
        if (!death && !reduced && age < 3.2 && shockwaveCount < shockwaves.length) {
          const ring = shockwaves[shockwaveCount++]; ring.visible = true; ring.position.copy(destination.position)
          ring.rotation.set(Math.PI * .43, 0, destination.rotation)
          ring.scale.setScalar(radius * (.55 + age * (death ? 1.8 : .65)))
          ring.material.color.setHex(effectColor); ring.material.opacity = Math.pow(1 - age / 3.2, 2) * .35
        }
        if (knockout && age < 1.8 && !reduced) {
          for (let branch = 0; branch < 3; branch++) {
            let previous = destination.position.clone()
            for (let j = 1; j <= 5; j++) {
              const phase = j / 5 * Math.PI * 2 + branch * 2.1
              const vertex = new THREE.Vector3(Math.cos(phase) * radius * .5, Math.sin(phase * 2 + age * 19) * radius * .2, Math.sin(phase) * radius * .3)
              vertex.applyAxisAngle(up, destination.rotation).add(destination.position)
              addBeam(previous, vertex, Math.max(.22, radius * .008) * (1 - age / 1.8), 0xb4e0ff, 5); previous = vertex
            }
          }
        }
        if (death) {
          for (let j = 0; j < 48 && sparkCount < 800; j++) {
            const r = random(seed + j * 997)
            dummy.position.copy(destination.position).add(new THREE.Vector3(r() - .5, r() - .35, r() - .5).multiplyScalar(radius * (.15 + age * .72)))
            // Burning fragments trail embers for their first seconds.
            if (!reduced && j % 3 === 0 && age < 2.4) {
              pointA.copy(dummy.position).sub(destination.position).multiplyScalar(Math.max(0, 1 - .55 / Math.max(.2, .15 + age * .72))).add(destination.position)
              addBeam(pointA, dummy.position, radius * .01 * (1 - age / 2.4), age < 1 ? 0xffd08a : 0xff7a30, 3.5)
            }
            dummy.rotation.set(r() * 6 + age, r() * 6 + age * .4, r() * 6)
            const fragment = radius * (.018 + r() * .055) * Math.max(.3, 1 - age / 10)
            dummy.scale.set(fragment * (j % 3 === 0 ? 2.8 : 1), fragment * .45, fragment); dummy.updateMatrix()
            sparks.setMatrixAt(sparkCount, dummy.matrix); sparks.setColorAt(sparkCount++, tint.setHex(age < 1.3 ? 0xffc280 : age < 2.6 ? 0xd75625 : 0x42464d))
          }
        }
        if (cue.id === pulseCue?.id && !reduced) { pulseLight.position.copy(destination.position); pulseLight.color.setHex(effectColor); pulseLight.intensity = radius * radius * (death ? 30 : 8) * Math.exp(-age * 2.5); pulseLight.distance = radius * (death ? 8 : 4) }
      } else if (cue.kind === 'repair' && age < cue.duration) {
        const progress=age/Math.max(.01,cue.duration), wave=Math.sin(progress*Math.PI), repairColor=cue.repairKind==='shield'?0x70cbe6:0x70e6b4
        const center=destination.position.clone();center.y+=destination.size*(progress-.5)*.45
        addFlash(center,destination.size*.5,repairColor,wave*.22)
        if(shockwaveCount<shockwaves.length){const ring=shockwaves[shockwaveCount++];ring.visible=true;ring.position.copy(center);ring.rotation.set(Math.PI/2,0,destination.rotation);ring.scale.setScalar(destination.size*.45);ring.material.color.setHex(repairColor);ring.material.opacity=wave*(reduced?.12:.45)}
      } else if (cue.kind === 'disable' && age < cue.duration) {
        const fade=1-age/Math.max(.01,cue.duration)
        for(let branch=0;branch<(reduced?1:3);branch++){
          let previous=destination.position.clone()
          for(let j=1;j<=5;j++){
            const phase=j/5*Math.PI*2+branch*2.1
            const next=new THREE.Vector3(Math.cos(phase)*destination.size*.5,Math.sin(phase*2+age*11)*destination.size*.16,Math.sin(phase)*destination.size*.3).applyAxisAngle(up,destination.rotation).add(destination.position)
            addBeam(previous,next,Math.max(.18,destination.size*.003)*fade,0xabbbff);previous=next
          }
        }
      } else if (cue.kind === 'drain' && from && to && age < cue.duration) {
        const progress=age/Math.max(.01,cue.duration)
        if(cue.drainTransferred){
          // Only an actual shield transfer or lifesteal heal names a beneficiary.
          const head=to.position.clone().lerp(from.position,progress),tail=to.position.clone().lerp(from.position,Math.max(0,progress-.2))
          addBeam(tail,head,Math.max(.25,from.size*.006),0xbba0ff)
          addFlash(head,from.size*.18,0xc3a6ff,.5*Math.sin(progress*Math.PI))
        }else if(shockwaveCount<shockwaves.length){
          const ring=shockwaves[shockwaveCount++];ring.visible=true;ring.position.copy(to.position);ring.quaternion.copy(camera.quaternion)
          ring.scale.setScalar(to.size*(.65-progress*.4));ring.material.color.setHex(0x859fcf);ring.material.opacity=Math.sin(progress*Math.PI)*.45
        }
      } else if (cue.kind === 'cloak' && age < cue.duration) {
        if(shieldCount<shields.length){const shield=shields[shieldCount++];shield.visible=true;shield.position.copy(destination.position);shield.rotation.y=destination.rotation;shield.scale.set(destination.size*.6,destination.size*.32,destination.size*.43);shield.material.uniforms.opacity.value=Math.sin(age/cue.duration*Math.PI)*(reduced?.1:.45);shield.material.uniforms.time.value=age*.4;shield.material.uniforms.color.value.setHex(0x8999b8)}
      } else if ((cue.kind === 'arrival' || cue.kind === 'escape') && age < 1.7) {
        addFlash(destination.position, destination.size * (1.1 + age), mixColor(0x80d8ff, destination.color, .4), Math.exp(-age * 3) * 0.35)
        // Warp streak: an arrival decelerates out of a long streak along its heading.
        if (cue.kind === 'arrival' && age < .6 && !reduced && destination.ship.kind !== 'station') {
          pointA.set(Math.cos(destination.rotation), 0, -Math.sin(destination.rotation)).multiplyScalar(-destination.size * 8 * (1 - age / .6)).add(destination.position)
          addBeam(pointA, destination.position, destination.size * .02 * (1 - age / .6), mixColor(0xcfefff, destination.color, .3), 2)
        }
      } else if (cue.kind === 'burn' && age < cue.duration) {
        addFlash(destination.position, destination.size * 0.5, 0xff8c40, 0.18 * Math.sin(age / cue.duration * Math.PI))
      }
    }
    for(const {actor,wreck,burning} of wrecks){
      const wreckAge=time-actor.ship.end-WRECK_BREAKUP_DELAY
      wreck.sample(wreckAge,reduced)
      wreck.mesh.position.copy(actor.position)
      wreck.mesh.rotation.set(reduced?0:actor.bank,actor.rotation,0,'YXZ')
      // The largest pieces keep burning: flickering fires that die down over seconds.
      if(wreckAge<0||wreckAge>9||!wreck.mesh.visible)continue
      wreck.mesh.updateMatrixWorld()
      for(const [index,fragment] of burning.entries()){
        const flicker=.7+.3*Math.sin(time*23+index*5.1)*Math.sin(time*7.3+index)
        const fade=Math.exp(-wreckAge*.35)*(reduced?.5:1)
        pointA.copy(fragment.pivot).add(sampleWreckFragment(fragment,wreckAge,reduced).offset)
        wreck.mesh.localToWorld(pointA)
        addFlash(pointA,actor.size*(.1+.05*flicker)*(1+wreckAge*.08),index%2?0xff8a3a:0xffb050,fade*flicker*.85,1.8)
      }
    }
    projectiles.count=projectileCount;projectiles.instanceMatrix.needsUpdate=true;if(projectiles.instanceColor)projectiles.instanceColor.needsUpdate=true
    boardingStructures.count=boardingStructureCount;boardingStructures.instanceMatrix.needsUpdate=true
    if(boardingStructures.instanceColor)boardingStructures.instanceColor.needsUpdate=true
    smoke.count = smokeCount; smoke.instanceMatrix.needsUpdate = true; if (smoke.instanceColor) smoke.instanceColor.needsUpdate = true
    beams.count = beamCount; beams.instanceMatrix.needsUpdate = true; if (beams.instanceColor) beams.instanceColor.needsUpdate = true
    sparks.count = sparkCount; sparks.instanceMatrix.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true
    for (let i = flashCount; i < flashes.length; i++) flashes[i].visible = false
    // Shells fade as the camera nears them, so no shot sits inside a bubble.
    for (let i = 0; i < shieldCount; i++) {
      const shell = shields[i], reach = Math.max(shell.scale.x, shell.scale.y, shell.scale.z)
      shell.material.uniforms.opacity.value *= THREE.MathUtils.smoothstep(camera.position.distanceTo(shell.position), reach * 1.15, reach * 2.2)
    }
    for (let i = shieldCount; i < shields.length; i++) shields[i].visible = false
    for (let i = fireballCount; i < fireballs.length; i++) fireballs[i].visible = false
    for (let i = blastRingCount; i < blastRings.length; i++) blastRings[i].visible = false
    for (let i = shockwaveCount; i < shockwaves.length; i++) shockwaves[i].visible = false
    grade.uniforms.time.value = reduced ? 0 : time
    grade.uniforms.amount.value = 0
    audio.intensity(shot?.intensity ?? 0.1, time)
    renderer.info.reset()
    renderer.setRenderTarget(sceneTarget);renderer.clear();renderer.render(scene,camera);renderer.setRenderTarget(null)
    composer.render()
  }

  function safeDraw() {
    try { draw() } catch (error) { playing = false; audio.setPlaying(false); options.onError?.(error instanceof Error ? error.message : 'The renderer stopped.') }
  }
  const emitCues = (previous: number, current: number, sink: (cue: typeof audioCues[number], pan: number) => void = (cue, pan) => audio.cue(cue, pan)) => {
    for (const cue of audioCueRange(audioCues, previous, current)) {
      if (cue.parentId) continue
      const actor = byId.get(cue.audioActorId ?? cue.from ?? cue.to ?? '')
      let pan = 0
      if (actor) { pointA.copy(actor.position).project(camera); pan = pointA.x }
      sink(cue, pan)
    }
  }
  // Development capture: step frames deterministically and render the matching
  // soundtrack offline, so reviews can watch and listen to exactly what plays.
  const captured: { cue: typeof audioCues[number]; pan: number }[] = []
  const capturedIntensity: [number, number][] = []
  const capture = {
    frame(seconds: number) {
      const previous = time
      time = clamp(seconds, 0, film.duration)
      draw()
      capturedIntensity.push([time, film.shots.find(s => time >= s.start && time < s.end)?.intensity ?? 0.1])
      if (time > previous) emitCues(previous, time, (cue, pan) => captured.push({ cue, pan }))
      options.onTime?.(time)
    },
    async audio(sampleRate = 44100) {
      const context = new OfflineAudioContext(2, Math.ceil((film.duration + 3) * sampleRate), sampleRate)
      const offline = new CinemaAudio(context)
      for (const [at, value] of capturedIntensity) offline.intensity(value, at, at)
      for (const { cue, pan } of captured) offline.cue(cue, pan, cue.time)
      return context.startRendering()
    },
  }
  const loop = (now: number) => {
    if (disposed) return
    raf = requestAnimationFrame(loop)
    const realElapsed = (now - last) / 1000
    const elapsed = Math.min(0.1, realElapsed); last = now
    if (!playing || document.hidden) return
    const previous = time
    time = Math.min(film.duration, time + elapsed)
    emitCues(previous, time)
    try { draw() } catch (error) { playing = false; audio.setPlaying(false); options.onError?.(error instanceof Error ? error.message : 'The renderer stopped.'); return }
    if (now - reportAt > 100) { options.onTime?.(time); reportAt = now }
    if (time >= film.duration) { playing = false; audio.setPlaying(false); options.onTime?.(time); options.onEnd?.() }
    sampleFrames++; sampleElapsed += realElapsed; qualityAge += realElapsed
    if (sampleElapsed > 3) {
      if (process.env.NODE_ENV === 'development') { canvas.dataset.cinemaFps = (sampleFrames / sampleElapsed).toFixed(1); canvas.dataset.cinemaDrawCalls = String(renderer.info.render.calls); canvas.dataset.cinemaTriangles = String(renderer.info.render.triangles); canvas.dataset.cinemaQuality = actualQuality }
    }
    if (requestedQuality === 'auto' && qualityAge > 8 && sampleElapsed > 3) {
      const fps = sampleFrames / sampleElapsed
      if (fps < 33 && actualQuality !== 'low') { actualQuality = actualQuality === 'high' ? 'medium' : 'low'; setResolution(); qualityAge = 0 }
      sampleFrames = 0; sampleElapsed = 0
    }
  }
  const visibility = () => {
    if (document.hidden) { playing = false; audio.setPlaying(false); options.onTime?.(time) }
    last = performance.now()
  }
  const contextLost = (event: Event) => { event.preventDefault(); playing = false; audio.setPlaying(false); options.onError?.('Graphics context lost. Reload the cinematic to try again.') }
  document.addEventListener('visibilitychange', visibility)
  canvas.addEventListener('webglcontextlost', contextLost)
  cleanups.push(() => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('webglcontextlost', contextLost) })
  draw(); raf = requestAnimationFrame(loop)
  return {
    seek(seconds) { time = clamp(seconds, 0, film.duration); audio.clear(); safeDraw(); options.onTime?.(time) },
    setPlaying(value) { playing = value; last = performance.now(); audio.setPlaying(value) },
    setMuted(value) { audio.setMuted(value) },
    setVolume(value) { audio.setVolume(value) },
    setQuality(value) { requestedQuality = value; actualQuality = value === 'auto' ? initialCinemaQuality(canvas.clientWidth || window.innerWidth) : value; sampleFrames=0;sampleElapsed=0;qualityAge=0;setResolution(); safeDraw() },
    setReducedMotion(value) { reduced = value; safeDraw() },
    capture,
    dispose() {
      if (disposed) return
      disposed = true
      for (const cleanup of cleanups.reverse()) { try { cleanup() } catch { /* Continue disposing independent resources. */ } }
    },
  }
  } catch (error) {
    for (const cleanup of cleanups.reverse()) { try { cleanup() } catch { /* Preserve the initialization error. */ } }
    throw error
  }
}
