import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { buildShipAppearances, resolveAppearance, type ShipEmpire } from './appearance'
import { createShip } from './ships'
import { aimWeaponMount, canAimWeaponMount, weaponMuzzleLocal, type WeaponRig } from './ship-weapons'

function dispose(group: THREE.Group) {
  const materials = new Set<THREE.Material>()
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    if(object.customDepthMaterial) materials.add(object.customDepthMaterial)
    if(object.customDistanceMaterial) materials.add(object.customDistanceMaterial)
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
    expect(group.children.filter(mesh => !mesh.userData.engine && !mesh.userData.retrothruster).length).toBeLessThanOrEqual(7)
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
        expect(group.children.filter(child => !child.userData.engine && !child.userData.retrothruster).length).toBeLessThanOrEqual(7)
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
    expect(manifest['solarian-hull'].hull).toBe(0x556374)
    expect(manifest['voidborn-hull'].hull).toBe(0x2a0f52)
    expect(manifest['crimson-hull'].hull).toBe(0x8b1a1a)
    expect(manifest['nebula-hull'].hull).toBe(0xb69a56)
    expect(manifest['outerrim-hull'].hull).toBe(0xc4a878)
    expect(manifest['pirate-hull'].hull).toBe(0x633c31)
    expect(manifest['pirate-hull'].hull).not.toBe(manifest['outerrim-hull'].hull)
  })

  test('projects only appearance fields without altering input catalog', () => {
    const catalog = [Object.freeze({ id: 'test', class: 'Cruiser', faction: 'crimson', category: 'Combat', scale: 3, tier: 4, lore: 'A long narrative', price: 500 })]
    const result = buildShipAppearances(catalog)
    expect(result.test.family).toBe('warship')
    expect(result.test.empire).toBe('crimson')
    expect(Object.keys(result.test).sort()).toEqual(['accent', 'beam', 'empire', 'family', 'height', 'hull', 'hullEmpire', 'length', 'tier'])
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

// Recorded equipment must alter geometry without inventing weapons for an empty fit.
describe('fitted ship hardware', () => {
  const empty = { source: 'modules' as const, weapons: {}, cargo: 0, mining: 0, salvage: 0, sensor: 0, defense: 0, utility: 0 }
  const vertices = (group: THREE.Group) => group.children.reduce((sum, object) => sum + (object as THREE.Mesh).geometry.getAttribute('position').count, 0)
  test('Midas mounts recorded defenses and scanners on its structural metal hull', () => {
    const appearance = buildShipAppearances([{ id: 'midas', class: 'Yacht', faction: 'nebula', scale: 3 }]).midas
    const bare = createShip(appearance, 11, 'hero', empty)
    // Its default fit contains three defenses and one scanner. Verify each
    // category independently so one visible assembly cannot hide another lost fit.
    for (const equipment of [{ defense: 3 }, { sensor: 1 }]) {
      const fitted = createShip(appearance, 11, 'hero', { ...empty, ...equipment })
      expect(vertices(fitted)).toBeGreaterThan(vertices(bare))
      dispose(fitted)
    }
    dispose(bare)
  })
  test('an explicitly unarmed combat hull has no fallback turret geometry', () => {
    const appearance = resolveAppearance('Cruiser', 'solarian')
    const bare = createShip(appearance, 22, 'hero', empty), legacy = createShip(appearance, 22)
    expect(vertices(bare)).toBeLessThan(vertices(legacy))
    dispose(bare); dispose(legacy)
  })
  test('different weapon mechanisms produce different physical assemblies', () => {
    const signatures = new Set<string>()
    for (const family of ['laser','beam','railgun','autocannon','flak','plasma','missile','torpedo','disruptor','exotic','mine','kinetic','smartbomb'] as const) {
      const group = createShip(resolveAppearance('Cruiser','crimson'), 1, 'hero', { ...empty, weapons: { [family]: 2 } })
      signatures.add(group.children.map(o=>Array.from((o as THREE.Mesh).geometry.getAttribute('position').array).join(',')).join(';'))
      expect(new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).length()).toBeLessThan(2)
      dispose(group)
    }
    // Continuous beams / pulsed lasers share optics; mines / smartbombs share emitters.
    expect(signatures.size).toBeGreaterThanOrEqual(9)
  })
  test('large heterogeneous fits keep finite geometry and bounded static draw calls', () => {
    for (const empire of ['solarian','nebula','crimson','voidborn','outerrim'] as const) {
      const group = createShip(resolveAppearance('Dreadnought',empire), 7, 'hero', { ...empty, weapons:{laser:8,railgun:8,missile:8,exotic:8},cargo:8,mining:8,salvage:8,sensor:8,defense:8,utility:8 })
      expect(group.children.filter(o=>!o.userData.engine && !o.userData.retrothruster).length).toBeLessThanOrEqual(7)
      expect(new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).length()).toBeLessThan(2)
      for(const o of group.children) expect(Array.from((o as THREE.Mesh).geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
      dispose(group)
    }
  })
  test('named and converted hulls remain valid in both detail levels', () => {
    const sources = ['prayer','worship','congregation','comet','concordia','liquidity_event','midas'].map(id=>({id,class:'Freighter',faction:id==='concordia'?'solarian':id==='comet'||id==='liquidity_event'||id==='midas'?'nebula':'outerrim',scale:2}))
    const appearances=buildShipAppearances([...sources,{id:'start_praying',class:'Freighter',faction:'pirate',based_on:'prayer'}])
    for(const appearance of Object.values(appearances)) for(const detail of ['hero','distant'] as const) {
      const group=createShip(appearance,11,detail,empty)
      const size=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
      expect(size.length()).toBeLessThan(2)
      expect(size.x).toBeGreaterThan(.7)
      for(const o of group.children) expect(Array.from((o as THREE.Mesh).geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true)
      dispose(group)
    }
  })
})

test('weapon proportions grow with tier while hull scale remains physical', () => {
  const lengths:number[]=[]
  for(const tier of [1,3,5]) {
    const appearance=resolveAppearance('Cruiser','solarian',3,'combat',tier)
    const model=createShip(appearance,1,'hero',{source:'modules',weapons:{railgun:1},cargo:0,mining:0,salvage:0,sensor:0,defense:0,utility:0})
    const mount=model.userData.weaponRig.mounts[0]
    lengths.push(mount.muzzle.distanceTo(mount.pivot))
    expect(appearance.length).toBe(resolveAppearance('Cruiser','solarian',3,'combat',1).length)
    expect(model.children.filter(child=>child.userData.retrothruster).length).toBe(2)
    dispose(model)
  }
  expect(lengths[0]).toBeGreaterThan(.20)
  expect(lengths[1]).toBeGreaterThan(lengths[0])
  expect(lengths[2]).toBeGreaterThan(lengths[1])
})


for (const family of ['autocannon', 'laser'] as const) test(`Shard ${family} mounts clear the hull throughout their legal firing envelope`, () => {
  const appearance = buildShipAppearances([{ id: 'shard', class: 'Miner', category: 'Industrial', faction: 'crimson', scale: 1, tier: 0 }]).shard
  const group = createShip(appearance, 90210, 'hero', { source: 'modules', weapons: { [family]: 2 }, cargo: 0, mining: 0, salvage: 0, sensor: 0, defense: 0, utility: 0 })
  try {
    group.updateMatrixWorld(true)
    const rig = group.userData.weaponRig as WeaponRig
    expect(rig.mounts).toHaveLength(2)
    const hull = group.children.filter(object => !object.userData.engine && !object.userData.retrothruster) as THREE.Mesh[]
    // Back faces detect muzzles embedded inside a closed hull, which a normal
    // front-face raycast can miss. GPU-rotated gun triangles are excluded below.
    for (const mesh of hull) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.side = THREE.DoubleSide
    const ray = new THREE.Raycaster()
    const failures: { mount: number; yaw: number; pitch: number; segment: string; surface: string }[] = []
    let checked = 0
    for (let index = 0; index < rig.mounts.length; index++) {
      const mount = rig.mounts[index]
      for (let yaw = -180; yaw < 180; yaw += 5) for (const pitch of [-10, -5, 0, 5, 10, 30, 60, 90]) {
        const heading = THREE.MathUtils.degToRad(yaw), elevation = THREE.MathUtils.degToRad(pitch)
        const direction = new THREE.Vector3(Math.cos(heading) * Math.cos(elevation), Math.sin(elevation), Math.sin(heading) * Math.cos(elevation))
        const target = mount.pivot.clone().addScaledVector(direction, 10)
        if (!canAimWeaponMount(rig, index, target)) continue
        checked++
        aimWeaponMount(rig, index, target)
        const muzzle = weaponMuzzleLocal(rig, index)!
        // Check both the visible barrel axis and the beam/projectile leaving
        // its animated muzzle. The old recessed mounts fail even at 60deg yaw.
        for (const [segment, origin, far] of [
          ['barrel', mount.pivot, mount.pivot.distanceTo(muzzle)],
          ['shot', muzzle, 10],
        ] as const) {
          ray.set(origin.clone().addScaledVector(direction, .0001), direction)
          ray.far = far
          const blocked = ray.intersectObjects(hull, false).find(hit => {
            if (!hit.face) return false
            const tag = (hit.object as THREE.Mesh).geometry.getAttribute('cinemaMount')
            return !tag || [hit.face.a, hit.face.b, hit.face.c].every(vertex => tag.getX(vertex) < 0)
          })
          if (blocked) failures.push({ mount: index, yaw, pitch, segment, surface: blocked.object.name })
        }
      }
    }
    // A bounded diagnostic avoids drowning the first failing headings in output.
    expect(checked).toBeGreaterThan(500)
    expect(failures.slice(0, 4)).toEqual([])
    expect(failures).toHaveLength(0)
  } finally {
    dispose(group)
  }
})
