import { describe, expect, test } from 'bun:test'
import type { Recipe } from '../types'
import { combineItems, isRecyclable, maxCraftable, missingFromCargo, runsFor } from './craftPlan'

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
    expect(maxCraftable(recipe, [{ item_id: 'steel_plate', quantity: 7 }], 'recycle')).toBe(7)
  })

  test('missingFromCargo deposits only the shortfall cargo can cover', () => {
    const storage = [{ item_id: 'iron_ore', quantity: 4 }, { item_id: 'carbon', quantity: 5 }]
    const cargo = [{ item_id: 'iron_ore', quantity: 3 }]
    expect(missingFromCargo(recipe, 3, storage, cargo)).toEqual([{ item_id: 'iron_ore', quantity: 3 }])
    expect(missingFromCargo(recipe, 1, storage, cargo)).toEqual([])
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
