import { expect, test } from 'bun:test'
import { Vector3, PerspectiveCamera } from 'three'
import { keepCameraOutsideHulls, sampleStoryCamera, clearStorySightline } from './camera'
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
