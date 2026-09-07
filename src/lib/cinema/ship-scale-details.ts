import * as THREE from 'three'
import type { ShipFamily } from './appearance'
import { CREW_SCALE } from './ship-scale'

export type ScaleDetailMaterial = 'windows' | 'dark' | 'metal' | 'hull'
export interface ScaleDetail { kind: 'pane' | 'hatch' | 'service'; position: THREE.Vector3; normal: THREE.Vector3; width: number; height: number }
export interface ScaleDetailResult { panes: number; fixtures: number; probes: number; details: ScaleDetail[] }
export interface ScaleDetailOptions {
  surfaces: readonly THREE.BufferGeometry[]
  worldSize: number
  family: ShipFamily
  empire?: string
  seed: number
  hero: boolean
  exclusions?: readonly THREE.Box3[]
  add: (geometry: THREE.BufferGeometry, material: ScaleDetailMaterial) => void
}
interface Triangle { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; normal: THREE.Vector3 }
interface Hit { point: THREE.Vector3; normal: THREE.Vector3 }
const MAX_PROBES=256, MAX_PANES=600, MAX_FIXTURES=24

/** Fixed-size access fittings on actual normalized hull faces. All geometry is
 * passed through the existing material batches; distant models add none. */
export function addShipScaleDetails(options:ScaleDetailOptions):ScaleDetailResult {
  const result:ScaleDetailResult={panes:0,fixtures:0,probes:0,details:[]}
  if(!options.hero||options.family==='creature'||!options.surfaces.length)return result
  const size=Math.max(16,Math.min(400,Number.isFinite(options.worldSize)?options.worldSize:16)),unit=1/size
  const bounds=new THREE.Box3().makeEmpty(),triangles:Triangle[]=[]
  for(const geometry of options.surfaces){
    const positions=geometry.getAttribute('position'),indices=geometry.index
    if(!positions)continue
    const count=indices?.count??positions.count
    for(let i=0;i+2<count;i+=3){
      const vertex=(j:number)=>new THREE.Vector3().fromBufferAttribute(positions,indices?indices.getX(j):j)
      const a=vertex(i),b=vertex(i+1),c=vertex(i+2)
      const normal=b.clone().sub(a).cross(c.clone().sub(a))
      if(normal.lengthSq()<1e-16)continue
      normal.normalize();triangles.push({a,b,c,normal});bounds.expandByPoint(a).expandByPoint(b).expandByPoint(c)
    }
  }
  if(bounds.isEmpty())return result
  // Two small projected grids make every support probe inspect a local bucket,
  // rather than rescanning the complete recipe mesh for each fitting.
  const grids=[Array.from({length:32*16},()=>[] as Triangle[]),Array.from({length:32*16},()=>[] as Triangle[])]
  const extent=bounds.getSize(new THREE.Vector3())
  const cell=(value:number,min:number,span:number,count:number)=>Math.max(0,Math.min(count-1,Math.floor((value-min)/Math.max(span,1e-8)*count)))
  for(const triangle of triangles)for(const axis of [0,1]){
    const points=[triangle.a,triangle.b,triangle.c],values=points.map(p=>axis?p.z:p.y)
    const left=cell(Math.min(...points.map(p=>p.x)),bounds.min.x,extent.x,32),right=cell(Math.max(...points.map(p=>p.x)),bounds.min.x,extent.x,32)
    const min=axis?bounds.min.z:bounds.min.y,span=axis?extent.z:extent.y
    const bottom=cell(Math.min(...values),min,span,16),top=cell(Math.max(...values),min,span,16)
    for(let x=left;x<=right;x++)for(let y=bottom;y<=top;y++)grids[axis][x+y*32].push(triangle)
  }
  const ray=new THREE.Ray(),intersection=new THREE.Vector3()
  const probe=(x:number,v:number,axis:0|1,side:number):Hit|undefined=>{
    if(result.probes>=MAX_PROBES)return
    result.probes++
    if(x<bounds.min.x||x>bounds.max.x||v<(axis?bounds.min.z:bounds.min.y)||v>(axis?bounds.max.z:bounds.max.y))return
    if(axis===0){ray.origin.set(x,v,side>0?bounds.max.z+1:bounds.min.z-1);ray.direction.set(0,0,-side)}
    else{ray.origin.set(x,bounds.max.y+1,v);ray.direction.set(0,-1,0)}
    const outward=ray.direction.clone().negate()
    let best:Hit|undefined,nearest=Infinity
    const column=cell(x,bounds.min.x,extent.x,32),row=cell(v,axis?bounds.min.z:bounds.min.y,axis?extent.z:extent.y,16)
    for(const triangle of grids[axis][column+row*32]){
      if(!ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,intersection))continue
      const distance=ray.origin.distanceToSquared(intersection)
      if(distance>=nearest)continue
      nearest=distance
      const normal=triangle.normal.clone();if(normal.dot(outward)<0)normal.negate()
      best={point:intersection.clone(),normal}
    }
    return best&&best.normal.dot(outward)>.72?best:undefined
  }
  const supported=(x:number,v:number,axis:0|1,side:number,width:number,height:number):Hit|undefined=>{
    const hit=probe(x,v,axis,side);if(!hit)return
    for(const a of [-1,1])for(const b of [-1,1]){
      const corner=probe(x+a*width*.52*unit,v+b*height*.52*unit,axis,side)
      if(!corner||corner.normal.dot(hit.normal)<.98||Math.abs(corner.point.clone().sub(hit.point).dot(hit.normal))>.055*unit)return
    }
    const margin=Math.hypot(width,height)*.55*unit
    if(options.exclusions?.some(box=>box.clone().expandByScalar(margin).containsPoint(hit.point)))return
    return hit
  }
  const emit=(kind:ScaleDetail['kind'],hit:Hit,width:number,height:number)=>{
    const normal=hit.normal
    const tangent=new THREE.Vector3(1,0,0).addScaledVector(normal,-normal.x).normalize()
    const vertical=new THREE.Vector3().crossVectors(normal,tangent).normalize()
    const basis=new THREE.Matrix4().makeBasis(tangent,vertical,normal)
    const piece=(w:number,h:number,depth:number,offset:number,material:ScaleDetailMaterial)=>{
      const geometry=new THREE.BoxGeometry(w*unit,h*unit,depth*unit)
      geometry.applyMatrix4(basis);geometry.translate(hit.point.x+normal.x*offset*unit,hit.point.y+normal.y*offset*unit,hit.point.z+normal.z*offset*unit)
      if(kind==='pane')geometry.userData.scaleWindow=true
      options.add(geometry,material)
    }
    if(kind==='pane'){piece(width,height,.018,.025,'windows');result.panes++}
    else if(kind==='hatch'){
      piece(width,height,.045,.03,'dark');piece(width*.81,height*.85,.035,.065,'metal');piece(width*.13,height*.18,.025,.095,'dark');result.fixtures++
    }else{piece(width,height,.045,.03,'dark');piece(width*.85,height*.82,.16,.12,'hull');result.fixtures++}
    result.details.push({kind,position:hit.point.clone(),normal:normal.clone(),width,height})
  }
  // Access/service fittings are sparse on every hull, including named recipes,
  // salvaged craft and crystalline construction. Unmanned hulls get service ports.
  const desired=Math.min(MAX_FIXTURES,Math.max(2,Math.ceil(size/24)))
  const phase=((options.seed>>>0)%31)/31
  for(let i=0;i<48&&result.fixtures<desired&&result.probes<MAX_PROBES-100;i++){
    const axis:0|1=i%3===0?0:1,side=i%2?1:-1
    const x=bounds.min.x+extent.x*(.12+((i*.61803398875+phase)%1)*.7)
    const v=axis?bounds.min.z+extent.z*(.18+((i*.381966+phase)%1)*.64):bounds.min.y+extent.y*(.28+((i*.23+phase)%1)*.44)
    const hatch=options.family!=='drone'&&i%3===0,width=hatch?CREW_SCALE.hatchWidth:.8,height=hatch?CREW_SCALE.hatchHeight:.7
    const hit=supported(x,v,axis,side,width,height)
    if(hit)emit(hatch?'hatch':'service',hit,width,height)
  }
  const small=['fighter','scout','drone'].includes(options.family)||size<40
  if(small||options.empire==='voidborn')return result
  const patches=Math.min(24,Math.max(4,Math.floor(size/15)))
  const maxPerPatch=Math.ceil(MAX_PANES/patches)
  for(let i=0;i<patches&&result.probes<MAX_PROBES-4;i++){
    const side=i%2?1:-1,column=Math.floor(i/2)%6,row=Math.floor(i/12)
    const x=bounds.min.x+extent.x*(.14+column*.13),y=bounds.min.y+extent.y*(row?.60:.38)
    const columns=Math.min(8,Math.max(1,Math.floor(extent.x*size*.10/1.1)))
    const rows=Math.min(3,Math.max(1,Math.floor(extent.y*size*.14/1.35)))
    const width=(columns-1)*1.1+.48,height=(rows-1)*1.35+.28
    const hit=supported(x,y,0,side,width,height);if(!hit)continue
    let emitted=0
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      if(result.panes>=MAX_PANES||emitted>=maxPerPatch)break
      const px=x+(col-(columns-1)/2)*1.1*unit,py=y+(row-(rows-1)/2)*1.35*unit
      // Reuse the verified plane; solve z rather than firing a ray per pane.
      const point=new THREE.Vector3(px,py,hit.point.z-(hit.normal.x*(px-hit.point.x)+hit.normal.y*(py-hit.point.y))/hit.normal.z)
      if(options.exclusions?.some(box=>box.clone().expandByScalar(.3*unit).containsPoint(point)))continue
      emit('pane',{point,normal:hit.normal},CREW_SCALE.windowWidth,CREW_SCALE.windowHeight);emitted++
    }
  }
  return result
}
