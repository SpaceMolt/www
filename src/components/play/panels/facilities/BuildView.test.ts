import { describe, it, expect } from 'bun:test'
import { combinedQuantity } from './BuildView'

// `combinedQuantity` is the inventory-aggregation helper behind the
// have/need indicator on facility build materials. It must mirror the
// inventory pools the gameserver will draw from on the matching build:
//   - personal/station builds:  ship cargo + station storage
//   - faction builds:           ship cargo + station storage + faction lockbox
// It must also degrade gracefully when any pool is missing/loading and
// must not return NaN/Infinity for malformed inputs.

describe('combinedQuantity', () => {
  it('returns 0 when item exists in no pool', () => {
    expect(combinedQuantity('plates', [], [], [])).toBe(0)
  })

  it('sums cargo + station storage for personal/station builds', () => {
    const cargo = [{ item_id: 'plates', quantity: 50 }]
    const storage = [{ item_id: 'plates', quantity: 75 }]
    expect(combinedQuantity('plates', cargo, storage, null)).toBe(125)
  })

  it('also adds faction lockbox when faction pool is provided', () => {
    const cargo = [{ item_id: 'plates', quantity: 50 }]
    const storage = [{ item_id: 'plates', quantity: 75 }]
    const faction = [{ item_id: 'plates', quantity: 100 }]
    expect(combinedQuantity('plates', cargo, storage, faction)).toBe(225)
  })

  it('handles undefined / null pools (state not loaded yet)', () => {
    expect(combinedQuantity('plates')).toBe(0)
    expect(combinedQuantity('plates', null, null, null)).toBe(0)
    expect(combinedQuantity('plates', undefined, undefined, undefined)).toBe(0)
  })

  it('only counts items in cargo, not other items', () => {
    const cargo = [
      { item_id: 'plates', quantity: 50 },
      { item_id: 'circuits', quantity: 999 },
    ]
    expect(combinedQuantity('plates', cargo, [], [])).toBe(50)
  })

  it('returns 0 (not NaN) when quantity field is malformed', () => {
    const cargo = [{ item_id: 'plates', quantity: NaN as unknown as number }]
    const storage = [{ item_id: 'plates', quantity: Infinity as unknown as number }]
    // Both NaN and Infinity should coerce to 0 so the UI never renders "NaN/50".
    expect(combinedQuantity('plates', cargo, storage, null)).toBe(0)
  })

  it('handles partial loads — items in storage but not cargo', () => {
    const storage = [{ item_id: 'plates', quantity: 30 }]
    expect(combinedQuantity('plates', [], storage, null)).toBe(30)
  })

  it('handles partial loads — items in cargo but not storage', () => {
    const cargo = [{ item_id: 'plates', quantity: 30 }]
    expect(combinedQuantity('plates', cargo, [], null)).toBe(30)
  })

  it('handles very large totals without overflow', () => {
    const cargo = [{ item_id: 'plates', quantity: 1_000_000 }]
    const storage = [{ item_id: 'plates', quantity: 2_000_000 }]
    const faction = [{ item_id: 'plates', quantity: 3_000_000 }]
    expect(combinedQuantity('plates', cargo, storage, faction)).toBe(6_000_000)
  })
})
