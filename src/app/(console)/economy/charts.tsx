'use client'

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatNumber } from '@/lib/format'
import { C, CURSOR, MARGIN, X_AXIS, Y_AXIS } from './chartTheme'
import { dayLabel, type ChartRow } from './economy'
import styles from './page.module.css'

type TipRow = [label: string, value: string, color?: string]

/** Tooltip body: the day, then one line per figure. Missing days say so. */
function tip(rows: (r: ChartRow) => TipRow[]) {
  function Tip({ active, payload }: TooltipContentProps<number, string>) {
    const r = payload?.[0]?.payload as ChartRow | undefined
    if (!active || !r) return null
    const lines = r.faucets === null && r.players === null ? null : rows(r)
    return (
      <div className={styles.tip}>
        <div className={styles.tipDate}>
          {dayLabel(r.date)} UTC{r.period !== null && r.period > 1 && ` · flows cover ${r.period} days`}
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

const cr = (v: number | null) => (v === null ? 'no data' : `${formatNumber(v)} cr`)
const idx = (v: number | null) => (v === null ? 'no data' : v.toFixed(1))

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

export function SupplyChart({ rows }: { rows: ChartRow[] }) {
  return (
    <div className={styles.chart}>
      <Legend items={[['Held by players', C.player], ['Held by NPCs', C.npc]]} />
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} />
          <Tooltip
            cursor={{ stroke: C.axis }}
            content={tip((r) => [
              ['Held by players', cr(r.players), C.player],
              ['Held by NPCs', cr(r.npc), C.npc],
              ['Total', cr(r.players === null || r.npc === null ? null : r.players + r.npc)],
            ])}
          />
          <Area dataKey="players" stackId="s" stroke={C.player} strokeWidth={2} fill={C.player} fillOpacity={0.14} isAnimationActive={false} />
          <Area dataKey="npc" stackId="s" stroke={C.npc} strokeWidth={2} fill={C.npc} fillOpacity={0.14} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FlowsChart({ rows }: { rows: ChartRow[] }) {
  const flowTip = tip((r) => [
    ['Created (faucets)', cr(r.faucets), C.faucet],
    ['Destroyed (sinks)', cr(r.sinks === null ? null : -r.sinks), C.sink],
    ['Net created', cr(r.net), C.net],
    ['Unattributed', cr(r.unattributed), C.unattributed],
    ['Supply change', cr(r.change)],
  ])
  return (
    <div className={styles.chart}>
      <Legend items={[['Created', C.faucet], ['Destroyed', C.sink], ['Net', C.net, true]]} />
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows} margin={MARGIN} stackOffset="sign">
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} hide />
          <YAxis {...Y_AXIS} />
          <Tooltip cursor={CURSOR} content={flowTip} />
          <ReferenceLine y={0} stroke={C.axis} />
          <Bar dataKey="faucets" stackId="f" fill={C.faucet} maxBarSize={18} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="sinks" stackId="f" fill={C.sink} maxBarSize={18} radius={[0, 0, 3, 3]} isAnimationActive={false} />
          <Line dataKey="net" stroke={C.net} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className={styles.stripLabel}>
        <i className={styles.swatch} style={{ background: C.unattributed }} />
        Unattributed
      </div>
      <ResponsiveContainer width="100%" height={96}>
        <BarChart data={rows} margin={MARGIN}>
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} tickCount={3} />
          <Tooltip cursor={CURSOR} content={flowTip} />
          <ReferenceLine y={0} stroke={C.axis} />
          <Bar dataKey="unattributed" fill={C.unattributed} maxBarSize={18} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TradeChart({ rows }: { rows: ChartRow[] }) {
  const seg = { stackId: 't', maxBarSize: 18, stroke: C.surface, strokeWidth: 1, isAnimationActive: false }
  return (
    <div className={styles.chart}>
      <Legend items={[['Player to player', C.p2p], ['Players selling to NPCs', C.sold], ['Players buying from NPCs', C.bought]]} />
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} />
          <Tooltip
            cursor={CURSOR}
            content={tip((r) => [
              ['Player to player', cr(r.p2p), C.p2p],
              ['Selling to NPCs', cr(r.sold), C.sold],
              ['Buying from NPCs', cr(r.bought), C.bought],
              ['Direct trades', cr(r.direct)],
              ['Taxes & fines', cr(r.taxes)],
            ])}
          />
          <Bar dataKey="p2p" fill={C.p2p} {...seg} />
          <Bar dataKey="sold" fill={C.sold} {...seg} />
          <Bar dataKey="bought" fill={C.bought} radius={[3, 3, 0, 0]} {...seg} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const INDEX_LABEL = { ore: 'Ore', refined: 'Refined', component: 'Components' } as const

export function PriceChart({ rows, categories }: { rows: ChartRow[]; categories: (keyof typeof INDEX_LABEL)[] }) {
  return (
    <div className={styles.chart}>
      <Legend items={categories.map((k) => [INDEX_LABEL[k], C[k], true])} />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis {...X_AXIS} />
          <YAxis {...Y_AXIS} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(0)} />
          <Tooltip
            cursor={{ stroke: C.axis }}
            content={tip((r) => categories.map((k) => [INDEX_LABEL[k], idx(r[k]), C[k]]))}
          />
          <ReferenceLine y={100} stroke={C.axis} label={{ value: 'BASE 100', position: 'insideTopRight', fill: '#6b8fa3', fontSize: 9 }} />
          {categories.map((k) => (
            <Line key={k} dataKey={k} stroke={C[k]} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** One small multiple: a single measure per day. */
export function ActivityChart({ rows, field, unit }: { rows: ChartRow[]; field: 'active' | 'mined' | 'crafted'; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={96}>
      <AreaChart data={rows} margin={MARGIN}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis {...X_AXIS} />
        <YAxis {...Y_AXIS} tickCount={3} />
        <Tooltip
          cursor={{ stroke: C.axis }}
          content={tip((r) => [[unit, r[field] === null ? 'no data' : formatNumber(r[field])]])}
        />
        <Area dataKey={field} stroke={C.player} strokeWidth={2} fill={C.player} fillOpacity={0.1} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
