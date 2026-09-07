import { Euler, Quaternion, Vector3 } from 'three'
import { keepCameraOutsideBodies, sampleStoryCamera, type CameraBody, type StoryCameraFrame, type StoryCameraOptions } from './camera'
import type { CinemaCue, CinemaFilm, CinemaShot } from './types'

export type ShotGoal = 'establish' | 'scale' | 'exchange' | 'contact' | 'outcome'
export interface CameraTransition { kind: 'hold' | 'move' | 'cut'; reason: string; start: number; duration: number; from?: StoryCameraFrame }
export interface PlannedShot { transition: CameraTransition; goal: ShotGoal; candidate: number; score: number; readableIds: string[]; concerns: string[] }
export interface ShotPlan { shots: Map<CinemaShot, PlannedShot> }
export interface ShotPlannerInput {
  optionsAt(shot: CinemaShot, time: number): StoryCameraOptions | undefined
  bodiesAt(time: number): readonly CameraBody[]
}
const variants = [
  { angle: 0, lift: 0, distance: 1, broadside: false },
  { angle: .20, lift: .12, distance: 1.04, broadside: false },
  { angle: -.20, lift: .25, distance: 1.10, broadside: false },
  { angle: 0, lift: .12, distance: 1, broadside: true },
  { angle: .08, lift: .42, distance: 1.12, broadside: true },
] as const

/** Every candidate goes through the same physical safety pass during planning
 * and playback. Camera positions are never cached against moving ships. */
export function sampleCameraCandidate(options: StoryCameraOptions, candidate: number, bodies: readonly CameraBody[]): StoryCameraFrame {
  if (!options.boarding && options.sequence?.attacker && options.sequence.defender) {
    const [attacker, defender] = [options.sequence.attacker, options.sequence.defender].sort()
    options = { ...options, sequence: { ...options.sequence, attacker, defender } }
  }
  const variant = variants[candidate] ?? variants[0]
  const broadside = variant.broadside && !options.boarding && !options.shot.battlefield
  const frame = sampleStoryCamera(broadside ? { ...options, sequence: undefined, shot: { ...options.shot, start: options.sequence?.start ?? options.shot.start, end: options.sequence?.end ?? options.shot.end, role: 'geography' } } : options)
  const offset = frame.position.clone().sub(frame.target)
  const length = offset.length()
  offset.applyAxisAngle(new Vector3(0, 1, 0), variant.angle).multiplyScalar(variant.distance)
  offset.y += length * variant.lift
  frame.position.copy(frame.target).add(offset)
  keepCameraOutsideBodies(frame.position, bodies)
  return frame
}

function corners(body: CameraBody): Vector3[] {
  const bounds = body.contactHull
  const rotation = bounds ? new Quaternion().setFromEuler(new Euler(bounds.bank, bounds.yaw, 0, 'YXZ')) : new Quaternion()
  const min = bounds?.min ?? new Vector3(-body.size * .5, -body.size * .2, -body.size * .3)
  const max = bounds?.max ?? min.clone().negate()
  const result: Vector3[] = []
  for (const x of [min.x,max.x]) for (const y of [min.y,max.y]) for (const z of [min.z,max.z]) result.push(new Vector3(x,y,z).applyQuaternion(rotation).add(body.position))
  return result
}

/** Hull-local slab test; a capital's empty bounding sphere is not an occluder. */
function blocks(origin: Vector3, destination: Vector3, body: CameraBody): boolean {
  const inverse = body.contactHull ? new Quaternion().setFromEuler(new Euler(body.contactHull.bank,body.contactHull.yaw,0,'YXZ')).invert() : new Quaternion()
  const point = origin.clone().sub(body.position).applyQuaternion(inverse)
  const direction = destination.clone().sub(origin).applyQuaternion(inverse)
  const min = body.contactHull?.min ?? new Vector3(-body.size*.5,-body.size*.2,-body.size*.3)
  const max = body.contactHull?.max ?? min.clone().negate()
  let near=.002, far=.98
  for (const key of ['x','y','z'] as const) {
    if(Math.abs(direction[key])<1e-8){if(point[key]<min[key]||point[key]>max[key])return false;continue}
    const a=(min[key]-point[key])/direction[key], b=(max[key]-point[key])/direction[key]
    near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b))
    if(near>far)return false
  }
  return true
}

export interface ShotVisibility { id: string; visible: boolean; readable: boolean; size: number; x: number; depth: number; occluded: boolean }
/** Screen fractions, rather than world distance, measure whether a hull reads. */
export function measureShotVisibility(frame: StoryCameraFrame, aspect: number, body: CameraBody, bodies: readonly CameraBody[]): ShotVisibility {
  const forward=frame.target.clone().sub(frame.position).normalize()
  const right=new Vector3().crossVectors(forward,new Vector3(0,1,0)).normalize()
  const up=new Vector3().crossVectors(right,forward).normalize()
  const vertical=Math.tan(frame.fov*Math.PI/360), horizontal=vertical*Math.max(.2,aspect)
  let left=Infinity,bottom=Infinity,top=-Infinity,rightmost=-Infinity,behind=false
  for(const corner of corners(body)){
    corner.sub(frame.position);const depth=corner.dot(forward)
    if(depth<=.01){behind=true;continue}
    const x=corner.dot(right)/(depth*horizontal),y=corner.dot(up)/(depth*vertical)
    left=Math.min(left,x);rightmost=Math.max(rightmost,x);bottom=Math.min(bottom,y);top=Math.max(top,y)
  }
  const relative=body.position.clone().sub(frame.position),depth=relative.dot(forward)
    const fullWidth=Math.max(0,rightmost-left),fullHeight=Math.max(0,top-bottom)
  const clippedWidth=Math.max(0,Math.min(1,rightmost)-Math.max(-1,left)),clippedHeight=Math.max(0,Math.min(1,top)-Math.max(-1,bottom))
  const size=Math.max(clippedWidth,clippedHeight)/2
  const fraction=clippedWidth*clippedHeight/Math.max(1e-8,fullWidth*fullHeight)
  const visible=!behind&&left<1&&rightmost>-1&&bottom<1&&top>-1
  const occluded=bodies.some(other=>other.id!==body.id&&blocks(frame.position,body.position,other))
  return {id:body.id,visible,readable:visible&&!occluded&&size>=.018&&fraction>=.35,size,x:relative.dot(right)/Math.max(.01,depth*horizontal),depth,occluded}
}

function eventMoment(event: CinemaCue): number {
  return event.time + (event.kind === 'weapon' ? event.duration : event.kind === 'boarding' ? event.duration * .54 : Math.min(.25, event.duration * .2))
}
function goalFor(shot: CinemaShot, options: StoryCameraOptions): ShotGoal {
  if(options.boarding)return 'contact'
  if(shot.battlefield)return 'establish'
  if(shot.role==='resolution'||shot.role==='impact'||shot.kind==='aftermath')return 'outcome'
  if(options.target&&Math.max(options.subject.size,options.target.size)>Math.min(options.subject.size,options.target.size)*3&&shot.role==='geography')return 'scale'
  return 'exchange'
}

/** Five candidates and three temporal samples per continuous take. Coverage is
 * accumulated only for readable ships, never merely because a name was selected. */
export function buildShotPlan(film: CinemaFilm, input: ShotPlannerInput): ShotPlan {
  const plan: ShotPlan={shots:new Map()}, coverage=new Map<string,number>()
  const groups: CinemaShot[][]=[]
  let lastKey=''
  for(const shot of film.shots){
    const options=input.optionsAt(shot,(shot.start+shot.end)/2)
    const sequence=options?.sequence
    const pair=sequence?[sequence.attacker,sequence.defender].sort().join(':'):''
    const key=sequence&&!shot.battlefield?`${sequence.start}:${sequence.end}:${pair}`:`shot:${shot.start}`
    if(key===lastKey)groups[groups.length-1].push(shot);else groups.push([shot])
    lastKey=key
  }
  let previous: { frame: StoryCameraFrame; candidate: number; pair: string; repeats: number; end: number; ids: string[] } | undefined
  for(const group of groups){
    const opening=group[0],closing=group[group.length-1]
    const options=input.optionsAt(opening,opening.start+.001)
    if(!options)continue
    const goal=goalFor(opening,options), pair=[options.subject.id,options.target?.id].sort().join(':')
    let best: { candidate:number;score:number;readableIds:string[];concerns:string[];frame:StoryCameraFrame }|undefined
      const times = [opening.start + .001, (opening.start + closing.end) / 2, closing.end - .001]
      const events = film.cues.filter(cue => eventMoment(cue) > opening.start && eventMoment(cue) < closing.end &&
        (cue.from === options.subject.id || cue.to === options.subject.id || (options.target && (cue.from === options.target.id || cue.to === options.target.id))))
        .sort((a,b) => Number(['death','capture','knockout','boarding'].includes(b.kind)) - Number(['death','capture','knockout','boarding'].includes(a.kind)) || b.intensity-a.intensity || a.time-b.time)
      const eventMoments = events.slice(0,3).map(event=>({event,time:Math.min(closing.end-.001,eventMoment(event))}))
      for (const moment of eventMoments) times.push(moment.time)
    const samples=[...new Set(times)].sort((a,b)=>a-b).map(time=>({time,options:input.optionsAt(group.find(item=>item.end>time)??closing,time),bodies:input.bodiesAt(time)}))
    for(let candidate=0;candidate<variants.length;candidate++){
      let score=0;const readable=new Set<string>(), concerns=new Set<string>();let finalFrame: StoryCameraFrame|undefined
      for(const {time,options:sample,bodies} of samples){
        if(!sample){score-=100;continue}
        const frame=sampleCameraCandidate(sample,candidate,bodies);finalFrame=frame
        const subjects=goal==='establish'?[...bodies].sort((a,b)=>(coverage.get(a.id)??0)-(coverage.get(b.id)??0)||b.size-a.size||a.id.localeCompare(b.id)).slice(0,32):[sample.subject,...(sample.target?[sample.target]:[])]
        const occluders = [...bodies].sort((a,b)=>a.position.distanceToSquared(frame.position)-b.position.distanceToSquared(frame.position)).slice(0,64)
        const measures=subjects.map(body=>measureShotVisibility(frame,sample.aspect,body,occluders))
        for (const moment of eventMoments.filter(moment=>Math.abs(moment.time-time)<.0001)) {
          const id=moment.event.to ?? moment.event.from
          const body=bodies.find(body=>body.id===id)
          if(!body)continue
          const visibility=measureShotVisibility(frame,sample.aspect,body,occluders)
          const important=['death','capture','knockout','boarding'].includes(moment.event.kind)
          if(!visibility.readable){score-=important?45:20;concerns.add(moment.event.id+': event subject unreadable')}
          else if(important)score+=12
          if(important){
            score+=detailFramingScore(moment.event.kind==='boarding'?'contact':'outcome',visibility,true)
            if(visibility.size<.08)concerns.add(moment.event.id+': event subject too small for detail')
          }
        }
        const small=subjects.reduce((a,b)=>a.size<b.size?a:b,sample.subject)
        for(const measure of measures){
          const primary=measure.id===sample.subject.id
          const required=goal==='contact'?measure.id===small.id:goal==='outcome'?primary:true
          score+=detailFramingScore(goal,measure,goal==='contact'?measure.id===small.id:primary)
          if(required&&!measure.visible)score-=35
          if(required&&measure.occluded)score-=24
          if(required&&measure.size<.018)score-=12
          if(measure.readable){readable.add(measure.id);score+=3+4/(1+(coverage.get(measure.id)??0))}
          if(required&&measure.size>.85&&goal!=='contact')score-=8
          if(required&&goal==='contact'&&measure.id===small.id)score+=Math.min(.25,measure.size)*40
        }
        if((goal==='scale'||goal==='establish')&&measures.length>1){
          const depths=measures.map(item=>item.depth).filter(value=>value>0)
          if(depths.length)score-=Math.min(20,(Math.max(...depths)/Math.max(1,Math.min(...depths))-1)*8)
        }
        if(time===opening.start+.001&&previous){
          const oldDirection=previous.frame.position.clone().sub(previous.frame.target).normalize()
          const newDirection=frame.position.clone().sub(frame.target).normalize()
          const angle=Math.acos(Math.max(-1,Math.min(1,oldDirection.dot(newDirection))))
                    const travel=previous.frame.position.distanceTo(frame.position)/Math.max(1,previous.frame.position.distanceTo(previous.frame.target),frame.position.distanceTo(frame.target))
          score-=travel*10
          score-=angle*(previous.pair===pair?12:4)
          // Short edits must earn a camera change. Recorded consequences can
          // justify a new composition; ordinary exchanges favor a held setup.
          if(goal==='exchange')score-=angle*Math.max(0,3-(closing.end-opening.start))*8
          if(previous.pair===pair&&previous.candidate===candidate)score+=10
          if(previous.pair!==pair&&previous.candidate===candidate&&previous.repeats>2)score-=Math.min(6,previous.repeats)
        }
      }
      if(finalFrame&&(!best||score>best.score))best={candidate,score,readableIds:[...readable],concerns:[...concerns],frame:finalFrame}
    }
    if(!best)continue
    const transition=planTransition({start:opening.start,end:closing.end,previous,subjectIds:[options.subject.id,...(options.target?[options.target.id]:[])],
      critical:film.cues.some(cue=>['death','capture','knockout','boarding'].includes(cue.kind)&&eventMoment(cue)>=opening.start&&eventMoment(cue)<=opening.start+Math.min(1.1,(closing.end-opening.start)/2)),
      frameAt:time=>{const shot=group.find(item=>item.end>time)??closing;const sample=input.optionsAt(shot,time)!;const bodies=input.bodiesAt(time);return {frame:sampleCameraCandidate(sample,best!.candidate,bodies),options:sample,bodies}},goal})
    for(const shot of group)plan.shots.set(shot,{goal,transition,candidate:best.candidate,score:best.score,readableIds:best.readableIds,concerns:[...best.concerns,...[options.subject.id,options.target?.id].filter((id): id is string => !!id && !best!.readableIds.includes(id)).map(id=>id+': not readable in sampled coverage')]})
    for(const id of best.readableIds)coverage.set(id,(coverage.get(id)??0)+closing.end-opening.start)
    previous={end:closing.end,ids:[options.subject.id,...(options.target?[options.target.id]:[])],frame:best.frame,candidate:best.candidate,pair,repeats:previous?.candidate===best.candidate?previous.repeats+1:1}
  }
  return plan
}

export function samplePlannedCamera(plan: ShotPlan, shot: CinemaShot, options: StoryCameraOptions, bodies: readonly CameraBody[]): StoryCameraFrame {
  const selected=plan.shots.get(shot)
  const frame=sampleCameraCandidate(options,selected?.candidate??0,bodies)
  return selected && !options.reduced ? sampleCameraTransition(selected.transition,frame,options.time,bodies) : frame
}

/** Absolute-time blending makes seeking identical to uninterrupted playback. */
export function sampleCameraTransition(transition: CameraTransition, incoming: StoryCameraFrame, time: number, bodies: readonly CameraBody[]): StoryCameraFrame {
  if(transition.kind!=='move'||!transition.from||time>=transition.start+transition.duration)return incoming
  const t=Math.max(0,Math.min(1,(time-transition.start)/transition.duration)),ease=t*t*(3-2*t)
  const frame={position:transition.from.position.clone().lerp(incoming.position,ease),target:transition.from.target.clone().lerp(incoming.target,ease),fov:transition.from.fov+(incoming.fov-transition.from.fov)*ease}
  keepCameraOutsideBodies(frame.position,bodies)
  return frame
}

interface TransitionInput {
 start:number;end:number;goal:ShotGoal;critical:boolean;subjectIds:string[]
 previous?:{frame:StoryCameraFrame;end:number;ids:string[]}
 frameAt(time:number):{frame:StoryCameraFrame;options:StoryCameraOptions;bodies:readonly CameraBody[]}
}
/** A move must retain readable subjects and physical clearance at five points.
 * Large geography changes and immediate consequences receive deliberate cuts. */
export function planTransition(input: TransitionInput):CameraTransition {
 const cut=(reason:string):CameraTransition=>({kind:'cut',reason,start:input.start,duration:0})
 const previous=input.previous
 if(!previous)return cut('opening composition')
 if(Math.abs(previous.end-input.start)>.01)return cut('editorial time gap')
 if(!input.subjectIds.some(id=>previous.ids.includes(id)))return cut('new participants')
 if(input.critical)return cut('protect immediate key event')
 const duration=Math.min(1.1,(input.end-input.start)/2)
 if(duration<.35)return cut('insufficient time for readable move')
 const incoming=input.frameAt(input.start).frame
 const oldDirection=previous.frame.position.clone().sub(previous.frame.target).normalize()
 const newDirection=incoming.position.clone().sub(incoming.target).normalize()
 const distance=Math.max(1,previous.frame.position.distanceTo(previous.frame.target),incoming.position.distanceTo(incoming.target))
 if(oldDirection.dot(newDirection)<.35)return cut('preserve screen geography')
 if(previous.frame.position.distanceTo(incoming.position)>distance*1.4)return cut('excessive camera travel')
 if(previous.frame.position.distanceTo(incoming.position)<.01&&previous.frame.target.distanceTo(incoming.target)<.01)return {kind:'hold',reason:'existing composition continues',start:input.start,duration:0}
 const transition:CameraTransition={kind:'move',reason:'retain shared participants through pan and dolly',start:input.start,duration,from:{position:previous.frame.position.clone(),target:previous.frame.target.clone(),fov:previous.frame.fov}}
 for(const fraction of [0,.25,.5,.75,1]){
  const time=input.start+duration*fraction,{frame:destination,options,bodies}=input.frameAt(time)
  const frame=sampleCameraTransition(transition,destination,time,[])
  const safe=frame.position.clone();keepCameraOutsideBodies(safe,bodies)
  if(safe.distanceTo(frame.position)>.01)return cut('move crosses hull clearance')
  const required=[options.subject,...(options.target?[options.target]:[])]
  const subjects=input.goal==='contact'?[required.reduce((a,b)=>a.size<b.size?a:b)]:input.goal==='outcome'?[options.subject]:required
  if(subjects.some(body=>!measureShotVisibility(frame,options.aspect,body,bodies).readable))return cut('move loses required subject')
 }
 return transition
}




/** Recognition is a minimum acceptance test, not cinematic composition. Favor
 * useful hull detail while retaining room around the silhouette and its action. */
export function detailFramingScore(goal: ShotGoal, visibility: ShotVisibility, primary: boolean): number {
  if(goal==='establish'||goal==='scale'||!visibility.readable)return 0
  if(goal==='outcome'&&!primary)return Math.min(2,visibility.size*8)
  if(goal==='contact'&&!primary)return 0
  const lower=goal==='contact'?.2:goal==='outcome'?.15:primary?.12:.035
  const upper=goal==='contact'||goal==='outcome'?.45:primary?.35:.4
  if(visibility.size<lower)return -24*(1-visibility.size/lower)
  if(visibility.size>upper)return -18*Math.min(2,(visibility.size-upper)/upper)
  return primary?9:3
}
