import { describe, it, expect } from 'bun:test'
import { canSurvey, EMPIRE_NAMES, extractionKinds, hasMineableResources, mineWarning } from './LeftSidebar'
import { getItem } from '@/data/catalog'
import { CANONICAL_EMPIRE_FULL_NAMES, expectExactEmpireKeys } from '@/test/canonicalEmpires'
import { transitDestination } from './TravelProgress'

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

describe('transitDestination', () => {
  const pois = [{ id: 'belt', name: 'Main Belt' }, { id: 'stn', name: 'Orbit', base_name: 'Sol Station' }]

  it('in-system travel with empty transit fields uses the POI list, then the picked name', () => {
    expect(transitDestination({ transit_type: 'travel', transit_dest_poi_id: 'stn' }, undefined, pois)).toBe('Sol Station')
    expect(transitDestination({ transit_type: 'travel' }, 'Main Belt', pois)).toBe('Main Belt')
    expect(transitDestination({ transit_type: 'travel' })).toBe('destination')
  })

  it('a jump prefers the system name', () => {
    expect(transitDestination({ transit_type: 'jump', transit_dest_system_name: 'Sol', transit_dest_poi_name: 'Gate' })).toBe('Sol')
  })
})

describe('mine and survey gates mirror the server loadout checks', () => {
  const fit = (...ids: string[]) => ids.map((id) => getItem(id)!)

  it('warns with the missing extractor only when nothing fitted can work a deposit here', () => {
    expect(mineWarning(['hydrogen_gas'], extractionKinds(fit('mining_laser_i'), undefined)))
      .toBe('Nothing fitted can extract gas here: fit a Gas Harvester')
    expect(mineWarning(['hydrogen_gas', 'iron_ore'], extractionKinds(fit('mining_laser_i'), undefined))).toBeNull()
    expect(mineWarning(['helium_ice'], extractionKinds(fit('ice_harvester_i'), undefined))).toBeNull()
  })

  it('counts a hull with inherent rad harvesting', () => {
    expect(extractionKinds([], 'warhead')).toEqual(['rad'])
  })

  it('needs survey power or an anomaly detector', () => {
    expect(canSurvey(fit('mining_laser_i'), undefined)).toBe(false)
    expect(canSurvey(fit('survey_scanner_i'), undefined)).toBe(true)
    expect(canSurvey(fit('anomaly_detector'), undefined)).toBe(true)
    expect(canSurvey([], 'datum')).toBe(true)
    expect(canSurvey([], undefined, [{ stat: 'survey_power', amount: 10 }])).toBe(true)
    expect(canSurvey([], undefined, [{ stat: 'weapon_damage', amount: 10 }])).toBe(false)
  })
})
