import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { buildShipAppearances, type ShipAppearance } from './appearance'
import { createShip } from './ships'

const appearances=buildShipAppearances([
  {id:'fighter',class:'Fighter',faction:'solarian',scale:1},
  {id:'scout',class:'Scout',faction:'solarian',scale:1},
  {id:'conversion',class:'Raider',faction:'pirate',scale:1,based_on:'fighter'},
  {id:'hauler',class:'Hauler',faction:'solarian',scale:3},
  {id:'capital',class:'Battleship',faction:'solarian',scale:4},
])
const bare={source:'modules' as const,weapons:{},cargo:0,mining:0,salvage:0,sensor:0,defense:0,utility:0}

/** Intersect the actual assembled pressure hull with a transverse plane. This
 * catches a broad box or trim left under a tapered overlay as well as a missing
 * taper at distant detail. Engine flames and fitted guns are intentionally out. */
function sectionWidth(group:THREE.Group,x:number) {
  const values:number[]=[]
  for(const name of ['hull','armor','dark']) {
    const mesh=group.getObjectByName(name) as THREE.Mesh|undefined
    if(!mesh)continue
    const points=mesh.geometry.getAttribute('position')
    for(let i=0;i<points.count;i+=3)for(let edge=0;edge<3;edge++) {
      const a=i+edge,b=i+(edge+1)%3,ax=points.getX(a),bx=points.getX(b)
      if(Math.min(ax,bx)<=x&&Math.max(ax,bx)>=x&&Math.abs(ax-bx)>1e-8) {
        const t=(x-ax)/(bx-ax)
        values.push(points.getZ(a)+(points.getZ(b)-points.getZ(a))*t)
      }
    }
  }
  expect(values.length).toBeGreaterThan(0)
  return Math.max(...values)-Math.min(...values)
}
function withShip(appearance:ShipAppearance,lod:'hero'|'distant',check:(group:THREE.Group)=>void) {
  const group=createShip(appearance,90210,lod,bare)
  try {check(group)}finally {
    const materials=new Set<THREE.Material>()
    group.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return
      object.geometry.dispose()
      for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material)
      if(object.customDepthMaterial)materials.add(object.customDepthMaterial)
      if(object.customDistanceMaterial)materials.add(object.customDistanceMaterial)
    })
    materials.forEach(material=>material.dispose())
  }
}

test('Solarian fighters, scouts, and donor conversions keep a visibly tapered bow at both detail levels',()=>{
  for(const id of ['fighter','scout','conversion'])for(const lod of ['hero','distant'] as const) {
    withShip(appearances[id],lod,group=>{
      const shoulder=sectionWidth(group,-.20),bow=sectionWidth(group,.36),nose=sectionWidth(group,.44)
      expect(bow/shoulder).toBeLessThan(.46)
      expect(nose/bow).toBeLessThan(.80)
      // The end is a small rounded port, not an infinitely sharp needle.
      expect(nose/bow).toBeGreaterThan(.25)
    })
  }
})

test('Solarian cargo and heavy combat pressure hulls retain their broad industrial forebody',()=>{
  for(const id of ['hauler','capital'])withShip(appearances[id],'hero',group=>{
    expect(sectionWidth(group,.34)/sectionWidth(group,-.20)).toBeGreaterThan(.72)
  })
})
