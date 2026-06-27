import { describe, it, expect } from 'bun:test'
import { gameReducer } from './useGameState'
import { initialGameState, type GameState, type POI } from './types'

// Regression for dc#380900: "Dock button does not show anymore".
// After arriving at a station via travel/jump, GameProvider fires an async
// get_poi refresh. If that refresh returns the same POI without base_id, the
// reducer used to clobber the known base_id, and the Dock button (gated on
// poi.base_id in LeftSidebar) disappeared until a manual page refresh.

const stationPoi: POI = {
  id: 'poi-station-1',
  name: 'Sol Station',
  system_id: 'sys-sol',
  type: 'planet',
  base_id: 'base-sol-1',
}

function stateAtStation(): GameState {
  return { ...initialGameState, poi: { ...stationPoi } }
}

describe('gameReducer get_poi base_id preservation (dc#380900)', () => {
  it('keeps base_id when a same-POI get_poi refresh omits it', () => {
    const refreshWithoutBase: POI = {
      id: 'poi-station-1',
      name: 'Sol Station',
      system_id: 'sys-sol',
      type: 'planet',
      description: 'A busy trade hub.',
      // base_id intentionally absent — this is the buggy refresh payload
    }
    const next = gameReducer(stateAtStation(), {
      type: 'OK',
      payload: { action: 'get_poi', poi: refreshWithoutBase },
    })
    expect(next.poi?.base_id).toBe('base-sol-1')
    // The rich fields from the refresh should still be applied
    expect(next.poi?.description).toBe('A busy trade hub.')
  })

  it('uses the refreshed base_id when get_poi supplies one', () => {
    const refreshWithBase: POI = { ...stationPoi, base_id: 'base-new-9' }
    const next = gameReducer(stateAtStation(), {
      type: 'OK',
      payload: { action: 'get_poi', poi: refreshWithBase },
    })
    expect(next.poi?.base_id).toBe('base-new-9')
  })

  it('does not borrow base_id across different POIs', () => {
    const otherPoi: POI = {
      id: 'poi-belt-2',
      name: 'Asteroid Belt',
      system_id: 'sys-sol',
      type: 'asteroid_belt',
      // genuinely has no base
    }
    const next = gameReducer(stateAtStation(), {
      type: 'OK',
      payload: { action: 'get_poi', poi: otherPoi },
    })
    expect(next.poi?.id).toBe('poi-belt-2')
    expect(next.poi?.base_id).toBeUndefined()
  })
})
