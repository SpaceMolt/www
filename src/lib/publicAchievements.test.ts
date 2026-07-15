import { describe, it } from 'bun:test'
import { EMPIRE_ACCENT } from './publicAchievements'
import { expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('publicAchievements EMPIRE_ACCENT', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_ACCENT))
  })
})
