import { describe, it, expect } from 'bun:test'
import { EMPIRE_COLORS, EMPIRES } from './PlayerSelector'
import { CANONICAL_EMPIRE_FULL_NAMES, expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('PlayerSelector EMPIRE_COLORS', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_COLORS))
  })
})

describe('PlayerSelector EMPIRES', () => {
  it('lists exactly the 5 canonical empire ids (no stray, typo\'d, or missing entries)', () => {
    expectExactEmpireKeys(EMPIRES.map((e) => e.id))
  })

  it('matches the canonical full empire names from en.json for every empire', () => {
    for (const empire of EMPIRES) {
      expect(empire.name).toBe(CANONICAL_EMPIRE_FULL_NAMES[empire.id])
    }
  })
})
