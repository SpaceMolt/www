import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { addShipScaleDetails, type ScaleDetailOptions } from './ship-scale-details'
import { createShip } from './ships'
import { resolveAppearance, type ShipRecipe } from './appearance'

function build(worldSize:number,extra:Partial<ScaleDetailOptions>={}) {
  const surface=new THREE.BoxGeometry(1,.24,.40),geometry:THREE.BufferGeometry[]=[]
  const result=addShipScaleDetails({surfaces:[surface],worldSize,family:'capital',seed:7,hero:true,
    add:piece=>geometry.push(piece),...extra})
  surface.dispose()
  return {result,geometry}
}
const dispose=(geometry:THREE.BufferGeometry[])=>geometry.forEach(piece=>piece.dispose())
describe('physical hull fittings',()=>{
  test('keeps hatch dimensions fixed from16to362worldunits and adds density instead of enlarging windows',()=>{
    const small=build(16),large=build(362),medium=build(60)
    for(const sample of [small,large]){
      const hatch=sample.result.details.find(detail=>detail.kind==='hatch')!
      expect(hatch).toBeDefined();expect(hatch.width).toBe(.9);expect(hatch.height).toBe(1.4)
    }
    expect(small.result.panes).toBe(0)
    expect(large.result.panes).toBeGreaterThan(medium.result.panes)
    for(const [sample,size] of [[medium,60],[large,362]] as const)for(const pane of sample.geometry.filter(piece=>piece.userData.scaleWindow)){
      pane.computeBoundingBox();const dimensions=pane.boundingBox!.getSize(new THREE.Vector3()).multiplyScalar(size)
      expect(dimensions.x).toBeCloseTo(.48,4);expect(dimensions.y).toBeCloseTo(.28,4)
    }
    for(const sample of [small,large,medium])dispose(sample.geometry)
  })
  test('attaches deterministic details to verified hull faces within geometry/probe budgets',()=>{
    const a=build(362),b=build(362)
    expect(a.result).toEqual(b.result)
    expect(a.result.probes).toBeLessThanOrEqual(256);expect(a.result.panes).toBeLessThanOrEqual(600);expect(a.result.fixtures).toBeLessThanOrEqual(24)
    for(const detail of a.result.details){
      const p=detail.position
      expect(Math.min(Math.abs(Math.abs(p.x)-.5),Math.abs(Math.abs(p.y)-.12),Math.abs(Math.abs(p.z)-.2))).toBeLessThan(1e-6)
      expect(detail.normal.length()).toBeCloseTo(1)
    }
    dispose(a.geometry);dispose(b.geometry)
  })
  test('omits fine distant geometry and keeps small/voidborn hulls free of window banks',()=>{
    const distant=build(362,{hero:false}),fighter=build(362,{family:'fighter'}),voidborn=build(362,{empire:'voidborn'})
    expect(distant.result.probes).toBe(0);expect(distant.geometry).toHaveLength(0)
    for(const sample of [fighter,voidborn]){expect(sample.result.panes).toBe(0);expect(sample.result.fixtures).toBeGreaterThan(0);dispose(sample.geometry)}
  })
  test('skips excluded weapon footprints rather than decorating them',()=>{
    const sample=build(362,{exclusions:[new THREE.Box3(new THREE.Vector3(-2,-2,-2),new THREE.Vector3(2,2,2))]})
    expect(sample.result.details).toHaveLength(0);expect(sample.geometry).toHaveLength(0);expect(sample.result.probes).toBeLessThanOrEqual(256)
  })
  test('covers named recipes and salvaged/empire hulls through the shared integration',()=>{
    const recipes:ShipRecipe[]=['shard','prayer','worship','congregation','comet','concordia','liquidity_event','midas']
    const appearances=[...recipes.map(recipe=>({...resolveAppearance('ship','solarian',4,'capital'),recipe})),
      ...['pirate','outerrim','voidborn','crimson','nebula'].map(empire=>resolveAppearance('ship',empire,4,'capital'))]
    for(const appearance of appearances){
      const ship=createShip(appearance,7,'hero',{source:'modules',weapons:{},cargo:0,mining:0,salvage:0,sensor:0,defense:0,utility:0})
      const details=ship.userData.scaleDetails
      expect(details).toBeDefined()
      if(!details.fixtures)throw new Error('No fixtures: '+(appearance.recipe??appearance.empire))
      expect(details.fixtures).toBeGreaterThan(0)
      expect(details.probes).toBeLessThanOrEqual(256)
      const materials=new Set<THREE.Material>()
      ship.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material)}})
      materials.forEach(material=>material.dispose())
    }
  })
})


test('does not hang fixtures on an unsupported edge-on surface',()=>{
  const surface=new THREE.PlaneGeometry(1,.25);surface.rotateY(Math.PI/2)
  const sample=build(362,{surfaces:[surface]})
  expect(sample.result.details).toHaveLength(0)
  expect(sample.result.probes).toBeLessThanOrEqual(256)
  surface.dispose()
})
