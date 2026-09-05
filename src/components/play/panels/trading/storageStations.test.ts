import { describe, it, expect } from 'bun:test'
import { storageStationOptions } from './storageLocations'

/*
 * gh#2070 — the remote storage picker went empty in the play UI.
 *
 * The picker used to scrape the station list out of the free-text hint with
 * /storage at (.+)$/. Gameserver 0.555.0 appended a second sentence to that hint,
 * so the anchored match returned null, the picker stayed empty, and the remote
 * view never rendered. The list now comes from the structured `locations` array
 * the server already sends, so hint wording cannot break it again.
 */

describe('storageStationOptions', () => {
  it('reads station options from locations, whatever the hint says', () => {
    const view = {
      hint: '120 items in storage at ironhearth_station, haven_depot\n\nDock, or pass station_id, to read one station’s contents.',
      locations: [{ base_id: 'ironhearth_station' }, { base_id: 'haven_depot' }],
    }
    expect(storageStationOptions(view)).toEqual([
      { id: 'ironhearth_station', label: 'Ironhearth Station' },
      { id: 'haven_depot', label: 'Haven Depot' },
    ])
  })

  it('returns no stations when the player stores nothing', () => {
    expect(storageStationOptions({ locations: [] })).toEqual([])
    expect(storageStationOptions(undefined)).toEqual([])
  })
})
