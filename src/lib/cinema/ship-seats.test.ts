import {expect,test} from 'bun:test'
import * as THREE from 'three'
import {buildFittedHardware} from './ship-hardware'
import {resolveAppearance} from './appearance'

test('offset batteries traverse normal to their physical seat and use shallow bases',()=>{
  const appearance=resolveAppearance('Battlecruiser','crimson',4,'Combat',4)
  let seatNormal=new THREE.Vector3(), seats=0
  const errors:number[]=[],heights:number[]=[]
  const surface=(p:THREE.Vector3,n:THREE.Vector3)=>new THREE.Vector3(p.x,0,0).addScaledVector(n,.25)
  const discard=()=>{}
  buildFittedHardware({source:'modules',weapons:{railgun:4,autocannon:1,kinetic:2},cargo:0,mining:0,salvage:0,sensor:0,defense:0,utility:0},appearance.family,{
    appearance,h:appearance.height/2,w:appearance.beam/2,hero:true,slab:discard,rounded:discard,rod:discard,engine:discard,
    add:(g:THREE.BufferGeometry,material:string)=>{
      if(g instanceof THREE.CylinderGeometry&&material==='armor') {
        const group=g.groups[1],index=g.index?.getX(group.start)??group.start
        seatNormal.fromBufferAttribute(g.getAttribute('normal'),index).normalize()
      }
      g.dispose()
    },hullSurface:surface,
    beginWeapon:(_family,pivot,_muzzle,_roll,normal)=>{
      seats++;errors.push(1-seatNormal.dot(normal!))
      heights.push(pivot.clone().sub(surface(pivot,normal!)).dot(normal!))
    },
  })
  expect(seats).toBeGreaterThanOrEqual(3)
  expect(Math.max(...errors)).toBeLessThan(.00001)
  expect(Math.max(...heights)).toBeLessThan(.065)
})


