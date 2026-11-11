import { describe, it, expect } from 'bun:test'
import { EMPIRE_NAMES, toFrontierSystems } from './GalaxyPanel'
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

describe('toFrontierSystems', () => {
  it('keeps only frontier entries, in the canvas shape', () => {
    const base = { name: 'A', description: '', position: { x: 1, y: 2 }, connections: ['sol'], visited_at: '', visited: true, poi_count: 1 }
    expect(toFrontierSystems([{ ...base, system_id: 'sol' }, { ...base, system_id: 'f1', frontier_tier: 2 }])).toEqual([
      { id: 'f1', name: 'A', x: 1, y: 2, empire_color: '#f472b6', frontier_tier: 2, connections: ['sol'] },
    ])
  })
})
