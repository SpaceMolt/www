import { describe, it, expect } from 'bun:test'
import { itemMarketOutcome } from './StationBreakdown'

// The gameserver returns 404, not 200 + {stations: []}, when no station
// quotes an item (internal/server/market_station_api.go handleItemMarket).
// A 404 must read as "nothing to show", never as a fetch failure — the two
// render completely different messages to the player.
describe('itemMarketOutcome', () => {
  it('treats 404 as empty, not an error', () => {
    expect(itemMarketOutcome(404, false)).toBe('empty')
  })

  it('treats a successful response as ok', () => {
    expect(itemMarketOutcome(200, true)).toBe('ok')
  })

  it('treats other non-ok statuses as an error', () => {
    expect(itemMarketOutcome(500, false)).toBe('error')
    expect(itemMarketOutcome(429, false)).toBe('error')
    expect(itemMarketOutcome(400, false)).toBe('error')
  })
})
