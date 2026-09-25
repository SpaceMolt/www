import { expect, test } from 'bun:test'
import { Vector3, PerspectiveCamera, Quaternion, Euler } from 'three'
import { keepCameraOutsideHulls, keepCameraOutsideBodies, sampleStoryCamera, clearStorySightline } from './camera'
test('overlapping capital ship guards cannot project the camera back into a hull', () => {
  const hulls=[{position:new Vector3(0,0,0),radius:283},{position:new Vector3(0,0,360),radius:283}]
  const camera=new Vector3(0,0,100)
  keepCameraOutsideHulls(camera,hulls)
  for(const hull of hulls)expect(camera.distanceTo(hull.position)).toBeGreaterThanOrEqual(hull.radius)
})
test('a camera exactly at a ship center escapes to a finite safe position',()=>{
  const camera=new Vector3(0,0,0)
  keepCameraOutsideHulls(camera,[{position:new Vector3(),radius:100}])
  expect(camera.length()).toBeGreaterThanOrEqual(100)
  expect(camera.toArray().every(Number.isFinite)).toBe(true)
})

const actor = (id: string, x: number, size = 80) => ({ id, position: new Vector3(x,0,0), size })
/** Projected hull-box width as a fraction of the frame width. */
const screenWidth = (camera: PerspectiveCamera, body: { position: Vector3; size: number }) => {
  const xs=[-.5,.5].flatMap(x=>[-.2,.2].flatMap(y=>[-.3,.3].map(z=>body.position.clone().add(new Vector3(x,y,z).multiplyScalar(body.size)).project(camera).x)))
  return (Math.max(...xs)-Math.min(...xs))/2
}
const axis = { from:'a', to:'b', side:1 as const }
const shot = { start:0,end:5,kind:'tracking' as const,role:'fire' as const,axis,intensity:.5 }

test('coverage preserves left-to-right geography across reciprocal fire and reactions', () => {
  const a=actor('a',-180),b=actor('b',180)
  for(const subject of [a,b]) for(const role of ['fire','reaction'] as const) {
    const frame=sampleStoryCamera({shot:{...shot,role},time:2,aspect:16/9,subject,target:subject===a?b:a,axisFrom:a.position,axisTo:b.position})
    const camera=new PerspectiveCamera(frame.fov,16/9,.1,10000);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld()
    expect(a.position.clone().project(camera).x).toBeLessThan(b.position.clone().project(camera).x)
    expect(frame.position.z).toBeGreaterThan(0)
  }
})

test('steep station geography preserves full standoff and foreground avoidance stays on the same side', () => {
  const a=actor('a',0),b=actor('b',0);b.position.y=-500
  const frame=sampleStoryCamera({shot:{...shot,role:'geography'},time:2,aspect:16/9,subject:a,target:b,axisFrom:a.position,axisTo:b.position})
  const view=new PerspectiveCamera(frame.fov,16/9,.1,10000);view.position.copy(frame.position);view.lookAt(frame.target);view.updateMatrixWorld()
  for(const body of [a,b]){const p=body.position.clone().project(view);expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1)}
  const blocker={id:'obstruction',position:frame.position.clone().lerp(frame.target,.5),size:140}
  clearStorySightline(frame,a.id,[a,b,blocker])
  expect(frame.position.z).toBeGreaterThan(0)
  expect(frame.position.toArray().every(Number.isFinite)).toBe(true)
})

test('fleet masters fit a readable formation, and a speck-sized swarm yields to its principals with the mass behind', () => {
  const capital = { ...actor('capital', -160, 220), side: 0 }
  const wing = Array.from({ length: 12 }, (_, index) => ({ id: `wing:${index}`, size: 60, side: 1,
    position: new Vector3(650 + Math.floor(index / 4) * 150, 0, (index % 4 - 1.5) * 120) }))
  const swarm = Array.from({ length: 100 }, (_, index) => ({ id: `shard:${index}`, size: 16, side: 1,
    position: new Vector3(650 + Math.floor(index / 10) * 120, (index % 3 - 1) * 40, (index % 10 - 4.5) * 100) }))
  for (const aspect of [.46, 16 / 9, 2.4]) for (const time of [0, 2, 3.99]) {
    const view = (target: typeof capital, field: typeof capital[]) => {
      const frame = sampleStoryCamera({ shot: { ...shot, role: 'geography', battlefield: true }, time, aspect,
        subject: capital, target, axisFrom: capital.position, axisTo: target.position, battlefield: field })
      const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
      camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
      return { frame, camera }
    }
    // Readable wing: every hull is inside the frame, seen from above.
    const fleet = view(wing[0], [capital, ...wing])
    expect(fleet.frame.position.clone().sub(fleet.frame.target).normalize().y).toBeGreaterThan(.25)
    for (const body of [capital, ...wing]) { const p = body.position.clone().project(fleet.camera); expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(1) }
    // Swarm: the principal shard reads with a large part of its mass behind it.
    const mass = view(swarm[0], [capital, ...swarm])
    if (aspect < 1) continue
    expect(screenWidth(mass.camera, swarm[0])).toBeGreaterThan(.03)
    const inside = (p: Vector3) => Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1
    expect(swarm.filter(body => inside(body.position.clone().project(mass.camera))).length).toBeGreaterThan(10)
  }
})

test('nonfiring detail coverage remains close even with a large battlefield available', () => {
  const a = actor('a', 0), b = actor('b', 600)
  const frame = sampleStoryCamera({ shot: { ...shot, role: 'reaction' }, time: 2, aspect: 16 / 9,
    subject: a, target: b, axisFrom: a.position, axisTo: b.position, battlefield: [a, b, actor('distant', 6000)] })
  expect(frame.position.distanceTo(a.position)).toBeLessThan(a.size * 4.5)
})


test('a firing take has a deliberate camera move instead of a frozen camera',()=>{
  const a=actor('a',-180),b=actor('b',180)
  const sequence={id:'take',start:0,end:6,kind:'confrontation' as const,attacker:'a',defender:'b',actionTime:1,impactTime:3,axis}
  const options={shot:{...shot,sequenceId:'take'},sequence,aspect:16/9,subject:a,target:b,axisFrom:a.position,axisTo:b.position}
  const early=sampleStoryCamera({...options,time:.2}),late=sampleStoryCamera({...options,time:2.5})
  expect(early.position.distanceTo(late.position)+early.target.distanceTo(late.target)).toBeGreaterThan(4)
})

test('reduced-motion takes stay fixed and seeking directly reproduces the authored frame', () => {
  const a = actor('a', -180), b = actor('b', 180)
  const sequence = { id: 'take', start: 0, end: 6, kind: 'confrontation' as const,
    attacker: 'a', defender: 'b', actionTime: 1, impactTime: 3, axis }
  const options = { shot: { ...shot, sequenceId: 'take' }, sequence, aspect: 16 / 9,
    subject: a, target: b, axisFrom: a.position, axisTo: b.position }
  const early = sampleStoryCamera({ ...options, time: 0, reduced: true })
  const late = sampleStoryCamera({ ...options, time: 5, reduced: true })
  expect(late).toEqual(early)
  const sought = sampleStoryCamera({ ...options, time: 4 })
  sampleStoryCamera({ ...options, time: .2 })
  expect(sampleStoryCamera({ ...options, time: 4 })).toEqual(sought)
})

test('tracking moving ships does not step between discrete portrait fit distances', () => {
  const a = actor('a', 0, 40), b = actor('b', 600, 180)
  const sequence = { id: 'take', start: 0, end: 6, kind: 'confrontation' as const,
    attacker: 'a', defender: 'b', actionTime: 1, impactTime: 3, axis }
  let previous: Vector3 | undefined
  for (let separation = 600; separation < 1600; separation += 2) {
    b.position.x = separation
    const frame = sampleStoryCamera({ shot: { ...shot, sequenceId: 'take' }, sequence, time: 2, aspect: .46,
      subject: a, target: b, axisFrom: a.position, axisTo: new Vector3(600, 0, 0) })
    if (previous) expect(frame.position.distanceTo(previous)).toBeLessThan(4)
    previous = frame.position
  }
})

test('boarding takes frame close hulls together without the downrange shoulder pullback', () => {
  const a = actor('a', 0, 180), b = actor('b', 240, 150)
  const sequence = { id: 'boarding', start: 0, end: 6, kind: 'confrontation' as const,
    attacker: 'a', defender: 'b', actionTime: 1, impactTime: 3, axis }
  for (const aspect of [.46, 16 / 9, 2.4]) for (const time of [0, 2.999, 3.001, 6]) {
    const impact = time >= 3
    const frame = sampleStoryCamera({ shot: { ...shot, sequenceId: 'boarding', role: impact ? 'reaction' : 'setup' },
      sequence, boarding: true, time, aspect, subject: impact ? b : a, target: impact ? a : b,
      axisFrom: a.position, axisTo: b.position })
    const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
    for (const body of [a, b]) for (const x of [-.5, .5]) for (const y of [-.2, .2]) for (const z of [-.3, .3]) {
      const p = body.position.clone().add(new Vector3(x, y, z).multiplyScalar(body.size)).project(camera)
      expect(Math.abs(p.x)).toBeLessThan(1)
      expect(Math.abs(p.y)).toBeLessThan(1)
    }
    const left = a.position.clone().add(new Vector3(-a.size * .6, 0, 0)).project(camera)
    const right = b.position.clone().add(new Vector3(b.size * .6, 0, 0)).project(camera)
    if (aspect === 16 / 9) {
      expect(right.x - left.x).toBeGreaterThan(.65)
      expect(frame.position.distanceTo(frame.target)).toBeLessThan(900)
    }
  }
})

test('boarding broadside follows a side berth without hiding the boarder behind its target', () => {
  const a = actor('a', 0, 100), b = actor('b', 0, 180)
  b.position.z = 260
  const sequence = { id: 'boarding', start: 0, end: 6, kind: 'confrontation' as const,
    attacker: 'a', defender: 'b', actionTime: 1, impactTime: 3, axis }
  for (const aspect of [.46, 16 / 9]) {
    const frame = sampleStoryCamera({ shot: { ...shot, sequenceId: 'boarding' }, sequence, boarding: true,
      time: 3, aspect, subject: a, target: b, axisFrom: new Vector3(), axisTo: new Vector3(260, 0, 0) })
    for (const [focus, obstruction] of [[a, b], [b, a]]) {
      const ray = focus.position.clone().sub(frame.position)
      const t = Math.max(0, Math.min(1, obstruction.position.clone().sub(frame.position).dot(ray) / ray.lengthSq()))
      const closest = frame.position.clone().addScaledVector(ray, t)
      expect(closest.distanceTo(obstruction.position)).toBeGreaterThan(obstruction.size * .78)
    }
  }
})

test('boarding pan stays continuous past a right-angle approach and across reaction subject swaps', () => {
  const a = actor('a', 0, 80), b = actor('b', 0, 120)
  const sequence = { id: 'boarding', start: 0, end: 6, kind: 'confrontation' as const,
    attacker: 'a', defender: 'b', actionTime: 1, impactTime: 3, axis }
  let previous: Vector3 | undefined
  for (let angle = 0; angle <= 110; angle++) {
    b.position.set(Math.cos(angle * Math.PI / 180) * 260, 0, Math.sin(angle * Math.PI / 180) * 260)
    const swapped = angle > 90
    const frame = sampleStoryCamera({ shot: { ...shot, role: swapped ? 'reaction' : 'setup', sequenceId: 'boarding' },
      sequence, boarding: true, time: angle / 110 * 6, aspect: 16 / 9, subject: swapped ? b : a, target: swapped ? a : b,
      axisFrom: new Vector3(), axisTo: new Vector3(260, 0, 0) })
    if (previous) expect(frame.position.distanceTo(previous)).toBeLessThan(20)
    previous = frame.position
  }
})

test('boarding contact coverage keeps a real 22-to-1 victim readable while cropping the capital', () => {
  const capital = actor('a', 0, 362), victim = actor('b', 0, 16.2)
  victim.position.z = (capital.size + victim.size) * .78 + 8
  const sequence = { id: 'boarding', start: 0, end: 10, kind: 'confrontation' as const,
    attacker: 'a', defender: 'b', actionTime: 1, impactTime: 9, axis }
  for (const aspect of [.46, 16 / 9, 2.4]) for (const reduced of [false, true]) {
    let previous: Vector3 | undefined
    for (let time = 0; time <= 10; time += .01) {
      const frame = sampleStoryCamera({ shot: { ...shot, sequenceId: 'boarding', role: time > 5 ? 'reaction' : 'setup' },
        sequence, boarding: true, reduced, time, aspect, subject: time > 5 ? victim : capital, target: time > 5 ? capital : victim,
        axisFrom: new Vector3(), axisTo: new Vector3(1000, 0, 0) })
      for (const body of [capital, victim]) expect(frame.position.distanceTo(body.position)).toBeGreaterThan(body.size * .78)
      if (previous) expect(frame.position.distanceTo(previous)).toBeLessThan(20)
      previous = frame.position
      if (!reduced && time < 8) continue
      const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
      camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
      const points = [-.5, .5].flatMap(x => [-.15, .15].flatMap(y => [-.2, .2].map(z =>
        victim.position.clone().add(new Vector3(x, y, z).multiplyScalar(victim.size)).project(camera))))
      const width = (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) * 455 * aspect / 2
      const height = (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) * 455 / 2
      expect(Math.max(width, height)).toBeGreaterThan(35)
      for (const p of points) { expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(1) }
    }
  }
})

test('actual narrow capital hull permits readable close boarding inside its empty bounding sphere', () => {
  const capital = { ...actor('a', 0, 362), contactHull: { min: new Vector3(-180,-30,-60), max: new Vector3(180,30,60), yaw:0, bank:0 } }
  const victim = actor('b', 0, 16.2); victim.position.z=72
  const sequence = { id:'boarding',start:0,end:10,kind:'confrontation' as const,attacker:'a',defender:'b',actionTime:1,impactTime:9,axis }
  const frame=sampleStoryCamera({shot:{...shot,sequenceId:'boarding'},sequence,boarding:true,time:9,aspect:16/9,subject:capital,target:victim,axisFrom:capital.position,axisTo:victim.position})
  expect(frame.position.distanceTo(frame.target)).toBeLessThan(100)
  expect(frame.position.z).toBeGreaterThan(61)
})


test('actual hull clearance respects yaw and bank and preserves clear space beside the hull', () => {
  for(const yaw of [0,.7,Math.PI/2])for(const bank of [0,.2,-.4]){
    const rotation=new Quaternion().setFromEuler(new Euler(bank,yaw,0,'YXZ'))
    const body={id:'a',position:new Vector3(40,20,-50),size:362,contactHull:{min:new Vector3(-180,-30,-60),max:new Vector3(180,30,60),yaw,bank}}
    const outside=new Vector3(0,0,70).applyQuaternion(rotation).add(body.position), original=outside.clone()
    keepCameraOutsideBodies(outside,[body]);expect(outside).toEqual(original)
    const inside=new Vector3(0,0,59).applyQuaternion(rotation).add(body.position)
    keepCameraOutsideBodies(inside,[body])
    const local=inside.clone().sub(body.position).applyQuaternion(rotation.clone().invert())
    expect(local.z).toBeGreaterThan(61)
    expect(Math.abs(local.x)).toBeLessThan(.001)
  }
})

/** Camera for a frame; `project` returns normalized device coordinates. */
const view = (frame: { position: Vector3; target: Vector3; fov: number }, aspect: number) => {
  const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
  camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
  return camera
}
const boxCorners = (body: { position: Vector3; size: number }) => [-.5, .5].flatMap(x => [-.2, .2].flatMap(y => [-.3, .3].map(z => body.position.clone().add(new Vector3(x, y, z).multiplyScalar(body.size)))))
const whole = (camera: PerspectiveCamera, body: { position: Vector3; size: number }) => boxCorners(body).every(point => { const p = point.clone().project(camera); return Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1 })
const centered = (camera: PerspectiveCamera, body: { position: Vector3 }, margin = 1) => { const p = body.position.clone().project(camera); return Math.abs(p.x) < margin && Math.abs(p.y) < margin && p.z < 1 }
const viewDirection = (frame: { position: Vector3; target: Vector3 }) => frame.target.clone().sub(frame.position).normalize()

test('fire is an over-the-shoulder shot: shooter in the foreground, target whole and readable downrange', () => {
  for (const aspect of [.57, 16 / 9, 2.2]) for (const [sizeA, sizeB, separation] of [[80, 80, 400], [80, 60, 1500], [36, 36, 3000]]) {
    const a = actor('a', 0, sizeA), b = actor('b', separation, sizeB)
    const frame = sampleStoryCamera({ shot, time: 2, aspect, subject: a, target: b, axisFrom: a.position, axisTo: b.position })
    const camera = view(frame, aspect)
    expect(frame.position.clone().sub(a.position).dot(b.position.clone().sub(a.position))).toBeLessThan(0)
    expect(frame.position.distanceTo(a.position)).toBeLessThan(frame.position.distanceTo(b.position))
    expect(centered(camera, a)).toBe(true)
    expect(whole(camera, b)).toBe(true)
    if (aspect > 1) expect(screenWidth(camera, b)).toBeGreaterThan(.03)
    expect(a.position.clone().project(camera).x).toBeLessThan(b.position.clone().project(camera).x)
  }
})

test('a capital firing on a fighter is shot over the fighter toward the whole capital', () => {
  const capital = actor('a', 0, 363), fighter = actor('b', 700, 16)
  for (const aspect of [16 / 9, 2.2]) {
    const frame = sampleStoryCamera({ shot, time: 2, aspect, subject: capital, target: fighter, axisFrom: capital.position, axisTo: fighter.position })
    const camera = view(frame, aspect)
    expect(frame.position.distanceTo(fighter.position)).toBeLessThan(frame.position.distanceTo(capital.position))
    expect(whole(camera, capital)).toBe(true)
    expect(centered(camera, fighter)).toBe(true)
  }
})

test('fire, impact and reaction are distinct setups on one side of the line', () => {
  const a = actor('a', 0, 80), b = actor('b', 900, 80)
  const frameFor = (role: 'fire' | 'impact' | 'reaction' | 'setup' | 'geography', subject: typeof a, target: typeof a) =>
    sampleStoryCamera({ shot: { ...shot, role }, time: 2, aspect: 2.2, subject, target, axisFrom: a.position, axisTo: b.position })
  const fire = frameFor('fire', a, b), impact = frameFor('impact', b, a), reaction = frameFor('reaction', b, a), setup = frameFor('setup', a, b), geography = frameFor('geography', a, b)
  const angle = (p: typeof fire, q: typeof fire) => Math.acos(Math.max(-1, Math.min(1, viewDirection(p).dot(viewDirection(q))))) * 180 / Math.PI
  expect(angle(fire, impact)).toBeGreaterThan(40)
  expect(angle(fire, reaction)).toBeGreaterThan(90)
  expect(angle(setup, fire)).toBeGreaterThan(30)
  expect(angle(geography, fire)).toBeGreaterThan(30)
  for (const frame of [fire, impact, reaction, setup, geography]) expect(frame.position.z).toBeGreaterThan(0)
  const camera = view(reaction, 2.2)
  expect(a.position.clone().project(camera).x).toBeLessThan(b.position.clone().project(camera).x)
  // Impact frames the hit hull alone at medium size.
  const impactCamera = view(impact, 2.2)
  expect(whole(impactCamera, b)).toBe(true)
  expect(screenWidth(impactCamera, b)).toBeGreaterThan(.2)
})

test('a hull that dies during the shot is framed as the victim, with room for the explosion', () => {
  const a = actor('a', 0, 80), b = actor('b', 500, 40)
  for (const aspect of [16 / 9, 2.2]) {
    const frame = sampleStoryCamera({ shot: { ...shot, role: 'fire' }, time: 2, aspect, subject: a, target: b, axisFrom: a.position, axisTo: b.position, dying: 'b' })
    const camera = view(frame, aspect)
    expect(whole(camera, b)).toBe(true)
    const width = screenWidth(camera, b)
    expect(width).toBeGreaterThan(.12); expect(width).toBeLessThan(.45)
    expect(centered(camera, b, .6)).toBe(true)
  }
})

test('over-the-shoulder framing follows moving hulls without stepping', () => {
  const a = actor('a', 0, 40), b = actor('b', 600, 60)
  let previous: { position: Vector3; fov: number } | undefined
  for (let separation = 600; separation < 1800; separation += 3) {
    b.position.x = separation
    const frame = sampleStoryCamera({ shot, time: 2, aspect: 2.2, subject: a, target: b, axisFrom: a.position, axisTo: new Vector3(600, 0, 0) })
    if (previous) { expect(frame.position.distanceTo(previous.position)).toBeLessThan(4); expect(Math.abs(frame.fov - previous.fov)).toBeLessThan(.5) }
    previous = frame
  }
})

test('pair establishing shots keep both hulls whole, or shoulder a distant counterpart', () => {
  for (const [smallSize, separation] of [[179, 1000], [16.2, 1000], [36, 3000]]) for (const aspect of [16 / 9, 2.4]) {
    const capital = actor('a', 0, 362), smaller = actor('b', separation, smallSize)
    const frame = sampleStoryCamera({ shot: { ...shot, role: 'geography', battlefield: true }, time: 2, aspect,
      subject: capital, target: smaller, battlefield: [capital, smaller], axisFrom: capital.position, axisTo: smaller.position })
    const camera = view(frame, aspect)
    expect(centered(camera, capital)).toBe(true)
    expect(centered(camera, smaller)).toBe(true)
    expect(screenWidth(camera, smaller)).toBeGreaterThan(.03)
  }
})

test('establishing moves are deterministic, and reduced motion holds still', () => {
  const a = actor('a', -500, 362), b = actor('b', 500, 179)
  const options = { shot: { ...shot, role: 'geography' as const, battlefield: true }, aspect: 16 / 9,
    subject: a, target: b, battlefield: [a, b], axisFrom: a.position, axisTo: b.position }
  const early = sampleStoryCamera({ ...options, time: 0 }), late = sampleStoryCamera({ ...options, time: 5 })
  expect(early.position.distanceTo(late.position)).toBeGreaterThan(1)
  sampleStoryCamera({ ...options, time: 1 })
  expect(sampleStoryCamera({ ...options, time: 5 })).toEqual(late)
  expect(sampleStoryCamera({ ...options, time: 5, reduced: true })).toEqual(sampleStoryCamera({ ...options, time: 0, reduced: true }))
})
