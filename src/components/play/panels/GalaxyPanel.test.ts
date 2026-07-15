import { describe, it, expect } from 'bun:test'
import { EMPIRE_NAMES } from './GalaxyPanel'
import { CANONICAL_EMPIRE_FULL_NAMES, expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('GalaxyPanel EMPIRE_NAMES', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_NAMES))
  })

  it('matches the canonical full empire names from en.json for every empire', () => {
    for (const [id, canonicalName] of Object.entries(CANONICAL_EMPIRE_FULL_NAMES)) {
      expect(EMPIRE_NAMES[id]).toBe(canonicalName)
    }
  })
})
