import { describe, it, expect } from 'bun:test'
import { EMPIRE_NAMES, EMPIRE_COLORS, EMPIRE_SHORT_KEYS } from './shipMeta'
import { CANONICAL_EMPIRE_FULL_NAMES, expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('shipMeta EMPIRE_NAMES', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_NAMES))
  })

  it('matches the canonical full empire names from en.json for every empire', () => {
    for (const [id, canonicalName] of Object.entries(CANONICAL_EMPIRE_FULL_NAMES)) {
      expect(EMPIRE_NAMES[id]).toBe(canonicalName)
    }
  })
})

describe('shipMeta EMPIRE_COLORS', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_COLORS))
  })
})

describe('shipMeta EMPIRE_SHORT_KEYS', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_SHORT_KEYS))
  })

  it('maps every empire id to its own i18n key (ships.empire<Id>)', () => {
    expect(EMPIRE_SHORT_KEYS.solarian).toBe('ships.empireSolarian')
    expect(EMPIRE_SHORT_KEYS.voidborn).toBe('ships.empireVoidborn')
    expect(EMPIRE_SHORT_KEYS.crimson).toBe('ships.empireCrimson')
    expect(EMPIRE_SHORT_KEYS.nebula).toBe('ships.empireNebula')
    expect(EMPIRE_SHORT_KEYS.outerrim).toBe('ships.empireOuterRim')
  })
})
