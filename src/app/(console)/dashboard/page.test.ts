import { describe, it, expect } from 'bun:test'
import { EMPIRE_COLORS, EMPIRE_NAMES } from './page'
import { CANONICAL_EMPIRE_SHORT_NAMES, expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('dashboard EMPIRE_COLORS', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_COLORS))
  })
})

describe('dashboard EMPIRE_NAMES', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_NAMES))
  })

  it('matches the canonical short empire names from en.json for every empire', () => {
    for (const [id, canonicalName] of Object.entries(CANONICAL_EMPIRE_SHORT_NAMES)) {
      expect(EMPIRE_NAMES[id]).toBe(canonicalName)
    }
  })
})
