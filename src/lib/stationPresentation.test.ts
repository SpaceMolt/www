import { describe, expect, it } from 'bun:test'
import {
  isFactionOutpost,
  splitStationRegistry,
  stationsVisibleInRecon,
  stationsVisibleOnPublicMap,
  visibleOnDarkMap,
} from './stationPresentation'

const majorStation = { id: 'sol_base', type: 'station' }
const ownedOutpost = { id: 'faction_home', type: 'outpost', faction_id: 'owned-faction' }
const foreignOutpost = { id: 'foreign_home', type: 'outpost', faction_id: 'foreign-faction' }

describe('station presentation', () => {
  it('uses the explicit base type rather than faction ownership', () => {
    expect(isFactionOutpost(majorStation)).toBe(false)
    expect(isFactionOutpost(ownedOutpost)).toBe(true)
    expect(isFactionOutpost({ type: 'station', faction_id: 'owned-faction' })).toBe(false)
  })

  it('keeps faction outposts off the public galaxy map', () => {
    expect(stationsVisibleOnPublicMap([majorStation, ownedOutpost])).toEqual([majorStation])
  })

  it('shows only the operator-owned faction outposts in Recon', () => {
    expect(
      stationsVisibleInRecon(
        [majorStation, ownedOutpost, foreignOutpost],
        ['owned-faction'],
      ),
    ).toEqual([majorStation, ownedOutpost])
  })

  it('splits the directory into stations and faction outposts', () => {
    expect(splitStationRegistry([majorStation, ownedOutpost])).toEqual({
      stations: [majorStation],
      outposts: [ownedOutpost],
    })
  })
})

describe('visibleOnDarkMap', () => {
  it('lifts a dark faction color so it reads on the dark map', () => {
    expect(visibleOnDarkMap('#502087')).toBe('#724b9e')
    expect(visibleOnDarkMap('#522289')).toBe('#724b9f')
    expect(visibleOnDarkMap('#000')).toBe('#595959')
    expect(visibleOnDarkMap('#0000ffcc')).toBe('#4c4cff')
  })

  it('keeps bright colors and passes non-hex colors through', () => {
    expect(visibleOnDarkMap('#ff3355')).toBe('#ff3355')
    expect(visibleOnDarkMap('#FF3355')).toBe('#ff3355')
    expect(visibleOnDarkMap('#f80')).toBe('#ff8800')
    expect(visibleOnDarkMap('hsl(100 70% 55%)')).toBe('hsl(100 70% 55%)')
  })
})
