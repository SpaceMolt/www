import { describe, it, expect } from 'bun:test'
import { unwrapActionResult } from './GameProvider'

// Regression: "no Mine button until refresh" after arriving at a POI.
// HTTP v2 mutations opt every request into v2 state deltas, so the gameserver
// delivers a multi-tick travel/jump arrival as a V2GameState with the typed
// arrival response (action, poi, poi_data, ...) nested under `details`
// instead of at the top level. GameProvider's action_result handler used to
// read `result.action` directly, which is always undefined on that shape —
// so the arrived/jumped check never matched and the follow-up get_system /
// get_poi refresh (which populates poi.resources for the Mine button) never
// fired until a manual page reload.

describe('unwrapActionResult', () => {
  it('unwraps a v2 delta-wrapped arrival so action/poi are reachable', () => {
    const deltaWrapped = {
      location: { system_id: 'sys-sol' },
      message: '',
      details: {
        action: 'arrived',
        poi: 'Sol Station',
        poi_id: 'poi-station-1',
      },
    }
    const result = unwrapActionResult(deltaWrapped)
    expect(result.action).toBe('arrived')
    expect(result.poi).toBe('Sol Station')
  })

  it('passes through an already-flat (non-delta) result unchanged', () => {
    const flat = { action: 'dock', base: 'Sol Station' }
    const result = unwrapActionResult(flat)
    expect(result.action).toBe('dock')
    expect(result.base).toBe('Sol Station')
  })

  it('does not unwrap when details is not an object', () => {
    const flatWithScalarDetails = { action: 'craft', details: 'queued job info' }
    const result = unwrapActionResult(flatWithScalarDetails)
    expect(result.action).toBe('craft')
  })

  it('keeps delta-only top-level fields (player/ship/location) alongside the unwrapped details', () => {
    const deltaWrapped = {
      ship: { fuel: 42 },
      credits: 1000,
      details: { action: 'dock', base: 'Sol Station' },
    }
    const result = unwrapActionResult(deltaWrapped)
    expect(result.ship).toEqual({ fuel: 42 })
    expect(result.credits).toBe(1000)
    expect(result.action).toBe('dock')
    expect(result.base).toBe('Sol Station')
  })

  it('unwraps a delta-wrapped salvage result so yield fields are reachable', () => {
    // Regression: salvage_wreck (any single-tick mutation, not just travel/
    // jump) gets delta-wrapped too. SalvagePanel reads metal_scrap/components/
    // rare_materials/total_value/xp_gained straight off the sendCommand()
    // resolved value — those used to live at the top level, now they're
    // nested under `details` unless unwrapped first.
    const deltaWrapped = {
      message: 'Salvage complete',
      details: {
        metal_scrap: 12,
        components: 3,
        rare_materials: 1,
        total_value: 4500,
        xp_gained: 25,
      },
    }
    const result = unwrapActionResult(deltaWrapped)
    expect(result.metal_scrap).toBe(12)
    expect(result.total_value).toBe(4500)
    expect(result.xp_gained).toBe(25)
  })
})
