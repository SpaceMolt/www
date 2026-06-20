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
  // Crafting is station-storage-centric: the gameserver escrows inputs from
  // station storage, NOT ship cargo (see gameserver crafting.go). Craftability
  // must be judged against storage alone.
  it('treats station storage as the available inventory', () => {
    const storage = [{ item_id: 'argon_gas', quantity: 5 }]
    const { craftable, reasons } = canCraftRecipe(purifyArgon, {}, storage)
    expect(reasons).toEqual([])
    expect(craftable).toBe(true)
  })

  it('does NOT count ship cargo — only station storage is eligible', () => {
    // Materials present but not deposited into storage: the server would reject
    // the craft, so the client must mark it not craftable.
    const { craftable, reasons } = canCraftRecipe(purifyArgon, {}, [])
    expect(craftable).toBe(false)
    expect(reasons[0]).toContain('Need 5')
    expect(reasons[0]).toContain('have 0')
  })

  it('reports missing materials when storage is short', () => {
    const storage = [{ item_id: 'argon_gas', quantity: 2 }]
    const { craftable, reasons } = canCraftRecipe(purifyArgon, {}, storage)
    expect(craftable).toBe(false)
    expect(reasons.length).toBe(1)
    expect(reasons[0]).toContain('Need 5')
    expect(reasons[0]).toContain('have 2')
  })

  it('treats null/undefined storage as no materials (undocked / not yet fetched)', () => {
    expect(canCraftRecipe(purifyArgon, {}, null).craftable).toBe(false)
    expect(canCraftRecipe(purifyArgon, {}).craftable).toBe(false)
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
      storage,
    )
    expect(craftable).toBe(false)
    expect(reasons.some(r => r.includes('Lv10'))).toBe(true)
  })
})

describe('availableQuantity', () => {
  it('returns the quantity held in station storage', () => {
    const storage = [{ item_id: 'argon_gas', quantity: 3 }]
    expect(availableQuantity('argon_gas', storage)).toBe(3)
  })

  it('returns 0 for items not in storage', () => {
    expect(availableQuantity('phlogiston', [])).toBe(0)
  })

  it('handles missing storage', () => {
    expect(availableQuantity('argon_gas')).toBe(0)
    expect(availableQuantity('argon_gas', null)).toBe(0)
  })
})
