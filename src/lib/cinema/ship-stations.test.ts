import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { resolveAppearance } from './appearance'
import { createShip } from './ships'
import type { CinemaHardware } from './hardware'
import type { WeaponRig } from './ship-weapons'
import { buildStationHull } from './ship-stations'

const empty: CinemaHardware = { source:'modules', weapons:{}, cargo:0, mining:0, salvage:0, sensor:0, defense:0, utility:0 }

test('Voidborn surface veins remain outside their opaque spindle', () => {
  const pieces: THREE.BufferGeometry[] = []
  const noop=()=>{}
  buildStationHull(resolveAppearance('station','voidborn',5,'',5,'station'),{
    add:geometry=>{pieces.push(geometry)},slab:noop,rounded:noop,rod:noop,engine:noop,hero:true,h:.35,w:.45,
  })
  try {
    const spindle=pieces.find(piece=>piece instanceof THREE.LatheGeometry) as THREE.LatheGeometry
    const shell=new THREE.Mesh(spindle,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))
    const raycaster=new THREE.Raycaster()
    const veins=pieces.filter(piece=>piece instanceof THREE.TubeGeometry&&piece.parameters.radius===.003) as THREE.TubeGeometry[]
    expect(veins.length).toBe(3)
    for(const vein of veins)for(let i=0;i<=64;i++){
      const point=vein.parameters.path.getPointAt(i/64),radial=new THREE.Vector3(point.x,0,point.z).normalize()
      raycaster.set(new THREE.Vector3(radial.x,point.y,radial.z),radial.clone().negate())
      const hit=raycaster.intersectObject(shell)[0]
      expect(hit).toBeDefined()
      expect(Math.hypot(point.x,point.z)).toBeGreaterThan(Math.hypot(hit.point.x,hit.point.z))
    }
    shell.material.dispose()
  } finally {pieces.forEach(piece=>piece.dispose())}
})
function dispose(group: THREE.Group) {
  const materials = new Set<THREE.Material>()
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    if (object.customDepthMaterial) materials.add(object.customDepthMaterial)
    if (object.customDistanceMaterial) materials.add(object.customDistanceMaterial)
  })
  materials.forEach(material => material.dispose())
}

test('large station variants retain bounded geometry, valid surfaces and cheaper distant models', () => {
  for (const empire of ['solarian','voidborn','crimson','nebula','outerrim','pirate','neutral']) {
    const appearance = resolveAppearance('station',empire,5,'',5,'station')
    const counts: number[] = []
    for (const detail of ['hero','distant'] as const) {
      const group = createShip(appearance,91,detail,{...empty,weapons:{kinetic:100,laser:100,missile:100}})
      try {
        expect(group.children.length).toBeLessThanOrEqual(7)
        let triangles = 0, radius = 0
        for (const object of group.children) {
          const geometry = (object as THREE.Mesh).geometry, p = geometry.getAttribute('position')
          triangles += p.count/3
          expect(Array.from(p.array).every(Number.isFinite)).toBe(true)
          expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true)
          for (let i=0;i<p.count;i++) radius=Math.max(radius,Math.hypot(p.getX(i),p.getY(i),p.getZ(i)))
        }
        expect(radius).toBeLessThan(.78)
        expect(triangles).toBeLessThan(55000)
        counts.push(triangles)
        const rig = group.userData.weaponRig as WeaponRig
        expect(rig.mounts.length).toBeLessThanOrEqual(12)
        for (const mount of rig.mounts) expect(Math.abs(mount.normal!.y)).toBe(1)
        expect(group.children.some(object => object.userData.engine || object.userData.retrothruster)).toBe(false)
      } finally { dispose(group) }
    }
    expect(counts[1]).toBeLessThan(counts[0]*.6)
  }
})

test('station fits preserve recorded batteries and an explicitly empty fit', () => {
  const appearance=resolveAppearance('station','pirate',5,'',5,'station')
  for(const profile of [empty,{...empty,weapons:{kinetic:2,flak:4}}]) {
    const group=createShip(appearance,7,'hero',profile)
    try {
      const rig=group.userData.weaponRig as WeaponRig
      expect(rig.mounts.length).toBe(profile===empty?0:6)
      if(profile!==empty) {
        expect(rig.mounts.filter(mount=>mount.family==='kinetic').length).toBe(2)
        expect(rig.mounts.filter(mount=>mount.family==='flak').length).toBe(4)
      }
    } finally { dispose(group) }
  }
})
