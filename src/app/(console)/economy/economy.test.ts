import { describe, it, expect } from 'bun:test'
import {
  calendar, chartRows, dayLabel, flowTotals, holders, indexedCategories, lastDays, playerHeld, signedPct,
  supplyChange, utcDateTime, type EconomyDay, type EconomyMoneySupply,
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

describe('flowTotals', () => {
  it('sums each category and keeps unattributed separate from faucets and sinks', () => {
    const days = [
      day('2026-09-01', {
        faucets: { ...day('x').faucets, missions: 30, respawns: 5, total: 35 },
        sinks: { ...day('x').sinks, shipbuilding: 10, total: 10 },
        supply_change: { change: 20, unattributed: -5 },
      }),
      day('2026-09-02', {
        faucets: { ...day('x').faucets, missions: 10, total: 10 },
        sinks: { ...day('x').sinks, labor: 25, total: 25 },
        supply_change: { change: -12, unattributed: 3 },
      }),
    ]
    const t = flowTotals(days)
    expect(t.created).toBe(45)
    expect(t.destroyed).toBe(35)
    expect(t.change).toBe(8)
    expect(t.unattributed).toBe(-2)
    expect(t.change - (t.created - t.destroyed)).toBe(t.unattributed)
    expect(t.faucets[0]).toEqual({ key: 'missions', label: 'Missions with no treasury', value: 40 })
    expect(t.sinks.map((s) => s.key).slice(0, 2)).toEqual(['labor', 'shipbuilding'])
  })
})

describe('supplyChange', () => {
  it('compares the last day with the day n days before it', () => {
    const days = [day('2026-09-01', { supply_total: 900 }), day('2026-09-02', { supply_total: 950 }), day('2026-09-03', { supply_total: 1000 })]
    expect(supplyChange(days, 1)).toEqual({ from: '2026-09-02', delta: 50, pct: (50 / 950) * 100 })
  })

  it('falls back to the first day when the series is shorter than n', () => {
    const days = [day('2026-09-01', { supply_total: 800 }), day('2026-09-02', { supply_total: 1000 })]
    expect(supplyChange(days, 30)?.from).toBe('2026-09-01')
    expect(supplyChange(days, 30)?.pct).toBe(25)
  })

  it('is null with fewer than two days', () => {
    expect(supplyChange([day('2026-09-01')], 30)).toBeNull()
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
    expect(signedPct(-1.2)).toBe('-1.2%')
    expect(signedPct(-0.01)).toBe('0.0%')
  })
})
