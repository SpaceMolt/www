import { describe, expect, it } from 'bun:test'
import { createBoardingMotionSampler, type BoardingMotionBody } from './boarding-motion'
import type { CinemaCue } from './types'
import type { ShipMotion } from './motion'
const bodies:BoardingMotionBody[]=[{id:'a',start:0,end:20,radius:20},{id:'b',start:0,end:20,radius:30}]
const base=(id:string,time:number):ShipMotion=>({x:id==='a'?-200:200,y:0,z:Math.min(time,20),yaw:id==='a'?0:Math.PI,bank:.1,thrust:1,retroThrust:0})
const cue=(phase:NonNullable<CinemaCue['boardingPhase']>,time:number,extra:Partial<CinemaCue>={}):CinemaCue=>({id:'cue'+time,kind:'boarding',from:'a',to:'b',operationId:'op',boardingPhase:phase,time,duration:1,tick:time,intensity:.5,...extra})
describe('boarding motion',()=>{
  it('approaches a nonintersecting position, holds a latch and reconstructs seeks',()=>{
    const sample=createBoardingMotionSampler([cue('approach',1),cue('breach',3),cue('assault',5)],bodies,base)
    expect(sample('a',0)).toEqual(base('a',0))
    for(let t=1;t<10;t+=.1){const a=sample('a',t),b=sample('b',t);expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThanOrEqual(58-1e-6)}
    expect(Math.hypot(sample('a',6).x-base('b',6).x,sample('a',6).z-base('b',6).z)).toBeCloseTo(58)
    expect(sample('a',6).yaw).toBe(base('a',6).yaw)
    expect(sample('a',6).x).toBeCloseTo(base('b',6).x)
    const expected=sample('a',5.5);sample('a',19);sample('a',0);expect(sample('a',5.5)).toEqual(expected)
  })
  it('releases plunder and defeated boarding without moving the target',()=>{
    for(const end of [cue('plunder',7,{boardingEnded:true}),cue('withdraw',7,{boardingEnded:true,boardingEvent:'boarding_force_defeated'})]){
      const sample=createBoardingMotionSampler([cue('breach',1),end],bodies,base)
      expect(sample('a',9)).toEqual(base('a',9));expect(sample('b',4)).toEqual(base('b',4))
    }
  })
  it('freezes a captured or destroyed hull offset at retirement',()=>{
    const retired=bodies.map(b=>({...b,end:b.id==='a'?5:20}))
    const stopped=(id:string,t:number)=>base(id,Math.min(t,id==='a'?5:20))
    const sample=createBoardingMotionSampler([cue('breach',1)],retired,stopped)
    expect(sample('a',8)).toEqual(sample('a',5))
  })
  it('keeps terminal target retirement from snapping its attached boarder back',()=>{
    const sample=createBoardingMotionSampler([cue('breach',1)],bodies.map(b=>({...b,end:b.id==='b'?5:20})),base)
    expect(sample('a',5.001).x).toBeCloseTo(sample('a',5).x)
  })
  it('ignores unknown targets and does not recursively follow reciprocal links',()=>{
    const sample=createBoardingMotionSampler([cue('breach',1),cue('breach',1,{from:'b',to:'a',operationId:'other'}),cue('breach',3,{to:'missing'})],bodies,base)
    expect(Number.isFinite(sample('a',4).x)).toBe(true);expect(Number.isFinite(sample('b',4).x)).toBe(true)
  })
})


it('uses historical pair identity without turning a station into a boarder',()=>{
  const sample=createBoardingMotionSampler([cue('approach',1,{operationId:undefined}),cue('breach',3,{operationId:undefined})],bodies,base)
  expect(sample('a',3).x).toBeCloseTo(base('b',3).x)
  const station=createBoardingMotionSampler([cue('breach',1)],bodies.map(b=>({...b,kind:b.id==='a'?'station':'ship'})),base)
  expect(station('a',5)).toEqual(base('a',5))
})

it('starts a subsequent operation from the released formation',()=>{
  const more=[...bodies,{id:'c',start:0,end:20,radius:25}]
  const sample=createBoardingMotionSampler([cue('breach',1),cue('withdraw',5,{boardingEnded:true}),cue('approach',8,{operationId:'next',to:'c'}),cue('breach',10,{operationId:'next',to:'c'})],more,base)
  expect(sample('a',8)).toEqual(base('a',8))
  expect(Math.hypot(sample('a',11).x-base('c',11).x,sample('a',11).z-base('c',11).z)).toBeCloseTo(53)
})

it('chooses a berth and approach that clear an active third hull',()=>{
  const fleet=[...bodies,{id:'c',start:0,end:20,radius:20}]
  const positions=(id:string,t:number)=>({...base(id,t),z:id==='c'?58:0})
  const sample=createBoardingMotionSampler([cue('breach',1)],fleet,positions)
  for(let t=1;t<=5;t+=.025){const a=sample('a',t),c=sample('c',t);expect(Math.hypot(a.x-c.x,a.y-c.y,a.z-c.z)).toBeGreaterThanOrEqual(40-1e-6)}
  expect(sample('a',3)).toEqual(sample('a',3))
})

it('plans a fixed elevated berth when a moving target has neighbors on both sides',()=>{
  const fleet=[...bodies,{id:'c',start:0,end:20,radius:20},{id:'d',start:0,end:20,radius:20}]
  const positions=(id:string,t:number)=>({...base(id,t),x:id==='a'?-200:200+t*5,z:id==='c'?58:id==='d'?-58:0})
  const sample=createBoardingMotionSampler([cue('approach',1),cue('breach',3)],fleet,positions)
  const expected=sample('a',7)
  expect(Math.abs(expected.y)).toBeGreaterThan(20)
  for(let t=1;t<19;t+=.025){const a=sample('a',t);for(const id of ['b','c','d']){const obstacle=positions(id,t);expect(Math.hypot(a.x-obstacle.x,a.y-obstacle.y,a.z-obstacle.z)).toBeGreaterThanOrEqual(id==='b'?50:40)}}
  sample('a',19);sample('a',0);expect(sample('a',7)).toEqual(expected)
  expect(sample('a',7).yaw).toBe(base('a',7).yaw)
})
