import { describe, it, expect } from 'bun:test'
import fs from 'fs'
import path from 'path'
import { storageStationOptions } from './storageLocations'

/*
 * gh#2112 — "Remote Storage View shows no stations when undocked".
 *
 * StorageView used to read the station list out of the free-text `hint` with
 * `hint.match(/storage at (.+)$/)`. Gameserver v0.555.0 appended a second
 * paragraph to that hint ("Dock, or pass station_id, ..."). The regex is not
 * multiline, so `$` anchored to the end of the whole string, the match failed,
 * and every undocked player saw "No items stored at any station".
 *
 * The same response carries `locations`, one entry per station. Read that.
 */

/** A view() response from gameserver v0.555.0 and later, undocked, no station_id. */
const undockedSummary = {
  action: 'view_storage',
  base_id: '',
  items: [],
  ships: [],
  // The server sorts locations by base id, so the fixture does too.
  locations: [
    { base_id: 'krynn_forge', base_name: 'Krynn Forge', system: 'krynn', system_name: 'Krynn', item_count: 0, ship_count: 1 },
    { base_id: 'sol_station', base_name: 'Sol Station', system: 'sol', system_name: 'Sol', item_count: 42, ship_count: 0 },
  ],
  hint: '42 items in storage at krynn_forge, sol_station\n\nDock, or pass station_id, to read one station\'s contents.',
}

describe('storageStationOptions', () => {
  it('lists every station in the v0.555.0+ two-paragraph-hint response', () => {
    expect(storageStationOptions(undockedSummary)).toEqual([
      { id: 'krynn_forge', label: 'Krynn Forge' },
      { id: 'sol_station', label: 'Sol Station' },
    ])
  })

  it('lists a station that holds only ships, which the hint never named', () => {
    const options = storageStationOptions(undockedSummary)
    expect(options.map((o) => o.id)).toContain('krynn_forge')
  })

  it('falls back to the base id when the station has no name', () => {
    expect(storageStationOptions({ locations: [{ base_id: 'deep_relay_7' }] })).toEqual([
      { id: 'deep_relay_7', label: 'Deep Relay 7' },
    ])
  })

  it('returns nothing for a player who stores nothing anywhere', () => {
    expect(storageStationOptions({ locations: [] })).toEqual([])
  })

  it('returns nothing when there is no response at all', () => {
    expect(storageStationOptions(null)).toEqual([])
    expect(storageStationOptions(undefined)).toEqual([])
  })
})

describe('StorageView remote station wiring', () => {
  const source = fs.readFileSync(path.join(import.meta.dir, 'StorageView.tsx'), 'utf8')

  it('builds the picker from the structured locations', () => {
    expect(source).toContain('storageStationOptions(')
  })

  it('no longer scrapes the hint prose', () => {
    expect(source).not.toContain('parseStationsFromHint')
    expect(source).not.toMatch(/storage at \(/)
  })
})
