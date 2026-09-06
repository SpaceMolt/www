import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { buildShipAppearances, resolveAppearance, type ShipEmpire } from './appearance'
import { createShip } from './ships'

function dispose(group: THREE.Group) {
  const materials = new Set<THREE.Material>()
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
  })
  for (const material of materials) material.dispose()
}

describe('cinematic ship geometry', () => {
  const classes = ['Fighter', 'Cruiser', 'Dreadnought', 'Fleet Carrier', 'Freighter', 'Scout', 'Logistics', 'Drone', 'Station', 'Creature']
  for (const shipClass of classes) test(`${shipClass} has finite volumetric geometry with a bounded draw budget`, () => {
    const group = createShip(resolveAppearance(shipClass, 'crimson'), 41)
    const bounds = new THREE.Box3().setFromObject(group)
    const size = bounds.getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(.35)
    expect(size.y).toBeGreaterThan(.06)
    expect(size.z).toBeGreaterThan(.1)
    expect(size.length()).toBeLessThan(2)
    expect(group.children.filter(mesh => !mesh.userData.engine).length).toBeLessThanOrEqual(7)
    for (const object of group.children) {
      const mesh = object as THREE.Mesh
      const positions = mesh.geometry.getAttribute('position')
      const normals = mesh.geometry.getAttribute('normal')
      expect(positions.count).toBeGreaterThan(2)
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true)
      expect(Array.from(normals.array).every(Number.isFinite)).toBe(true)
    }
    dispose(group)
  })

  test('empire construction changes physical geometry', () => {
    const empires: ShipEmpire[] = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim']
    const signatures = empires.map(empire => {
      const group = createShip(resolveAppearance('Cruiser', empire), 72)
      const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
      // Outer bounds can coincide even when a ram, outriggers and armored trim differ.
      const geometry = group.children.map(object => Array.from((object as THREE.Mesh).geometry.getAttribute('position').array).join(',')).join(';')
      dispose(group)
      return `${size.toArray().join(',')}:${geometry}`
    })
    expect(new Set(signatures).size).toBe(empires.length)
  })

  test('distant models reduce geometry and groups do not share disposable resources', () => {
    const appearance = resolveAppearance('Dreadnought', 'crimson')
    const hero = createShip(appearance, 11)
    const distant = createShip(appearance, 11, 'distant')
    const count = (group: THREE.Group) => group.children.reduce((sum, object) => sum + (object as THREE.Mesh).geometry.getAttribute('position').count, 0)
    expect(count(distant)).toBeLessThan(count(hero) * .6)
    const heroMaterials = new Set(hero.children.map(object => (object as THREE.Mesh).material))
    for (const object of distant.children) expect(heroMaterials.has((object as THREE.Mesh).material)).toBe(false)
    dispose(hero)
    dispose(distant)
  })

  test('seeded construction is stable', () => {
    const appearance = resolveAppearance('Cruiser', 'outerrim')
    const a = createShip(appearance, 103)
    const b = createShip(appearance, 103)
    for (let i = 0; i < a.children.length; i++) {
      expect((a.children[i] as THREE.Mesh).geometry.getAttribute('position').array).toEqual((b.children[i] as THREE.Mesh).geometry.getAttribute('position').array)
    }
    dispose(a)
    dispose(b)
  })
})

describe('public appearance projection', () => {
  test('projects only appearance fields without altering input catalog', () => {
    const catalog = [Object.freeze({ id: 'test', class: 'Cruiser', faction: 'crimson', category: 'Combat', scale: 3, tier: 4, lore: 'A long narrative', price: 500 })]
    const result = buildShipAppearances(catalog)
    expect(result.test.family).toBe('warship')
    expect(result.test.empire).toBe('crimson')
    expect(Object.keys(result.test).sort()).toEqual(['accent', 'beam', 'empire', 'family', 'height', 'hull', 'length', 'tier'])
    expect(catalog[0].lore).toBe('A long narrative')
  })

  test('scale determines size independently of tier and non-ship kind overrides names', () => {
    expect(resolveAppearance('Cruiser', 'solarian', 3, '', 1).length).toBe(resolveAppearance('Cruiser', 'solarian', 3, '', 5).length)
    expect(resolveAppearance('Cruiser', 'solarian', 4).length).toBeGreaterThan(resolveAppearance('Cruiser', 'solarian', 1).length)
    expect(resolveAppearance('Carrier', 'solarian', 5).length / resolveAppearance('Fighter', 'solarian', 1).length).toBeGreaterThanOrEqual(18)
    expect(resolveAppearance('Unknown historical class', undefined, 2, '', 1, 'creature').family).toBe('creature')
    expect(resolveAppearance('Cruiser', undefined, 2, '', 1, 'drone').family).toBe('drone')
    expect(resolveAppearance('constructor', 'constructor', NaN).empire).toBe('neutral')
    expect(Number.isFinite(resolveAppearance('', undefined, NaN).length)).toBe(true)
  })
})
