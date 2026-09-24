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
  dev_team: 'Dev team grants',
  other: 'Old passenger fares',
}

export const SINK_LABELS: Record<Exclude<keyof EconomySinks, 'total'>, string> = {
  shipbuilding: 'Shipbuilding labor',
  labor: 'Facility labor',
  station_facilities: 'Station facility builds',
  station_founding: 'Station founding',
  war_declarations: 'War declarations',
  penalties: 'Penalties & fees',
  dev_team: 'Dev team removals',
}

export interface Holder {
  label: string
  /** What the account is, in plain words. */
  note: string
  value: number
  side: 'player' | 'npc'
}

/** current.money_supply as labelled rows, player side first. */
export function holders(ms: EconomyMoneySupply): Holder[] {
  return [
    { label: 'Player wallets', note: 'credits players carry', value: ms.player_wallets, side: 'player' },
    { label: 'Faction treasuries', note: 'shared funds of player groups', value: ms.faction_treasuries, side: 'player' },
    { label: 'Player buy orders', note: 'locked in open bids on the market', value: ms.player_order_escrow, side: 'player' },
    { label: 'Station managers', note: 'run the NPC station markets', value: ms.station_managers, side: 'npc' },
    { label: 'Empire treasuries', note: 'collect taxes and fines', value: ms.empire_treasuries, side: 'npc' },
    { label: 'NPC buy orders', note: 'locked in open NPC bids on the market', value: ms.npc_order_escrow, side: 'npc' },
    { label: 'Citizen pools', note: 'earned from station labor, spent on citizens\' travel', value: ms.citizen_pools, side: 'npc' },
    { label: 'Ship insurer', note: 'premiums received minus claims paid', value: ms.insurer, side: 'npc' },
    { label: 'Other NPCs', note: 'the pirate fleet and prize money awaiting payout', value: ms.other_npc, side: 'npc' },
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

/** Player exchange volume for one day: the three series the trade chart stacks. */
export function exchangeVolume(t: EconomyTrade): number {
  return t.player_to_player + t.players_sold_to_npc + t.players_bought_from_npc
}

/**
 * Everything the page says about one span of days. Every period figure on the
 * page comes from here, so they all cover the same days. The first day's
 * flows start at the previous day's last snapshot, so the span's supply change
 * runs from `supplyStart` (the supply just before `from`) to `supplyEnd`.
 */
export function summarize(days: EconomyDay[]) {
  const sum = (f: (d: EconomyDay) => number) => days.reduce((s, d) => s + f(d), 0)
  const created = sum((d) => d.faucets.total)
  const destroyed = sum((d) => d.sinks.total)
  const change = sum((d) => d.supply_change.change)
  const gap = sum((d) => d.supply_change.unattributed)
  const net = created - destroyed
  const supplyEnd = days.at(-1)?.supply_total ?? 0
  const supplyStart = supplyEnd - change
  return {
    from: days[0]?.date ?? '',
    to: days.at(-1)?.date ?? '',
    days: sum((d) => d.period_days),
    faucets: sumBy(days.map((d) => d.faucets), FAUCET_LABELS),
    sinks: sumBy(days.map((d) => d.sinks), SINK_LABELS),
    created,
    destroyed,
    net,
    change,
    /** change − net: credits the counters do not explain. */
    gap,
    /** |gap| as a percentage of |net|; null when net is 0. */
    gapPct: net ? Math.abs(gap / net) * 100 : null,
    supplyStart,
    supplyEnd,
    changePct: supplyStart ? (change / supplyStart) * 100 : 0,
    trade: {
      p2p: sum((d) => d.trade.player_to_player),
      sold: sum((d) => d.trade.players_sold_to_npc),
      bought: sum((d) => d.trade.players_bought_from_npc),
      direct: sum((d) => d.trade.direct_trades),
      total: sum((d) => exchangeVolume(d.trade)),
    },
    taxes: sum((d) => d.taxes_and_fines),
  }
}

export type Summary = ReturnType<typeof summarize>

const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 }).format

/** 3 significant digits (8.05B, 242M) with a true minus sign. formatCompact's one decimal turns 8.048B into "8B". */
export function compact(n: number): string {
  return `${n < 0 ? '\u2212' : ''}${compactFmt(Math.abs(n))}`
}

/** compact() with an explicit sign: "+48.4M", "−1.95M", "0". */
export function signed(n: number): string {
  return `${n > 0 ? '+' : ''}${compact(n)}`
}

export const INDEX_NAME = { ore: 'Ore', refined: 'Refined goods', component: 'Components' } as const

/** The "In brief" bullets: the page's findings in plain sentences. */
export function inBrief(s: Summary, current: EconomyCurrent): string[] {
  const out: string[] = []
  const pct = Math.abs(s.changePct).toFixed(2)
  const share = current.money_supply.total ? (playerHeld(current.money_supply) / current.money_supply.total) * 100 : 0
  out.push(
    `${pct === '0.00' ? `The money supply held steady at ${compact(s.supplyEnd)} credits` : `The money supply ${s.change > 0 ? 'grew' : 'shrank'} ${pct}% over ${s.days} days, to ${compact(s.supplyEnd)} credits`}. Players hold ${share.toFixed(0)}% of it.`,
  )
  out.push(`The game created ${compact(s.created)} new credits and destroyed ${compact(s.destroyed)}, a net ${signed(s.net)}.`)
  const [source, drain] = [s.faucets[0], s.sinks[0]]
  if (source && drain && source.value > 0 && drain.value > 0) {
    out.push(`Biggest source of new credits: ${source.label.toLowerCase()} (${compact(source.value)}). Biggest drain: ${drain.label.toLowerCase()} (${compact(drain.value)}).`)
  }
  const inf = current.inflation_7d
  if (inf.basket_items > 0) {
    const p = Math.abs(inf.composite_pct).toFixed(1)
    out.push(p === '0.0' ? 'Traded prices were flat against a week earlier.' : `Traded prices were ${p}% ${inf.composite_pct > 0 ? 'higher' : 'lower'} than a week earlier.`)
  }
  return out
}

/** Chapter title for trade: which side dominates, and the player-to-player share. */
export function tradeHeadline(t: Summary['trade']): string {
  if (t.total === 0) return 'No market trade in this period'
  const p2pPct = Math.round((t.p2p / t.total) * 100)
  if (t.p2p >= t.sold && t.p2p >= t.bought) return `Most market trade is between players (${p2pPct}%)`
  const side = t.sold >= t.bought ? 'players selling to NPC stations' : 'players buying from NPC stations'
  return `Most market trade is ${side}; ${p2pPct}% is between players`
}

/** Chapter title for prices: the index furthest from 100 on the last day. */
export function priceHeadline(last: EconomyPriceIndex, cats: (keyof EconomyPriceIndex)[]): string {
  const k = cats.filter((c) => last[c] !== null).sort((a, b) => Math.abs(last[b]! - 100) - Math.abs(last[a]! - 100))[0]
  if (!k) return 'Not enough trade to price the basket yet'
  const d = last[k]! - 100
  const verb = k === 'ore' ? 'costs' : 'cost'
  if (Math.abs(d) < 0.05) return `${INDEX_NAME[k]} ${verb} the same as in the base week`
  return `${INDEX_NAME[k]} ${verb} ${Math.abs(d).toFixed(1)}% ${d > 0 ? 'more' : 'less'} than in the base week`
}

/** Caption under the created/destroyed chart: the biggest day, and any dev-team money in it. */
export function flowCaption(days: EconomyDay[]): string | null {
  const top = days.reduce<EconomyDay | null>((m, d) => (!m || d.faucets.total > m.faucets.total ? d : m), null)
  if (!top || top.faucets.total === 0) return null
  const head = `The biggest day was ${dayLabel(top.date)}, with ${compact(top.faucets.total)} created`
  return top.faucets.dev_team > 0
    ? `${head}, including ${compact(top.faucets.dev_team)} the dev team handed out.`
    : `${head}.`
}

/** The next "round" number at or above n: 1, 2, 2.5 or 5 times a power of ten. */
export function niceCeil(n: number): number {
  if (n <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(n))
  const m = n / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p
}

/** Round axis ticks covering [min, max] (min ≤ 0 ≤ max) in about `target` steps. */
export function ticksFor(min: number, max: number, target: number): number[] {
  const step = niceCeil((max - min) / target || 1)
  const out: number[] = []
  for (let t = Math.floor(min / step) * step; t <= Math.ceil(max / step) * step + step / 2; t += step) out.push(t)
  return out
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
  /** Money supply at the day's end minus the supply just before the first day. */
  supply: number | null
  total: number | null
  players: number | null
  npc: number | null
  faucets: number | null
  /** Negative: sinks plot below the axis. */
  sinks: number | null
  net: number | null
  change: number | null
  unattributed: number | null
  /** Credits the dev team added or removed that day. */
  dev: number | null
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
  const start = days.length ? days[0].supply_total - days[0].supply_change.change : 0
  return calendar(days).map(({ date, day: d }) => ({
    date,
    period: d?.period_days ?? null,
    supply: d ? d.supply_total - start : null,
    total: d?.supply_total ?? null,
    players: d?.supply_players ?? null,
    npc: d?.supply_npc ?? null,
    faucets: d?.faucets.total ?? null,
    sinks: d ? -d.sinks.total : null,
    net: d ? d.faucets.total - d.sinks.total : null,
    change: d?.supply_change.change ?? null,
    unattributed: d?.supply_change.unattributed ?? null,
    dev: d ? d.faucets.dev_team + d.sinks.dev_team : null,
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

/** "+1.8%" / "−0.4%" / "0.0%". */
export function signedPct(n: number, digits = 1): string {
  const r = Number(n.toFixed(digits)) || 0 // || 0 folds -0 into 0
  return `${r > 0 ? '+' : r < 0 ? '\u2212' : ''}${Math.abs(r).toFixed(digits)}%`
}
