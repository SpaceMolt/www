'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import styles from './PriceHistoryChart.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface HistoryPoint {
  date: string
  vwap: number
  volume: number
  notional: number
  fill_count: number
}

interface VWAPHistoryResponse {
  item_id: string
  item_name: string
  history: HistoryPoint[]
}

interface PriceHistoryChartProps {
  itemId: string
  itemName: string
}

type RangeKey = '30' | '90' | '365' | 'all'

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
  { key: '365', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: 0 },
]

const PRICE_COLOR = '#00d4ff'
const VOLUME_COLOR = '#2dd4bf'

const AXIS_STYLE = {
  tick: { fill: '#a8c5d6', fontSize: 11 },
  tickLine: { stroke: '#3d5a6c' },
  axisLine: { stroke: '#3d5a6c' },
}

const TOOLTIP_STYLE = {
  background: '#0d1321',
  border: '1px solid #3d5a6c',
  borderRadius: 4,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.75rem',
}

function formatVolume(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`
  return String(val)
}

export default function PriceHistoryChart({ itemId, itemName }: PriceHistoryChartProps) {
  const [range, setRange] = useState<RangeKey>('90')
  const [history, setHistory] = useState<HistoryPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    const days = RANGES.find((r) => r.key === range)?.days ?? 90
    fetch(`${API_BASE}/api/market/vwap-history/${itemId}?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json() as Promise<VWAPHistoryResponse>
      })
      .then((data) => {
        if (!cancelled) setHistory(data.history)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [itemId, range])

  const pctChange = useMemo(() => {
    if (!history || history.length < 2) return null
    const first = history[0].vwap
    const last = history[history.length - 1].vwap
    if (!first) return null
    return ((last - first) / first) * 100
  }, [history])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Price History</span>
        <div className={styles.headerRight}>
          {pctChange !== null && (
            <span className={pctChange >= 0 ? styles.up : styles.down}>
              {pctChange >= 0 ? (
                <TrendingUp size={12} aria-hidden className={styles.trendIcon} />
              ) : (
                <TrendingDown size={12} aria-hidden className={styles.trendIcon} />
              )}
              {pctChange >= 0 ? '+' : ''}
              {pctChange.toFixed(1)}%
            </span>
          )}
          <div className={styles.rangePicker}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={r.key === range ? styles.rangeBtnActive : styles.rangeBtn}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading price history…</div>
      ) : error ? (
        <div className={styles.empty}>Failed to load price history.</div>
      ) : !history || history.length === 0 ? (
        <div className={styles.empty}>
          No trade history yet for {itemName} — check back once it starts trading.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <XAxis dataKey="date" {...AXIS_STYLE} />
            <YAxis
              yAxisId="price"
              orientation="left"
              tickFormatter={(v) => Math.round(v).toLocaleString()}
              {...AXIS_STYLE}
            />
            <YAxis yAxisId="volume" orientation="right" tickFormatter={formatVolume} {...AXIS_STYLE} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) =>
                name === 'vwap'
                  ? [Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }), 'VWAP']
                  : [Number(value).toLocaleString(), 'Volume']
              }
            />
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill={VOLUME_COLOR}
              fillOpacity={0.35}
              isAnimationActive={false}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="vwap"
              stroke={PRICE_COLOR}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
