import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { armorPlateGeometry } from './ship-plates'

test('faceted plates have closed outward faces, flat normals, and preserve their bounding box', () => {
  for (const [length, width, height] of [[.225,.4,.2],[.22,.12,.24],[.1,.1,.004]]) {
    const geometry=armorPlateGeometry(length,width,height)
    const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal')
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),center=new THREE.Vector3()
    const edges=new Map<string,number>()
    let volume=0, sloped=0
    const key=(v:THREE.Vector3)=>v.toArray().map(value=>value.toFixed(7)).join(',')
    for(let i=0;i<p.count;i+=3) {
      a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2)
      normal.crossVectors(b.clone().sub(a),c.clone().sub(a))
      center.copy(a).add(b).add(c).divideScalar(3)
      expect(normal.length()).toBeGreaterThan(1e-10)
      expect(normal.dot(center)).toBeGreaterThan(0)
      volume+=a.dot(b.clone().cross(c))/6
      if(Math.abs(normal.x)>1e-9&&Math.abs(normal.y)>1e-9)sloped++
      for(let j=0;j<3;j++)expect(new THREE.Vector3().fromBufferAttribute(n,i+j).distanceTo(normal.clone().normalize())).toBeLessThan(1e-5)
      for(const [u,v] of [[a,b],[b,c],[c,a]]) {
        const forward=key(u)+'/'+key(v),reverse=key(v)+'/'+key(u)
        edges.set(forward,(edges.get(forward)??0)+1)
        edges.set(reverse,(edges.get(reverse)??0)-1)
      }
    }
    expect([...edges.values()].every(count=>count===0)).toBe(true)
    expect(volume).toBeGreaterThan(length*width*height*.6)
    expect(volume).toBeLessThan(length*width*height)
    expect(sloped).toBeGreaterThan(0)
    expect(p.count/3).toBeLessThanOrEqual(60)
    geometry.computeBoundingBox()
    const size=geometry.boundingBox!.getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(length,6);expect(size.y).toBeCloseTo(height,6);expect(size.z).toBeCloseTo(width,6)
    const ray=new THREE.Raycaster(new THREE.Vector3(0,height,0),new THREE.Vector3(0,-1,0))
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial())
    expect(ray.intersectObject(mesh)[0]?.point.y).toBeCloseTo(height/2,6)
    geometry.dispose();mesh.material.dispose()
  }
})
