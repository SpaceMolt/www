import { describe, it, expect } from 'bun:test'
import { EMPIRE_NAMES, hasMineableResources } from './LeftSidebar'
import { CANONICAL_EMPIRE_FULL_NAMES, expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('LeftSidebar EMPIRE_NAMES', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_NAMES))
  })

  it('matches the canonical full empire names from en.json for every empire', () => {
    for (const [id, canonicalName] of Object.entries(CANONICAL_EMPIRE_FULL_NAMES)) {
      expect(EMPIRE_NAMES[id]).toBe(canonicalName)
    }
  })
})

// dc#457858: the Mine / Mine Until Full actions disappeared from /play when the
// gameserver briefly deprecated get_poi, because the gate read the get_poi POI
// blob. The gate must key off the `location` state section — which carries
// `resources` on every state delta — so a single query command can never take
// the affordance out again.
describe('hasMineableResources (Mine / Mine Until Full gate, dc#457858)', () => {
  it('is true at a POI with deposits — the reported case', () => {
    const location = {
      poi_id: 'main_belt',
      poi_type: 'asteroid_belt',
      docked_at: null,
      resources: [{ item_id: 'iron_ore', item_name: 'Iron Ore', richness: 5, remaining: 500 }],
    }
    expect(hasMineableResources(location)).toBe(true)
  })

  it('is false at a POI with no deposits', () => {
    expect(hasMineableResources({ poi_id: 'sol_central', resources: [] })).toBe(false)
  })

  it('is false when the location section carries no resources key at all', () => {
    expect(hasMineableResources({ poi_id: 'sol_central' })).toBe(false)
  })

  it('is false before the location section has been seeded', () => {
    expect(hasMineableResources(undefined)).toBe(false)
    expect(hasMineableResources(null)).toBe(false)
  })

  it('does not depend on a get_poi-shaped POI blob — a POI object alone is not enough', () => {
    // The pre-fix gate read `poi.resources`; passing only a POI-shaped object
    // with no location resources must not light the buttons up.
    expect(hasMineableResources({} as { resources?: unknown[] })).toBe(false)
  })
})
