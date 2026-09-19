import * as THREE from 'three'
import type {WeaponRig} from './ship-weapons'

const sectorCount=72,sectorWidth=Math.PI*2/sectorCount

/** Clip a convex polygon to a vertical half-plane through the mount. Scratch
 * buffers are reused for every triangle; no geometry survives in these buffers. */
function clipPlane(input:Float64Array,count:number,output:Float64Array,nx:number,nz:number):number {
  let written=0
  for(let vertex=0;vertex<count;vertex++) {
    const a=vertex*3,b=((vertex+1)%count)*3
    const da=input[a]*nx+input[a+2]*nz,db=input[b]*nx+input[b+2]*nz
    if(da>=0) {
      output[written++]=input[a];output[written++]=input[a+1];output[written++]=input[a+2]
    }
    if((da<0&&db>0)||(da>0&&db<0)) {
      const t=da/(da-db)
      for(let axis=0;axis<3;axis++)output[written++]=input[a+axis]+(input[b+axis]-input[a+axis])*t
    }
  }
  return written/3
}

/** The hull's vertical silhouette in a gun's traverse plane. Geometry is copied
 * once before source batches are disposed; only static triangles can obstruct it. */
export function bindWeaponHullClearance(rig:WeaponRig, geometries:readonly THREE.BufferGeometry[]):void {
  const points:number[]=[]
  for(const geometry of geometries) {
    const p=geometry.getAttribute('position'),tag=geometry.getAttribute('cinemaMount')
    for(let i=0;i<p.count;i+=3) {
      if(tag&&[i,i+1,i+2].some(v=>tag.getX(v)>=0)) continue
      for(let j=0;j<3;j++) points.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j))
    }
  }
  for(const mount of rig.mounts) {
    if(!mount.normal)continue
    const normal=mount.normal, side=new THREE.Vector3().crossVectors(new THREE.Vector3(1,0,0),normal)
    const local=new Float32Array(points.length)
    for(let i=0;i<points.length;i+=3) {
      const x=points[i]-mount.pivot.x,y=points[i+1]-mount.pivot.y,z=points[i+2]-mount.pivot.z
      local[i]=x;local[i+1]=y*normal.y+z*normal.z;local[i+2]=y*side.y+z*side.z
    }
    const floors=new Float64Array(sectorCount).fill(NaN)
    const triangle=new Float64Array(9),clipped=new Float64Array(15),polygon=new Float64Array(18)
    mount.minimumElevation=(heading:THREE.Vector3)=>{
      const yaw=(Math.atan2(heading.dot(side),heading.x)+Math.PI*2)%(Math.PI*2)
      const sector=Math.min(sectorCount-1,Math.floor(yaw/sectorWidth))
      if(!Number.isNaN(floors[sector]))return floors[sector]
      const lower=sector*sectorWidth,upper=lower+sectorWidth
      const lx=-Math.sin(lower),lz=Math.cos(lower),ux=Math.sin(upper),uz=-Math.cos(upper)
      let floor=-Math.PI/2
      const consider=(x:number,height:number,z:number)=>{
        floor=Math.max(floor,Math.atan2(height,Math.hypot(x,z)))
      }
      // Cover the entire sector, not sampled rays: even a very narrow obstacle
      // between samples must raise every heading sharing this cached skyline.
      for(let i=0;i<local.length;i+=9) {
        for(let j=0;j<9;j++)triangle[j]=local[i+j]
        const firstCount=clipPlane(triangle,3,clipped,lx,lz)
        if(firstCount===0)continue
        const count=clipPlane(clipped,firstCount,polygon,ux,uz)
        for(let edge=0;edge<count;edge++) {
          const a=edge*3,b=((edge+1)%count)*3
          const x=polygon[a],z=polygon[a+2],h=polygon[a+1]+.004
          consider(x,h,z)
          const dx=polygon[b]-x,dz=polygon[b+2]-z,dh=polygon[b+1]+.004-h
          // For h(t)/sqrt(A+2Bt+Ct²), the derivative numerator is
          // (dh*A-h*B)+(dh*B-h*C)*t. Include its interior stationary point.
          const A=x*x+z*z,B=x*dx+z*dz,C=dx*dx+dz*dz,denominator=dh*B-h*C
          if(denominator!==0) {
            const t=(h*B-dh*A)/denominator
            if(t>0&&t<1)consider(x+dx*t,h+dh*t,z+dz*t)
          }
        }
      }
      floors[sector]=floor
      return floors[sector]
    }
  }
}
