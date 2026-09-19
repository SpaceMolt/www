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

test('whole-hull close shots stay framed on portrait and ultrawide screens', () => {
  const a=actor('a',0),b=actor('b',400)
  for(const aspect of [.46,.57,16/9,2.4]) {
    const frame=sampleStoryCamera({shot,time:2,aspect,subject:a,target:b,axisFrom:a.position,axisTo:b.position})
    const camera=new PerspectiveCamera(frame.fov,aspect,.1,10000);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld()
    for(const x of [-.6,.6]) for(const y of [-.25,.4]) for(const z of [-.3,.3]) {
      const point=new Vector3(x,y,z).multiplyScalar(a.size).project(camera)
      expect(Math.abs(point.x)).toBeLessThan(1)
      expect(Math.abs(point.y)).toBeLessThan(1)
    }
  }
})

test('steep station geography preserves full standoff and foreground avoidance stays on the same side', () => {
  const a=actor('a',0),b=actor('b',0);b.position.y=-500
  const frame=sampleStoryCamera({shot:{...shot,role:'geography'},time:2,aspect:16/9,subject:a,target:b,axisFrom:a.position,axisTo:b.position})
  expect(frame.position.distanceTo(frame.target)).toBeGreaterThan(800)
  const blocker={id:'obstruction',position:frame.position.clone().lerp(frame.target,.5),size:140}
  clearStorySightline(frame,a.id,[a,b,blocker])
  expect(frame.position.z).toBeGreaterThan(0)
  expect(frame.position.toArray().every(Number.isFinite)).toBe(true)
})

test('a long-range setup retains a substantial attacker in the foreground', () => {
  const a=actor('a',0),b=actor('b',1100,16)
  const frame=sampleStoryCamera({shot:{...shot,role:'setup'},time:2,aspect:16/9,subject:a,target:b,axisFrom:a.position,axisTo:b.position})
  expect(frame.position.distanceTo(a.position)).toBeLessThan(a.size*3)
  const camera=new PerspectiveCamera(frame.fov,16/9,.1,10000);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld()
  expect(a.position.clone().project(camera).x).toBeLessThan(b.position.clone().project(camera).x)
  expect(Math.abs(b.position.clone().project(camera).x)).toBeLessThan(1)
  expect(Math.abs(a.position.clone().project(camera).x)).toBeLessThan(.65)
  expect(Math.abs(a.position.clone().project(camera).y)).toBeLessThan(.65)
})

test('portrait setups keep both actors visible across extreme size and distance differences', () => {
  for(const aspect of [.46,.57,1,16/9,2.4]) for(const size of [16,80,400]) for(const separation of [600,1200,3000]) {
    const a=actor('a',0,size),b=actor('b',separation,80)
    const frame=sampleStoryCamera({shot:{...shot,role:'setup'},time:2,aspect,subject:a,target:b,axisFrom:a.position,axisTo:b.position})
    const camera=new PerspectiveCamera(frame.fov,aspect,.1,10000);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld()
    for(const body of [a,b]) {
      const projected=body.position.clone().project(camera)
      expect(Math.abs(projected.x)).toBeLessThan(1)
      expect(Math.abs(projected.y)).toBeLessThan(1)
    }
  }
})

test('firing coverage stays behind the attacker and includes its target', () => {
  for (const aspect of [.46, 16 / 9, 2.4]) for (const reversed of [false, true]) for (const reduced of [false, true]) {
    const a = actor('a', -180), b = actor('b', 600, 140)
    const subject = reversed ? b : a, target = reversed ? a : b
    const toward = target.position.clone().sub(subject.position).normalize()
    const frame = sampleStoryCamera({ shot, time: 2, aspect, subject, target, axisFrom: a.position, axisTo: b.position, reduced })
    expect(frame.position.clone().sub(subject.position).dot(toward)).toBeLessThan(-subject.size)
    const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
    for (const body of [subject, target]) for (const x of [-.6, .6]) for (const y of [-.25, .4]) for (const z of [-.3, .3]) {
      const projected = body.position.clone().add(new Vector3(x, y, z).multiplyScalar(body.size)).project(camera)
      expect(Math.abs(projected.x)).toBeLessThan(1)
      expect(Math.abs(projected.y)).toBeLessThan(1)
    }
  }
})

test('strategic masters show an asymmetric fleet rather than only the selected duel', () => {
  const capital = actor('capital', -160, 220)
  const swarm = Array.from({ length: 100 }, (_, index) => ({
    id: `shard:${index}`, size: 16,
    position: new Vector3(650 + Math.floor(index / 10) * 120, (index % 3 - 1) * 40, (index % 10 - 4.5) * 100),
  }))
  for (const aspect of [.46, 16 / 9, 2.4]) for (const time of [0, 2, 3.99]) {
    const frame = sampleStoryCamera({ shot: { ...shot, role: 'geography', battlefield: true }, time, aspect,
      subject: capital, target: swarm[0], axisFrom: capital.position, axisTo: swarm[0].position, battlefield: [capital, ...swarm] })
    const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
    for (const body of [capital, ...swarm]) for (const x of [-.6, .6]) for (const y of [-.3, .3]) for (const z of [-.4, .4]) {
      const projected = body.position.clone().add(new Vector3(x, y, z).multiplyScalar(body.size)).project(camera)
      expect(Math.abs(projected.x)).toBeLessThan(.95)
      expect(Math.abs(projected.y)).toBeLessThan(.95)
    }
  }
})

test('nonfiring detail coverage remains close even with a large battlefield available', () => {
  const a = actor('a', 0), b = actor('b', 600)
  const frame = sampleStoryCamera({ shot: { ...shot, role: 'reaction' }, time: 2, aspect: 16 / 9,
    subject: a, target: b, axisFrom: a.position, axisTo: b.position, battlefield: [a, b, actor('distant', 6000)] })
  expect(frame.position.distanceTo(a.position)).toBeLessThan(a.size * 3)
})


test('asymmetric fleet masters reveal their decks and fill the available frame without strong depth foreshortening', () => {
  const capital = actor('capital', -160, 220)
  const swarm = Array.from({ length: 100 }, (_, index) => ({ id: `shard:${index}`, size: 16,
    position: new Vector3(650 + Math.floor(index / 10) * 120, (index % 3 - 1) * 40, (index % 10 - 4.5) * 100) }))
  const bodies = [capital, ...swarm]
  for (const aspect of [.46, 16 / 9, 2.4]) {
    const frame = sampleStoryCamera({ shot: { ...shot, role: 'geography', battlefield: true }, time: 2, aspect,
      subject: capital, target: swarm[0], axisFrom: capital.position, axisTo: new Vector3(1000, 0, 0), battlefield: bodies })
    const viewing = frame.position.clone().sub(frame.target).normalize()
    expect(viewing.x).toBeGreaterThan(.025)
    expect(viewing.x).toBeLessThan(.15)
    expect(viewing.z).toBeGreaterThan(.8)
    expect(viewing.y).toBeGreaterThan(.25)
    const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
    const projected = bodies.flatMap(body => [-.6, .6].flatMap(x => [-.3, .3].flatMap(y => [-.4, .4].map(z =>
      body.position.clone().add(new Vector3(x, y, z).multiplyScalar(body.size)).project(camera)))))
    const width = Math.max(...projected.map(p => p.x)) - Math.min(...projected.map(p => p.x))
    const height = Math.max(...projected.map(p => p.y)) - Math.min(...projected.map(p => p.y))
    expect(Math.max(width, height)).toBeGreaterThan(1.25)
  }
})


test('downrange targets remain outside the foreground hull silhouette after portrait pullback', () => {
  for (const aspect of [.46, 16 / 9, 2.4]) for (const separation of [160, 500, 1500]) for (const elevation of [0, 150, -150]) {
    const a = actor('a', 0, 100), b = actor('b', separation, 40)
    b.position.y = elevation
    for (const role of ['setup', 'fire'] as const) {
      const frame = sampleStoryCamera({ shot: { ...shot, role }, time: 2, aspect,
        subject: a, target: b, axisFrom: a.position, axisTo: b.position })
      const toTarget = b.position.clone().sub(frame.position), toSubject = a.position.clone().sub(frame.position)
      const along = Math.max(0, Math.min(1, toSubject.dot(toTarget) / toTarget.lengthSq()))
      const nearest = frame.position.clone().addScaledVector(toTarget, along)
      expect(nearest.distanceTo(a.position)).toBeGreaterThanOrEqual(a.size * .85)
      const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
      camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
      for (const body of [a, b]) {
        const projected = body.position.clone().project(camera)
        expect(Math.abs(projected.x)).toBeLessThan(1)
        expect(Math.abs(projected.y)).toBeLessThan(1)
      }
    }
  }
})

test('one exchange uses a continuous camera move across its fire-to-impact boundary',()=>{
  const a=actor('a',-180),b=actor('b',180)
  const sequence={id:'take',start:0,end:6,kind:'confrontation' as const,attacker:'a',defender:'b',actionTime:1,impactTime:3,axis}
  const before=sampleStoryCamera({shot:{...shot,start:0,end:3,sequenceId:'take'},sequence,time:2.999,aspect:16/9,subject:a,target:b,axisFrom:a.position,axisTo:b.position})
  const after=sampleStoryCamera({shot:{...shot,start:3,end:6,role:'impact',sequenceId:'take'},sequence,time:3.001,aspect:16/9,subject:b,target:a,axisFrom:a.position,axisTo:b.position})
  expect(before.position.distanceTo(after.position)).toBeLessThan(1)
  expect(before.target.distanceTo(after.target)).toBeLessThan(1)
  expect(Math.abs(before.fov-after.fov)).toBeLessThan(.1)
})

test('a firing take has a deliberate camera move instead of a frozen camera',()=>{
  const a=actor('a',-180),b=actor('b',180)
  const sequence={id:'take',start:0,end:6,kind:'confrontation' as const,attacker:'a',defender:'b',actionTime:1,impactTime:3,axis}
  const options={shot:{...shot,sequenceId:'take'},sequence,aspect:16/9,subject:a,target:b,axisFrom:a.position,axisTo:b.position}
  const early=sampleStoryCamera({...options,time:.2}),late=sampleStoryCamera({...options,time:2.5})
  expect(early.position.distanceTo(late.position)+early.target.distanceTo(late.target)).toBeGreaterThan(4)
})

test('continuous takes retain framing, hull clearance, and geography throughout the move', () => {
  for (const aspect of [.46, 16 / 9, 2.4]) for (const reversed of [false, true]) {
    const a = actor('a', -180, 100), b = actor('b', 600, 140)
    const attacker = reversed ? b : a, defender = reversed ? a : b
    const sequence = { id: 'take', start: 0, end: 6, kind: 'confrontation' as const,
      attacker: attacker.id, defender: defender.id, actionTime: 1, impactTime: 3, axis }
    for (const time of [0, 1, 2.999, 3.001, 4, 6]) {
      const impact = time >= 3
      const frame = sampleStoryCamera({ shot: { ...shot, sequenceId: 'take', role: impact ? 'impact' : 'fire' },
        sequence, time, aspect, subject: impact ? defender : attacker, target: impact ? attacker : defender,
        axisFrom: a.position, axisTo: b.position })
      const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
      camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
      expect(a.position.clone().project(camera).x).toBeLessThan(b.position.clone().project(camera).x)
      for (const body of [a, b]) {
        expect(frame.position.distanceTo(body.position)).toBeGreaterThan(body.size * .78)
        for (const x of [-.6, .6]) for (const y of [-.25, .4]) for (const z of [-.3, .3]) {
          const p = body.position.clone().add(new Vector3(x, y, z).multiplyScalar(body.size)).project(camera)
          expect(Math.abs(p.x)).toBeLessThan(1)
          expect(Math.abs(p.y)).toBeLessThan(1)
        }
      }
    }
  }
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
    for (const body of [a, b]) for (const x of [-.6, .6]) for (const y of [-.25, .4]) for (const z of [-.3, .3]) {
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

test('scale-establishing masters keep real two-to-one and twenty-two-to-one hull ratios legible', () => {
  for (const smallSize of [179, 16.2]) for (const aspect of [.46, 16 / 9, 2.4]) for (const time of [0, 2.5, 5]) {
    const capital = actor('a', -500, 362), smaller = actor('b', 500, smallSize)
    const frame = sampleStoryCamera({ shot: { ...shot, role: 'geography', battlefield: true }, time, aspect,
      subject: capital, target: smaller, battlefield: [capital, smaller], axisFrom: capital.position, axisTo: smaller.position })
    const camera = new PerspectiveCamera(frame.fov, aspect, .1, 100000)
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld()
    const depth = (body: typeof capital) => -body.position.clone().applyMatrix4(camera.matrixWorldInverse).z
    expect(Math.max(depth(capital), depth(smaller)) / Math.min(depth(capital), depth(smaller))).toBeLessThan(1.15)
    const width = (body: typeof capital) => {
      const left = body.position.clone().add(new Vector3(-body.size * .5, 0, 0)).project(camera)
      const right = body.position.clone().add(new Vector3(body.size * .5, 0, 0)).project(camera)
      return Math.abs(right.x - left.x)
    }
    const perceivedRatio = width(capital) / width(smaller)
    const actualRatio = capital.size / smaller.size
    expect(perceivedRatio / actualRatio).toBeGreaterThan(.85)
    expect(perceivedRatio / actualRatio).toBeLessThan(1.15)
  }
})


test('scale masters add restrained lateral parallax and remain deterministic with reduced motion', () => {
  const a = actor('a', -500, 362), b = actor('b', 500, 179)
  const options = { shot: { ...shot, role: 'geography' as const, battlefield: true }, aspect: 16 / 9,
    subject: a, target: b, battlefield: [a, b], axisFrom: a.position, axisTo: b.position }
  const early = sampleStoryCamera({ ...options, time: 0 }), late = sampleStoryCamera({ ...options, time: 5 })
  const earlyView = early.position.clone().sub(early.target).normalize(), lateView = late.position.clone().sub(late.target).normalize()
  expect(lateView.x - earlyView.x).toBeGreaterThan(.03)
  expect(lateView.x - earlyView.x).toBeLessThan(.05)
  expect(early.position.z).toBeGreaterThan(0)
  expect(late.position.z).toBeGreaterThan(0)
  sampleStoryCamera({ ...options, time: 1 })
  expect(sampleStoryCamera({ ...options, time: 5 })).toEqual(late)
  expect(sampleStoryCamera({ ...options, time: 5, reduced: true })).toEqual(sampleStoryCamera({ ...options, time: 0, reduced: true }))
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
