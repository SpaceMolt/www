import { describe, it, expect } from 'bun:test'
import { storageStationIds } from './StorageView'

/*
 * gh#2070 — "Remote storage view disappeared from the play UI".
 *
 * The station picker used to scrape the station list out of the free-text hint
 * with /storage at (.+)$/. Gameserver 0.555.0 appended a second sentence to that
 * hint, so the anchored match returned null, the picker stayed empty, and the
 * remote view never rendered. The station list now comes from the structured
 * `locations` array the server already sends.
 */

describe('storageStationIds', () => {
  const locations = [
    { base_id: 'ironhearth_station', base_name: 'Ironhearth Station', item_count: 120, ship_count: 2 },
    { base_id: 'haven_depot', base_name: 'Haven Depot', item_count: 0, ship_count: 1 },
  ]

  it('reads the station ids from locations', () => {
    expect(storageStationIds({ locations } as never)).toEqual(['ironhearth_station', 'haven_depot'])
  })

  // The reported bug: the hint carries a trailing sentence after the station list.
  it('reads the station ids even when the hint has trailing text', () => {
    const view = {
      hint: '120 items in storage at ironhearth_station, haven_depot\n\nDock, or pass station_id, to read one station’s contents.',
      locations,
    }
    expect(storageStationIds(view as never)).toEqual(['ironhearth_station', 'haven_depot'])
  })

  it('returns no stations when the player stores nothing', () => {
    expect(storageStationIds({ hint: 'No items in storage at any station.', locations: [] } as never)).toEqual([])
    expect(storageStationIds(undefined)).toEqual([])
  })
})
