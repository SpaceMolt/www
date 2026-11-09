import { describe, expect, test } from 'bun:test'
import type { UseItemResponse } from '@spacemolt/lib'
import { canRefit, isUsableConsumable, usesQuantity, useItemResultText } from './shipModules'

describe('ship module rules', () => {
  test('refit needs a dock or a fitted maintenance bay', () => {
    expect(canRefit(true, [])).toBe(true)
    expect(canRefit(false, [])).toBe(false)
    expect(canRefit(false, [{ stats: { refit_capability: true } }] as never)).toBe(true)
  })

  test('only effect types the server applies are usable', () => {
    expect(isUsableConsumable({ id: 'repair_kit', name: 'Repair Kit', effect: { type: 'repair' } })).toBe(true)
    expect(isUsableConsumable({ id: 'torpedo', name: 'Torpedo', effect: { type: 'ammo' } })).toBe(false)
    expect(isUsableConsumable({ id: 'ore', name: 'Ore' })).toBe(false)
    expect(usesQuantity({ id: 'stim', name: 'Stim', effect: { type: 'buff' } })).toBe(false)
  })

  test('result text prefers the server message', () => {
    const base = { action: 'use_item', effect_type: 'repair', item_id: 'repair_kit', item_name: 'Repair Kit', quantity_used: 2, quantity_remaining: 3 }
    expect(useItemResultText({ ...base, hull_restored: 40 } as UseItemResponse)).toBe('Used 2x Repair Kit. Restored 40 hull. 3 remaining.')
    expect(useItemResultText({ ...base, message: 'Power surge discharged.' } as UseItemResponse)).toBe('Power surge discharged.')
  })
})
