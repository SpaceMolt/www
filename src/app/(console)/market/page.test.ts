import { describe, expect, it } from 'bun:test'
import { EMPIRE_COLORS, EMPIRE_LINK_COLORS, groupStationsByEmpire } from './empireMeta'
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
  it('drops stations without a market service and files faction stations under independent', () => {
    const grouped = groupStationsByEmpire([
      { id: 'b', name: 'Beta', empire: 'solarian', services: ['market', 'refuel'] },
      { id: 'f', name: 'Fortress', services: [] },
      { id: 'v', name: 'Vault', services: ['refuel', 'storage'] },
      { id: 'c', name: 'Junction', services: ['crafting', 'market'] },
      { id: 'a', name: 'Alpha', empire: 'solarian', services: ['market'] },
    ])
    expect(grouped).toEqual({
      solarian: [
        { id: 'a', name: 'Alpha', empire: 'solarian', services: ['market'] },
        { id: 'b', name: 'Beta', empire: 'solarian', services: ['market', 'refuel'] },
      ],
      independent: [{ id: 'c', name: 'Junction', services: ['crafting', 'market'] }],
    })
  })
})
