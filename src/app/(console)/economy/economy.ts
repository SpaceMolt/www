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
  trade_authenticators: EconomyBondStock
}

/** Trade authenticators: counts are items, prices credits. A 0 price means that window side is off. */
export interface EconomyBondStock {
  reserve: number
  in_circulation: number
  window_sell_price: number
  window_buy_price: number
}

/** One segment of authenticator trade. Average price = credits ÷ units. */
export interface EconomyBondTrades {
  units: number
  credits: number
}

/**
 * On summary-only days (before detailed accounting) in_circulation, burned and
 * used_in_shipbuilding are null, and the window prices are the average price
 * of that day's window trades (null with none).
 */
export interface EconomyBondDay {
  reserve: number
  in_circulation: number | null
  window_sell_price: number | null
  window_buy_price: number | null
  minted: number
  burned: number | null
  used_in_shipbuilding: number | null
  window_sold_to_players: EconomyBondTrades
  window_sold_to_stations: EconomyBondTrades
  window_bought_back: EconomyBondTrades
  players_to_stations: EconomyBondTrades
  stations_to_players: EconomyBondTrades
  player_to_player: EconomyBondTrades
  station_to_station: EconomyBondTrades
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
  /** unattributed, faucets and sinks are null on summary-only days, before detailed accounting. */
  supply_change: { change: number; unattributed: number | null }
  faucets: EconomyFaucets | null
  sinks: EconomySinks | null
  trade: EconomyTrade
  taxes_and_fines: number
  /** Players who issued a command in the previous 24h. Null before detailed accounting. */
  active_players: number | null
  ore_mined: number
  items_crafted: number
  price_index: EconomyPriceIndex
  trade_authenticators: EconomyBondDay
}

export interface EconomyReport {
  generated_at: string
  series_start: string
  price_index_base_start: string
  price_index_base_end: string
  /** First day with detailed accounting (faucets, sinks, authenticator use); "" or absent when there is none. */
  detailed_accounting_since?: string
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

type DetailedDay = EconomyDay & { faucets: EconomyFaucets; sinks: EconomySinks }

/** False on summary-only days, before detailed accounting: no faucets, sinks or gap. */
export function isDetailed(d: EconomyDay): d is DetailedDay {
  return d.faucets !== null && d.sinks !== null
}

/** The last summary-only day in `days`, or null when every day is detailed. */
export function summaryOnlyUntil(days: EconomyDay[]): string | null {
  return days.filter((d) => !isDetailed(d)).at(-1)?.date ?? null
}

/**
 * Everything the page says about one span of days. Every period figure on the
 * page comes from here, so they all cover the same days. The first day's
 * flows start at the previous day's last snapshot, so the span's supply change
 * runs from `supplyStart` (the supply just before `from`) to `supplyEnd`.
 *
 * Created, destroyed and the gap exist only on detailed days, so they (and the
 * supply change they reconcile against, `detailedChange`) cover only those.
 */
export function summarize(days: EconomyDay[]) {
  const sum = (f: (d: EconomyDay) => number) => days.reduce((s, d) => s + f(d), 0)
  const detailed = days.filter(isDetailed)
  const dsum = (f: (d: DetailedDay) => number) => detailed.reduce((s, d) => s + f(d), 0)
  const created = dsum((d) => d.faucets.total)
  const destroyed = dsum((d) => d.sinks.total)
  const change = sum((d) => d.supply_change.change)
  const gap = dsum((d) => d.supply_change.unattributed ?? 0)
  const net = created - destroyed
  const supplyEnd = days.at(-1)?.supply_total ?? 0
  const supplyStart = supplyEnd - change
  return {
    from: days[0]?.date ?? '',
    to: days.at(-1)?.date ?? '',
    days: sum((d) => d.period_days),
    /** First detailed day, and the days the detailed figures cover. */
    detailedFrom: detailed[0]?.date ?? null,
    detailedDays: dsum((d) => d.period_days),
    /** True when some days in the span are summary-only. */
    partial: detailed.length < days.length,
    faucets: sumBy(detailed.map((d) => d.faucets), FAUCET_LABELS),
    sinks: sumBy(detailed.map((d) => d.sinks), SINK_LABELS),
    created,
    destroyed,
    net,
    change,
    detailedChange: dsum((d) => d.supply_change.change),
    /** detailedChange − net: credits the counters do not explain. */
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
  if (s.detailedFrom) {
    const lead = s.partial ? `Since detailed accounting began on ${dayLabel(s.detailedFrom)}, the game` : 'The game'
    out.push(`${lead} created ${compact(s.created)} new credits and destroyed ${compact(s.destroyed)}, a net ${signed(s.net)}.`)
  }
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
  const top = days.filter(isDetailed).reduce<DetailedDay | null>((m, d) => (!m || d.faucets.total > m.faucets.total ? d : m), null)
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
  /** Trade authenticators: units minted, sold by the window, and used up (negative). */
  bMinted: number | null
  bSold: number | null
  bUsed: number | null
  bReserve: number | null
  bCirculating: number | null
  /** Window prices; null when that side is off. */
  bWindowSell: number | null
  bWindowBuy: number | null
  /** Average price per segment; null on days it did not trade. */
  bP2S: number | null
  bS2P: number | null
  bP2P: number | null
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
    faucets: d?.faucets?.total ?? null,
    sinks: d?.sinks ? -d.sinks.total : null,
    net: d?.faucets && d.sinks ? d.faucets.total - d.sinks.total : null,
    change: d?.supply_change.change ?? null,
    unattributed: d?.supply_change.unattributed ?? null,
    dev: d?.faucets && d.sinks ? d.faucets.dev_team + d.sinks.dev_team : null,
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
    ...bondRow(d?.trade_authenticators),
  }))
}

function bondRow(b: EconomyBondDay | undefined) {
  return {
    bMinted: b ? b.minted : null,
    bSold: b ? windowSold(b) : null,
    bUsed: b && b.burned !== null && b.used_in_shipbuilding !== null ? -(b.burned + b.used_in_shipbuilding) : null,
    bReserve: b ? b.reserve : null,
    bCirculating: b?.in_circulation ?? null,
    bWindowSell: b?.window_sell_price || null,
    bWindowBuy: b?.window_buy_price || null,
    bP2S: b ? avgPrice(b.players_to_stations) : null,
    bS2P: b ? avgPrice(b.stations_to_players) : null,
    bP2P: b ? avgPrice(b.player_to_player) : null,
  }
}

/** Credits per unit, or null when nothing traded. */
export function avgPrice(t: EconomyBondTrades): number | null {
  return t.units ? t.credits / t.units : null
}

function windowSold(b: EconomyBondDay): number {
  return b.window_sold_to_players.units + b.window_sold_to_stations.units
}

type Segment = 'window_sold_to_players' | 'window_sold_to_stations' | 'window_bought_back' | 'players_to_stations'
  | 'stations_to_players' | 'player_to_player' | 'station_to_station'

export const BOND_SEGMENTS: [Segment, string][] = [
  ['window_sold_to_players', 'Window sales to players'],
  ['window_sold_to_stations', 'Window sales to stations'],
  ['window_bought_back', 'Window buy-backs'],
  ['players_to_stations', 'Players selling to stations'],
  ['stations_to_players', 'Stations selling to players'],
  ['player_to_player', 'Between players'],
  ['station_to_station', 'Between stations'],
]

/**
 * The authenticator market over a span. Stock figures compare the first and
 * last day's end; cover uses the current reserve and the span's average daily
 * window sales.
 */
export function bondSummary(days: EconomyDay[], stock: EconomyBondStock) {
  const bonds = days.map((d) => d.trade_authenticators)
  const sum = (f: (b: EconomyBondDay) => number) => bonds.reduce((s, b) => s + f(b), 0)
  const spanDays = days.reduce((s, d) => s + d.period_days, 0)
  const sold = sum(windowSold)
  const first = bonds[0]
  const last = bonds.at(-1)
  // Circulation is unknown on summary-only days: compare the first and last days that have it.
  const counted = days.filter((d) => d.trade_authenticators.in_circulation !== null)
  // One counted day is a level, not a change.
  const circFrom = counted.length > 1 ? counted[0].trade_authenticators.in_circulation : null
  const circTo = counted.length > 1 ? counted.at(-1)!.trade_authenticators.in_circulation : null
  const pct = (from: number, to: number) => (from ? ((to - from) / from) * 100 : null)
  const segments = BOND_SEGMENTS.map(([key, label]) => {
    const t = { units: sum((b) => b[key].units), credits: sum((b) => b[key].credits) }
    return { key, label, units: t.units, avg: avgPrice(t) }
  })
  const stationPrice = segments.find((x) => x.key === 'players_to_stations')!.avg
  return {
    minted: sum((b) => b.minted),
    sold,
    /** Burned plus built into ships, over the days that count them. */
    used: sum((b) => (b.burned ?? 0) + (b.used_in_shipbuilding ?? 0)),
    boughtBack: sum((b) => b.window_bought_back.units),
    reserveChangePct: first && last ? pct(first.reserve, last.reserve) : null,
    circulationFrom: counted[0]?.date ?? null,
    circulationChange: circFrom !== null && circTo !== null ? circTo - circFrom : null,
    circulationChangePct: circFrom !== null && circTo !== null ? pct(circFrom, circTo) : null,
    soldPerDay: spanDays ? sold / spanDays : 0,
    /** Days the current reserve lasts at the span's average window sales; null with no sales. */
    coverDays: sold && spanDays ? stock.reserve / (sold / spanDays) : null,
    segments,
    stationPrice,
    /** Average price stations paid players ÷ the window sell price; null if either is missing. */
    premium: stationPrice !== null && stock.window_sell_price ? stationPrice / stock.window_sell_price : null,
  }
}

export type BondSummary = ReturnType<typeof bondSummary>

/** Chapter title for authenticators: the reserve's direction first, else the station premium. */
export function bondHeadline(b: BondSummary, from: string): string {
  const r = b.reserveChangePct
  if (r !== null && Math.abs(r) >= 10) {
    const c = b.circulationChangePct
    // Circulation is only counted from detailed accounting on, which can start later than the span.
    const circSince = b.circulationFrom && b.circulationFrom !== from ? ` since ${dayLabel(b.circulationFrom)}` : ''
    const reserve = `The reserve ${r < 0 ? 'fell' : 'grew'} ${Math.abs(r).toFixed(0)}% since ${dayLabel(from)}`
    if (c === null) return reserve
    const circ = Math.abs(c) < 1 ? 'circulation held steady' : `circulation ${c > 0 ? 'grew' : 'shrank'} ${Math.abs(c).toFixed(0)}%`
    return `${reserve}; ${circ}${circSince}`
  }
  if (b.premium !== null) return `Stations pay ${b.premium.toFixed(2)}× the window price; the reserve is steady`
  return 'The reserve is steady'
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
