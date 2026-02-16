'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
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
  bidCumulative: number | null
  askCumulative: number | null
}

const BID_COLOR = '#2dd4bf'
const ASK_COLOR = '#e63946'

export default function DepthChart({ bids, asks, itemName, onClose }: DepthChartProps) {
  const data = useMemo(() => {
    const points: ChartPoint[] = []

    // Bids come in price DESC from the API (best bid first).
    // Reverse so they go low→high price for the x-axis.
    // Cumulative should build from the spread outward (right to left on chart),
    // so we need to recalculate: the rightmost bid (highest price) has the smallest
    // cumulative, and the leftmost (lowest price) has the largest.
    const reversedBids = [...bids].reverse()
    const totalBidQty = bids.length > 0 ? bids[bids.length - 1].cumulative : 0
    for (const level of reversedBids) {
      points.push({
        price: level.price,
        bidCumulative: totalBidQty - level.cumulative + level.quantity,
        askCumulative: null,
      })
    }

    // Asks come in price ASC (best ask first). Cumulative already builds outward.
    for (const level of asks) {
      points.push({
        price: level.price,
        bidCumulative: null,
        askCumulative: level.cumulative,
      })
    }

    return points
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{itemName} — Order Book Depth</span>
        <button className={styles.closeBtn} onClick={onClose}>{'\u2715'}</button>
      </div>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={280}>
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
              label={{ value: 'Quantity', angle: -90, position: 'insideLeft', offset: 5, fill: '#a8c5d6', fontSize: 11 }}
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
            <Area
              type="stepAfter"
              dataKey="bidCumulative"
              stroke={BID_COLOR}
              fill="url(#bidGradient)"
              fillOpacity={1}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Area
              type="stepAfter"
              dataKey="askCumulative"
              stroke={ASK_COLOR}
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
