import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { createShip } from './ships'
import { buildShipAppearances, resolveAppearance } from './appearance'
import { createShipWreckage, sampleWreckFragment, WRECK_MAX_FRAGMENTS, WRECK_MAX_VERTICES } from './ship-wreckage'

function disposeShip(ship: THREE.Group) {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>()
  ship.traverse(object=>{if(object instanceof THREE.Mesh){
    geometries.add(object.geometry)
    for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material)
    if(object.customDepthMaterial)materials.add(object.customDepthMaterial)
    if(object.customDistanceMaterial)materials.add(object.customDistanceMaterial)
  }})
  for(const geometry of geometries)geometry.dispose()
  for(const material of materials)material.dispose()
}

test('wreck pieces come from actual ship construction surfaces with the original placement and faction paint',()=>{
  for(const empire of ['solarian','voidborn','crimson','nebula','outerrim','pirate'] as const) {
    const ship=createShip(resolveAppearance('Cruiser',empire),71)
    const wreck=createShipWreckage(ship,71)
    try {
      const geometry=wreck.mesh.geometry,positions=geometry.getAttribute('position')
      expect(wreck.fragments.length).toBeGreaterThanOrEqual(2)
      expect(wreck.fragments.length).toBeLessThanOrEqual(WRECK_MAX_FRAGMENTS)
      expect(positions.count).toBeGreaterThan(100)
      expect(positions.count).toBeLessThanOrEqual(WRECK_MAX_VERTICES)
      expect(geometry.groups).toHaveLength(0) // exactly one material/draw per actor
      const pivots=new Set(wreck.fragments.map(fragment=>fragment.pivot.toArray().join(',')))
      expect(pivots.size).toBe(wreck.fragments.length)
      const sourceParts=new Map<number,THREE.Triangle[]>()
      ship.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return
        const ids=object.geometry.getAttribute('cinemaStructuralPart'),attribute=object.geometry.getAttribute('position')
        if(!ids)return
        for(let i=0;i<attribute.count;i+=3) {
          const id=ids.getX(i),triangles=sourceParts.get(id)??[]
          triangles.push(new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(attribute,i+j)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]))
          sourceParts.set(id,triangles)
        }
      })
      const p=new THREE.Vector3(),closest=new THREE.Vector3()
      for(const fragment of wreck.fragments) {
        expect(fragment.sourcePart).toBeGreaterThan(0)
        expect(['hull','armor','metal','dark','accent']).toContain(fragment.sourceMaterial)
        // Include cut vertices as well as original corners: all must remain on
        // their particular source component, not merely inside the ship bounds.
        for(const surface of fragment.surfaces) {
          const triangles=sourceParts.get(surface.sourcePart)!
          expect(triangles).toBeDefined()
          for(let i=surface.start;i<surface.start+surface.count;i+=Math.max(1,Math.floor(surface.count/12))) {
            p.fromBufferAttribute(positions,i)
            expect(triangles.some(triangle=>triangle.closestPointToPoint(p,closest).distanceTo(p)<1e-6)).toBe(true)
          }
        }
        const initial=sampleWreckFragment(fragment,0)
        expect(initial.offset.length()).toBe(0)
        expect(initial.rotation.equals(new THREE.Quaternion())).toBe(true)
      }
      for(const attribute of Object.values(geometry.attributes))expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true)
      const color=geometry.getAttribute('color')
      expect(new Set(Array.from({length:color.count},(_,i)=>[color.getX(i),color.getY(i),color.getZ(i)].join(','))).size).toBeGreaterThan(1)
    } finally {wreck.dispose();disposeShip(ship)}
  }
})

test('a monolithic hull is cut into distinct open sections rather than an intact miniature ship',()=>{
  const ship=new THREE.Group(),source=new THREE.BoxGeometry(1,.2,.3).toNonIndexed()
  source.setAttribute('cinemaStructuralPart',new THREE.Float32BufferAttribute(new Float32Array(source.getAttribute('position').count).fill(1),1))
  ship.add(new THREE.Mesh(source,new THREE.MeshStandardMaterial({color:0x993322})))
  const wreck=createShipWreckage(ship,1)
  try {
    expect(wreck.fragments).toHaveLength(2)
    const attribute=wreck.mesh.geometry.getAttribute('position'),boxes=wreck.fragments.map(fragment=>{
      const box=new THREE.Box3()
      for(let i=fragment.start;i<fragment.start+fragment.count;i++)box.expandByPoint(new THREE.Vector3().fromBufferAttribute(attribute,i))
      return box
    })
    expect(boxes[0].max.x).toBeLessThan(boxes[1].min.x)
    expect(boxes.every(box=>box.getSize(new THREE.Vector3()).x<.5)).toBe(true)
    expect(boxes.every(box=>Math.abs(box.getSize(new THREE.Vector3()).z-.3)<1e-6)).toBe(true)
  } finally {wreck.dispose();disposeShip(ship)}
})

test('wreck animation and seeking are deterministic, slow after breakup and bounded at long ages',()=>{
  const ship=createShip(resolveAppearance('Cruiser','outerrim'),19)
  const wreck=createShipWreckage(ship,93),again=createShipWreckage(ship,93)
  try {
    for(const key of Object.keys(wreck.mesh.geometry.attributes))expect(wreck.mesh.geometry.getAttribute(key).array).toEqual(again.mesh.geometry.getAttribute(key).array)
    for(const fragment of wreck.fragments) {
      const early=sampleWreckFragment(fragment,2),late=sampleWreckFragment(fragment,60),end=sampleWreckFragment(fragment,60000)
      expect(end.offset.length()).toBeLessThanOrEqual(.5)
      expect(late.offset.distanceTo(end.offset)).toBeLessThan(.02)
      expect(sampleWreckFragment(fragment,61).offset.distanceTo(late.offset)).toBeLessThan(sampleWreckFragment(fragment,3).offset.distanceTo(early.offset))
      expect(sampleWreckFragment(fragment,2).offset.equals(early.offset)).toBe(true)
      expect(sampleWreckFragment(fragment,2,true).offset.length()).toBeLessThan(early.offset.length())
    }
    wreck.sample(12);expect(wreck.mesh.visible).toBe(true)
    wreck.sample(-.01);expect(wreck.mesh.visible).toBe(false)
    wreck.sample(0);expect(wreck.mesh.visible).toBe(true)
  } finally {wreck.dispose();again.dispose();disposeShip(ship)}
})

test('wreck lifetime is independent and does not mutate or dispose source resources',()=>{
  const ship=createShip(resolveAppearance('Cruiser','solarian'),71)
  const sourceData=new Map<THREE.BufferGeometry,number[]>();let sourceDisposals=0
  ship.traverse(object=>{if(object instanceof THREE.Mesh){
    sourceData.set(object.geometry,Array.from(object.geometry.getAttribute('position').array))
    object.geometry.addEventListener('dispose',()=>sourceDisposals++)
    for(const material of Array.isArray(object.material)?object.material:[object.material])material.addEventListener('dispose',()=>sourceDisposals++)
  }})
  const wreck=createShipWreckage(ship,71),scene=new THREE.Scene();scene.add(wreck.mesh)
  let wreckDisposals=0
  wreck.mesh.geometry.addEventListener('dispose',()=>wreckDisposals++)
  wreck.mesh.material.addEventListener('dispose',()=>wreckDisposals++)
  wreck.sample(100);wreck.dispose();wreck.dispose();wreck.sample(0)
  expect(wreck.mesh.parent).toBe(null)
  expect(wreck.mesh.visible).toBe(false)
  expect(wreckDisposals).toBe(2)
  expect(sourceDisposals).toBe(0)
  for(const [geometry,before] of sourceData)expect(Array.from(geometry.getAttribute('position').array)).toEqual(before)
  disposeShip(ship)
})

test('major wreck sections keep attached armor and hardware with their original surface atlas',()=>{
  const ship=createShip(resolveAppearance('Cruiser','solarian'),71),wreck=createShipWreckage(ship,71)
  try {
    const roles=ship.userData.wreckPartRoles as Record<number,string>
    const surviving= wreck.fragments.flatMap(fragment=>fragment.surfaces.map(surface=>roles[surface.sourcePart]))
    expect(surviving).toContain('hull');expect(surviving).toContain('armor');expect(surviving).toContain('hardware')
    for(const fragment of wreck.fragments) {
      expect(fragment.surfaces.length).toBeGreaterThan(1)
      for(const surface of fragment.surfaces) {
        const pivot=wreck.mesh.geometry.getAttribute('wreckPivot')
        expect(new THREE.Vector3().fromBufferAttribute(pivot,surface.start).distanceTo(fragment.pivot)).toBeLessThan(1e-6)
      }
    }
    const hull=(ship.getObjectByName('hull') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material
    const compile=(material:THREE.MeshStandardMaterial)=>{
      const shader={...THREE.ShaderLib.standard,uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)}
      material.onBeforeCompile(shader,{} as THREE.WebGLRenderer)
      return shader
    }
    const original=compile(hull),shader=compile(wreck.mesh.material)
    const atlas=shader.uniforms.cinemaSurfaceAtlas.value as THREE.Texture
    expect(atlas).toBe(original.uniforms.cinemaSurfaceAtlas.value)
    expect(shader.uniforms.cinemaSurfaceDensity.value).toBe(original.uniforms.cinemaSurfaceDensity.value)
    expect(shader.uniforms.cinemaSurfaceOffset.value).toEqual(original.uniforms.cinemaSurfaceOffset.value)
    // Compile the actual injected motion expression to compare shader and CPU
    // sampling, catching accidental seek-state accumulation or different rates.
    const expression=shader.vertexShader.match(/float travel=([^;]+);/)![1].replaceAll('wreckAge','age').replaceAll('exp(','Math.exp(')
    const travel=new Function('age',`return ${expression}`) as (age:number)=>number
    for(const age of [0,.2,2,16,10000])for(const fragment of wreck.fragments)
      expect(sampleWreckFragment(fragment,age).offset.distanceTo(fragment.drift.clone().multiplyScalar(travel(age)))).toBeLessThan(1e-10)
    let atlasDisposals=0;atlas.addEventListener('dispose',()=>atlasDisposals++)
    wreck.dispose();expect(atlasDisposals).toBe(0)
    disposeShip(ship);expect(atlasDisposals).toBe(1)
  } finally {wreck.dispose()}
})

test('named recipes and stations retain substantial real shells within a fixed geometry budget',()=>{
  const recipes=buildShipAppearances([
    {id:'shard',class:'Miner',faction:'crimson',scale:1},
    {id:'midas',class:'Freighter',faction:'neutral',scale:3},
    {id:'concordia',class:'Cruiser',faction:'solarian',scale:3},
    {id:'prayer',class:'Cruiser',faction:'voidborn',scale:3},
  ])
  const appearances=[...Object.values(recipes),...['voidborn','solarian','outerrim','nebula'].map(empire=>resolveAppearance('Station',empire))]
  for(const appearance of appearances) {
    const ship=createShip(appearance,71),wreck=createShipWreckage(ship,71)
    try {
      expect(wreck.fragments.length).toBeGreaterThan(1)
      expect(wreck.mesh.geometry.getAttribute('position').count).toBeLessThanOrEqual(WRECK_MAX_VERTICES)
      for(const fragment of wreck.fragments)expect(fragment.surfaces.some(surface=>surface.sourcePart===fragment.sourcePart)).toBe(true)
    } finally {wreck.dispose();disposeShip(ship)}
  }
})
