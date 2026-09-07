import type { ShipMotion } from './motion'
import type { CinemaCue } from './types'
import { hullContactAnchors, hullsHaveClearance, hullSupportPoint, type HullContactProfile, type ContactPoint } from './hull-contact'

export interface BoardingMotionBody { id: string; start: number; end: number; radius: number; kind?: string; hull?: HullContactProfile }
export interface BoardingShipMotion extends ShipMotion { boardingContact?: {actor:ContactPoint;target:ContactPoint;normal:ContactPoint;gap:number} }
type Sampler = (id: string, time: number) => BoardingShipMotion
interface Operation { actor: BoardingMotionBody; target: BoardingMotionBody; events: CinemaCue[]; start: number; openingContact?: boolean }
const smooth = (value: number) => { const p=Math.max(0,Math.min(1,value)); return p*p*(3-2*p) }

/** Pure cinematic blocking from observed links. Radii bound hulls, not personnel. */
export function createBoardingMotionSampler(cues: readonly CinemaCue[], bodies: readonly BoardingMotionBody[], base: Sampler): Sampler {
  const bodyById=new Map(bodies.map(body=>[body.id,body]))
  const grouped=new Map<string,Operation>()
  for(const cue of [...cues].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id))) {
    if(cue.kind!=='boarding'||!cue.boardingPhase||!cue.from||!cue.to||cue.from===cue.to)continue
    const actor=bodyById.get(cue.from),target=bodyById.get(cue.to)
    if(!actor||!target||actor.kind==='station'||cue.time<Math.max(actor.start,target.start)||cue.time>=Math.min(actor.end,target.end))continue
    const key=JSON.stringify([cue.operationId||'historical',cue.from,cue.to])
    let op=grouped.get(key)
    if(!op){op={actor,target,events:[],start:cue.time};grouped.set(key,op)}
    op.events.push(cue)
  }
  for(const op of grouped.values()) {
    const first=op.events[0]
    if(!first.boardingEnded&&['breach','assault'].includes(first.boardingPhase??'')) {
      // A historical record can begin after closing. Reserve only available
      // lifecycle time before its first observed contact, never delay the latch.
      const start=Math.max(op.actor.start,op.target.start,first.time-1.5)
      if(start<first.time) {
        op.start=start
        op.events.unshift({...first,id:first.id+':motion-preroll',time:start,boardingPhase:'approach'})
      } else op.openingContact=true
    }
  }
  const byActor=new Map<string,Operation[]>()
  const accepted:Operation[]=[]
  const end=(op:Operation)=>op.events.find(event=>event.boardingEnded)?.time ?? Math.min(op.actor.end,op.target.end)
  for(const op of [...grouped.values()].sort((a,b)=>a.start-b.start||a.actor.id.localeCompare(b.actor.id))) {
    // Public links are exclusive; inconsistent reciprocal rows must not make
    // two animated hulls converge through one another.
    if(accepted.some(other=>end(other)>op.start && other.start<end(op) &&
      (other.actor.id===op.target.id||other.target.id===op.actor.id||other.target.id===op.target.id)))continue
    accepted.push(op)
    const existing=byActor.get(op.actor.id)??[];existing.push(op);byActor.set(op.actor.id,existing)
  }
  for(const operations of byActor.values())operations.sort((a,b)=>a.start-b.start)
  interface Berth { side: number; elevation: number; disabled?: boolean }
  const berths=new Map<Operation,Berth>()
  const offset=(op:Operation,time:number,berth:Berth=berths.get(op)??{side:1,elevation:0}) => {
    const t=Math.min(time,op.actor.end,op.target.end)
    const actor=base(op.actor.id,t),target=base(op.target.id,t)
    const openingActor=base(op.actor.id,op.start),openingTarget=base(op.target.id,op.start)
    const dx=openingActor.x-openingTarget.x,dz=openingActor.z-openingTarget.z
    const nx=Math.sin(openingTarget.yaw),nz=Math.cos(openingTarget.yaw)
    const side=dx*nx+dz*nz<0?-1:1
    const ux=nx*side*berth.side,uz=nz*side*berth.side
        const physical=!!op.actor.hull?.points.length&&!!op.target.hull?.points.length
    const normalLength=physical?Math.hypot(1,berth.elevation):1
    const normal={x:ux/normalLength,y:physical?berth.elevation/normalLength:0,z:uz/normalLength}
    const actorPatch=physical?hullSupportPoint(op.actor.hull!,{x:-normal.x,y:-normal.y,z:-normal.z},{yaw:actor.yaw,bank:0}):{x:0,y:0,z:0}
    const targetPatch=physical?hullSupportPoint(op.target.hull!,normal,target):{x:0,y:0,z:0}
    const gap=physical?Math.max(.5,Math.min(2,Math.min(op.actor.radius,op.target.radius)*.06)):8
    const desired=physical?{x:targetPatch.x-actorPatch.x+normal.x*gap,y:targetPatch.y-actorPatch.y+normal.y*gap,z:targetPatch.z-actorPatch.z+normal.z*gap}:
      {x:ux*(Math.max(1,op.actor.radius)+Math.max(1,op.target.radius)+8),y:berth.elevation,z:uz*(Math.max(1,op.actor.radius)+Math.max(1,op.target.radius)+8)}
    const clearance=Math.hypot(desired.x,desired.z)
    let weight=op.openingContact?1:0,lastTime=op.start,fromWeight=weight,toWeight=weight,duration=1
    for(const event of op.events) {
      if(event.time>t)break
      // Closing occupies the observed interval to contact; a closing report
      // alone never authorizes parking at the attachment berth.
      const following=event.boardingPhase==='approach'?op.events.find(candidate=>candidate.time>event.time&&candidate.boardingPhase!=='approach'):undefined
      const contact=following&&!following.boardingEnded&&['breach','assault'].includes(following.boardingPhase??'')?following:undefined
      const next=event.boardingPhase==='withdraw'||event.boardingPhase==='plunder'||event.boardingEnded?0:
        event.boardingPhase==='approach' && !contact ? .7 : 1
      if(next===toWeight)continue
      weight=fromWeight+(toWeight-fromWeight)*smooth((event.time-lastTime)/duration)
      fromWeight=weight;toWeight=next;lastTime=event.time
      duration=contact?Math.max(.15,contact.time-event.time):Math.max(.15,Math.min(1.5,event.duration))
    }
    weight=berth.disabled?0:fromWeight+(toWeight-fromWeight)*smooth((t-lastTime)/duration)
    const initialAngle=Math.atan2(actor.z-target.z,actor.x-target.x)
    const finalAngle=Math.atan2(desired.z,desired.x)
    const turn=Math.atan2(Math.sin(finalAngle-initialAngle),Math.cos(finalAngle-initialAngle))
    const bearing=initialAngle+turn*weight
    const radius=Math.max(clearance,Math.hypot(actor.x-target.x,actor.z-target.z))*(1-weight)+clearance*weight
    const x=weight>0?target.x+Math.cos(bearing)*radius:actor.x
    const z=weight>0?target.z+Math.sin(bearing)*radius:actor.z
        const y=actor.y+(target.y-actor.y+desired.y)*weight
    // Keep sockets while disengaging too. They track the actual rolled hulls;
    // callers use their measured separation to fade only still-nearby hardware.
    const contact=physical&&weight>0?hullContactAnchors(op.actor.hull!,op.target.hull!,
      {...actor,x,y,z,bank:actor.bank*(1-weight)},target,normal):undefined
    return {x:x-actor.x,y:y-actor.y,z:z-actor.z,yaw:0,weight,contact}
  }
  // Berths are chosen once for the complete operation, never in response to
  // a frame. Fixed work per candidate bounds planning even for long holds.
  for(const op of accepted) {
    const finish=Math.min(op.actor.end,op.target.end)
    const times=new Set<number>()
    for(let i=0;i<=48;i++)times.add(op.start+(finish-op.start)*i/48)
    let previousPhase:string|undefined
    let transitions=0
    for(const event of op.events) {
      const phase=event.boardingPhase==='withdraw'||event.boardingPhase==='plunder'||event.boardingEnded?'release':'contact'
      if(phase===previousPhase)continue
      previousPhase=phase
      if(++transitions>24)break
      for(let i=0;i<=16;i++)times.add(Math.min(finish,event.time+Math.max(.15,Math.min(1.5,event.duration))*i/16))
    }
    const nearby=bodies.filter(body=>body.id!==op.actor.id&&body.id!==op.target.id&&body.start<finish&&body.end>op.start)
    if(!nearby.length){berths.set(op,{side:1,elevation:0});continue}
    const probes=[...times].sort((a,b)=>a-b).map(time=>({time,actor:base(op.actor.id,time),
      obstacles:nearby.filter(body=>body.start<=time&&body.end>=time).map(body=>({radius:body.radius,hull:body.hull,pose:base(body.id,time)}))}))
    const lift=op.actor.hull&&op.target.hull?1:(op.actor.radius+op.target.radius+8)*2
    const candidates=[{side:1,elevation:0},{side:-1,elevation:0},
      {side:1,elevation:lift},{side:-1,elevation:lift},{side:1,elevation:-lift},{side:-1,elevation:-lift}]
    const berth=candidates.find(candidate=>probes.every(probe=>{
      const change=offset(op,probe.time,candidate)
            return probe.obstacles.every(obstacle=>op.actor.hull&&obstacle.hull?
        hullsHaveClearance(op.actor.hull,{...probe.actor,x:probe.actor.x+change.x,y:probe.actor.y+change.y,z:probe.actor.z+change.z,bank:probe.actor.bank*(1-change.weight)},obstacle.hull,obstacle.pose,4):
        Math.hypot(probe.actor.x+change.x-obstacle.pose.x,
        probe.actor.y+change.y-obstacle.pose.y,probe.actor.z+change.z-obstacle.pose.z)>=op.actor.radius+obstacle.radius+4)
    }))
    berths.set(op,berth??{side:1,elevation:0,disabled:true})
  }
  return (id,time) => {
    const pose=base(id,time),operations=byActor.get(id)
    const op=operations?.findLast(operation=>operation.start<=time)
    if(!op)return pose
    const change=offset(op,time)
    return {...pose,x:pose.x+change.x,y:pose.y+change.y,z:pose.z+change.z,yaw:pose.yaw+change.yaw,
      bank:pose.bank*(1-change.weight),thrust:pose.thrust*(1-change.weight),retroThrust:pose.retroThrust*(1-change.weight),...(change.contact?{boardingContact:change.contact}:{})}
  }
}
