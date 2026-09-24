import { describe, it, expect } from 'bun:test'
import {
  avgPrice, bondHeadline, bondSummary, calendar, chartRows, compact, dayLabel, flowCaption, holders, inBrief, indexedCategories, lastDays, niceCeil,
  playerHeld, priceHeadline, signed, tradeGapNote, signedPct, summarize, summaryOnlyUntil, ticksFor, tradeHeadline, utcDateTime,
  type EconomyBondDay, type EconomyCurrent, type EconomyDay, type EconomyMoneySupply,
} from './economy'

function day(date: string, over: Partial<EconomyDay> = {}): EconomyDay {
  return {
    date,
    period_days: 1,
    supply_total: 1000,
    supply_players: 600,
    supply_npc: 400,
    supply_change: { change: 0, unattributed: 0 },
    faucets: {
      new_players: 0, respawns: 0, missions: 0, pirate_bounties: 0, achievements: 0,
      freight_insurance: 0, npc_seeding: 0, dev_team: 0, other: 0, total: 0,
    },
    sinks: {
      labor: 0, station_founding: 0, shipbuilding: 0, station_facilities: 0,
      war_declarations: 0, penalties: 0, dev_team: 0, total: 0,
    },
    trade: { player_to_player: 0, players_sold_to_npc: 0, players_bought_from_npc: 0, direct_trades: 0, fills: 0 },
    taxes_and_fines: 0,
    active_players: 0,
    ore_mined: 0,
    items_crafted: 0,
    price_index: { ore: null, refined: null, component: null },
    trade_authenticators: bond(),
    ...over,
  }
}

const NONE = { units: 0, credits: 0 }

function bond(over: Partial<EconomyBondDay> = {}): EconomyBondDay {
  return {
    reserve: 0, in_circulation: 0, window_sell_price: 1000, window_buy_price: 900,
    minted: 0, burned: 0, used_in_shipbuilding: 0,
    window_sold_to_players: NONE, window_sold_to_stations: NONE, window_bought_back: NONE,
    players_to_stations: NONE, stations_to_players: NONE, player_to_player: NONE, station_to_station: NONE,
    ...over,
  }
}

const SUPPLY: EconomyMoneySupply = {
  total: 100, player_wallets: 40, player_order_escrow: 5, faction_treasuries: 5,
  station_managers: 20, empire_treasuries: 10, citizen_pools: 8, npc_order_escrow: 6, insurer: 4, other_npc: 2,
}

describe('money supply holders', () => {
  it('player-held is wallets + order escrow + faction treasuries', () => {
    expect(playerHeld(SUPPLY)).toBe(50)
  })

  it('every holder is listed once and the rows sum to the total', () => {
    const rows = holders(SUPPLY)
    expect(rows.reduce((s, r) => s + r.value, 0)).toBe(SUPPLY.total)
    expect(rows.filter((r) => r.side === 'player').reduce((s, r) => s + r.value, 0)).toBe(playerHeld(SUPPLY))
  })
})

const F0 = day('x').faucets
const S0 = day('x').sinks

// Two days: supply 1000 -> 1020 -> 1008, before the first day it was 1000.
const TWO = [
  day('2026-09-01', {
    supply_total: 1020,
    faucets: { ...F0, missions: 30, respawns: 5, total: 35 },
    sinks: { ...S0, shipbuilding: 10, total: 10 },
    supply_change: { change: 20, unattributed: -5 },
    trade: { player_to_player: 10, players_sold_to_npc: 50, players_bought_from_npc: 20, direct_trades: 3, fills: 99 },
    taxes_and_fines: 4,
  }),
  day('2026-09-02', {
    supply_total: 1008,
    period_days: 2,
    faucets: { ...F0, missions: 10, dev_team: 45, total: 55 },
    sinks: { ...S0, labor: 25, total: 25 },
    supply_change: { change: -12, unattributed: -42 },
    trade: { player_to_player: 20, players_sold_to_npc: 0, players_bought_from_npc: 0, direct_trades: 0, fills: 5 },
    taxes_and_fines: 1,
  }),
]

describe('summarize', () => {
  const s = summarize(TWO)

  it('sums each category and keeps the gap separate from created and destroyed', () => {
    expect(s.created).toBe(90)
    expect(s.destroyed).toBe(35)
    expect(s.net).toBe(55)
    expect(s.change).toBe(8)
    expect(s.gap).toBe(-47)
    expect(s.change - s.net).toBe(s.gap)
    expect(s.gapPct).toBeCloseTo((47 / 55) * 100)
    expect(s.faucets[0]).toEqual({ key: 'dev_team', label: 'Dev team grants', value: 45 })
    expect(s.sinks.map((x) => x.key).slice(0, 2)).toEqual(['labor', 'shipbuilding'])
  })

  it('measures the supply change over the same span as the flows', () => {
    expect(s.supplyStart).toBe(1000)
    expect(s.supplyEnd).toBe(1008)
    expect(s.changePct).toBeCloseTo(0.8)
    expect(s.days).toBe(3) // period_days, not entries
    expect(s.from).toBe('2026-09-01')
    expect(s.to).toBe('2026-09-02')
  })

  it('totals trade without the direct trades or fills', () => {
    expect(s.trade).toEqual({ p2p: 30, sold: 50, bought: 20, direct: 3, total: 100 })
    expect(s.taxes).toBe(5)
  })

  it('has no gap percentage when nothing net was created', () => {
    expect(summarize([day('2026-09-01')]).gapPct).toBeNull()
  })
})

const CURRENT: EconomyCurrent = {
  captured_at: '2026-09-03T00:00:00Z',
  money_supply: { ...({} as EconomyMoneySupply), total: 100, player_wallets: 60, player_order_escrow: 0, faction_treasuries: 3 },
  players: { registered: 10, active_24h: 5, median_wallet: 100, top_10pct_share: 90 },
  exchange: { player_sell_orders: 0, player_sell_value: 0, player_buy_orders: 0, player_buy_value: 0, npc_sell_value: 0, npc_buy_value: 0 },
  factions: 1,
  active_facilities: 1,
  inflation_7d: { composite_pct: 1.84, basket_items: 12, by_category: {} },
  trade_authenticators: { reserve: 600, in_circulation: 0, window_sell_price: 1000, window_buy_price: 900 },
}

describe('inBrief', () => {
  it('states supply, creation, the biggest source and drain, and prices', () => {
    expect(inBrief(summarize(TWO), CURRENT)).toEqual([
      'The money supply grew 0.80% over 3 days, to 1.01K credits. Players hold 63% of it.',
      'The game created 90 new credits and destroyed 35, a net +55.',
      'Biggest source of new credits: dev team grants (45). Biggest drain: facility labor (25).',
      'Traded prices were 1.8% higher than a week earlier.',
    ])
  })

  it('skips the price line without a basket and says when supply did not move', () => {
    const lines = inBrief(summarize([day('2026-09-01')]), { ...CURRENT, inflation_7d: { composite_pct: 0, basket_items: 0, by_category: {} } })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toStartWith('The money supply held steady at 1K credits.')
  })
})

describe('headlines', () => {
  it('trade: names the biggest side and the player-to-player share', () => {
    expect(tradeHeadline(summarize(TWO).trade)).toBe('Most market trade is players selling to NPC stations; 30% is between players')
    expect(tradeHeadline({ p2p: 60, sold: 30, bought: 10, direct: 0, total: 100 })).toBe('Most market trade is between players (60%)')
    expect(tradeHeadline({ p2p: 0, sold: 0, bought: 0, direct: 0, total: 0 })).toBe('No market trade in this period')
  })

  it('prices: picks the index furthest from 100', () => {
    expect(priceHeadline({ ore: 111.8, refined: 128.87, component: null }, ['ore', 'refined'])).toBe('Refined goods cost 28.9% more than in the base week')
    expect(priceHeadline({ ore: 94, refined: null, component: null }, ['ore'])).toBe('Ore costs 6.0% less than in the base week')
    expect(priceHeadline({ ore: null, refined: null, component: null }, [])).toBe('Not enough trade to price the basket yet')
  })

  it('flow caption: the biggest day, calling out dev team money', () => {
    expect(flowCaption(TWO)).toBe('The biggest day was Sep 2, with 55 created, including 45 the dev team handed out.')
    expect(flowCaption([TWO[0]])).toBe('The biggest day was Sep 1, with 35 created.')
    expect(flowCaption([])).toBeNull()
  })
})

describe('number formatting', () => {
  it('compact keeps 3 significant digits and a true minus sign', () => {
    expect(compact(8_048_251_090)).toBe('8.05B')
    expect(compact(-1_950_000)).toBe('\u22121.95M')
    expect(signed(48_400_000)).toBe('+48.4M')
    expect(signed(0)).toBe('0')
  })

  it('niceCeil and ticksFor give round axis ticks', () => {
    expect(niceCeil(2.65e6)).toBe(5e6)
    expect(niceCeil(1.7)).toBe(2)
    expect(niceCeil(100)).toBe(100)
    expect(ticksFor(-18.7e6, 43.4e6, 3)).toEqual([-25e6, 0, 25e6, 50e6])
  })
})

describe('calendar', () => {
  it('fills a missing day with null so charts show a gap', () => {
    const cal = calendar([day('2026-09-29'), day('2026-10-02')])
    expect(cal.map((c) => c.date)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(cal.map((c) => c.day === null)).toEqual([false, true, true, false])
  })

  it('is empty for no days', () => {
    expect(calendar([])).toEqual([])
  })
})

describe('chartRows', () => {
  it('plots sinks below the axis, derives net, and keeps missing days and null indices null', () => {
    const rows = chartRows([
      day('2026-09-01', {
        faucets: { ...day('x').faucets, total: 30 },
        sinks: { ...day('x').sinks, total: 12 },
        price_index: { ore: 101, refined: null, component: null },
      }),
      day('2026-09-03'),
    ])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ faucets: 30, sinks: -12, net: 18, ore: 101, refined: null })
    expect(Object.entries(rows[1]).filter(([k, v]) => k !== 'date' && v !== null)).toEqual([])
  })
})

describe('helpers', () => {
  it('lastDays takes the tail, or everything when short', () => {
    const days = [day('a'), day('b'), day('c')]
    expect(lastDays(days, 2).map((d) => d.date)).toEqual(['b', 'c'])
    expect(lastDays(days, 30)).toHaveLength(3)
  })

  it('indexedCategories drops a category that is null every day', () => {
    const days = [day('2026-09-01', { price_index: { ore: 100, refined: null, component: null } }),
      day('2026-09-02', { price_index: { ore: 101, refined: 99, component: null } })]
    expect(indexedCategories(days)).toEqual(['ore', 'refined'])
  })

  it('formats dates in UTC', () => {
    expect(dayLabel('2026-09-01')).toBe('Sep 1')
    expect(utcDateTime('2026-09-24T23:55:00Z')).toBe('Sep 24, 2026, 23:55 UTC')
  })

  it('signs percentages and never prints -0.0', () => {
    expect(signedPct(1.84)).toBe('+1.8%')
    expect(signedPct(-1.2)).toBe('\u22121.2%')
    expect(signedPct(-0.01)).toBe('0.0%')
  })
})

describe('trade authenticators', () => {
  // Reserve 1000 -> 800, circulation 5000 -> 5500 over 2 entries covering 3 days.
  const BONDS = [
    day('2026-09-01', {
      trade_authenticators: bond({
        reserve: 1000, in_circulation: 5000, minted: 100, burned: 20, used_in_shipbuilding: 5,
        window_sold_to_players: { units: 80, credits: 80_000 },
        window_sold_to_stations: { units: 10, credits: 10_000 },
        players_to_stations: { units: 50, credits: 60_000 },
      }),
    }),
    day('2026-09-03', {
      period_days: 2,
      trade_authenticators: bond({
        reserve: 800, in_circulation: 5500, minted: 50, burned: 10,
        window_sold_to_players: { units: 210, credits: 210_000 },
        window_bought_back: { units: 4, credits: 3_600 },
        players_to_stations: { units: 50, credits: 64_000 },
      }),
    }),
  ]
  const b = bondSummary(BONDS, { reserve: 600, in_circulation: 5600, window_sell_price: 1000, window_buy_price: 900 })

  it('sums minting, window sales and use', () => {
    expect(b.minted).toBe(150)
    expect(b.sold).toBe(300)
    expect(b.used).toBe(35)
    expect(b.boughtBack).toBe(4)
  })

  it('days of cover: current reserve over average daily window sales across period_days', () => {
    expect(b.soldPerDay).toBe(100)
    expect(b.coverDays).toBe(6)
  })

  it('stock changes compare the first and last day', () => {
    expect(b.reserveChangePct).toBe(-20)
    expect(b.circulationChange).toBe(500)
    expect(b.circulationChangePct).toBe(10)
  })

  it('one day of circulation is no history: no change is claimed', () => {
    const one = bondSummary([{ ...BONDS[0], trade_authenticators: { ...BONDS[0].trade_authenticators, in_circulation: null } }, BONDS[1]], { reserve: 600, in_circulation: 5600, window_sell_price: 1000, window_buy_price: 900 })
    expect(one.circulationFrom).toBe('2026-09-03')
    expect(one.circulationChange).toBeNull()
    expect(one.circulationChangePct).toBeNull()
  })

  it('station price is volume-weighted over the span, and its premium over the window price', () => {
    expect(b.stationPrice).toBe(1240)
    expect(b.premium).toBe(1.24)
    expect(b.segments.find((x) => x.key === 'player_to_player')?.avg).toBeNull()
  })

  it('has no cover without sales and no premium with the window closed', () => {
    const quiet = bondSummary([day('2026-09-01')], { reserve: 10, in_circulation: 0, window_sell_price: 0, window_buy_price: 0 })
    expect(quiet.coverDays).toBeNull()
    expect(quiet.premium).toBeNull()
  })

  it('avgPrice guards zero units', () => {
    expect(avgPrice({ units: 0, credits: 0 })).toBeNull()
    expect(avgPrice({ units: 4, credits: 3_600 })).toBe(900)
  })

  it('chart rows: used plots below the axis, closed window and untraded segments are gaps', () => {
    const rows = chartRows([day('2026-09-01', {
      trade_authenticators: bond({ minted: 7, burned: 3, used_in_shipbuilding: 2, window_buy_price: 0, player_to_player: { units: 2, credits: 2_200 } }),
    })])
    expect(rows[0]).toMatchObject({ bMinted: 7, bUsed: -5, bWindowSell: 1000, bWindowBuy: null, bP2P: 1100, bP2S: null })
  })

  it('headline leads with a moving reserve, else the station premium', () => {
    expect(bondHeadline(b, '2026-09-01')).toBe('The reserve fell 20% since Sep 1; circulation grew 10%')
    expect(bondHeadline({ ...b, circulationFrom: '2026-09-03' }, '2026-09-01')).toBe('The reserve fell 20% since Sep 1; circulation grew 10% since Sep 3')
    expect(bondHeadline({ ...b, reserveChangePct: 3 }, '2026-09-01')).toBe('Stations pay 1.24× the window price; the reserve is steady')
    expect(bondHeadline({ ...b, reserveChangePct: null, premium: null }, '2026-09-01')).toBe('The reserve is steady')
    // No circulation history: say nothing about its trend.
    expect(bondHeadline({ ...b, circulationChangePct: null }, '2026-09-01')).toBe('The reserve fell 20% since Sep 1')
  })
})

describe('summary-only days (before detailed accounting)', () => {
  const summaryOnly = (date: string, over: Partial<EconomyDay> = {}) => day(date, {
    faucets: null,
    sinks: null,
    supply_change: { change: 30, unattributed: null },
    trade_authenticators: bond({ reserve: 900, in_circulation: null, burned: null, used_in_shipbuilding: null, window_sell_price: 990, window_buy_price: null }),
    ...over,
  })
  const MIXED = [summaryOnly('2026-08-31'), ...TWO]

  it('finds the last summary-only day', () => {
    expect(summaryOnlyUntil(MIXED)).toBe('2026-08-31')
    expect(summaryOnlyUntil(TWO)).toBeNull()
  })

  it('created, destroyed and the gap cover only detailed days; supply change covers all', () => {
    const s = summarize(MIXED)
    const d = summarize(TWO)
    expect(s.partial).toBe(true)
    expect(s.detailedFrom).toBe('2026-09-01')
    expect(s.detailedDays).toBe(3)
    expect(s.days).toBe(4)
    expect([s.created, s.destroyed, s.net, s.gap, s.gapPct]).toEqual([d.created, d.destroyed, d.net, d.gap, d.gapPct])
    expect(s.detailedChange).toBe(d.change)
    expect(s.change).toBe(d.change + 30)
    expect(s.faucets).toEqual(d.faucets)
  })

  it('in brief says when the flow totals start', () => {
    expect(inBrief(summarize(MIXED), CURRENT)[1]).toBe(
      'Since detailed accounting began on Sep 1, the game created 90 new credits and destroyed 35, a net +55.',
    )
    expect(inBrief(summarize([summaryOnly('2026-08-31')]), CURRENT)).toHaveLength(2)
    expect(flowCaption([summaryOnly('2026-08-31')])).toBeNull()
  })

  it('chart rows leave the missing figures as gaps', () => {
    expect(chartRows([summaryOnly('2026-08-31')])[0]).toMatchObject({
      faucets: null, sinks: null, net: null, unattributed: null, dev: null,
      bUsed: null, bCirculating: null, bReserve: 900, bWindowSell: 990, bWindowBuy: null,
    })
  })

  it('authenticator circulation change starts at the first counted day', () => {
    const b = bondSummary([
      summaryOnly('2026-08-31'),
      day('2026-09-01', { trade_authenticators: bond({ in_circulation: 100, burned: 4, used_in_shipbuilding: 1 }) }),
      day('2026-09-02', { trade_authenticators: bond({ in_circulation: 130 }) }),
    ], { reserve: 0, in_circulation: 130, window_sell_price: 1000, window_buy_price: 900 })
    expect(b.circulationFrom).toBe('2026-09-01')
    expect(b.circulationChange).toBe(30)
    expect(b.used).toBe(5)
  })
})

describe('trade record coverage', () => {
  it('warns when the span starts before complete trade records, with no detailed day needed', () => {
    expect(tradeGapNote('2026-09-25', '2026-09-01')).toBe(
      'Before Sep 25, trades that matched the moment an order was placed were not recorded, so figures for those days leave some trades out.',
    )
  })
  it('says nothing once the span starts on or after the coverage date', () => {
    expect(tradeGapNote('2026-09-25', '2026-09-25')).toBeNull()
    expect(tradeGapNote('2026-09-25', '2026-10-01')).toBeNull()
  })
  it('warns without a date before any complete day exists', () => {
    expect(tradeGapNote('', '2026-09-01')).toBe(
      'Trades that matched the moment an order was placed are not yet recorded, so these figures leave some trades out.',
    )
  })
})
