import { Triangle, Vector3 } from 'three'
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js'
import type { ShipMotion } from './motion'
export interface ContactPoint { x:number; y:number; z:number }
export interface HullContactProfile { points: readonly ContactPoint[]; surfacePlanes?: ReadonlyMap<string,readonly Triangle[]> }
const planeKey=(x:number,y:number,z:number)=>`${Math.round(x*1e4)},${Math.round(y*1e4)},${Math.round(z*1e4)}`
/** Reduce assembled solid geometry once; support queries then use only its convex envelope. */
export function createHullContactProfile(points: readonly ContactPoint[], triangleSoup=false): HullContactProfile {
  const surfacePlanes=new Map<string,Triangle[]>()
  if(triangleSoup)for(let i=0;i+2<points.length;i+=3){
    const triangle=new Triangle(...points.slice(i,i+3).map(p=>new Vector3(p.x,p.y,p.z)) as [Vector3,Vector3,Vector3])
    const n=triangle.getNormal(new Vector3())
    if(n.lengthSq()<.5)continue
    for(const sign of [1,-1]){
      const key=planeKey(n.x*sign,n.y*sign,n.z*sign),planes=surfacePlanes.get(key)??[]
      planes.push(triangle);surfacePlanes.set(key,planes)
    }
  }
  const unique = new Map<string,Vector3>()
  for(const p of points) if(Number.isFinite(p.x+p.y+p.z)) unique.set(`${Math.round(p.x*1e5)},${Math.round(p.y*1e5)},${Math.round(p.z*1e5)}`,new Vector3(p.x,p.y,p.z))
  const vertices=[...unique.values()]
  if(vertices.length<4)return {points:vertices,surfacePlanes}
  try {
    const hull=new ConvexHull().setFromPoints(vertices), result=new Set<Vector3>()
    for(const face of hull.faces){let edge=face.edge;do{result.add(edge.head().point);edge=edge.next}while(edge!==face.edge)}
    return {points:[...result],surfacePlanes}
  } catch { return {points:vertices,surfacePlanes} }
}
export function hullSupportPoint(profile: HullContactProfile, direction: ContactPoint, pose: Pick<ShipMotion,'yaw'|'bank'>): ContactPoint {
  const c=Math.cos(pose.yaw),s=Math.sin(pose.yaw),cb=Math.cos(pose.bank),sb=Math.sin(pose.bank)
  let maximum=-Infinity, count=0, x=0,y=0,z=0
  for(const p of profile.points){
    const py=p.y*cb-p.z*sb,pz=p.y*sb+p.z*cb
    const px=p.x*c+pz*s,wz=-p.x*s+pz*c, dot=px*direction.x+py*direction.y+wz*direction.z
    if(dot>maximum+1e-5){maximum=dot;x=px;y=py;z=wz;count=1}
    else if(Math.abs(dot-maximum)<=1e-5){x+=px;y+=py;z+=wz;count++}
  }
  if(!count)return {x:0,y:0,z:0}
  const worldMean=new Vector3(x/count,y/count,z/count)
  // Support vertices can surround a hole or disconnected cargo pods. A mean is
  // only a valid anchor when projected back onto an original surface triangle.
  const localMean=new Vector3(worldMean.x*c-worldMean.z*s,worldMean.y,worldMean.x*s+worldMean.z*c)
  localMean.set(localMean.x,localMean.y*cb+localMean.z*sb,-localMean.y*sb+localMean.z*cb)
  const localN=new Vector3(direction.x*c-direction.z*s,direction.y,direction.x*s+direction.z*c)
  localN.set(localN.x,localN.y*cb+localN.z*sb,-localN.y*sb+localN.z*cb).normalize()
  let nearest:ContactPoint|undefined,distance=Infinity
  const projected=new Vector3()
  for(const face of profile.surfacePlanes?.get(planeKey(localN.x,localN.y,localN.z))??[]){
    if(Math.abs(face.a.dot(localN)-maximum)>1e-4||Math.abs(face.b.dot(localN)-maximum)>1e-4||Math.abs(face.c.dot(localN)-maximum)>1e-4)continue
    face.closestPointToPoint(localMean,projected)
    const d=projected.distanceToSquared(localMean)
    if(d<distance){distance=d;nearest=projected.clone()}
  }
  if(!nearest)for(const p of profile.points){
    if(Math.abs(p.x*localN.x+p.y*localN.y+p.z*localN.z-maximum)>1e-4)continue
    const d=(p.x-localMean.x)**2+(p.y-localMean.y)**2+(p.z-localMean.z)**2
    if(d<distance){distance=d;nearest=p}
  }
  const p=nearest??profile.points[0],py=p.y*cb-p.z*sb,pz=p.y*sb+p.z*cb
  return {x:p.x*c+pz*s,y:py,z:-p.x*s+pz*c}
}
/** Actual opposing support patches. The motion planner aligns these patches, not bounding spheres. */
export function hullContactAnchors(actor: HullContactProfile,target: HullContactProfile,a: ShipMotion,b: ShipMotion, normal?:ContactPoint) {
  const length=Math.hypot(a.x-b.x,a.z-b.z)||1
  const n=normal??{x:(a.x-b.x)/length,y:0,z:(a.z-b.z)/length}
  const ap=hullSupportPoint(actor,{x:-n.x,y:-n.y,z:-n.z},a),bp=hullSupportPoint(target,n,b)
  const actorPoint={x:a.x+ap.x,y:a.y+ap.y,z:a.z+ap.z},targetPoint={x:b.x+bp.x,y:b.y+bp.y,z:b.z+bp.z}
  return {actor:actorPoint,target:targetPoint,normal:n,gap:Math.hypot(actorPoint.x-targetPoint.x,actorPoint.y-targetPoint.y,actorPoint.z-targetPoint.z)}
}

/** Conservative separating-plane check over the center axis and both hull frames.
 * A successful check proves separation; failure may choose a different berth. */
export function hullsHaveClearance(a:HullContactProfile,ap:ShipMotion,b:HullContactProfile,bp:ShipMotion,clearance=0):boolean {
  const delta={x:ap.x-bp.x,y:ap.y-bp.y,z:ap.z-bp.z}
  const axes:ContactPoint[]=[delta]
  for(const pose of [ap,bp]){
    const c=Math.cos(pose.yaw),s=Math.sin(pose.yaw),cb=Math.cos(pose.bank),sb=Math.sin(pose.bank)
    axes.push({x:c,y:0,z:-s},{x:s*sb,y:cb,z:c*sb},{x:s*cb,y:-sb,z:c*cb})
  }
  for(const axis of axes){
    const length=Math.hypot(axis.x,axis.y,axis.z)
    if(length<1e-6)continue
    const sign=delta.x*axis.x+delta.y*axis.y+delta.z*axis.z<0?-1:1
    const n={x:axis.x/length*sign,y:axis.y/length*sign,z:axis.z/length*sign}
    // Collision probes only need support distances, not expensive surface anchors.
    const project=(profile:HullContactProfile,pose:ShipMotion,d:ContactPoint)=>{
      const c=Math.cos(pose.yaw),s=Math.sin(pose.yaw),cb=Math.cos(pose.bank),sb=Math.sin(pose.bank)
      const nx=d.x*c-d.z*s,ny=d.y,nz=d.x*s+d.z*c
      const dy=ny*cb+nz*sb,dz=-ny*sb+nz*cb
      let maximum=-Infinity
      for(const p of profile.points)maximum=Math.max(maximum,p.x*nx+p.y*dy+p.z*dz)
      return maximum
    }
    const av=project(a,ap,{x:-n.x,y:-n.y,z:-n.z}),bv=project(b,bp,n)
    if(delta.x*n.x+delta.y*n.y+delta.z*n.z-av-bv>=clearance-1e-6)return true
  }
  return false
}
