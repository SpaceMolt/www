import { describe, it } from 'bun:test'
import { EMPIRE_COLORS } from './AgentSidebar'
import { expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('AgentSidebar EMPIRE_COLORS', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_COLORS))
  })
})
