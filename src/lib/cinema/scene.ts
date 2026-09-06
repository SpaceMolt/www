import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CinemaAudio } from './audio'
import { cueRange, cueLifetime, weaponImpactAge, selectImpactFocus } from './playback'
import { sampleCinemaHealth } from './director'
import { sampleShipMotion, fleetMotionSpacing, type ShipMotionOptions } from './motion'
import { keepCameraOutsideHulls } from './camera'
import { createShip } from './ships'
import { resolveAppearance, type ShipAppearance } from './appearance'
import type { CinemaFilm, CinemaShip } from './types'

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
const smooth = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x) }
const weaponColors: Record<string, number> = { kinetic: 0xffd28b, energy: 0x64eaff, thermal: 0xff814b, explosive: 0xffb25b, em: 0x929bff, void: 0xd39bff }

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
  size: number
  angle: number
  lane: number
  seed: number
  engineMaterials: { material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial; intensity: number }[]
}

/** The cinema owns its GPU and audio resources; nothing is shared with the tactical viewer. */
export function mountCinema(canvas: HTMLCanvasElement, film: CinemaFilm, appearances: Record<string, ShipAppearance>, options: CinemaOptions = {}): CinemaController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false })
  const cleanups: (() => void)[] = [() => renderer.dispose()]
  try {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.info.autoReset = false
  const scene = new THREE.Scene()
  cleanups.push(() => {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite) {
        if ('geometry' in object) geometries.add(object.geometry)
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
  const composer = new EffectComposer(renderer)
  cleanups.push(() => { for (const pass of composer.passes) pass.dispose(); composer.dispose() })
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.55, 1.05)
  composer.addPass(bloom)
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.018 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float amount; varying vec2 vUv;
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb; vec2 p=vUv-.5;
      float vignette=1.-smoothstep(.22,.76,length(p))*.42;
      float grain=fract(sin(dot(vUv*vec2(1920.,1080.)+mod(time,73.),vec2(12.9898,78.233)))*43758.5453)-.5;
      c*=vignette; c+=grain*amount; gl_FragColor=vec4(max(c,vec3(0.)),1.);}`,
  })
  composer.addPass(grade)
  composer.addPass(new OutputPass())

  // Soft three-point light, with a warm distant sun and icy ship-side bounce.
  scene.add(new THREE.HemisphereLight(0x9ddfff, 0x171323, 2.4))
  const sun = new THREE.DirectionalLight(0xffd4a5, 4.2)
  sun.position.set(-400, 260, 170); scene.add(sun)
  const rim = new THREE.DirectionalLight(0x58c9ff, 3.1)
  rim.position.set(150, 80, -300); scene.add(rim)
  const fill = new THREE.DirectionalLight(0xa0b7d5, 1.1)
  fill.position.set(0, -150, 200); scene.add(fill)
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
  scene.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ size: 3.2, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true, depthWrite: false })))

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
    const known = appearances[ship.shipClass]
    const appearance = ['station', 'creature', 'drone'].includes(ship.kind) ? { ...(known ?? resolveAppearance(ship.shipClass)), family: ship.kind as ShipAppearance['family'] } : known ?? resolveAppearance(ship.shipClass)
    const size = clamp(appearance.length * 9, 16, 400)
    const seed = hash(ship.id)
    const side = sides.indexOf(ship.sideIndex)
    const angle = side / Math.max(2, sides.length) * Math.PI * 2
    const lane = shipRanks.get(`${ship.sideIndex}:${ship.playerId}`) ?? 0
    const model = detailed.has(ship.id) ? createShip(appearance, seed, 'hero') : null
    const engineMaterials: { material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial; intensity: number }[] = []
    if (model) {
      model.scale.setScalar(size)
      model.traverse(object => {
        if (object instanceof THREE.Mesh && object.userData.engine) {
          const material = object.material
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) engineMaterials.push({ material, intensity: object.userData.baseIntensity ?? 1 })
        }
      })
      scene.add(model)
    }
    return { ship, appearance, model, position: new THREE.Vector3(), rotation: 0, bank: 0, thrust: 1, size, angle, lane, seed, engineMaterials }
  })
  const fleetSpacing = new Map(sides.map(side => [side, fleetMotionSpacing(actors.filter(a=>a.ship.sideIndex===side).map(a=>({size:a.size,beam:a.appearance.beam})))]))
  const fleetDepth = new Map(sides.map(side => [side, Math.max(130,...actors.filter(a=>a.ship.sideIndex===side).map(a=>a.size*1.25+55))]))
  const byId = new Map(actors.map(a => [a.ship.id, a]))
  // Distant actors remain real participants, rendered with a bounded number of draw calls.
  const distantGroups = new Map<string,{mesh:THREE.InstancedMesh;count:number}>()
  for (const key of new Set(actors.map(actor=>`${actor.appearance.empire}:${actor.appearance.family}`))) {
    const example = actors.find(actor=>`${actor.appearance.empire}:${actor.appearance.family}`===key)!
    const template = createShip(example.appearance, 31, 'distant')
    template.updateMatrixWorld(true)
    const pieces:THREE.BufferGeometry[]=[]
    template.traverse(object=>{
      if(object instanceof THREE.Mesh && !object.userData.engine) {
        let geometry=object.geometry.clone()
        if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat}
        for(const key of Object.keys(geometry.attributes))if(key!=='position'&&key!=='normal')geometry.deleteAttribute(key)
        geometry.applyMatrix4(object.matrixWorld);pieces.push(geometry)
      }
    })
    const geometry=mergeGeometries(pieces)!
    for(const piece of pieces)piece.dispose()
    template.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose()}})
    const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:0xa1b0ba,metalness:.55,roughness:.6}),Math.max(1,actors.length))
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
  const pulseLight = new THREE.PointLight(0x66dcff, 0, 320, 2); scene.add(pulseLight)
  let time = 0, playing = false, disposed = false, reduced = options.reducedMotion ?? false
  let requestedQuality: CinemaQuality = options.quality ?? 'auto'
  let actualQuality = requestedQuality === 'auto' ? (window.innerWidth < 760 ? 'low' : 'high') : requestedQuality
  let raf = 0, last = performance.now(), reportAt = 0, sampleFrames = 0, sampleElapsed = 0, qualityAge = 0
  const effectWindow = film.cues.reduce((max, cue) => Math.max(max, cue.duration + 2), 7)
  const cameraTarget = new THREE.Vector3(), cameraPosition = new THREE.Vector3()
  const pointA = new THREE.Vector3(), pointB = new THREE.Vector3(), delta = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3()
  const motionOptions = (actor: Actor): ShipMotionOptions => ({ size: actor.size, angle: actor.angle, lane: actor.lane, seed: actor.seed,
    sideCount: sideCounts.get(actor.ship.sideIndex) ?? 1, spacing: fleetSpacing.get(actor.ship.sideIndex) ?? 90, depth: fleetDepth.get(actor.ship.sideIndex) ?? 130 })
  const positionAt = (actor: Actor, t: number) => {
    const motion = sampleShipMotion(actor.ship,t,motionOptions(actor))
    actor.position.set(motion.x,motion.y,motion.z)
    actor.rotation=motion.yaw; actor.bank=motion.bank; actor.thrust=motion.thrust
    return actor.position
  }
  const isVisible = (actor: Actor, t: number) => t >= actor.ship.start && (t <= actor.ship.end || !['escaped', 'withdrawn'].includes(actor.ship.fate) || t < actor.ship.end + 2.5)
  const setResolution = () => {
    const width = canvas.clientWidth || 1280, height = canvas.clientHeight || 720
    const ratio = actualQuality === 'high' ? Math.min(window.devicePixelRatio || 1, 1.5) : actualQuality === 'medium' ? 1 : 0.7
    renderer.setPixelRatio(ratio); renderer.setSize(width, height, false)
    composer.setPixelRatio(ratio); composer.setSize(width, height)
    camera.aspect = width / height; camera.updateProjectionMatrix()
    bloom.enabled = actualQuality !== 'low'
    options.onQuality?.(actualQuality)
  }
  const resize = new ResizeObserver(() => { setResolution(); if (!playing) safeDraw() }); cleanups.push(() => resize.disconnect()); resize.observe(canvas); setResolution()

  function draw() {
    let engineCount = 0, trailCount = 0
    for(const group of distantGroups.values())group.count=0
    for (const actor of actors) {
      positionAt(actor, time)
      const visible = isVisible(actor, time)
      const stopped = time > actor.ship.end && actor.ship.fate !== 'survived'
      if (actor.model) {
        actor.model.visible = visible && !(actor.ship.fate === 'destroyed' && time > actor.ship.end + .32)
        actor.model.position.copy(actor.position)
        actor.model.rotation.set(reduced ? 0 : actor.bank, actor.rotation, 0, 'YXZ')
        for (const { material, intensity } of actor.engineMaterials) { if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = actor.thrust * (2.4 + Math.sin(time * 8 + actor.seed) * .3); else { material.transparent = true; material.opacity = actor.thrust * intensity * (.7 + Math.sin(time * 8 + actor.seed) * .06) } }
      } else if (visible && !(actor.ship.fate === 'destroyed' && time > actor.ship.end + .32)) {
        dummy.position.copy(actor.position); dummy.rotation.set(reduced ? 0 : actor.bank, actor.rotation, 0, 'YXZ'); dummy.scale.setScalar(actor.size); dummy.updateMatrix()
        const group=distantGroups.get(`${actor.appearance.empire}:${actor.appearance.family}`)!
        group.mesh.setMatrixAt(group.count, dummy.matrix); group.mesh.setColorAt(group.count++, tint.setHex(actor.appearance.hull))
      }
      if (visible && actor.thrust > 0 && engineCount < engineSprites.length && actor.model) {
        const sprite = engineSprites[engineCount++]
        sprite.visible = true; sprite.position.copy(actor.position).add(new THREE.Vector3(-Math.cos(actor.rotation) * actor.size * 0.49, 0, Math.sin(actor.rotation) * actor.size * 0.49))
        sprite.scale.setScalar(actor.size * actor.thrust * (.34 + Math.sin(time * 6 + actor.seed) * .012))
        sprite.material.color.setHex(actor.appearance.accent)
      }
    }
    if (!reduced) for (const actor of actors) {
      if (!actor.model || actor.ship.kind==='station' || time < actor.ship.start || time > actor.ship.end+5) continue
      const settings=motionOptions(actor)
      for (let segment=0;segment<8 && trailCount<240;segment++) {
        const now=time-segment*.65, before=now-.65
        if (before<actor.ship.start || now>actor.ship.end) continue
        const head=sampleShipMotion(actor.ship,now,settings), tail=sampleShipMotion(actor.ship,before,settings)
        pointA.set(head.x-Math.cos(head.yaw)*actor.size*.51,head.y,head.z+Math.sin(head.yaw)*actor.size*.51)
        pointB.set(tail.x-Math.cos(tail.yaw)*actor.size*.51,tail.y,tail.z+Math.sin(tail.yaw)*actor.size*.51)
        direction.copy(pointB).sub(pointA)
        dummy.position.copy(pointA).add(pointB).multiplyScalar(.5); dummy.quaternion.setFromUnitVectors(up,direction.clone().normalize())
        dummy.scale.set(actor.size*.004*(1-segment/9),direction.length(),actor.size*.004*(1-segment/9));dummy.updateMatrix()
        trails.setMatrixAt(trailCount,dummy.matrix); trails.setColorAt(trailCount++,tint.setHex(actor.appearance.accent).multiplyScalar((1-segment/9)*1.4))
      }
    }
    trails.count=trailCount;trails.instanceMatrix.needsUpdate=true;if(trails.instanceColor)trails.instanceColor.needsUpdate=true
    for(const group of distantGroups.values()){group.mesh.count=group.count;group.mesh.instanceMatrix.needsUpdate=true;if(group.mesh.instanceColor)group.mesh.instanceColor.needsUpdate=true}
    for (let i = engineCount; i < engineSprites.length; i++) engineSprites[i].visible = false

    let shotIndex = film.shots.findIndex(s => time >= s.start && time < s.end)
    if (shotIndex < 0) shotIndex = Math.max(0, film.shots.length - 1)
    const shot = film.shots[shotIndex]
    const candidates = shot?.kind === 'impact' ? selectImpactFocus(film.cues,time).flatMap(id => { const actor=byId.get(id); return actor && isVisible(actor,time) ? [actor] : [] }) : []
    const anchor = candidates[0]
    const impactActors = anchor ? candidates.filter(actor => actor === anchor || actor.position.distanceTo(anchor.position) < anchor.size * 3 + actor.size * .5) : []
    const requestedSubject = impactActors[0] ?? (shot?.subject ? byId.get(shot.subject) : undefined)
    const requestedTarget = shot?.target ? byId.get(shot.target) : undefined
    const subject = requestedSubject && isVisible(requestedSubject,time) ? requestedSubject : actors.find(a => isVisible(a, time))
    const target = requestedTarget && isVisible(requestedTarget,time) ? requestedTarget : undefined
    const progress = shot ? smooth((time - shot.start) / Math.max(1, shot.end - shot.start)) : 0
    const size = subject?.size ?? 60
    const pos = subject?.position ?? pointA.set(0, 0, 0)
    const yaw = subject?.rotation ?? 0
    const lateral = shotIndex % 2 ? -1 : 1
    cameraTarget.copy(pos)
    let localX = -size * 0.5, localY = size * 0.6, localZ = size * 2.4 * lateral
    const kind = reduced ? 'reveal' : shot?.kind
    if (kind === 'reveal') {
      cameraTarget.copy(pos).lerp(new THREE.Vector3(0, 0, 0), reduced ? 0.7 : progress * 0.65)
      const pullback = reduced ? 2.5 : 1 + progress * 2.3
      cameraPosition.copy(pos).add(new THREE.Vector3(size * 1.3 * pullback, size * 0.75 * pullback, size * 2.6 * pullback))
    } else if (kind === 'aftermath') {
      localX = size * (1 + progress * 1.5); localY = size * (0.8 + progress * 0.4); localZ = size * (2.3 + progress) * lateral
    } else if (kind === 'tracking') {
      localX = size * (0.9 - progress * 1.6); localY = size * 0.38; localZ = size * 1.65 * lateral
    } else if (kind === 'broadside') {
      localX = size * (-0.6 + progress * 1.4); localY = size * 0.4; localZ = size * 1.75 * lateral
      if (target) cameraTarget.lerp(target.position, 0.1)
    } else if (kind === 'pursuit') {
      localX = -size * (1.7 + progress * 0.3); localY = size * 0.65; localZ = size * 0.7 * lateral
      if (target) cameraTarget.lerp(target.position, 0.25)
    } else if (kind === 'impact') {
      localX = size * (1.25 - progress * 0.3); localY = size * 0.48; localZ = size * (1.6 + progress * 0.9) * lateral
    }
    if (kind !== 'reveal') cameraPosition.set(pos.x + Math.cos(yaw) * localX + Math.sin(yaw) * localZ, pos.y + localY, pos.z - Math.sin(yaw) * localX + Math.cos(yaw) * localZ)
    if (!reduced && kind === 'broadside' && target && subject) {
      cameraTarget.copy(subject.position).lerp(target.position, .5)
      const separation = subject.position.distanceTo(target.position)
      delta.copy(target.position).sub(subject.position).normalize()
      cameraPosition.copy(cameraTarget).add(new THREE.Vector3(-delta.z, .27, delta.x).multiplyScalar(Math.max(separation * .95, size * 3)))
      cameraPosition.addScaledVector(delta, (progress - .5) * separation * .18)
    }
    if (!reduced && kind === 'impact' && impactActors.length > 1) {
      cameraTarget.set(0,0,0)
      for (const actor of impactActors) cameraTarget.add(actor.position)
      cameraTarget.multiplyScalar(1 / impactActors.length)
      const radius = Math.max(...impactActors.map(actor => actor.position.distanceTo(cameraTarget) + actor.size * .8))
      const halfAngle = Math.min(20 * Math.PI / 180, Math.atan(Math.tan(20 * Math.PI / 180) * camera.aspect))
      const distance = radius / Math.sin(halfAngle) * 1.12
      cameraPosition.copy(cameraTarget).add(new THREE.Vector3(Math.cos(yaw + .6 + progress * .25), .5, -Math.sin(yaw + .6 + progress * .25)).normalize().multiplyScalar(distance))
    }
    // Keep every camera path outside a conservative hull sphere, including neighboring ships.
    keepCameraOutsideHulls(cameraPosition, actors.filter(actor=>isVisible(actor,time) && !(actor.ship.fate==='destroyed' && time>actor.ship.end+.32)).map(actor=>({position:actor.position,radius:actor.size*.78})))
    camera.position.copy(cameraPosition)
    if (!reduced) cameraTarget.y += Math.sin(time * 0.55) * 0.5
    camera.lookAt(cameraTarget)
    camera.fov = kind === 'reveal' ? 48 : 40
    camera.updateProjectionMatrix()

    let beamCount = 0, sparkCount = 0, flashCount = 0, shieldCount = 0, shockwaveCount = 0
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
          material.userData.originalColor ??= material.color.clone()
          material.color.copy(material.userData.originalColor).multiplyScalar(1-damage*.55)
          material.userData.originalEmissive ??= material.emissiveIntensity
          material.emissiveIntensity = disabled ? 0 : material.userData.originalEmissive
        }
      })
      if(flashCount < flashes.length - 12 && damage>.5 && actor.ship.fate!=='knocked_out' && actor.ship.fate!=='captured'){
        pointA.copy(actor.position);pointA.y+=actor.size*.08
        addFlash(pointA,actor.size*.28,0xff873e,(.12+Math.sin(time*5+actor.seed)*.04)*damage)
      }
    }
    // Reserve the effect budget for consequences before ordinary volleys.
    const activeCues = [...cueRange(film.cues, time - effectWindow, time + 0.00001)]
    const consequence = (kind: string) => ['death', 'knockout', 'capture'].includes(kind) ? 1 : 0
    activeCues.sort((a,b) => (consequence(b.kind) * 2 + Number(b.to === subject?.ship.id)) - (consequence(a.kind) * 2 + Number(a.to === subject?.ship.id)))
    for (const cue of activeCues) {
      const age = time - cue.time
      if (age < 0 || age > cueLifetime(cue)) continue
      const from = cue.from ? byId.get(cue.from) : undefined
      const to = cue.to ? byId.get(cue.to) : undefined
      const destination = to ?? from
      if (!destination) continue
      const color = weaponColors[cue.damageType ?? 'energy'] ?? 0x86dfff
      const seed = hash(cue.id)
      if (cue.kind === 'weapon' && from && to) {
        pointA.copy(from.position); pointA.y += from.size * 0.1
        pointB.copy(to.position); pointB.y += to.size * 0.06
        if (!cue.hit) { pointB.y += to.size * 0.8; pointB.z += to.size * (seed % 2 ? 0.7 : -0.7) }
        const travel = Math.max(0.015, cue.duration)
        if (!cue.parentId && age < travel) {
          const fraction = clamp(age / travel, 0, 1)
          const missile = cue.damageType === 'explosive' || /missile|torpedo/i.test(cue.weaponName ?? '')
          const electric = cue.damageType === 'em' || cue.damageType === 'void'
          const head = pointA.clone().lerp(pointB, fraction)
          const tail = pointA.clone().lerp(pointB, clamp(fraction - (cue.damageType === 'energy' ? 0.9 : 0.16), 0, 1))
          if (missile) {
            head.y += Math.sin(fraction * Math.PI) * (30 + seed % 40)
            tail.y += Math.sin(clamp(fraction - 0.16, 0, 1) * Math.PI) * (30 + seed % 40)
            addBeam(tail, head, 0.32, color)
            addFlash(head, 8, 0xffd4a3, 0.8)
          } else if (electric) {
            let segmentStart = pointA.clone()
            for (let j = 1; j <= 7; j++) {
              const step = j / 7 * fraction
              const segmentEnd = pointA.clone().lerp(pointB, step)
              if (j < 7) { segmentEnd.y += Math.sin(seed + j * 17 + time * 13) * 4; segmentEnd.z += Math.cos(seed + j * 19 + time * 11) * 4 }
              addBeam(segmentStart, segmentEnd, 0.3, color); segmentStart = segmentEnd
            }
          } else {
            addBeam(tail, head, cue.damageType === 'kinetic' ? 0.26 : 0.65, color)
            if(cue.damageType==='energy') addBeam(tail,head,.17,0xeaffff)
          }
          addFlash(pointA, from.size * 0.3 * (1 - fraction), color, 0.5)
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
        if (age < 1.5 && !reduced) { pulseLight.position.copy(destination.position); pulseLight.color.setHex(effectColor); pulseLight.intensity = radius * radius * 12 * Math.exp(-age * 3); pulseLight.distance = radius * 7 }
      } else if ((cue.kind === 'arrival' || cue.kind === 'escape') && age < 1.7) {
        addFlash(destination.position, destination.size * (1.3 + age), 0x80d8ff, Math.exp(-age * 3) * 0.35)
      } else if (cue.kind === 'burn' && age < cue.duration) {
        addFlash(destination.position, destination.size * 0.5, 0xff8c40, 0.18 * Math.sin(age / cue.duration * Math.PI))
      }
    }
    beams.count = beamCount; beams.instanceMatrix.needsUpdate = true; if (beams.instanceColor) beams.instanceColor.needsUpdate = true
    sparks.count = sparkCount; sparks.instanceMatrix.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true
    for (let i = flashCount; i < flashes.length; i++) flashes[i].visible = false
    for (let i = shieldCount; i < shields.length; i++) shields[i].visible = false
    for (let i = shockwaveCount; i < shockwaves.length; i++) shockwaves[i].visible = false
    grade.uniforms.time.value = reduced ? 0 : time
    grade.uniforms.amount.value = actualQuality === 'low' ? 0 : 0.012
    audio.intensity(shot?.intensity ?? 0.1, time)
    renderer.info.reset()
    composer.render()
  }

  function safeDraw() {
    try { draw() } catch (error) { playing = false; audio.setPlaying(false); options.onError?.(error instanceof Error ? error.message : 'The renderer stopped.') }
  }
  const emitCues = (previous: number, current: number) => {
    for (const cue of cueRange(film.cues, previous, current)) {
      if (cue.parentId) continue
      const actor = byId.get(cue.from ?? cue.to ?? '')
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
    setQuality(value) { requestedQuality = value; actualQuality = value === 'auto' ? 'high' : value; setResolution(); safeDraw() },
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

