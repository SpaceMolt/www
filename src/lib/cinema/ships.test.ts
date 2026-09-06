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
    const empires: ShipEmpire[] = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim', 'pirate']
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

  test('empire silhouettes remain distinct without hero details or illumination', () => {
    const empires: ShipEmpire[] = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim', 'pirate']
    for (const shipClass of ['Fighter', 'Cruiser', 'Freighter', 'Carrier']) {
      const outlines = empires.map(empire => {
        const group = createShip(resolveAppearance(shipClass, empire), 12, 'distant')
        const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
        const armor = group.getObjectByName('armor') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
        expect(armor.geometry.getAttribute('position').count).toBeGreaterThan(200)
        expect(group.children.filter(child => !child.userData.engine).length).toBeLessThanOrEqual(7)
        const silhouette = size.toArray().map(value => value.toFixed(3)).join(',')
        dispose(group)
        return silhouette
      })
      expect(new Set(outlines).size).toBe(empires.length)
    }
  })

  test('grown Voidborn hulls and all empire variants have finite normals and bounded volumes', () => {
    for (const empire of ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim', 'pirate']) {
      for (const shipClass of classes) {
        const group = createShip(resolveAppearance(shipClass, empire), 9)
        const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
        expect(size.length()).toBeLessThan(2)
        for (const object of group.children) {
          const mesh = object as THREE.Mesh
          expect(Array.from(mesh.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true)
        }
        dispose(group)
      }
    }
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
  test('public catalog faction IDs preserve five empire palettes and pirate salvage identity', () => {
    const empires = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim', 'pirate'] as const
    const catalog = empires.map(faction => ({ id: `${faction}-hull`, class: 'Cruiser', faction, scale: 3 }))
    const manifest = buildShipAppearances(catalog)
    for (const empire of empires) expect(manifest[`${empire}-hull`].empire).toBe(empire)
    expect(manifest['solarian-hull'].hull).toBe(0x3e5c82)
    expect(manifest['voidborn-hull'].hull).toBe(0x2a0f52)
    expect(manifest['crimson-hull'].hull).toBe(0x8b1a1a)
    expect(manifest['nebula-hull'].hull).toBe(0x1f4a34)
    expect(manifest['outerrim-hull'].hull).toBe(0xc4a878)
    expect(manifest['pirate-hull'].hull).toBe(0x633c31)
    expect(manifest['pirate-hull'].hull).not.toBe(manifest['outerrim-hull'].hull)
  })

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
