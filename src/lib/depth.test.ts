import { describe, it, expect } from 'bun:test'
import { isCrossed, headlinePrices, bidDepthOf, askDepthOf, firmDepth } from './depth'

// The reported case: within Solarian, the best bid (30) is at Sirius and the
// best ask (23) is at Nova Terra. Neither station's own book is crossed.
const SOLARIAN_IONIZED_NEON = [
  { base_id: 'sirius_observatory_station', best_bid: 30, best_ask: 0 },
  { base_id: 'nova_terra_central', best_bid: 21, best_ask: 23 },
  { base_id: 'confederacy_central_command', best_bid: 2, best_ask: 31 },
  { base_id: 'alpha_centauri_colonial_station', best_bid: 0, best_ask: 30 },
]

describe('isCrossed', () => {
  it('flags a bid above its ask', () => {
    expect(isCrossed(30, 23)).toBe(true)
  })

  it('does not flag a normal book', () => {
    expect(isCrossed(21, 23)).toBe(false)
  })

  it('does not flag equal prices', () => {
    expect(isCrossed(23, 23)).toBe(false)
  })

  it('does not flag a one-sided book, where 0 means no orders', () => {
    expect(isCrossed(30, 0)).toBe(false)
    expect(isCrossed(0, 23)).toBe(false)
    expect(isCrossed(0, 0)).toBe(false)
  })
})

describe('headlinePrices', () => {
  it('takes the highest bid and the lowest ask across stations', () => {
    expect(headlinePrices(SOLARIAN_IONIZED_NEON)).toEqual({ bestBid: 30, bestAsk: 23 })
  })

  it('reproduces the crossed empire cell players reported', () => {
    const { bestBid, bestAsk } = headlinePrices(SOLARIAN_IONIZED_NEON)
    expect(isCrossed(bestBid, bestAsk)).toBe(true)

    // ...while every individual station's book is sane.
    for (const station of SOLARIAN_IONIZED_NEON) {
      expect(isCrossed(station.best_bid, station.best_ask)).toBe(false)
    }
  })

  it('ignores a missing side rather than treating 0 as the best ask', () => {
    expect(headlinePrices([{ best_bid: 30, best_ask: 0 }])).toEqual({ bestBid: 30, bestAsk: 0 })
  })

  it('returns zeros for no stations', () => {
    expect(headlinePrices([])).toEqual({ bestBid: 0, bestAsk: 0 })
  })
})

describe('bidDepthOf / askDepthOf', () => {
  const row = {
    bid_quantity: 560,
    ask_quantity: 1203618,
    bid_quantity_at_best: 8,
    ask_quantity_at_best: 33,
    bid_quantity_reasonable: 74,
    ask_quantity_reasonable: 1203612,
    bid_quantity_station_mgr: 74,
    ask_quantity_station_mgr: 97,
  }

  it('maps each side onto the depth views', () => {
    expect(bidDepthOf(row)).toEqual({ total: 560, atBest: 8, reasonable: 74, stationMgr: 74 })
    expect(askDepthOf(row)).toEqual({ total: 1203618, atBest: 33, reasonable: 1203612, stationMgr: 97 })
  })

  it('headlines the reasonable band, not the lowball-inflated total', () => {
    expect(firmDepth(bidDepthOf(row))).toBe(74)
  })

  it('falls back through at-best to the total when the server omits the richer fields', () => {
    expect(firmDepth(bidDepthOf({ bid_quantity: 10, ask_quantity: 0, bid_quantity_at_best: 4 }))).toBe(4)
    expect(firmDepth(bidDepthOf({ bid_quantity: 10, ask_quantity: 0 }))).toBe(10)
  })
})
