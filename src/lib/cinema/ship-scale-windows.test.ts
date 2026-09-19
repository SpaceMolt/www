import {expect,test} from 'bun:test'
import * as THREE from 'three'
import {cinemaHullWorldSize} from './ship-scale'
import {calibrateCrewWindows} from './ship-scale-windows'

test('one physical length helper covers personal, capital and invalid catalog values',()=>{
  expect(cinemaHullWorldSize({length:1.8})).toBeCloseTo(16.2)
  expect(cinemaHullWorldSize({length:40.3})).toBeCloseTo(362.7)
  for(const length of [NaN,Infinity,-1])expect(cinemaHullWorldSize({length})).toBe(16)
  expect(cinemaHullWorldSize({length:1000})).toBe(400)
})
test('large legacy openings contain more bounded human-sized panes without growing their footprint',()=>{
  const counts:number[]=[]
  for(const worldSize of [48,180,362]) {
    const geometry=calibrateCrewWindows(new THREE.BoxGeometry(.3,.012,.002),worldSize)
    const position=geometry.getAttribute('position');counts.push(position.count)
    expect(position.count/36).toBeLessThanOrEqual(64)
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.max.x).toBeLessThanOrEqual(.150001)
    expect(geometry.boundingBox!.min.x).toBeGreaterThanOrEqual(-.150001)
    for(let start=0;start<position.count;start+=36) {
      const box=new THREE.Box3()
      for(let i=start;i<start+36;i++)box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position,i))
      const size=box.getSize(new THREE.Vector3()).multiplyScalar(worldSize)
      expect(size.x).toBeCloseTo(.48,4);expect(size.y).toBeCloseTo(.28,4)
    }
    geometry.dispose()
  }
  expect(counts[1]).toBeGreaterThan(counts[0])
})
test('beacons and deliberately calibrated panes keep their original geometry',()=>{
  const beacon=new THREE.SphereGeometry(.01,8,4),pane=new THREE.BoxGeometry(.1,.01,.001)
  pane.userData.cinemaCrewScale=true
  expect(calibrateCrewWindows(beacon,362)).toBe(beacon)
  expect(calibrateCrewWindows(pane,362)).toBe(pane)
  beacon.dispose();pane.dispose()
})
