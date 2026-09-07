import * as THREE from 'three'
import { applyShipSurface, type ShipSurfaceOptions } from './ship-surfaces'

export const WRECK_MAX_FRAGMENTS = 12
export const WRECK_MAX_VERTICES = 30000
export const WRECK_BREAKUP_DELAY = .32

interface SourcePart {
  id: number
  geometry: THREE.BufferGeometry
  material: THREE.MeshStandardMaterial
  vertices: number[]
  bounds: THREE.Box3
  area: number
}
interface Vertex { position: THREE.Vector3; normal: THREE.Vector3; color: THREE.Color }
export interface WreckFragment {
  sourcePart: number
  sourceMaterial: string
  start: number
  count: number
  surfaces: { sourcePart: number; start: number; count: number }[]
  pivot: THREE.Vector3
  drift: THREE.Vector3
  axis: THREE.Vector3
  spin: number
}
export interface ShipWreckage {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  fragments: readonly WreckFragment[]
  /** Seconds since the hull-to-wreck handoff; absolute time makes seeking reversible. */
  sample: (age: number, reducedMotion?: boolean) => void
  dispose: () => void
}

function random(seed: number) {
  return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296 }
}

/** Motion is in original hull-local units. Its displacement and rotation both
 * approach a limit, so long aftermaths cannot scatter recognizable pieces away. */
export function sampleWreckFragment(fragment: WreckFragment, age: number, reducedMotion=false) {
  const seconds=Math.max(0,Number.isFinite(age)?age:0)*(reducedMotion?.25:1)
  const travel=.38*(1-Math.exp(-seconds*.7))+.12*(1-Math.exp(-seconds*.055))
  const turn=(1-Math.exp(-seconds*.11))*fragment.spin
  return {
    offset:fragment.drift.clone().multiplyScalar(travel),
    rotation:new THREE.Quaternion().setFromAxisAngle(fragment.axis,turn),
  }
}

// Sutherland-Hodgman clipping retains the real shell surface, normals and paint.
// The omitted band is an open blast fracture, not a scaled copy of an intact hull.
function clip(vertices: Vertex[], axis: 'x'|'y'|'z', cut: number, greater: boolean): Vertex[] {
  const result: Vertex[]=[]
  for(let i=0;i<vertices.length;i++) {
    const a=vertices[i],b=vertices[(i+1)%vertices.length]
    const insideA=greater?a.position[axis]>=cut:a.position[axis]<=cut
    const insideB=greater?b.position[axis]>=cut:b.position[axis]<=cut
    if(insideA)result.push(a)
    if(insideA!==insideB) {
      const t=(cut-a.position[axis])/(b.position[axis]-a.position[axis])
      result.push({position:a.position.clone().lerp(b.position,t),normal:a.normal.clone().lerp(b.normal,t).normalize(),color:a.color.clone().lerp(b.color,t)})
    }
  }
  return result
}

/** One independently owned mesh per destroyed detailed actor. The only inputs
 * are tagged construction parts already present in its rendered material batches.
 * No geometry or material is shared with, mutated on, or retained from the ship. */
export function createShipWreckage(source: THREE.Group, seed: number): ShipWreckage {
  const parts=new Map<number,SourcePart>(),point=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3()
  source.traverse(object=>{
    if(!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial))return
    const geometry=object.geometry,ids=geometry.getAttribute('cinemaStructuralPart'),positions=geometry.getAttribute('position')
    if(!ids || geometry.index)return
    for(let i=0;i<positions.count;i+=3) {
      const id=ids.getX(i)
      if(!id)continue
      let part=parts.get(id)
      if(!part){part={id,geometry,material:object.material,vertices:[],bounds:new THREE.Box3(),area:0};parts.set(id,part)}
      for(let j=0;j<3;j++){part.vertices.push(i+j);part.bounds.expandByPoint(point.fromBufferAttribute(positions,i+j))}
      a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);c.fromBufferAttribute(positions,i+2)
      part.area+=b.sub(a).cross(c.sub(a)).length()*.5
    }
  })
  const roles=(source.userData.wreckPartRoles??{}) as Record<number,string>
  const ranked=[...parts.values()].filter(part=>Number.isFinite(part.area)&&part.area>.000001)
    .sort((a,b)=>b.area-a.area || a.id-b.id)
  const hulls=ranked.filter(part=>roles[part.id]==='hull')
  const candidates=hulls.length?hulls:ranked.filter(part=>roles[part.id]!=='hardware'&&roles[part.id]!=='glass')
  const anchors=candidates.filter(part=>part.area>=(candidates[0]?.area??0)*.12).slice(0,4)
  // Keep construction attached: nearby original armor, ribs, engine bells and
  // fixed gun hardware ride with a major shell section instead of turning into
  // isolated flat plates. Every source component belongs to exactly one cluster.
  const clusters=new Map(anchors.map(part=>[part,[part]]))
  for(const part of ranked) {
    if(clusters.has(part))continue
    const center=part.bounds.getCenter(new THREE.Vector3())
    let nearest:SourcePart|undefined,distance=Infinity
    for(const anchor of anchors) {
      const score=anchor.bounds.distanceToPoint(center)+anchor.bounds.getCenter(point).distanceTo(center)*.08
      if(score<distance){distance=score;nearest=anchor}
    }
    if(nearest)clusters.get(nearest)!.push(part)
  }
  const positions:number[]=[],normals:number[]=[],colors:number[]=[],pivots:number[]=[],drifts:number[]=[],spins:number[]=[],finishes:number[]=[]
  const fragments:WreckFragment[]=[]
  const rng=random(seed)
  for(const [anchor,components] of clusters) {
    if(fragments.length>=WRECK_MAX_FRAGMENTS)break
    const extent=anchor.bounds.getSize(new THREE.Vector3())
    const axis=extent.x>=extent.y&&extent.x>=extent.z?'x':extent.y>=extent.z?'y':'z'
    const length=extent[axis],minimum=anchor.bounds.min[axis]
    // Split long hulls, nacelles, ring segments and wings along their own major
    // axis. This prevents even a single-piece recipe surviving as an intact ship.
    const ranges=length>.4 ? [[-Infinity,minimum+length*.44],[minimum+length*.51,Infinity]] : [[-Infinity,Infinity]]
    for(const [low,high] of ranges) {
      if(fragments.length>=WRECK_MAX_FRAGMENTS)break
      const bounds=anchor.bounds.clone()
      bounds.min[axis]=Math.max(bounds.min[axis],low);bounds.max[axis]=Math.min(bounds.max[axis],high)
      const pivot=bounds.getCenter(new THREE.Vector3())
      const drift=pivot.clone().add(new THREE.Vector3((rng()-.5)*.18,(rng()-.5)*.3,(rng()-.5)*.24)).normalize().multiplyScalar(.55+rng()*.4)
      const spinAxis=new THREE.Vector3(rng()-.5,rng()-.5,rng()-.5).normalize(),spin=(rng()-.5)*1.9
      const start=positions.length/3
      const surfaces:WreckFragment['surfaces']=[]
      // Reserve room for each remaining cluster; a detailed bridge cannot crowd
      // out the far half of a hull. All primary shells are ahead of tiny details.
      const fragmentBudget=Math.floor(WRECK_MAX_VERTICES/Math.max(1,anchors.reduce((sum,part)=>sum+(part.bounds.getSize(point).length()>.4?2:1),0)))
      for(const part of components) {
        const vertices:Vertex[]=[]
        const attribute=part.geometry.getAttribute('position'),normal=part.geometry.getAttribute('normal'),paint=part.material.vertexColors?part.geometry.getAttribute('color'):undefined
        for(let i=0;i<part.vertices.length;i+=3) {
          const triangle=part.vertices.slice(i,i+3).map(index=>({
            position:new THREE.Vector3().fromBufferAttribute(attribute,index),
            normal:new THREE.Vector3().fromBufferAttribute(normal,index),
            color:part.material.color.clone().multiply(new THREE.Color().setRGB(paint?.getX(index)??1,paint?.getY(index)??1,paint?.getZ(index)??1)),
          }))
          const polygon=clip(clip(triangle,axis,low,true),axis,high,false)
          for(let j=1;j<polygon.length-1;j++)vertices.push(polygon[0],polygon[j],polygon[j+1])
        }
        if(!vertices.length || positions.length/3+vertices.length>WRECK_MAX_VERTICES || positions.length/3-start+vertices.length>fragmentBudget)continue
        const surfaceStart=positions.length/3
        for(const vertex of vertices) {
          positions.push(...vertex.position.toArray());normals.push(...vertex.normal.toArray())
          const edge=Math.min(Math.abs(vertex.position[axis]-low),Math.abs(vertex.position[axis]-high))
          const scorch=length>.4 && edge<length*.045?.32:.87
          colors.push(vertex.color.r*scorch,vertex.color.g*scorch,vertex.color.b*scorch)
          finishes.push(part.material.metalness*.8,Math.min(.93,part.material.roughness+.18))
          pivots.push(...pivot.toArray());drifts.push(...drift.toArray());spins.push(spinAxis.x,spinAxis.y,spinAxis.z,spin)
        }
        surfaces.push({sourcePart:part.id,start:surfaceStart,count:vertices.length})
      }
      if(surfaces.length)fragments.push({sourcePart:anchor.id,sourceMaterial:roles[anchor.id]??'hull',start,count:positions.length/3-start,surfaces,pivot,drift,axis:spinAxis,spin})
    }
  }
  const geometry=new THREE.BufferGeometry()
  for(const [name,values,size] of [['position',positions,3],['normal',normals,3],['color',colors,3],['wreckPivot',pivots,3],['wreckDrift',drifts,3],['wreckSpin',spins,4],['wreckFinish',finishes,2]] as const)
    geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,size))
  geometry.computeBoundingSphere()
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:.48,roughness:.84,side:THREE.DoubleSide})
  const surface=source.userData.wreckSurface as ShipSurfaceOptions|undefined
  if(surface && surface.empire!=='voidborn')applyShipSurface(material,{...surface,kind:'hull'})
  const surfaceCompile=material.onBeforeCompile,surfaceKey=material.customProgramCacheKey()
  const seconds={value:0}
  material.customProgramCacheKey=()=> `${surfaceKey}|cinema-structural-wreck-v2`
  material.onBeforeCompile=function(shader,renderer){
    surfaceCompile.call(this,shader,renderer)
    shader.uniforms.wreckAge=seconds
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float wreckAge;
      attribute vec3 wreckPivot; attribute vec3 wreckDrift; attribute vec4 wreckSpin;
      attribute vec2 wreckFinish; varying vec2 vWreckFinish;
      vec3 wreckRotate(vec3 p){
        float angle=(1.-exp(-wreckAge*.11))*wreckSpin.w;
        float s=sin(angle),c=cos(angle);vec3 axis=wreckSpin.xyz;
        return p*c+cross(axis,p)*s+axis*dot(axis,p)*(1.-c);
      }`)
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=wreckRotate(objectNormal);')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vWreckFinish=wreckFinish;
        float travel=.38*(1.-exp(-wreckAge*.7))+.12*(1.-exp(-wreckAge*.055));
        transformed=wreckRotate(transformed-wreckPivot)+wreckPivot+wreckDrift*travel;`)
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vWreckFinish;')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vWreckFinish.y;')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vWreckFinish.x;')
  }
  const mesh=new THREE.Mesh(geometry,material)
  mesh.name='structural-wreck';mesh.frustumCulled=false;mesh.visible=false
  let disposed=false
  return {mesh,fragments,sample(age,reducedMotion=false){
    mesh.visible=!disposed&&Number.isFinite(age)&&age>=0&&fragments.length>0
    seconds.value=Math.max(0,Number.isFinite(age)?age:0)*(reducedMotion?.25:1)
  },dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();material.dispose()}}
}
