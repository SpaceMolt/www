import { describe, it, expect } from 'bun:test'
import { canCraftRecipe, availableQuantity } from './crafting'
import type { Recipe } from '@/components/play/types'

const purifyArgon: Recipe = {
  id: 'purify_argon',
  name: 'Purify Argon',
  description: 'Process argon for welding and shield systems.',
  category: 'Gas Processing',
  required_skills: {},
  inputs: [{ item_id: 'argon_gas', quantity: 5 }],
  outputs: [{ item_id: 'purified_argon', quantity: 3 }],
  crafting_time: 3,
}

describe('canCraftRecipe', () => {
  // Regression: GH#794 — recipes with inputs in station storage must be
  // marked craftable, since the gameserver craft handler accepts inputs from
  // cargo + station storage combined.
  it('treats station storage as available inventory (gh#794: Purify Argon)', () => {
    const cargo: { item_id: string; quantity: number }[] = []
    const storage = [{ item_id: 'argon_gas', quantity: 5 }]

    const { craftable, reasons } = canCraftRecipe(purifyArgon, {}, cargo, storage)

    expect(reasons).toEqual([])
    expect(craftable).toBe(true)
  })

  it('still marks recipe craftable when materials live in cargo', () => {
    const cargo = [{ item_id: 'argon_gas', quantity: 5 }]
    const { craftable } = canCraftRecipe(purifyArgon, {}, cargo, [])
    expect(craftable).toBe(true)
  })

  it('combines cargo + storage when neither alone is sufficient', () => {
    const cargo = [{ item_id: 'argon_gas', quantity: 2 }]
    const storage = [{ item_id: 'argon_gas', quantity: 3 }]
    const { craftable } = canCraftRecipe(purifyArgon, {}, cargo, storage)
    expect(craftable).toBe(true)
  })

  it('reports missing materials when neither cargo nor storage covers the recipe', () => {
    const cargo = [{ item_id: 'argon_gas', quantity: 1 }]
    const storage = [{ item_id: 'argon_gas', quantity: 1 }]
    const { craftable, reasons } = canCraftRecipe(purifyArgon, {}, cargo, storage)
    expect(craftable).toBe(false)
    expect(reasons.length).toBe(1)
    expect(reasons[0]).toContain('Need 5')
    expect(reasons[0]).toContain('have 2')
  })

  it('still works with no storage argument (undocked / not yet fetched)', () => {
    const cargo = [{ item_id: 'argon_gas', quantity: 5 }]
    const { craftable } = canCraftRecipe(purifyArgon, {}, cargo)
    expect(craftable).toBe(true)
  })

  it('treats null storage the same as missing storage', () => {
    const cargo = [{ item_id: 'argon_gas', quantity: 5 }]
    const { craftable } = canCraftRecipe(purifyArgon, {}, cargo, null)
    expect(craftable).toBe(true)
  })

  it('blocks craft when required skills are unmet, even with materials in storage', () => {
    const recipe: Recipe = {
      ...purifyArgon,
      required_skills: { refining: 10 },
    }
    const storage = [{ item_id: 'argon_gas', quantity: 5 }]
    const { craftable, reasons } = canCraftRecipe(
      recipe,
      { refining: { level: 3, xp: 0, next_level_xp: 100 } },
      [],
      storage,
    )
    expect(craftable).toBe(false)
    expect(reasons.some(r => r.includes('Lv10'))).toBe(true)
  })
})

describe('availableQuantity', () => {
  it('sums cargo and storage for the same item id', () => {
    const cargo = [{ item_id: 'argon_gas', quantity: 2 }]
    const storage = [{ item_id: 'argon_gas', quantity: 3 }]
    expect(availableQuantity('argon_gas', cargo, storage)).toBe(5)
  })

  it('returns 0 for items that exist in neither pool', () => {
    expect(availableQuantity('phlogiston', [], [])).toBe(0)
  })

  it('handles missing storage', () => {
    const cargo = [{ item_id: 'argon_gas', quantity: 4 }]
    expect(availableQuantity('argon_gas', cargo)).toBe(4)
    expect(availableQuantity('argon_gas', cargo, null)).toBe(4)
  })
})
