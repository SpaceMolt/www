import { describe, expect, test } from 'bun:test'
import type { Recipe } from '../types'
import { buyPlan, combineItems, inputStoreFor, isRecyclable, maxCraftable, missingFromCargo, runsFor } from './craftPlan'

const recipe: Recipe = {
  id: 'steel_plate',
  name: 'Steel Plate',
  category: 'Refining',
  required_skills: {},
  inputs: [{ item_id: 'iron_ore', quantity: 3 }, { item_id: 'carbon', quantity: 1 }],
  outputs: [{ item_id: 'steel_plate', quantity: 2 }],
  crafting_time: 1,
}

describe('craftPlan', () => {
  test('runsFor rounds up to whole runs', () => {
    expect(runsFor(recipe, 1)).toBe(1)
    expect(runsFor(recipe, 5)).toBe(3)
  })

  test('maxCraftable is limited by the scarcest input', () => {
    expect(maxCraftable(recipe, [{ item_id: 'iron_ore', quantity: 10 }, { item_id: 'carbon', quantity: 2 }])).toBe(4)
    expect(maxCraftable(recipe, [{ item_id: 'iron_ore', quantity: 10 }])).toBe(0)
  })

  test('missingFromCargo deposits only the shortfall cargo can cover', () => {
    const storage = [{ item_id: 'iron_ore', quantity: 4 }, { item_id: 'carbon', quantity: 5 }]
    const cargo = [{ item_id: 'iron_ore', quantity: 3 }]
    expect(missingFromCargo(recipe, 3, storage, cargo)).toEqual([{ item_id: 'iron_ore', quantity: 3 }])
    expect(missingFromCargo(recipe, 1, storage, cargo)).toEqual([])
  })

  test('buyPlan buys only the shortfall, cheapest asks first, skipping own orders', () => {
    const held = [{ item_id: 'iron_ore', quantity: 2 }, { item_id: 'carbon', quantity: 5 }]
    const asks = (id: string) => (id === 'iron_ore'
      ? [{ price_each: 9, quantity: 10 }, { price_each: 5, quantity: 3, my_quantity: 1 }]
      : [])
    // 2 runs need 6 ore: buy 4 = 2 at 5 (one of the 3 is ours) + 2 at 9.
    expect(buyPlan(recipe, 2, held, asks)).toEqual([{ item_id: 'iron_ore', quantity: 4, cost: 28, short: 0 }])
    // 6 runs also need 1 carbon, which nobody sells here.
    expect(buyPlan(recipe, 6, held, asks)).toEqual([
      { item_id: 'iron_ore', quantity: 16, cost: 100, short: 4 },
      { item_id: 'carbon', quantity: 1, cost: 0, short: 1 },
    ])
  })

  test('combineItems sums by id', () => {
    expect(combineItems([{ item_id: 'a', quantity: 1 }], [{ item_id: 'a', quantity: 2 }, { item_id: 'b', quantity: 1 }]))
      .toEqual([{ item_id: 'a', quantity: 3 }, { item_id: 'b', quantity: 1 }])
  })
})

test('isRecyclable rejects irreversible categories and no_recycle recipes', () => {
  expect(isRecyclable({ category: 'Components' })).toBe(true)
  expect(isRecyclable({ category: 'Refining' })).toBe(false)
  expect(isRecyclable({ category: 'Components', no_recycle: true })).toBe(false)
})

// The server takes inputs from `source`, else `deliver_to`; both on auto use personal
// storage, then faction storage when only it covers the job (gameserver crafting.go).
describe('inputStoreFor', () => {
  const full = [{ item_id: 'iron_ore', quantity: 3 }, { item_id: 'carbon', quantity: 1 }]
  test('output faction with inputs auto reads faction storage (hiver bug report)', () => {
    expect(inputStoreFor(recipe, { personal: [], faction: full, deliverTo: 'faction' })).toBe('faction')
  })
  test('an explicit source wins over the output store', () => {
    expect(inputStoreFor(recipe, { personal: full, faction: [], source: 'storage', deliverTo: 'faction' })).toBe('storage')
    expect(inputStoreFor(recipe, { personal: full, faction: [], source: 'faction' })).toBe('faction')
  })
  test('both auto fall back to faction storage only when it covers the job and the pilot may use it', () => {
    expect(inputStoreFor(recipe, { personal: [], faction: full, canUseFaction: true })).toBe('faction')
    expect(inputStoreFor(recipe, { personal: [], faction: full })).toBe('storage')
    expect(inputStoreFor(recipe, { personal: full, faction: full, canUseFaction: true })).toBe('storage')
    expect(inputStoreFor(recipe, { personal: [], faction: [], canUseFaction: true })).toBe('storage')
  })
  test('output to my storage never falls back', () => {
    expect(inputStoreFor(recipe, { personal: [], faction: full, deliverTo: 'storage', canUseFaction: true })).toBe('storage')
  })
})
