import { describe, it } from 'bun:test'
import { EMPIRE_COLORS } from './page'
import { expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('leaderboard EMPIRE_COLORS', () => {
  it('has exactly the 5 canonical empire ids plus the "pirate" bucket as keys (no stray, typo\'d, or missing keys)', () => {
    // Leaderboard also colors kills attributed to unaffiliated pirates, so
    // it legitimately carries one extra key beyond the 5 canonical empires.
    expectExactEmpireKeys(Object.keys(EMPIRE_COLORS), ['pirate'])
  })
})
