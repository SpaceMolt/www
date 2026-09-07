import * as THREE from 'three'

/** A convex armor slab with planar shoulders and bow, rather than a smoothed
 * box. Four octagonal rings preserve the input envelope and central flat deck.
 * All 60 triangles have face normals; material batching is unchanged. */
export function armorPlateGeometry(length:number,width:number,height:number,shoulder=.22,bow=.12):THREE.BufferGeometry {
  const x=length/2,y=height/2,z=width/2
  const edge=Math.min(length,width,height)*.035
  const shoulderWidth=width*shoulder,shoulderHeight=height*shoulder
  const section:[number,number][]=[
    [y,-z+shoulderWidth],[y,z-shoulderWidth],
    [y-shoulderHeight,z],[-y+edge,z],[-y,z-edge],
    [-y,-z+edge],[-y+edge,-z],[y-shoulderHeight,-z],
  ]
  const rings=[[-x,.96],[-x+edge,1],[x-Math.max(edge,length*bow),1],[x,.86]]
  const vertices=rings.flatMap(([at,scale])=>section.map(([up,across])=>new THREE.Vector3(at,up*scale,across*scale)))
  const positions:number[]=[]
  const face=(ia:number,ib:number,ic:number)=>{
    const a=vertices[ia],b=vertices[ib],c=vertices[ic]
    const outward=b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c))
    for(const v of outward>0?[a,b,c]:[a,c,b])positions.push(v.x,v.y,v.z)
  }
  for(let ring=0;ring<3;ring++)for(let side=0;side<8;side++) {
    const a=ring*8+side,b=ring*8+(side+1)%8
    face(a,b,a+8);face(b,b+8,a+8)
  }
  for(const ring of [0,3])for(let side=1;side<7;side++)face(ring*8,ring*8+side,ring*8+side+1)
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.computeVertexNormals()
  return geometry
}
