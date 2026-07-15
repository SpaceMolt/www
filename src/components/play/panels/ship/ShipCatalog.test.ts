/**
 * Unit tests for the ship-catalog tier filter predicate.
 *
 * Regression coverage for dc#626957: with no tier selected the catalogue must
 * show every ship (including tier-0 ships), and selecting a tier must match
 * that tier exactly. The `tier` argument is the raw <select> value (a string).
 */
import { test, expect } from 'bun:test'
import { matchesTierFilter, EMPIRES } from './ShipCatalog'
import { expectExactEmpireKeys } from '@/test/canonicalEmpires'

test('no tier selected shows every ship, including tier 0', () => {
  expect(matchesTierFilter({ tier: 0 }, '')).toBe(true)
  expect(matchesTierFilter({ tier: 1 }, '')).toBe(true)
  expect(matchesTierFilter({ tier: 5 }, '')).toBe(true)
})

test('selecting a tier matches that tier exactly', () => {
  expect(matchesTierFilter({ tier: 3 }, '3')).toBe(true)
  expect(matchesTierFilter({ tier: 2 }, '3')).toBe(false)
  expect(matchesTierFilter({ tier: 0 }, '3')).toBe(false)
})

test('selecting tier 1 does not accidentally include tier 0', () => {
  expect(matchesTierFilter({ tier: 1 }, '1')).toBe(true)
  expect(matchesTierFilter({ tier: 0 }, '1')).toBe(false)
})

test('EMPIRES filter options are exactly the 5 canonical empire ids (no stray, typo\'d, or missing entries)', () => {
  expectExactEmpireKeys(EMPIRES)
})
