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
import { sampleStoryCamera, clearStorySightline, keepCameraOutsideHulls, type CameraBody } from './camera'
import { cinemaRenderSettings, initialCinemaQuality } from './quality'
import { weaponVisual } from './weaponVisuals'
import { getWeaponColor, resolveWeaponFamily } from './weapons'
import { createShip } from './ships'
import { aimWeaponMount, canAimWeaponMount, weaponMuzzleLocal, assignWeaponCues, type WeaponRig } from './ship-weapons'
import { updateRetrothrusters } from './ship-thrusters'
import { resolveAppearance, type ShipAppearance } from './appearance'
import type { CinemaFilm, CinemaShip, CinemaCue } from './types'

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
}

/** The cinema owns its GPU and audio resources; nothing is shared with the tactical viewer. */
export function mountCinema(canvas: HTMLCanvasElement, film: CinemaFilm, appearances: Record<string, ShipAppearance>, options: CinemaOptions = {}): CinemaController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false })
  const cleanups: (() => void)[] = [() => renderer.dispose()]
  try {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
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
    float finiteRadiance(float c){return c >= 0.0 ? min(c, 64.0) : 0.0;}
    void main(){vec4 c=texture2D(tDiffuse,vUv);gl_FragColor=vec4(finiteRadiance(c.r),finiteRadiance(c.g),finiteRadiance(c.b),1.0)*opacity;}`
  composer.addPass(scenePass)
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.3, 2.2)
  composer.addPass(bloom)
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.018 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float amount; varying vec2 vUv;
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb; vec2 p=vUv-.5;
      float vignette=1.-smoothstep(.22,.76,length(p))*.16;
      float grain=fract(sin(dot(vUv*vec2(1920.,1080.)+mod(time,73.),vec2(12.9898,78.233)))*43758.5453)-.5;
      c*=vignette; c+=grain*amount; gl_FragColor=vec4(max(c,vec3(0.)),1.);}`,
  })
  composer.addPass(grade)
  composer.addPass(new OutputPass())

  // Soft three-point light, with a warm distant sun and icy ship-side bounce.
  scene.add(new THREE.HemisphereLight(0xbacbdc, 0x101119, 1.35))
  const sun = new THREE.DirectionalLight(0xffe2b9, 3.6)
  sun.position.set(-400, 260, 170); scene.add(sun); scene.add(sun.target)
  const sunDirection = sun.position.clone().normalize()
  cleanups.push(()=>sun.shadow.dispose())
  sun.castShadow=true; sun.shadow.bias=-.00008; sun.shadow.normalBias=.025
  sun.shadow.camera.near=10;sun.shadow.camera.far=3000
  const rim = new THREE.DirectionalLight(0x94c9ed, 1.8)
  rim.position.set(150, 80, -300); scene.add(rim)
  const fill = new THREE.DirectionalLight(0xc4ccdd, .45)
  fill.position.set(0, -150, 200); scene.add(fill)
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
  scene.environment=reflectionMap.texture; scene.environmentIntensity=.8
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
      vec3 color=vec3(.002,.005,.012)+cloud*mix(vec3(.035,.095,.13),vec3(.22,.075,.027),smoothstep(-.3,.8,d.x));
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

  // Planetary limb anchors scale without inventing any combat participants.
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1100, 72, 48), new THREE.ShaderMaterial({
    uniforms: { light: { value: new THREE.Vector3(-0.5, 0.3, 0.8).normalize() } },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){vN=normal;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vN;varying vec3 vP;uniform vec3 light;void main(){float l=max(0.,dot(normalize(vN),light));float bands=sin(vP.y*.016+sin(vP.x*.008)*1.3)*.5+.5;vec3 c=mix(vec3(.022,.039,.055),vec3(.085,.14,.17),bands);gl_FragColor=vec4(c*(.08+l),1.);}`,
  }))
  planet.position.set(-2300, -1250, -3400); scene.add(planet)
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1110, 64, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader: 'varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-max(0.,dot(vN,vV)),4.);gl_FragColor=vec4(.12,.5,.8,f*.5);}',
  }))
  atmosphere.position.copy(planet.position); scene.add(atmosphere)
  const solar = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd6a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
  solar.position.set(-2600, 950, -2100); solar.scale.set(1800, 1800, 1); scene.add(solar)

  const sides = [...new Set(film.ships.map(s => s.sideIndex))]
  const shipRanks = new Map<string, number>()
  const sideCounts = new Map<number, number>()
  for (const ship of film.ships) {
    const key = `${ship.sideIndex}:${ship.playerId}`
    if (!shipRanks.has(key)) { shipRanks.set(key, sideCounts.get(ship.sideIndex) ?? 0); sideCounts.set(ship.sideIndex, (sideCounts.get(ship.sideIndex) ?? 0) + 1) }
  }
  // Hero detail is reserved for participants the director actually follows.
  const featured = new Set(film.shots.flatMap(s => [s.subject, s.target]).filter(Boolean))
  const priority = [...film.ships].sort((a, b) => Number(featured.has(b.id)) - Number(featured.has(a.id)))
  const detailed = new Set(priority.slice(0, 28).map(s => s.id))
  const actors = film.ships.map((ship): Actor => {
    const known = appearances[ship.shipClass] ?? (ship.kind==='station' ? resolveAppearance('station',undefined,5,'',0,'station') : undefined)
    const appearance = ['station', 'creature', 'drone'].includes(ship.kind) ? { ...(known ?? resolveAppearance(ship.shipClass)), family: ship.kind as ShipAppearance['family'] } : known ?? resolveAppearance(ship.shipClass)
    const size = clamp(appearance.length * 9, 16, 400)
    const seed = hash(ship.id)
    const side = sides.indexOf(ship.sideIndex)
    const angle = side / Math.max(2, sides.length) * Math.PI * 2
    const lane = shipRanks.get(`${ship.sideIndex}:${ship.playerId}`) ?? 0
    const model = detailed.has(ship.id) ? createShip(appearance, seed, 'hero', ship.hardware) : null
    const engineMaterials: { material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial; intensity: number }[] = []
    if (model) {
      model.scale.setScalar(size)
      model.traverse(object => {
        if (object instanceof THREE.Mesh && object.userData.engine && !object.userData.retrothruster) {
          const material = object.material
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) engineMaterials.push({ material, intensity: object.userData.baseIntensity ?? 1 })
        }
      })
      scene.add(model)
    }
    return { ship, appearance, model, position: new THREE.Vector3(), rotation: 0, bank: 0, thrust: 1, retroThrust: 0, size, angle, lane, seed, engineMaterials }
  })
  const fleetSpacing = new Map(sides.map(side => [side, fleetMotionSpacing(actors.filter(a=>a.ship.sideIndex===side && a.ship.kind!=='station').map(a=>({size:a.size,beam:a.appearance.beam})))]))
  const fleetDepth = new Map(sides.map(side => [side, Math.max(130,...actors.filter(a=>a.ship.sideIndex===side && a.ship.kind!=='station').map(a=>a.size*1.25+55))]))
  const formations = new Map(sides.flatMap(side => [...buildFleetFormation(actors.filter(actor => actor.ship.sideIndex === side).map(actor => ({
    id: actor.ship.id, playerId: actor.ship.playerId, size: actor.size, beam: actor.appearance.beam, kind: actor.ship.kind, family: actor.appearance.family,
  })), sides.length)]))
  const byId = new Map(actors.map(a => [a.ship.id, a]))
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
        let geometry=object.geometry.clone()
        if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat}
        for(const key of Object.keys(geometry.attributes))if(key!=='position'&&key!=='normal')geometry.deleteAttribute(key)
        const material = (Array.isArray(object.material)?object.material[0]:object.material) as THREE.MeshStandardMaterial
        const colors = new Float32Array(geometry.getAttribute('position').count*3)
        for(let i=0;i<colors.length;i+=3) material.color.toArray(colors,i)
        geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
        geometry.applyMatrix4(object.matrixWorld);pieces.push(geometry)
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
  for (let i = 0; i < 40; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x75dfff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    sprite.visible = false; scene.add(sprite); engineSprites.push(sprite)
  }
  // Near-field particulate and exhaust give tracked shots visible parallax.
  const dustGeometry = new THREE.BufferGeometry()
  const dustPositions = new Float32Array(800 * 3)
  for (let i=0;i<dustPositions.length;i++) dustPositions[i]=(rng()-.5)*2200
  dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3))
  scene.add(new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0xa0b6c4,size:.75,transparent:true,opacity:.24,depthWrite:false})))
  const trails = new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.1,blending:THREE.AdditiveBlending,depthWrite:false}),240)
  trails.frustumCulled=false; trails.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(trails)
  const beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), 160)
  beams.frustumCulled = false; beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(beams)
  const projectiles = new THREE.InstancedMesh(new THREE.ConeGeometry(.5, 2.8, 7), new THREE.MeshStandardMaterial({color:0xffffff,metalness:.75,roughness:.35}),96)
  projectiles.frustumCulled=false;projectiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(projectiles)
  const wrecks = new THREE.InstancedMesh(new THREE.BoxGeometry(1,.45,.75),new THREE.MeshStandardMaterial({color:0xffffff,metalness:.6,roughness:.86}),168)
  wrecks.frustumCulled=false;wrecks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(wrecks)
  const sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .4, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .55, roughness: .6 }), 800)
  sparks.frustumCulled = false; sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(sparks)
  const flashes: THREE.Sprite[] = []
  const shields: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>[] = []
  for (let i = 0; i < 32; i++) {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    flash.visible = false; scene.add(flash); flashes.push(flash)
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { opacity: { value: 0 }, time: { value: 0 }, color: { value: new THREE.Color(0x66dcff) } },
      vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-p.xyz);vP=position;gl_Position=projectionMatrix*p;}',
      fragmentShader: `varying vec3 vN;varying vec3 vV;varying vec3 vP;uniform float opacity;uniform float time;uniform vec3 color;
        void main(){float rim=pow(1.-abs(dot(vN,vV)),2.);float ring=pow(max(0.,sin(vP.x*22.-time*12.)),12.);gl_FragColor=vec4(color,(rim*.6+ring*.35)*opacity);}`,
    }))
    shield.visible = false; scene.add(shield); shields.push(shield)
  }
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
  let time = 0, playing = false, disposed = false, reduced = options.reducedMotion ?? false
  let requestedQuality: CinemaQuality = options.quality ?? 'auto'
  let actualQuality = requestedQuality === 'auto' ? initialCinemaQuality(canvas.clientWidth || window.innerWidth) : requestedQuality
  let raf = 0, last = performance.now(), reportAt = 0, sampleFrames = 0, sampleElapsed = 0, qualityAge = 0
  const audioCues = buildAudioSchedule(film.cues)
  const cuesById = new Map(film.cues.map(cue=>[cue.id,cue]))
  const effectWindow = film.cues.reduce((max, cue) => Math.max(max, cue.duration + 2), 7)
  const clearanceByShot = new Map<string,number>()
  const cameraTarget = new THREE.Vector3(), cameraPosition = new THREE.Vector3()
  const pointA = new THREE.Vector3(), pointB = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3()
  const motionOptions = (actor: Actor): ShipMotionOptions => ({ size: actor.size, angle: actor.angle, lane: actor.lane, seed: actor.seed,
    formation: formations.get(actor.ship.id), fleetCount: sides.length, sideCount: sideCounts.get(actor.ship.sideIndex) ?? 1, spacing: fleetSpacing.get(actor.ship.sideIndex) ?? 90, depth: fleetDepth.get(actor.ship.sideIndex) ?? 130 })
  const positionAt = (actor: Actor, t: number) => {
    const motion = sampleShipMotion(actor.ship,t,motionOptions(actor))
    actor.position.set(motion.x,motion.y,motion.z)
    actor.rotation=motion.yaw; actor.bank=motion.bank; actor.thrust=motion.thrust; actor.retroThrust=motion.retroThrust
    return actor.position
  }
  const cascadePlans = buildCinemaCascades(film.cues,(id,at)=>{
    const actor=byId.get(id)
    return actor ? sampleShipMotion(actor.ship,at,motionOptions(actor)) : undefined
  }).filter(plan=>plan.kind==='chain' || plan.recipients.length>=6)
  const cascadeGroups = new Set(cascadePlans.map(plan=>`${plan.sourceCueId}:${plan.kind==='chain'?'chain':'area'}`))
  const cascadeCollateral = new Set(film.cues.filter(cue=>cue.hit===true && cue.parentId &&
    ['aoe','ammo_splash','chain'].includes(cue.secondaryKind??'') &&
    cascadeGroups.has(`${cue.parentId}:${cue.secondaryKind==='chain'?'chain':'area'}`)).map(cue=>cue.id))
  const isVisible = (actor: Actor, t: number) => t >= actor.ship.start && (t <= actor.ship.end || !['escaped', 'withdrawn'].includes(actor.ship.fate) || t < actor.ship.end + 2.5)
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
    else {const pose=sampleShipMotion(target.ship,at,motionOptions(target));output.set(pose.x,pose.y,pose.z)}
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
          const at=cue.time+cue.duration*phase, pose=sampleShipMotion(actor.ship,at,motionOptions(actor))
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
        const pose=sampleShipMotion(actor.ship,Math.max(actor.ship.start,actor.ship.end-.00001),motionOptions(actor))
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
        actor.model.visible = visible && !(actor.ship.fate === 'destroyed' && time > actor.ship.end + .32)
        actor.model.position.copy(actor.position)
        actor.model.rotation.set(reduced ? 0 : actor.bank, actor.rotation, 0, 'YXZ')
        updateRetrothrusters(actor.model,actor.retroThrust*(1-cloak*.95))
        for (const { material, intensity } of actor.engineMaterials) { if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = actor.thrust * (2.4 + Math.sin(time * 8 + actor.seed) * .3) * (1-cloak*.95); else { material.transparent = true; material.opacity = actor.thrust * intensity * (.7 + Math.sin(time * 8 + actor.seed) * .06) * (1-cloak*.95) } }
      } else if (visible && !(actor.ship.fate === 'destroyed' && time > actor.ship.end + .32)) {
        dummy.position.copy(actor.position); dummy.rotation.set(reduced ? 0 : actor.bank, actor.rotation, 0, 'YXZ'); dummy.scale.setScalar(actor.size); dummy.updateMatrix()
        const group=distantGroups.get(distantKey(actor))!
        group.mesh.setMatrixAt(group.count, dummy.matrix); (group.mesh.geometry.getAttribute('cinemaVisibility') as THREE.InstancedBufferAttribute).setX(group.count,1-cloak*.95); group.mesh.setColorAt(group.count++, tint.setHex(0xffffff).multiplyScalar(1 - (time >= actor.ship.end && actor.ship.fate === 'knocked_out' ? .72 : 1 - sampleCinemaHealth(actor.ship,time).hull) * .55))
      }
      if (visible && actor.thrust > 0 && engineCount < engineSprites.length && actor.model) {
        const sprite = engineSprites[engineCount++]
        sprite.visible = true; sprite.position.copy(actor.position).add(new THREE.Vector3(-Math.cos(actor.rotation) * actor.size * 0.49, 0, Math.sin(actor.rotation) * actor.size * 0.49))
        sprite.scale.setScalar(actor.size * actor.thrust * (.34 + Math.sin(time * 6 + actor.seed) * .012))
        sprite.material.color.setHex(actor.appearance.accent);sprite.material.opacity=1-cloak*.95
      }
    }
    updateGuns()
    if (!reduced) for (const actor of actors) {
      if (!actor.model || actor.ship.kind==='station' || time < actor.ship.start || time > actor.ship.end+5) continue
      const settings=motionOptions(actor)
      for (let segment=0;segment<8 && trailCount<240;segment++) {
        const now=time-segment*.65, before=now-.65
        if (before<actor.ship.start || now>actor.ship.end) continue
        const head=sampleShipMotion(actor.ship,now,settings), tail=sampleShipMotion(actor.ship,before,settings)
        if (head.thrust < .4 || tail.thrust < .4) continue
        pointA.set(head.x-Math.cos(head.yaw)*actor.size*.51,head.y,head.z+Math.sin(head.yaw)*actor.size*.51)
        pointB.set(tail.x-Math.cos(tail.yaw)*actor.size*.51,tail.y,tail.z+Math.sin(tail.yaw)*actor.size*.51)
        direction.copy(pointB).sub(pointA)
        dummy.position.copy(pointA).add(pointB).multiplyScalar(.5); dummy.quaternion.setFromUnitVectors(up,direction.clone().normalize())
        dummy.scale.set(actor.size*.004*(1-segment/9),direction.length(),actor.size*.004*(1-segment/9));dummy.updateMatrix()
        trails.setMatrixAt(trailCount,dummy.matrix); trails.setColorAt(trailCount++,tint.setHex(actor.appearance.accent).multiplyScalar((1-segment/9)*1.4))
      }
    }
    trails.count=trailCount;trails.instanceMatrix.needsUpdate=true;if(trails.instanceColor)trails.instanceColor.needsUpdate=true
    for(const group of distantGroups.values()){group.mesh.count=group.count;group.mesh.instanceMatrix.needsUpdate=true;group.mesh.geometry.getAttribute('cinemaVisibility').needsUpdate=true;if(group.mesh.instanceColor)group.mesh.instanceColor.needsUpdate=true}
    for (let i = engineCount; i < engineSprites.length; i++) engineSprites[i].visible = false

    let shotIndex = film.shots.findIndex(s => time >= s.start && time < s.end)
    if (shotIndex < 0) shotIndex = Math.max(0, film.shots.length - 1)
    const shot = film.shots[shotIndex]
    const sequence = film.story?.sequences.find(sequence=>sequence.id===shot?.sequenceId)
    const subjectActor = (shot.subject ? byId.get(shot.subject) : undefined) ?? actors.find(a=>isVisible(a,time))
    const targetActor = shot.target ? byId.get(shot.target) : undefined
    const bodyAt = (id: string | undefined, at: number): CameraBody | undefined => {
      const actor=id ? byId.get(id) : undefined
      if(!actor)return undefined
      const motion=sampleShipMotion(actor.ship,at,motionOptions(actor))
      return {id:actor.ship.id,size:actor.size,position:new THREE.Vector3(motion.x,motion.y,motion.z)}
    }
    const subject = subjectActor ? {id:subjectActor.ship.id,size:subjectActor.size,position:subjectActor.position} : {id:'empty',size:60,position:new THREE.Vector3()}
    const target = targetActor ? {id:targetActor.ship.id,size:targetActor.size,position:targetActor.position} : undefined
    const referenceTime=sequence?.start ?? 0
    const axisFrom=bodyAt(shot.axis?.from ?? subject.id,referenceTime)?.position ?? subject.position
    const axisTo=bodyAt(shot.axis?.to ?? target?.id,referenceTime)?.position ?? subject.position.clone().add(new THREE.Vector3(100,0,0))
    const boundaries=actors.filter(actor=>isVisible(actor,time) && !(actor.ship.fate==='destroyed' && time>actor.ship.end+.32)).map(actor=>({id:actor.ship.id,position:actor.position,size:actor.size}))
    // Hold recent wreck/impact anchors for the entire master shot. Removing
    // every destroyed hull at once would zoom away while its blast is visible.
    const battlefield=shot.battlefield ? actors.filter(actor=>isVisible(actor,time) &&
      !(actor.ship.fate==='destroyed' && shot.start>actor.ship.end+7)).map(actor=>({id:actor.ship.id,position:actor.position,size:actor.size})) : boundaries
    const frame=sampleStoryCamera({shot,sequence,time,aspect:camera.aspect,subject,target,battlefield,axisFrom,axisTo,reduced})
    // Clearance is planned over the shot, not switched frame-by-frame as another
    // hull passes the edge of the view. This avoids sudden camera height jumps.
    const clearanceKey=`${shotIndex}:${camera.aspect.toFixed(3)}:${reduced}`
    if(!shot.battlefield && !clearanceByShot.has(clearanceKey)) {
      let lift=0
      for(const sampleTime of [shot.start,(shot.start+shot.end)*.5,shot.end-.001]) {
        const sampledSubject=bodyAt(subject.id,sampleTime) ?? subject
        const sampledTarget=bodyAt(target?.id,sampleTime)
        const planned=sampleStoryCamera({shot,sequence,time:sampleTime,aspect:camera.aspect,subject:sampledSubject,target:sampledTarget,axisFrom,axisTo,reduced})
        const height=planned.position.y
        clearStorySightline(planned,subject.id,actors.filter(actor=>isVisible(actor,sampleTime) && !(actor.ship.fate==='destroyed' && sampleTime>actor.ship.end+.32)).flatMap(actor=>bodyAt(actor.ship.id,sampleTime) ?? []))
        lift=Math.max(lift,planned.position.y-height)
      }
      clearanceByShot.set(clearanceKey,lift)
    }
    frame.position.y+=clearanceByShot.get(clearanceKey) ?? 0
    keepCameraOutsideHulls(frame.position,boundaries.map(body=>({position:body.position,radius:body.size*.78})))
    cameraPosition.copy(frame.position);cameraTarget.copy(frame.target)
    camera.position.copy(frame.position);sky.position.copy(camera.position);stars.position.copy(camera.position);camera.fov=frame.fov;camera.far=Math.max(14000,...battlefield.map(body=>camera.position.distanceTo(body.position)+body.size*2+500));camera.lookAt(frame.target);camera.updateProjectionMatrix()
    const shadowRadius=Math.max(90,subject.size*1.1)
    sun.position.copy(subject.position).addScaledVector(sunDirection,1400);sun.target.position.copy(subject.position)
    Object.assign(sun.shadow.camera,{left:-shadowRadius,right:shadowRadius,top:shadowRadius,bottom:-shadowRadius})
    sun.shadow.camera.updateProjectionMatrix()
    if(process.env.NODE_ENV==='development'){
      canvas.dataset.cinemaShot=shot.role ?? shot.kind
      canvas.dataset.cinemaSubject=subjectActor?.ship.name ?? ''
      canvas.dataset.cinemaTarget=targetActor?.ship.name ?? ''
      canvas.dataset.cinemaSequence=sequence?.id ?? 'opening'
      canvas.dataset.cinemaPixelRatio=String(renderer.getPixelRatio())
      canvas.dataset.cinemaSamples=String(sceneTarget.samples)
      canvas.dataset.cinemaCamera=frame.position.toArray().map(value=>value.toFixed(1)).join(',')
      canvas.dataset.cinemaFocus=frame.target.toArray().map(value=>value.toFixed(1)).join(',')
    }

    let beamCount = 0, sparkCount = 0, flashCount = 0, shieldCount = 0, shockwaveCount = 0, projectileCount = 0, wreckCount = 0
    pulseLight.intensity = 0
    const addBeam = (a: THREE.Vector3, b: THREE.Vector3, width: number, color: number) => {
      if (beamCount >= (actualQuality === 'low' ? 48 : 160)) return
      direction.copy(b).sub(a)
      dummy.position.copy(a).add(b).multiplyScalar(0.5)
      dummy.quaternion.setFromUnitVectors(up, direction.clone().normalize())
      dummy.scale.set(width, Math.max(0.01, direction.length()), width); dummy.updateMatrix()
      beams.setMatrixAt(beamCount, dummy.matrix); beams.setColorAt(beamCount++, tint.setHex(color).multiplyScalar(2))
    }
    const addFlash = (position: THREE.Vector3, radius: number, color: number, opacity: number) => {
      if (flashCount >= flashes.length) return
      const sprite = flashes[flashCount++]
      sprite.visible = true; sprite.position.copy(position); sprite.scale.setScalar(radius)
      sprite.material.color.setHex(color); sprite.material.opacity = clamp(opacity, 0, reduced ? 0.35 : 1)
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
        shell.material.uniforms.opacity.value=cascade.wave.opacity*(reduced?.15:.5)
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
      if (cue.kind === 'weapon' && from && to) {
        if(cascadeCollateral.has(cue.id))continue
        pointA.copy(from.position).add(new THREE.Vector3(Math.cos(from.rotation)*from.size*.42,from.size*.12,-Math.sin(from.rotation)*from.size*.42))
        aimPoint(cue,pointB)
        const mount=cueMount.get(cue.id),rig=from.model?.userData.weaponRig as WeaponRig|undefined
        if(mount!==undefined && rig && from.model && weaponMuzzleLocal(rig,mount,pointA)) from.model.localToWorld(pointA)
        if(cue.secondaryKind==='retaliation'||/galvanic hull grid/i.test(cue.weaponName??''))pointA.copy(from.position)
        const parent=cuesById.get(cue.parentId ?? '')
        const collateralOrigin=parent?.to ? byId.get(parent.to)?.position : undefined
        const outsideArc=mount!==undefined && rig && from.model && !canAimWeaponMount(rig,mount,from.model.worldToLocal(pointB.clone()))
        const visual=suppressedGuns.has(cue.id)||outsideArc?{lines:[],glows:[],rings:[],projectiles:[]}:weaponVisual(cue,age,pointA,pointB,from.size,to.size,reduced,collateralOrigin)
        for(const beam of visual.lines)addBeam(beam.from,beam.to,beam.width,beam.color)
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
          if (damage > 0) addFlash(pointB, to.size * (cue.hullDamage ? 0.75 : 0.4) * (1 + impactAge), color, (1 - impactAge / 1.2) * 0.65)
          // A stopped volley lights the shield, never a penetrating hull explosion.
          if (((cue.shieldDamage ?? 0) > 0 || damage === 0) && !(time >= to.ship.end && ['destroyed', 'knocked_out'].includes(to.ship.fate))) {
            if (shieldCount < shields.length) {
              const shield = shields[shieldCount++]; shield.visible = true; shield.position.copy(to.position); shield.rotation.y = to.rotation
              shield.scale.set(to.size * 0.6, to.size * 0.32, to.size * 0.43)
              shield.material.uniforms.opacity.value = (1 - impactAge / 1.2) * (reduced ? 0.25 : 0.65)
              shield.material.uniforms.time.value = impactAge; shield.material.uniforms.color.value.setHex(0x62ceff)
            }
          }
          if ((cue.hullDamage ?? 0) > 0 && sparkCount < 720) {
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
        // Knockouts leave an intact unpowered hull; destruction breaks into fragments.
        if (age < 3.8) {
          addFlash(destination.position, radius * (death ? 2.6 + age * 2.2 : 1.7 + age), effectColor, Math.exp(-age * (death ? .95 : 1.1)) * (death ? 1 : .8))
          if (death && age < 1.1) addFlash(destination.position, radius * (1 + age), 0xfff5d8, 1 - age / 1.1)
        }
        if (!death && shieldCount < shields.length && age < 3.2) {
          const shield = shields[shieldCount++]; shield.visible = true; shield.position.copy(destination.position); shield.rotation.y = destination.rotation
          if (death) shield.scale.setScalar(radius * (.5 + age * 1.4))
          else shield.scale.set(radius * (.68 + age * .12), radius * .38, radius * .5)
          shield.material.uniforms.opacity.value = Math.exp(-age * .6) * (reduced ? .15 : .95)
          shield.material.uniforms.time.value = age * (knockout ? 3 : 1); shield.material.uniforms.color.value.setHex(effectColor)
        }
        if (!reduced && age < 3.2 && shockwaveCount < shockwaves.length) {
          const ring = shockwaves[shockwaveCount++]; ring.visible = true; ring.position.copy(destination.position)
          ring.rotation.set(Math.PI * .43, 0, destination.rotation)
          ring.scale.setScalar(radius * (.55 + age * (death ? 1.8 : .65)))
          ring.material.color.setHex(effectColor); ring.material.opacity = Math.pow(1 - age / 3.2, 2) * .8
        }
        if (knockout && age < 1.8 && !reduced) {
          for (let branch = 0; branch < 3; branch++) {
            let previous = destination.position.clone()
            for (let j = 1; j <= 5; j++) {
              const phase = j / 5 * Math.PI * 2 + branch * 2.1
              const vertex = new THREE.Vector3(Math.cos(phase) * radius * .5, Math.sin(phase * 2 + age * 19) * radius * .2, Math.sin(phase) * radius * .3)
              vertex.applyAxisAngle(up, destination.rotation).add(destination.position)
              addBeam(previous, vertex, Math.max(.22, radius * .004) * (1 - age / 1.8), 0x94cfff); previous = vertex
            }
          }
        }
        if (death) {
          if (age < 2.8) for (let burst=0;burst<3;burst++) {
            const r=random(seed+burst*73)
            pointA.copy(destination.position).add(new THREE.Vector3(r()-.5,r()-.5,r()-.5).multiplyScalar(radius*(.15+age*.5)))
            addFlash(pointA,radius*(.9+age*.6),burst===0?0xffd196:0xf47731,Math.exp(-age*1.1)*.7)
          }
          for (let j = 0; j < 48 && sparkCount < 800; j++) {
            const r = random(seed + j * 997)
            dummy.position.copy(destination.position).add(new THREE.Vector3(r() - .5, r() - .35, r() - .5).multiplyScalar(radius * (.15 + age * .72)))
            dummy.rotation.set(r() * 6 + age, r() * 6 + age * .4, r() * 6)
            const fragment = radius * (.018 + r() * .055) * Math.max(.3, 1 - age / 10)
            dummy.scale.set(fragment * (j % 3 === 0 ? 2.8 : 1), fragment * .45, fragment); dummy.updateMatrix()
            sparks.setMatrixAt(sparkCount, dummy.matrix); sparks.setColorAt(sparkCount++, tint.setHex(age < 1.3 ? 0xffc280 : age < 2.6 ? 0xd75625 : 0x42464d))
          }
        }
        if (cue.id === pulseCue?.id && !reduced) { pulseLight.position.copy(destination.position); pulseLight.color.setHex(effectColor); pulseLight.intensity = radius * radius * 12 * Math.exp(-age * 3); pulseLight.distance = radius * 7 }
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
        addFlash(destination.position, destination.size * (1.3 + age), 0x80d8ff, Math.exp(-age * 3) * 0.35)
      } else if (cue.kind === 'burn' && age < cue.duration) {
        addFlash(destination.position, destination.size * 0.5, 0xff8c40, 0.18 * Math.sin(age / cue.duration * Math.PI))
      }
    }
    for(const actor of actors){
      if(!actor.model || actor.ship.fate!=='destroyed' || time<actor.ship.end+.4)continue
      const age=time-actor.ship.end
      for(let j=0;j<6 && wreckCount<168;j++){
        const r=random(actor.seed+j*997)
        const offset=new THREE.Vector3(r()-.5,r()-.5,r()-.5).multiplyScalar(actor.size*(.35+Math.min(age,15)*.025))
        dummy.position.copy(actor.position).add(offset);dummy.rotation.set(r()*6+age*.03,r()*6+age*.025,r()*6)
        dummy.scale.set(actor.size*(.12+r()*.14),actor.size*(.08+r()*.07),actor.size*(.14+r()*.1));dummy.updateMatrix()
        wrecks.setMatrixAt(wreckCount,dummy.matrix);wrecks.setColorAt(wreckCount++,tint.setHex(actor.appearance.hull).multiplyScalar(.42))
      }
    }
    wrecks.count=wreckCount;wrecks.instanceMatrix.needsUpdate=true;if(wrecks.instanceColor)wrecks.instanceColor.needsUpdate=true
    projectiles.count=projectileCount;projectiles.instanceMatrix.needsUpdate=true;if(projectiles.instanceColor)projectiles.instanceColor.needsUpdate=true
    beams.count = beamCount; beams.instanceMatrix.needsUpdate = true; if (beams.instanceColor) beams.instanceColor.needsUpdate = true
    sparks.count = sparkCount; sparks.instanceMatrix.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true
    for (let i = flashCount; i < flashes.length; i++) flashes[i].visible = false
    for (let i = shieldCount; i < shields.length; i++) shields[i].visible = false
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
  const emitCues = (previous: number, current: number) => {
    for (const cue of audioCueRange(audioCues, previous, current)) {
      if (cue.parentId) continue
      const actor = byId.get(cue.audioActorId ?? cue.from ?? cue.to ?? '')
      let pan = 0
      if (actor) { pointA.copy(actor.position).project(camera); pan = pointA.x }
      audio.cue(cue, pan)
    }
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

