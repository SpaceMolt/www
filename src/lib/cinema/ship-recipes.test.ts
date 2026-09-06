import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { buildShipAppearances } from './appearance'
import { createShip } from './ships'
import type { CinemaHardware } from './hardware'

const empty: CinemaHardware = { source: 'modules', weapons: {}, cargo: 0, mining: 0, salvage: 0, sensor: 0, defense: 0, utility: 0 }
const shard = buildShipAppearances([{ id: 'shard', class: 'Miner', category: 'Industrial', faction: 'crimson', scale: 1, tier: 0 }]).shard

for (const detail of ['hero', 'distant'] as const) test(`Shard ${detail} has an exposed tiny inset cockpit and bounded armored drone silhouette`, () => {
  const group = createShip(shard, 11, detail, empty)
  group.updateMatrixWorld(true)
  const staticMeshes = group.children.filter(o => !o.userData.engine) as THREE.Mesh[]
  const bounds = new THREE.Box3().makeEmpty()
  for (const mesh of staticMeshes) bounds.union(new THREE.Box3().setFromObject(mesh))
  const size = bounds.getSize(new THREE.Vector3())
  expect(staticMeshes.length).toBeLessThanOrEqual(7)
  expect(size.z / size.x).toBeGreaterThan(.65)
  expect(size.z / size.x).toBeLessThan(.9)
  expect(bounds.max.x).toBeLessThan(.5) // Empty gun sockets have no fictional barrels.
  expect(bounds.getBoundingSphere(new THREE.Sphere()).radius).toBeLessThan(.78)
  const glass = group.getObjectByName('glass') as THREE.Mesh
  expect(glass).toBeDefined()
  const canopy = new THREE.Box3().setFromObject(glass).getSize(new THREE.Vector3())
  expect(canopy.x).toBeLessThan(size.x * .12)
  expect(canopy.z).toBeLessThan(size.z * .12)
  const view = new THREE.Raycaster(new THREE.Vector3(.219, .5, 0), new THREE.Vector3(0, -1, 0))
  expect(view.intersectObjects(staticMeshes)[0]?.object).toBe(glass)
  for (const object of group.children as THREE.Mesh[]) {
    expect(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
    expect(Array.from(object.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true)
    object.geometry.dispose()
  }
  const materials = new Set((group.children as THREE.Mesh[]).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
  materials.forEach(material => material.dispose())
})
