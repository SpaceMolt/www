import {expect,test} from 'bun:test'
import * as THREE from 'three'
import {colorSalvagePart} from './ship-salvage'

test('replacement paint is deterministic per component and uses a bounded shared vertex layout',()=>{
  const original=new THREE.Color(0xa69170),variants=new Set<string>()
  for(let i=0;i<20;i++) {
    const a=new THREE.BoxGeometry(.18,.08,.2).toNonIndexed().translate(-.4+i*.04,.1,0),b=a.clone()
    try {
      colorSalvagePart(a,original,90210,true);colorSalvagePart(b,original,90210,true)
      const color=a.getAttribute('color')
      expect(color.normalized).toBe(true)
      expect(color.count).toBe(a.getAttribute('position').count)
      expect(color.array).toEqual(b.getAttribute('color').array)
      const rgb=Array.from(color.array.slice(0,3));variants.add(rgb.join(','))
      for(let j=0;j<color.count;j++) expect(Array.from(color.array.slice(j*3,j*3+3))).toEqual(rgb)
    } finally {a.dispose();b.dispose()}
  }
  expect(variants.size).toBeGreaterThan(3)
  expect(variants.size).toBeLessThanOrEqual(7)
})

test('moving hardware retains the original finish rather than random replacement colors',()=>{
  const geometry=new THREE.BoxGeometry(.2,.1,.1).toNonIndexed(),color=new THREE.Color(0x655a4e)
  try {
    colorSalvagePart(geometry,color,90210,false)
    expect(Array.from(geometry.getAttribute('color').array.slice(0,3))).toEqual([color.r,color.g,color.b].map(c=>Math.round(c*255)))
  } finally {geometry.dispose()}
})
