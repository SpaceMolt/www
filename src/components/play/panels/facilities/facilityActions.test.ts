import { describe, expect, test } from 'bun:test'
import { facilityWarnings, isOwnListing, unitPriceForRunFee } from './facilityActions'

describe('isOwnListing', () => {
  const me = { username: 'Vex', factionName: 'Star Wolves' }
  test('player listing matches username', () => {
    expect(isOwnListing({ seller_type: 'player', seller_name: 'Vex' }, me)).toBe(true)
    expect(isOwnListing({ seller_type: 'player', seller_name: 'Other' }, me)).toBe(false)
  })
  test('faction listing matches faction name, not username', () => {
    expect(isOwnListing({ seller_type: 'faction', seller_name: 'Star Wolves' }, me)).toBe(true)
    expect(isOwnListing({ seller_type: 'faction', seller_name: 'Vex' }, me)).toBe(false)
  })
  test('no seller name or no faction never matches', () => {
    expect(isOwnListing({ seller_type: 'player' }, me)).toBe(false)
    expect(isOwnListing({ seller_type: 'faction', seller_name: '' }, { username: 'Vex' })).toBe(false)
  })
})

describe('facilityWarnings', () => {
  test('healthy facility has no warnings', () => {
    expect(facilityWarnings({})).toEqual([])
  })
  test('damaged vs repairing, rent plural', () => {
    expect(facilityWarnings({ damaged: true })).toEqual(['Damaged'])
    expect(facilityWarnings({ damaged: true, repair_complete_tick: 50 })).toEqual(['Repairing'])
    expect(facilityWarnings({ missed_rent_cycles: 1 })).toEqual(['Rent 1 cycle behind'])
    expect(facilityWarnings({ missed_rent_cycles: 3, dismantling: true })).toEqual(['Dismantling', 'Rent 3 cycles behind'])
  })
})

describe('unitPriceForRunFee', () => {
  test('a per-run fee divides across the units one run makes', () => {
    expect(unitPriceForRunFee(120, 4)).toBe(30)
  })
  test('no output count (Logistics) keeps the fee as typed', () => {
    expect(unitPriceForRunFee(120)).toBe(120)
  })
})
