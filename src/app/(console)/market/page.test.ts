import { describe, it } from 'bun:test'
import { EMPIRE_COLORS, EMPIRE_LINK_COLORS } from './page'
import { expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('market page EMPIRE_COLORS', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_COLORS))
  })
})

describe('market page EMPIRE_LINK_COLORS', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_LINK_COLORS))
  })
})
