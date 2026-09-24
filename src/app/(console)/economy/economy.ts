// Types and pure transforms for /economy. The report comes from the
// gameserver's GET /api/economy (internal/models/economy_report.go there;
// field definitions in internal/openapi/economy.go).

export interface EconomyMoneySupply {
  total: number
  player_wallets: number
  player_order_escrow: number
  faction_treasuries: number
  station_managers: number
  empire_treasuries: number
  citizen_pools: number
  npc_order_escrow: number
  insurer: number
  other_npc: number
}

export interface EconomyCurrent {
  captured_at: string
  money_supply: EconomyMoneySupply
  players: { registered: number; active_24h: number; median_wallet: number; top_10pct_share: number }
  exchange: {
    player_sell_orders: number
    player_sell_value: number
    player_buy_orders: number
    player_buy_value: number
    npc_sell_value: number
    npc_buy_value: number
  }
  factions: number
  active_facilities: number
  inflation_7d: { composite_pct: number; basket_items: number; by_category: Record<string, number> }
}

export interface EconomyFaucets {
  new_players: number
  respawns: number
  missions: number
  pirate_bounties: number
  achievements: number
  freight_insurance: number
  npc_seeding: number
  dev_team: number
  other: number
  total: number
}

export interface EconomySinks {
  labor: number
  station_founding: number
  shipbuilding: number
  station_facilities: number
  war_declarations: number
  penalties: number
  dev_team: number
  total: number
}

export interface EconomyTrade {
  player_to_player: number
  players_sold_to_npc: number
  players_bought_from_npc: number
  direct_trades: number
  fills: number
}

/** Fixed-basket indices, 100 = base period. null = no base-period trades. */
export interface EconomyPriceIndex {
  ore: number | null
  refined: number | null
  component: number | null
}

export interface EconomyDay {
  date: string
  /** Days the flow figures cover; more than 1 after a gap in snapshots. */
  period_days: number
  supply_total: number
  supply_players: number
  supply_npc: number
  supply_change: { change: number; unattributed: number }
  faucets: EconomyFaucets
  sinks: EconomySinks
  trade: EconomyTrade
  taxes_and_fines: number
  active_players: number
  ore_mined: number
  items_crafted: number
  price_index: EconomyPriceIndex
}

export interface EconomyReport {
  generated_at: string
  series_start: string
  price_index_base_start: string
  price_index_base_end: string
  current: EconomyCurrent
  days: EconomyDay[]
  top_categories: { category: string; notional: number; units: number; share_pct: number }[]
}

export const FAUCET_LABELS: Record<Exclude<keyof EconomyFaucets, 'total'>, string> = {
  missions: 'Missions with no treasury',
  pirate_bounties: 'Pirate bounties',
  new_players: 'New player grants',
  respawns: 'Respawn top-ups',
  achievements: 'Achievements',
  freight_insurance: 'Freight insurance',
  npc_seeding: 'NPC seed capital',
  dev_team: 'DevTeam grants',
  other: 'Legacy fares',
}

export const SINK_LABELS: Record<Exclude<keyof EconomySinks, 'total'>, string> = {
  shipbuilding: 'Shipbuilding labor',
  labor: 'Facility labor',
  station_facilities: 'Station facility builds',
  station_founding: 'Station founding',
  war_declarations: 'War declarations',
  penalties: 'Penalties & fees',
  dev_team: 'DevTeam removals',
}

export interface Holder {
  label: string
  value: number
  side: 'player' | 'npc'
}

/** current.money_supply as labelled rows, player side first. */
export function holders(ms: EconomyMoneySupply): Holder[] {
  return [
    { label: 'Player wallets', value: ms.player_wallets, side: 'player' },
    { label: 'Faction treasuries', value: ms.faction_treasuries, side: 'player' },
    { label: 'Player buy orders', value: ms.player_order_escrow, side: 'player' },
    { label: 'Station managers', value: ms.station_managers, side: 'npc' },
    { label: 'Empire treasuries', value: ms.empire_treasuries, side: 'npc' },
    { label: 'NPC buy orders', value: ms.npc_order_escrow, side: 'npc' },
    { label: 'Citizen pools', value: ms.citizen_pools, side: 'npc' },
    { label: 'Ship insurer', value: ms.insurer, side: 'npc' },
    { label: 'Other NPCs', value: ms.other_npc, side: 'npc' },
  ]
}

export function playerHeld(ms: EconomyMoneySupply): number {
  return ms.player_wallets + ms.player_order_escrow + ms.faction_treasuries
}

/** The last `n` days (all of them when the series is shorter). */
export function lastDays(days: EconomyDay[], n: number): EconomyDay[] {
  return days.slice(Math.max(0, days.length - n))
}

export interface LabelledValue {
  key: string
  label: string
  value: number
}

function sumBy<K extends string>(rows: Record<K, number>[], labels: Record<K, string>): LabelledValue[] {
  return (Object.keys(labels) as K[])
    .map((key) => ({ key, label: labels[key], value: rows.reduce((s, r) => s + r[key], 0) }))
    .sort((a, b) => b.value - a.value)
}

/** Faucet and sink totals by category over `days`, largest first, plus the reconciliation. */
export function flowTotals(days: EconomyDay[]) {
  const sum = (f: (d: EconomyDay) => number) => days.reduce((s, d) => s + f(d), 0)
  return {
    faucets: sumBy(days.map((d) => d.faucets), FAUCET_LABELS),
    sinks: sumBy(days.map((d) => d.sinks), SINK_LABELS),
    created: sum((d) => d.faucets.total),
    destroyed: sum((d) => d.sinks.total),
    change: sum((d) => d.supply_change.change),
    unattributed: sum((d) => d.supply_change.unattributed),
  }
}

/** Player exchange volume for one day: the three series the trade chart stacks. */
export function exchangeVolume(t: EconomyTrade): number {
  return t.player_to_player + t.players_sold_to_npc + t.players_bought_from_npc
}

/**
 * Money-supply change from the day `n` days before the last one (or the first
 * day, if the series is shorter) to the last day. null with fewer than 2 days.
 */
export function supplyChange(days: EconomyDay[], n: number) {
  if (days.length < 2) return null
  const last = days[days.length - 1]
  const from = days[Math.max(0, days.length - 1 - n)]
  const delta = last.supply_total - from.supply_total
  return { from: from.date, delta, pct: from.supply_total ? (delta / from.supply_total) * 100 : 0 }
}

/**
 * One entry per calendar day from the first to the last report day. A day the
 * server has no snapshot for is null, so charts show a gap instead of packing
 * the neighbours together.
 */
export function calendar(days: EconomyDay[]): { date: string; day: EconomyDay | null }[] {
  if (days.length === 0) return []
  const byDate = new Map(days.map((d) => [d.date, d]))
  const out: { date: string; day: EconomyDay | null }[] = []
  const end = Date.parse(`${days[days.length - 1].date}T00:00:00Z`)
  for (let t = Date.parse(`${days[0].date}T00:00:00Z`); t <= end; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10)
    out.push({ date, day: byDate.get(date) ?? null })
  }
  return out
}

export interface ChartRow {
  date: string
  /** Days the flow figures cover; more than 1 right after a gap. */
  period: number | null
  players: number | null
  npc: number | null
  faucets: number | null
  /** Negative: sinks plot below the axis. */
  sinks: number | null
  net: number | null
  change: number | null
  unattributed: number | null
  p2p: number | null
  sold: number | null
  bought: number | null
  direct: number | null
  taxes: number | null
  active: number | null
  mined: number | null
  crafted: number | null
  ore: number | null
  refined: number | null
  component: number | null
}

/** One flat, serialisable row per calendar day for the client charts; null on missing days. */
export function chartRows(days: EconomyDay[]): ChartRow[] {
  return calendar(days).map(({ date, day: d }) => ({
    date,
    period: d?.period_days ?? null,
    players: d?.supply_players ?? null,
    npc: d?.supply_npc ?? null,
    faucets: d?.faucets.total ?? null,
    sinks: d ? -d.sinks.total : null,
    net: d ? d.faucets.total - d.sinks.total : null,
    change: d?.supply_change.change ?? null,
    unattributed: d?.supply_change.unattributed ?? null,
    p2p: d?.trade.player_to_player ?? null,
    sold: d?.trade.players_sold_to_npc ?? null,
    bought: d?.trade.players_bought_from_npc ?? null,
    direct: d?.trade.direct_trades ?? null,
    taxes: d?.taxes_and_fines ?? null,
    active: d?.active_players ?? null,
    mined: d?.ore_mined ?? null,
    crafted: d?.items_crafted ?? null,
    ore: d?.price_index.ore ?? null,
    refined: d?.price_index.refined ?? null,
    component: d?.price_index.component ?? null,
  }))
}

/** Price-index categories that have at least one value in the series. */
export function indexedCategories(days: EconomyDay[]): (keyof EconomyPriceIndex)[] {
  return (['ore', 'refined', 'component'] as const).filter((k) => days.some((d) => d.price_index[k] !== null))
}

/** "Sep 23" for a YYYY-MM-DD UTC date, in UTC so no viewer sees the day before. */
export function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** "Sep 24, 2026, 23:55 UTC". */
export function utcDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
  })} UTC`
}

/** "+1.8%" / "-0.4%" / "0.0%". */
export function signedPct(n: number, digits = 1): string {
  const r = Number(n.toFixed(digits)) || 0 // || 0 folds -0 into 0
  return `${r > 0 ? '+' : ''}${r.toFixed(digits)}%`
}
