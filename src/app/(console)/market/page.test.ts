import { describe, expect, it } from 'bun:test'
import { EMPIRE_COLORS, EMPIRE_LINK_COLORS, INDEPENDENT_EMPIRE_ID, groupStationsByEmpire } from './empireMeta'
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

describe('groupStationsByEmpire', () => {
  it('puts empireless market stations under independent and skips ones without a market', () => {
    const grouped = groupStationsByEmpire([
      { id: 'b', name: 'Bravo', empire: '', services: ['market'] },
      { id: 'a', name: 'Alpha', empire: '', services: ['market', 'repair'] },
      { id: 'c', name: 'Charlie', empire: '', services: ['repair'] },
      { id: 's', name: 'Sol Central', empire: 'solarian', services: [] },
    ])
    expect(grouped[INDEPENDENT_EMPIRE_ID].map((s) => s.id)).toEqual(['a', 'b'])
    expect(grouped.solarian.map((s) => s.id)).toEqual(['s'])
  })
})
