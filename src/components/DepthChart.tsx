'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import styles from './DepthChart.module.css'

interface DepthLevel {
  price: number
  quantity: number
  cumulative: number
}

interface DepthChartProps {
  bids: DepthLevel[]
  asks: DepthLevel[]
  itemName: string
  onClose: () => void
}

interface ChartPoint {
  price: number
  bidCumulative: number | undefined
  askCumulative: number | undefined
}

const BID_COLOR = '#2dd4bf'
const ASK_COLOR = '#e63946'

export default function DepthChart({ bids, asks, itemName, onClose }: DepthChartProps) {
  const { data, spreadMid } = useMemo(() => {
    const points: ChartPoint[] = []

    // Bids come price DESC from API (best bid first = highest price first).
    // For the butterfly chart, bids go on the left side.
    // We want: lowest price at far left, highest price (best bid) near the spread.
    // Cumulative should build from spread outward: best bid has smallest cumulative,
    // worst bid has largest cumulative (more volume available at lower prices).
    // The API gives cumulative building from best outward, so we reverse for the chart.
    const reversedBids = [...bids].reverse()
    // Recalculate cumulative from the spread outward (right to left on chart)
    const totalBidQty = bids.reduce((sum, b) => sum + b.quantity, 0)
    let bidCum = totalBidQty
    for (const level of reversedBids) {
      points.push({
        price: level.price,
        bidCumulative: bidCum,
        askCumulative: undefined,
      })
      bidCum -= level.quantity
    }

    // Asks come price ASC from API (best ask first = lowest price first).
    // Asks go on the right side. Cumulative already builds outward from best ask.
    for (const level of asks) {
      points.push({
        price: level.price,
        bidCumulative: undefined,
        askCumulative: level.cumulative,
      })
    }

    // Calculate spread midpoint for the reference line
    const bestBid = bids.length > 0 ? bids[0].price : 0
    const bestAsk = asks.length > 0 ? asks[0].price : 0
    const mid = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : 0

    return { data: points, spreadMid: mid }
  }, [bids, asks])

  if (data.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>{itemName} — Order Book Depth</span>
          <button className={styles.closeBtn} onClick={onClose}>{'\u2715'}</button>
        </div>
        <div className={styles.empty}>No orders to display.</div>
      </div>
    )
  }

  const bestBid = bids.length > 0 ? bids[0].price : null
  const bestAsk = asks.length > 0 ? asks[0].price : null
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{itemName} — Order Book Depth</span>
        <div className={styles.headerStats}>
          {bestBid !== null && (
            <span className={styles.statBid}>Bid: {bestBid.toLocaleString()}</span>
          )}
          {bestAsk !== null && (
            <span className={styles.statAsk}>Ask: {bestAsk.toLocaleString()}</span>
          )}
          {spread !== null && (
            <span className={styles.statSpread}>Spread: {spread.toLocaleString()}</span>
          )}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>{'\u2715'}</button>
      </div>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="bidGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BID_COLOR} stopOpacity={0.4} />
                <stop offset="95%" stopColor={BID_COLOR} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="askGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ASK_COLOR} stopOpacity={0.4} />
                <stop offset="95%" stopColor={ASK_COLOR} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="price"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: '#a8c5d6', fontSize: 11 }}
              tickLine={{ stroke: '#3d5a6c' }}
              axisLine={{ stroke: '#3d5a6c' }}
              label={{ value: 'Price', position: 'insideBottom', offset: -2, fill: '#a8c5d6', fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: '#a8c5d6', fontSize: 11 }}
              tickLine={{ stroke: '#3d5a6c' }}
              axisLine={{ stroke: '#3d5a6c' }}
              label={{ value: 'Cumulative Quantity', angle: -90, position: 'insideLeft', offset: 5, fill: '#a8c5d6', fontSize: 11 }}
              tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)}
            />
            <Tooltip
              contentStyle={{
                background: '#0d1321',
                border: '1px solid #3d5a6c',
                borderRadius: 4,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.75rem',
              }}
              labelFormatter={(val) => `Price: ${Number(val).toLocaleString()}`}
              formatter={(value, name) => {
                const label = name === 'bidCumulative' ? 'Bid Depth' : 'Ask Depth'
                return [typeof value === 'number' ? value.toLocaleString() : '-', label]
              }}
            />
            {spreadMid > 0 && (
              <ReferenceLine
                x={spreadMid}
                stroke="#3d5a6c"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}
            <Area
              type="stepAfter"
              dataKey="bidCumulative"
              stroke={BID_COLOR}
              strokeWidth={2}
              fill="url(#bidGradient)"
              fillOpacity={1}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Area
              type="stepBefore"
              dataKey="askCumulative"
              stroke={ASK_COLOR}
              strokeWidth={2}
              fill="url(#askGradient)"
              fillOpacity={1}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
