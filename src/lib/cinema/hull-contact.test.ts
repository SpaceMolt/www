import { expect,it } from 'bun:test'
import { createBoardingMotionSampler,type BoardingMotionBody } from './boarding-motion'
import { createHullContactProfile,hullContactAnchors,hullsHaveClearance,hullSupportPoint } from './hull-contact'
import type { ShipMotion } from './motion'
import type { CinemaCue } from './types'
const box=(x:number,y:number,z:number)=>createHullContactProfile([-x,x].flatMap(x=>[-y,y].flatMap(y=>[-z,z].map(z=>({x,y,z})))))
it('docks actual narrow hull surfaces across a T5 versus scout scale disparity',()=>{
 const hullA=box(180,30,45),hullB=box(8,2,3)
 const bodies:BoardingMotionBody[]=[{id:'a',start:0,end:20,radius:283,hull:hullA},{id:'b',start:0,end:20,radius:12.6,hull:hullB}]
 const base=(id:string):ShipMotion=>({x:id==='a'?-500:100,y:0,z:0,yaw:0,bank:0,thrust:1,retroThrust:0})
 const cues:CinemaCue[]=[{id:'latch',kind:'boarding',boardingPhase:'breach',from:'a',to:'b',time:3,duration:1,tick:1,intensity:1}]
 const sample=createBoardingMotionSampler(cues,bodies,base)
 const a=sample('a',4),b=sample('b',4),contact=hullContactAnchors(hullA,hullB,a,b,a.boardingContact?.normal)
 expect(contact.gap).toBeLessThanOrEqual(2)
 expect(Math.abs(a.z-b.z)).toBeGreaterThanOrEqual(48)
 expect(Math.abs(a.z-b.z)).toBeLessThanOrEqual(50)
})

it('keeps opposing physical hull envelopes separate during asymmetric closure',()=>{
 const hullA=box(180,30,45),hullB=box(8,2,3)
 const bodies:BoardingMotionBody[]=[{id:'a',start:0,end:20,radius:283,hull:hullA},{id:'b',start:0,end:20,radius:12.6,hull:hullB}]
 for(const yaw of [0,.3,1,Math.PI]){
 const base=(id:string):ShipMotion=>({x:id==='a'?-500:100,y:0,z:0,yaw:id==='a'?yaw:Math.PI,bank:0,thrust:1,retroThrust:0})
 const cues:CinemaCue[]=[{id:'close',kind:'boarding',boardingPhase:'approach',from:'a',to:'b',time:1,duration:1,tick:1,intensity:1},{id:'latch',kind:'boarding',boardingPhase:'breach',from:'a',to:'b',time:3,duration:1,tick:1,intensity:1}]
 const sample=createBoardingMotionSampler(cues,bodies,base)
 for(let t=1;t<=4;t+=.025)expect(hullsHaveClearance(hullA,sample('a',t),hullB,sample('b',t),0)).toBe(true)
 }
})

import { Mesh,Triangle,Vector3,type Material } from 'three'
import { createShip } from './ships'
import { resolveAppearance } from './appearance'
import { cinemaHullWorldSize } from './ship-scale'
it('places Opus Magna and pirate Lemming contact patches on their assembled hull surfaces',()=>{
 const appearances=[resolveAppearance('Dreadnought','solarian',5,'Combat',5),{...resolveAppearance('Scout','pirate',1,'Exploration',1),hullEmpire:'solarian' as const}]
 const models=appearances.map((appearance,i)=>createShip(appearance,101+i))
 const triangles:Triangle[][]=[],profiles:ReturnType<typeof createHullContactProfile>[]=[]
 try {
 for(let m=0;m<models.length;m++){
  const points:Vector3[]=[],faces:Triangle[]=[];const scale=cinemaHullWorldSize(appearances[m])
  models[m].traverse(object=>{
   if(!(object instanceof Mesh)||!['hull','armor','dark','metal'].includes(object.name))return
   const p=object.geometry.getAttribute('position'),mount=object.geometry.getAttribute('cinemaMount')
   for(let i=0;i<p.count;i+=3){if(mount&&mount.getX(i)>=0)continue
    const vertices=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,i+j).multiplyScalar(scale))
    points.push(...vertices);faces.push(new Triangle(...vertices as [Vector3,Vector3,Vector3]))
   }
  });profiles.push(createHullContactProfile(points,true));triangles.push(faces)
 }
 const bodies:BoardingMotionBody[]=profiles.map((hull,i)=>({id:i?'b':'a',start:0,end:20,radius:cinemaHullWorldSize(appearances[i])*.78,hull}))
 const base=(id:string):ShipMotion=>({x:id==='a'?-500:100,y:0,z:0,yaw:0,bank:0,thrust:1,retroThrust:0})
 const cues:CinemaCue[]=[{id:'latch',kind:'boarding',boardingPhase:'breach',from:'a',to:'b',time:3,duration:1,tick:1,intensity:1}]
 const sample=createBoardingMotionSampler(cues,bodies,base),a=sample('a',4),b=sample('b',4),contact=a.boardingContact!
 expect(contact).toBeDefined();expect(contact.gap).toBeLessThan(2)
 for(const [index,pose,point] of [[0,a,contact.actor],[1,b,contact.target]] as const){
  const local=new Vector3(point.x-pose.x,point.y-pose.y,point.z-pose.z),nearest=new Vector3()
  const distance=Math.min(...triangles[index].map(face=>face.closestPointToPoint(local,nearest).distanceTo(local)))
  expect(distance).toBeLessThan(.05)
 }
 } finally {
  const materials=new Set<Material>()
  for(const model of models)model.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material)}})
  for(const material of materials)material.dispose()
 }
})

it('never anchors in the empty space between disconnected hull surfaces',()=>{
 const profile=createHullContactProfile([{x:-3,y:-1,z:1},{x:-3,y:1,z:1},{x:3,y:-1,z:1},{x:3,y:1,z:1}])
 const anchor=hullSupportPoint(profile,{x:0,y:0,z:1},{yaw:0,bank:0})
 expect(Math.abs(anchor.x)).toBe(3)
 expect(profile.points.some(p=>p.x===anchor.x&&p.y===anchor.y&&p.z===anchor.z)).toBe(true)
})

it('retains a real side berth beside a nearby tanker despite overlapping bounding spheres',()=>{
 const hullA=box(180,30,45),hullB=box(8,2,3),hullC=box(90,20,30)
 const bodies:BoardingMotionBody[]=[{id:'a',start:0,end:20,radius:283,hull:hullA},{id:'b',start:0,end:20,radius:12.6,hull:hullB},{id:'c',start:0,end:20,radius:140,hull:hullC}]
 const base=(id:string):ShipMotion=>({x:id==='a'?-500:100,y:0,z:id==='c'?170:0,yaw:0,bank:0,thrust:1,retroThrust:0})
 const sample=createBoardingMotionSampler([{id:'latch',kind:'boarding',boardingPhase:'breach',from:'a',to:'b',time:3,duration:1,tick:1,intensity:1}],bodies,base)
 expect(sample('a',4).boardingContact?.gap).toBeLessThan(2)
 expect(hullsHaveClearance(hullA,sample('a',4),hullC,sample('c',4),4)).toBe(true)
})

it('projects a disconnected triangle-soup support patch onto solid geometry',()=>{
 const profile=createHullContactProfile([{x:-4,y:-1,z:1},{x:-2,y:-1,z:1},{x:-3,y:1,z:1},{x:2,y:-1,z:1},{x:4,y:-1,z:1},{x:3,y:1,z:1}],true)
 const anchor=hullSupportPoint(profile,{x:0,y:0,z:1},{yaw:0,bank:0})
 expect(Math.abs(anchor.x)).toBeGreaterThanOrEqual(2)
})

it('keeps real surface sockets through release and reports their growing separation',()=>{
 const hullA=box(180,30,45),hullB=box(8,2,3)
 const bodies:BoardingMotionBody[]=[{id:'a',start:0,end:20,radius:283,hull:hullA},{id:'b',start:0,end:20,radius:12.6,hull:hullB}]
 const base=(id:string):ShipMotion=>({x:id==='a'?-500:100,y:0,z:0,yaw:0,bank:id==='a'?.2:0,thrust:1,retroThrust:0})
 const cues:CinemaCue[]=[{id:'latch',kind:'boarding',boardingPhase:'breach',from:'a',to:'b',time:3,duration:1,tick:1,intensity:1},{id:'release',kind:'boarding',boardingPhase:'withdraw',boardingEnded:true,from:'a',to:'b',time:5,duration:1,tick:2,intensity:1}]
 const sample=createBoardingMotionSampler(cues,bodies,base)
 const initial=sample('a',5).boardingContact!
 let previous=initial.gap
 for(const time of [5.05,5.1,5.3,5.6]){
  const actor=sample('a',time),target=sample('b',time)
  expect(actor.boardingContact).toBeDefined()
  const actual=hullContactAnchors(hullA,hullB,actor,target,actor.boardingContact!.normal)
  for(const axis of ['x','y','z'] as const)expect(actor.boardingContact!.actor[axis]).toBeCloseTo(actual.actor[axis],7)
  expect(actor.boardingContact!.gap).toBeCloseTo(actual.gap,7)
  expect(actual.gap).toBeGreaterThan(previous);previous=actual.gap
 }
 expect(sample('a',6).boardingContact).toBeUndefined()
})
