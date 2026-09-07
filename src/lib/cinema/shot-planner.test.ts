import { expect, test } from 'bun:test'
import { Vector3 } from 'three'
import { buildShotPlan, measureShotVisibility, sampleCameraCandidate, planTransition, sampleCameraTransition, detailFramingScore } from './shot-planner'
import type { CameraBody, StoryCameraOptions } from './camera'
import type { CinemaFilm, CinemaShot } from './types'
const a: CameraBody={id:'a',position:new Vector3(),size:40}
const b: CameraBody={id:'b',position:new Vector3(180,0,0),size:30}
const shot: CinemaShot={start:0,end:4,kind:'tracking',role:'fire',subject:'a',target:'b',intensity:1,sequenceId:'s'}
const options=(s=shot,time=2):StoryCameraOptions=>({shot:s,time,aspect:16/9,subject:a,target:b,axisFrom:a.position,axisTo:b.position,sequence:{id:'s',start:0,end:4,kind:'confrontation',attacker:'a',defender:'b',actionTime:1,impactTime:2}})
const film=(shots=[shot]):CinemaFilm=>({version:1,battleId:'x',seed:1,duration:4,arena:false,outcome:'',winningSide:0,systemName:'',ships:[],shots,cues:[],segments:[]})
test('projection rejects behind camera, tiny and occluded subjects',()=>{
 const frame={position:new Vector3(0,0,100),target:new Vector3(),fov:42}
 expect(measureShotVisibility(frame,16/9,a,[a]).readable).toBe(true)
 expect(measureShotVisibility(frame,16/9,{...a,position:new Vector3(0,0,200)},[]).visible).toBe(false)
 expect(measureShotVisibility(frame,16/9,{...a,size:.01},[]).readable).toBe(false)
 const blocker={id:'block',position:new Vector3(0,0,50),size:60}
 expect(measureShotVisibility(frame,16/9,a,[a,blocker]).occluded).toBe(true)
})
test('hull-local occlusion does not confuse empty space around a capital with solid hull',()=>{
 const frame={position:new Vector3(0,0,100),target:new Vector3(),fov:42}
 const blocker:CameraBody={id:'capital',position:new Vector3(0,20,50),size:300,contactHull:{min:new Vector3(-150,-3,-5),max:new Vector3(150,3,5),yaw:0,bank:0}}
 expect(measureShotVisibility(frame,16/9,a,[a,blocker]).occluded).toBe(false)
})
test('planning is deterministic and chooses clearer coverage when authored camera is obstructed',()=>{
 const authored=sampleCameraCandidate(options(),0,[a,b])
 const blocker={id:'block',position:authored.position.clone().lerp(a.position,.5),size:50}
 const input={optionsAt:options,bodiesAt:()=>[a,b,blocker]}
 const first=buildShotPlan(film(),input),second=buildShotPlan(film(),input)
 expect(first.shots.get(shot)).toEqual(second.shots.get(shot))
 expect(first.shots.get(shot)?.candidate).not.toBe(0)
})
test('setup and impact within a take choose one camera variant',()=>{
 const setup={...shot,end:2,role:'setup' as const},impact={...shot,start:2,role:'impact' as const}
 const plan=buildShotPlan(film([setup,impact]),{optionsAt:options,bodiesAt:()=>[a,b]})
 expect(plan.shots.get(setup)?.candidate).toBe(plan.shots.get(impact)?.candidate)
})
test('reciprocal fire keeps the same camera shoulder within a shared take',()=>{
 const first=options(),second={...options(),sequence:{...options().sequence!,attacker:'b',defender:'a'}}
 for(let candidate=0;candidate<5;candidate++)expect(sampleCameraCandidate(first,candidate,[a,b]).position.distanceTo(sampleCameraCandidate(second,candidate,[a,b]).position)).toBeLessThan(.0001)
})

test('every candidate remains continuous across setup and impact labels',()=>{
 const setup={...shot,end:2,role:'setup' as const},impact={...shot,start:2,role:'impact' as const}
 for(let candidate=0;candidate<5;candidate++){
  const before=sampleCameraCandidate(options(setup,1.9999),candidate,[a,b])
  const after=sampleCameraCandidate(options(impact,2.0001),candidate,[a,b])
  expect(before.position.distanceTo(after.position)).toBeLessThan(.02)
 }
})

test('key event acceptance checks the impact moment rather than only firing time',()=>{
 const record=film();record.cues=[{id:'hit',time:1,duration:1,tick:1,kind:'weapon',from:'a',to:'b',intensity:1}]
 const sampled:number[]=[]
 const plan=buildShotPlan(record,{optionsAt:options,bodiesAt:time=>{
  sampled.push(time)
  return [a,Math.abs(time-2)<.0001?{...b,size:.001}:b]
 }})
 expect(sampled).toContain(2)
 expect(plan.shots.get(shot)?.concerns).toContain('hit: event subject unreadable')
})

test('a mostly off-screen silhouette is not readable coverage',()=>{
 const frame={position:new Vector3(0,0,100),target:new Vector3(),fov:42}
 expect(measureShotVisibility(frame,16/9,{...a,position:new Vector3(95,0,0)},[]).readable).toBe(false)
})


test('compatible adjacent compositions use an absolute-time pan and dolly',()=>{
 const from={position:new Vector3(70,60,300),target:new Vector3(90,0,0),fov:42}
 const incoming={position:new Vector3(90,70,310),target:new Vector3(90,0,0),fov:42}
 const transition=planTransition({start:4,end:8,goal:'exchange',critical:false,subjectIds:['a','b'],previous:{frame:from,end:4,ids:['a','b']},frameAt:()=>({frame:incoming,options:options(),bodies:[a,b]})})
 expect(transition.kind).toBe('move')
 expect(sampleCameraTransition(transition,incoming,4,[a,b]).position.distanceTo(from.position)).toBe(0)
 const seek=sampleCameraTransition(transition,incoming,4.5,[a,b])
 sampleCameraTransition(transition,incoming,4.2,[a,b])
 expect(sampleCameraTransition(transition,incoming,4.5,[a,b]).position.distanceTo(seek.position)).toBe(0)
 expect(sampleCameraTransition(transition,incoming,6,[a,b]).position.distanceTo(incoming.position)).toBe(0)
})

test('an unsafe orbit or immediate outcome receives an intentional cut',()=>{
 const from={position:new Vector3(90,60,300),target:new Vector3(90,0,0),fov:42}
 const opposite={position:new Vector3(90,60,-300),target:new Vector3(90,0,0),fov:42}
 const input={start:4,end:8,goal:'exchange' as const,critical:false,subjectIds:['a','b'],previous:{frame:from,end:4,ids:['a','b']},frameAt:()=>({frame:opposite,options:options(),bodies:[a,b]})}
 expect(planTransition(input).reason).toBe('preserve screen geography')
 expect(planTransition({...input,critical:true}).reason).toBe('protect immediate key event')
})

test('a camera path intersecting an actual hull is rejected before playback',()=>{
 const from={position:new Vector3(65,60,300),target:new Vector3(90,0,0),fov:42}
 const incoming={position:new Vector3(115,60,300),target:new Vector3(90,0,0),fov:42}
 const block:CameraBody={id:'wall',position:new Vector3(90,60,300),size:5,contactHull:{min:new Vector3(-8,-8,-8),max:new Vector3(8,8,8),yaw:0,bank:0}}
 const transition=planTransition({start:4,end:8,goal:'exchange',critical:false,subjectIds:['a','b'],previous:{frame:from,end:4,ids:['a','b']},frameAt:()=>({frame:incoming,options:options(),bodies:[a,b,block]})})
 expect(transition.kind).toBe('cut')
 expect(transition.reason).toBe('move crosses hull clearance')
})


test('cinematic goals prefer readable detail over merely recognizable distant hulls',()=>{
 const distant={id:'a',visible:true,readable:true,size:.025,x:0,depth:1000,occluded:false}
 const detailed={...distant,size:.24},tooClose={...distant,size:.9}
 for(const goal of ['exchange','outcome','contact'] as const){
  expect(detailFramingScore(goal,detailed,true)).toBeGreaterThan(detailFramingScore(goal,distant,true)+20)
  expect(detailFramingScore(goal,detailed,true)).toBeGreaterThan(detailFramingScore(goal,tooClose,true))
 }
 expect(detailFramingScore('outcome',distant,false)).toBeGreaterThanOrEqual(0)
 expect(detailFramingScore('exchange',{...distant,size:.04},false)).toBeGreaterThan(detailFramingScore('exchange',distant,false))
})

test('aftermath favors a detailed survivor instead of fitting a distant opponent',()=>{
 const ending: CinemaShot={...shot,sequenceId:undefined,kind:'aftermath',role:'resolution'}
 const distantOpponent={...b,position:new Vector3(3000,0,0)}
 const opts=(s=ending,time=2):StoryCameraOptions=>({...options(s,time),sequence:undefined,target:distantOpponent})
 const plan=buildShotPlan(film([ending]),{optionsAt:opts,bodiesAt:()=>[a,distantOpponent]})
 const choice=plan.shots.get(ending)!
 const selected=sampleCameraCandidate(opts(),choice.candidate,[a,distantOpponent])
 const primary=measureShotVisibility(selected,16/9,a,[a,distantOpponent])
 expect(choice.goal).toBe('outcome')
 expect(primary.readable).toBe(true)
 expect(primary.size).toBeGreaterThan(.15)
})
