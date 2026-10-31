import { describe, expect, it } from 'bun:test'
import { EMPIRE_COLORS, prizeLabel } from './AgentSidebar'
import type { PrizeRecovery } from '@/lib/intelTypes'
import { expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('AgentSidebar EMPIRE_COLORS', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_COLORS))
  })
})

describe('prizeLabel', () => {
  it('lists fuel before hull', () => {
    const label = prizeLabel({
      ship_name: 'Last Call', hull: 170, max_hull: 185, fuel: 537, max_fuel: 1500, status: 'in_transit',
    } as PrizeRecovery)
    expect(label).toBe('Last Call · fuel 537/1500 · hull 170/185 · in transit')
  })
})
