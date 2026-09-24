'use client'

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatNumber } from '@/lib/format'
import { C, CURSOR, MARGIN, X_AXIS, Y_AXIS } from './chartTheme'
import { dayLabel, INDEX_NAME, signed, ticksFor, type ChartRow } from './economy'
import styles from './page.module.css'

type TipRow = [label: string, value: string, color?: string]

/** Tooltip body: the day, then one line per figure. Missing days say so. */
function tip(rows: (r: ChartRow) => TipRow[]) {
  function Tip({ active, payload }: TooltipContentProps<number, string>) {
    const r = payload?.[0]?.payload as ChartRow | undefined
    if (!active || !r) return null
    const lines = r.total === null ? null : rows(r)
    return (
      <div className={styles.tip}>
        <div className={styles.tipDate}>
          {dayLabel(r.date)} UTC{r.period !== null && r.period > 1 && ` · covers ${r.period} days`}
        </div>
        {lines === null ? (
          <div className={styles.tipRow}>No snapshot this day</div>
        ) : (
          lines.map(([label, value, color]) => (
            <div key={label} className={styles.tipRow}>
              <span className={styles.tipLabel}>
                {color && <i className={styles.swatch} style={{ background: color }} />}
                {label}
              </span>
              <span className={styles.tipValue}>{value}</span>
            </div>
          ))
        )}
      </div>
    )
  }
  return Tip
}

/** Full figure with a true minus sign: "−1,234 cr". */
const num = (v: number) => `${v < 0 ? '\u2212' : ''}${formatNumber(Math.abs(v))}`
const cr = (v: number | null) => (v === null ? 'No data' : `${num(v)} cr`)
const idx = (v: number | null) => (v === null ? 'No data' : v.toFixed(1))

export function Legend({ items }: { items: [label: string, color: string, line?: boolean][] }) {
  return (
    <ul className={styles.legend}>
      {items.map(([label, color, line]) => (
        <li key={label}>
          <i className={line ? styles.swatchLine : styles.swatch} style={{ background: color }} />
          {label}
        </li>
      ))}
    </ul>
  )
}

/** Grey band over the summary-only days (before detailed accounting), or nothing. */
function summaryBand(rows: ChartRow[], until: string | null | undefined) {
  if (!until || !rows.length) return null
  return <ReferenceArea x1={rows[0].date} x2={until} fill={C.gap} fillOpacity={0.12} stroke="none" ifOverflow="visible" />
}

const extent = (rows: ChartRow[], f: (r: ChartRow) => number | null) => {
  const v = rows.map(f).filter((x): x is number => x !== null)
  return [Math.min(0, ...v), Math.max(0, ...v)] as const
}

export function SupplyChart({ rows, since }: { rows: ChartRow[]; since: string }) {
  // The first day usually dips a little below 0; do not spend a whole tick band on it.
  const [lo, hi] = extent(rows, (r) => r.supply)
  const ticks = ticksFor(lo, hi, 3).filter((t) => t >= lo)
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} ticks={ticks} domain={[Math.min(lo, ticks[0]), ticks.at(-1)!]} tickFormatter={(v: number) => signed(v)} />
          <Tooltip
            cursor={{ stroke: C.axis }}
            content={tip((r) => [
              [`Change since ${since}`, `${r.supply === null ? 'No data' : `${signed(r.supply)} cr`}`, C.net],
              ['Money supply', cr(r.total)],
              ['Held by players', cr(r.players), C.player],
              ['Held by NPCs', cr(r.npc), C.npc],
            ])}
          />
          <ReferenceLine y={0} stroke={C.axis} />
          <Area dataKey="supply" stroke={C.net} strokeWidth={2} fill={C.net} fillOpacity={0.08} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FlowsChart({ rows, summaryUntil }: { rows: ChartRow[]; summaryUntil?: string | null }) {
  const [lo, hi] = extent(rows, (r) => r.faucets)
  const [sinkLo] = extent(rows, (r) => r.sinks)
  const ticks = ticksFor(Math.min(lo, sinkLo), hi, 3)
  const [gapLo, gapHi] = extent(rows, (r) => r.unattributed)
  const gapMax = Math.max(-gapLo, gapHi, 1)
  const gapTick = ticksFor(0, gapMax, 2)[1]
  const devDays = rows.filter((r) => r.dev)
  const flowTip = tip((r) => [
    ['Created', cr(r.faucets), C.created],
    ['Destroyed', cr(r.sinks === null ? null : -r.sinks), C.destroyed],
    ['Net created', cr(r.net), C.net],
    ['Supply change', cr(r.change)],
    ['Unexplained', cr(r.unattributed), C.gap],
    ...(r.dev ? [['Dev team credits', cr(r.dev)] as TipRow] : []),
  ])
  return (
    <div className={styles.chart}>
      <Legend items={[['Created', C.created], ['Destroyed', C.destroyed], ['Net created', C.net, true]]} />
      <ResponsiveContainer width="100%" height={270}>
        <ComposedChart data={rows} margin={{ ...MARGIN, top: devDays.length ? 22 : MARGIN.top, bottom: 8 }} stackOffset="sign">
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} tick={false} axisLine={false} height={4} />
          <YAxis {...Y_AXIS} ticks={ticks} domain={[ticks[0], ticks.at(-1)!]} />
          <Tooltip cursor={CURSOR} content={flowTip} />
          {summaryBand(rows, summaryUntil)}
          <ReferenceLine y={0} stroke={C.axis} />
          {devDays.map((r) => (
            <ReferenceLine key={r.date} x={r.date} stroke={C.neutral} strokeOpacity={0.5} label={{ value: 'Dev team grant', position: 'top', fill: '#a8c5d6', fontSize: 11 }} />
          ))}
          <Bar dataKey="faucets" stackId="f" fill={C.created} maxBarSize={18} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="sinks" stackId="f" fill={C.destroyed} maxBarSize={18} radius={[0, 0, 3, 3]} isAnimationActive={false} />
          <Line dataKey="net" stroke={C.net} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className={styles.stripLabel}>
        <i className={styles.swatch} style={{ background: C.gap }} />
        Unexplained difference
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={rows} margin={MARGIN}>
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} ticks={[-gapTick, 0, gapTick]} domain={[-Math.max(gapMax, gapTick), Math.max(gapMax, gapTick)]} />
          <Tooltip cursor={CURSOR} content={flowTip} />
          {summaryBand(rows, summaryUntil)}
          <ReferenceLine y={0} stroke={C.axis} />
          <Bar dataKey="unattributed" fill={C.gap} maxBarSize={18} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TradeChart({ rows }: { rows: ChartRow[] }) {
  const seg = { stackId: 't', maxBarSize: 18, stroke: C.surface, strokeWidth: 1, isAnimationActive: false }
  return (
    <div className={styles.chart}>
      <Legend items={[['Between players', C.player], ['Players selling to NPC stations', C.npc], ['Players buying from NPC stations', C.npcAlt]]} />
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} />
          <Tooltip
            cursor={CURSOR}
            content={tip((r) => [
              ['Between players', cr(r.p2p), C.player],
              ['Selling to NPC stations', cr(r.sold), C.npc],
              ['Buying from NPC stations', cr(r.bought), C.npcAlt],
              ['Direct player deals', cr(r.direct)],
              ['Taxes & fines', cr(r.taxes)],
            ])}
          />
          <Bar dataKey="p2p" fill={C.player} {...seg} />
          <Bar dataKey="sold" fill={C.npc} {...seg} />
          <Bar dataKey="bought" fill={C.npcAlt} radius={[3, 3, 0, 0]} {...seg} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PriceChart({ rows, categories }: { rows: ChartRow[]; categories: (keyof typeof INDEX_NAME)[] }) {
  return (
    <div className={styles.chart}>
      <Legend items={[...categories.map((k): [string, string, boolean] => [INDEX_NAME[k], C[k], true]), ['100 = base week', C.reference, true]]} />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(0)} />
          <Tooltip
            cursor={{ stroke: C.axis }}
            content={tip((r) => categories.map((k) => [INDEX_NAME[k], idx(r[k]), C[k]]))}
          />
          <ReferenceLine y={100} stroke={C.reference} />
          {categories.map((k) => (
            <Line key={k} dataKey={k} stroke={C[k]} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** One small multiple: a single measure per day. */
export function ActivityChart({ rows, field, unit, color = C.neutral, summaryUntil }: {
  rows: ChartRow[]
  field: 'active' | 'mined' | 'crafted' | 'bReserve' | 'bCirculating'
  unit: string
  color?: string
  summaryUntil?: string | null
}) {
  return (
    <ResponsiveContainer width="100%" height={96}>
      <AreaChart data={rows} margin={MARGIN}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis {...X_AXIS} />
        <YAxis {...Y_AXIS} tickCount={3} />
        <Tooltip
          cursor={{ stroke: C.axis }}
          content={tip((r) => [[unit, r[field] === null ? 'No data' : formatNumber(r[field])]])}
        />
        {summaryBand(rows, summaryUntil)}
        <Area dataKey={field} stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

const units = (v: number | null) => (v === null ? 'No data' : num(v))

/** Authenticators made (up), used up (down), and sold by the window (line), per day. */
export function BondFlowChart({ rows, summaryUntil }: { rows: ChartRow[]; summaryUntil?: string | null }) {
  return (
    <div className={styles.chart}>
      <Legend items={[['Minted', C.created], ['Burned or built into ships', C.destroyed], ['Sold by the window', C.window, true]]} />
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={rows} margin={MARGIN} stackOffset="sign">
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} tickFormatter={(v: number) => num(v)} />
          <Tooltip
            cursor={CURSOR}
            content={tip((r) => [
              ['Minted', units(r.bMinted), C.created],
              ['Burned or built into ships', units(r.bUsed === null ? null : -r.bUsed), C.destroyed],
              ['Sold by the window', units(r.bSold), C.window],
            ])}
          />
          {summaryBand(rows, summaryUntil)}
          <ReferenceLine y={0} stroke={C.axis} />
          <Bar dataKey="bMinted" stackId="b" fill={C.created} maxBarSize={18} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="bUsed" stackId="b" fill={C.destroyed} maxBarSize={18} radius={[0, 0, 3, 3]} isAnimationActive={false} />
          <Line dataKey="bSold" stroke={C.window} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Average daily price per market segment against the window's prices. */
export function BondPriceChart({ rows, summaryUntil }: { rows: ChartRow[]; summaryUntil?: string | null }) {
  const price = (v: number | null) => (v === null ? 'No trades' : `${num(Math.round(v))} cr`)
  return (
    <div className={styles.chart}>
      <Legend
        items={[
          ['Players selling to stations', C.p2s, true],
          ['Stations selling to players', C.s2p, true],
          ['Between players', C.p2p, true],
          ['Window sells at', C.window, true],
          ['Window buys back at', `${C.window}80`, true],
        ]}
      />
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} domain={[(lo: number) => Math.floor((lo * 0.92) / 50) * 50, 'auto']} tickFormatter={(v: number) => num(v)} />
          <Tooltip
            cursor={{ stroke: C.axis }}
            content={tip((r) => [
              ['Players selling to stations', price(r.bP2S), C.p2s],
              ['Stations selling to players', price(r.bS2P), C.s2p],
              ['Between players', price(r.bP2P), C.p2p],
              ['Window sells at', price(r.bWindowSell), C.window],
              ['Window buys back at', price(r.bWindowBuy)],
            ])}
          />
          {summaryBand(rows, summaryUntil)}
          <Line dataKey="bWindowSell" type="stepAfter" stroke={C.window} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="bWindowBuy" type="stepAfter" stroke={C.window} strokeOpacity={0.5} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="bP2S" stroke={C.p2s} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="bS2P" stroke={C.s2p} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="bP2P" stroke={C.p2p} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
