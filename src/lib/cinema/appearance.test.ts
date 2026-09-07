import { expect, test } from 'bun:test'
import { buildShipAppearances, resolveAppearance } from './appearance'

const base = { id: 'empire_carrier', class: 'Carrier', faction: 'crimson', scale: 4, tier: 4 }

test('pirate conversions retain the donor silhouette and colors at their own recorded physical scale', () => {
  const result = buildShipAppearances([base, { id: 'pirate_conversion', class: 'Cruiser', faction: 'pirate', scale: 2, tier: 3, based_on: base.id }])
  const pirate = result.pirate_conversion, original = result.empire_carrier
  expect(pirate.empire).toBe('pirate')
  expect(pirate.hullEmpire).toBe('crimson')
  expect(pirate.family).toBe('carrier')
  expect([pirate.beam, pirate.height, pirate.hull, pirate.accent]).toEqual([original.beam, original.height, original.hull, original.accent])
  expect(pirate.length).toBe(resolveAppearance('Cruiser', 'pirate', 2).length)
  expect(pirate.length).toBeLessThan(original.length)
  expect(pirate.tier).toBe(3)
})

test('named hull recipes and inherited Prayer construction survive the compact projection', () => {
  const ships = ['prayer', 'worship', 'congregation', 'comet', 'concordia', 'liquidity_event', 'midas'].map(id => ({ id, class: 'Freighter', faction: 'outerrim', scale: 2 }))
  const result = buildShipAppearances([...ships, { id: 'start_praying', class: 'Freighter', faction: 'pirate', scale: 1, based_on: 'prayer' }])
  for (const ship of ships) expect(result[ship.id].recipe).toBe(ship.id)
  expect(result.start_praying.recipe).toBe('prayer')
  expect(result.start_praying.hullEmpire).toBe('outerrim')
  expect(result.start_praying.empire).toBe('pirate')
})

test('lineage follows multiple public conversions without depending on input order', () => {
  const ships = [{ id: 'last', class: 'Freighter', faction: 'pirate', based_on: 'middle' },
    { id: 'middle', class: 'Cruiser', faction: 'pirate', based_on: base.id }, base]
  const result = buildShipAppearances(ships)
  expect(result.last.hullEmpire).toBe('crimson')
  expect(result.last.family).toBe('carrier')
  expect(result).toEqual(buildShipAppearances([...ships].reverse()))
})

test('missing bases and cycles retain safe local appearances instead of guessing an empire', () => {
  const result = buildShipAppearances([
    { id: 'missing', class: 'Miner', faction: 'pirate', based_on: 'not_in_catalog' },
    { id: 'a', class: 'Scout', faction: 'pirate', based_on: 'b' },
    { id: 'b', class: 'Carrier', faction: 'pirate', based_on: 'a' },
    { id: 'self', class: 'Fighter', faction: 'pirate', based_on: 'self' },
  ])
  expect(result.missing.family).toBe('industrial')
  expect(result.a.family).toBe('scout')
  expect(result.b.family).toBe('carrier')
  expect(result.self.family).toBe('fighter')
  for (const appearance of Object.values(result)) {
    expect(appearance.hullEmpire).toBe('pirate')
    expect([appearance.length, appearance.beam, appearance.height].every(Number.isFinite)).toBe(true)
  }
})

test('the public No Exit lineage names its absent Solarian donor explicitly', () => {
  const result = buildShipAppearances([{ id: 'no_exit', class: 'Interdictor', faction: 'pirate', category: 'Combat Support', scale: 4, based_on: 'interdictor' }])
  expect(result.no_exit.hullEmpire).toBe('solarian')
  expect(result.no_exit.empire).toBe('pirate')
  expect(result.no_exit.hull).toBe(resolveAppearance('Interdictor', 'solarian', 4, 'Combat Support').hull)
})

test('construction identity is explicit on ordinary hulls without leaking catalog prose or stats', () => {
  const source = { ...base, description: 'public description', lore: 'public lore', price: 100000, base_hull: 900 }
  const appearance = buildShipAppearances([source]).empire_carrier
  expect(appearance.hullEmpire).toBe('crimson')
  expect(Object.keys(appearance).sort()).toEqual(['accent', 'beam', 'empire', 'family', 'height', 'hull', 'hullEmpire', 'length', 'tier'].sort())
})

test('Solarian slate and Nebula gold are large-surface identities', () => {
  const solarian = resolveAppearance('Cruiser', 'solarian'), nebula = resolveAppearance('Yacht', 'nebula')
  expect(solarian.hull).toBe(0x556374)
  expect(nebula.hull).toBe(0xb69a56)
  expect(nebula.accent).toBe(0x244b36)
})

test('Shard keeps its repurposed combat-drone construction despite the Miner catalog class', () => {
  const result = buildShipAppearances([
    { id: 'shard', class: 'Miner', category: 'Industrial', faction: 'crimson', scale: 1, tier: 0 },
    { id: 'ordinary_miner', class: 'Miner', category: 'Industrial', faction: 'crimson', scale: 1, tier: 0 },
    { id: 'converted_shard', class: 'Miner', faction: 'pirate', scale: 2, based_on: 'shard' },
  ])
  expect(result.shard.recipe).toBe('shard')
  expect(result.shard.family).toBe('drone')
  expect(result.shard.beam).toBe(.72)
  expect(result.shard.height).toBe(.40)
  expect(result.shard.length).toBe(resolveAppearance('Miner', 'crimson', 1).length)
  expect(result.ordinary_miner.family).toBe('industrial')
  expect(result.ordinary_miner.recipe).toBeUndefined()
  expect(result.converted_shard.recipe).toBe('shard')
  expect(result.converted_shard.family).toBe('drone')
  expect(result.converted_shard.empire).toBe('pirate')
  expect(result.converted_shard.length).toBeGreaterThan(result.shard.length)
})
