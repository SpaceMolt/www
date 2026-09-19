import {expect,test} from 'bun:test'
import * as THREE from 'three'
import {bindWeaponHullClearance} from './ship-clearance'
import {createWeaponRig,canAimWeaponMount,aimWeaponMount,weaponMuzzleLocal} from './ship-weapons'

test('low batteries elevate their barrels over a raised structure while the bearing stays flush',()=>{
  const rig=createWeaponRig(),normal=new THREE.Vector3(0,1,0)
  rig.mounts.push({family:'railgun',pivot:new THREE.Vector3(),muzzle:new THREE.Vector3(.2,0,0),normal,rotation:new THREE.Quaternion()})
  const wall=new THREE.BoxGeometry(.08,.20,.30).toNonIndexed();wall.translate(.4,.02,0)
  bindWeaponHullClearance(rig,[wall])
  expect(canAimWeaponMount(rig,0,new THREE.Vector3(10,0,0))).toBe(false)
  expect(canAimWeaponMount(rig,0,new THREE.Vector3(-10,0,0))).toBe(true)
  aimWeaponMount(rig,0,new THREE.Vector3(10,0,0))
  const direction=weaponMuzzleLocal(rig,0)!.normalize()
  expect(direction.y/direction.x).toBeGreaterThan(.12/.36)
  expect(normal.clone().applyQuaternion(rig.mounts[0].traverseRotation!).distanceTo(normal)).toBeLessThan(1e-6)
  expect(canAimWeaponMount(rig,0,new THREE.Vector3(10,5,0))).toBe(true)
  wall.dispose()
})

test('a yaw sector includes a thin blocker between its center and boundary',()=>{
  const rig=createWeaponRig(),normal=new THREE.Vector3(0,1,0)
  rig.mounts.push({family:'railgun',pivot:new THREE.Vector3(),muzzle:new THREE.Vector3(.2,0,0),normal,rotation:new THREE.Quaternion()})
  const angle=4.4*Math.PI/180
  const wall=new THREE.BoxGeometry(.002,.20,.002).toNonIndexed()
  wall.translate(Math.cos(angle),.1,Math.sin(angle))
  bindWeaponHullClearance(rig,[wall])
  const heading=(degrees:number)=>new THREE.Vector3(Math.cos(degrees*Math.PI/180),0,Math.sin(degrees*Math.PI/180))
  const near=rig.mounts[0].minimumElevation!(heading(4.4))
  expect(near).toBeGreaterThan(Math.atan(.2))
  // Neither ray intersects the blocker. The whole five-degree sector shares
  // its conservative skyline, including obstacles missed by a center sample.
  expect(rig.mounts[0].minimumElevation!(heading(2.5))).toBe(near)
  expect(rig.mounts[0].minimumElevation!(heading(.1))).toBe(near)
  expect(rig.mounts[0].minimumElevation!(heading(7.5))).toBe(-Math.PI/2)
  wall.dispose()
})

test('sector skyline includes elevation maxima between clipped edge endpoints',()=>{
  const rig=createWeaponRig()
  rig.mounts.push({family:'laser',pivot:new THREE.Vector3(),muzzle:new THREE.Vector3(.2,0,0),normal:new THREE.Vector3(0,-1,0),rotation:new THREE.Quaternion()})
  const geometry=new THREE.BufferGeometry()
  // A raised edge crosses an entire sector. Its closest point (and maximum
  // elevation) is strictly inside that edge, at 2.5 degrees.
  const yaw=2.5*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw)
  const point=(along:number,height:number)=>[c-along*s,-height,-(s+along*c)]
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([...point(-.2,.2),...point(.2,.2),...point(0,.1)],3))
  bindWeaponHullClearance(rig,[geometry])
  const floor=rig.mounts[0].minimumElevation!(new THREE.Vector3(c,0,-s))
  expect(floor).toBeCloseTo(Math.atan2(.204,1),7)
  geometry.dispose()
})
