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

interface HalfPoint {
  price: number
  cumulative: number
}

const BID_COLOR = '#2dd4bf'
const ASK_COLOR = '#e63946'

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

function formatQty(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`
  return String(val)
}

export default function DepthChart({ bids, asks, itemName, onClose }: DepthChartProps) {
  const { bidData, askData } = useMemo(() => {
    // Bids: API gives price DESC (best bid first). Reverse to price ASC.
    // Cumulative builds from spread outward: lowest price has highest cumulative.
    const reversedBids = [...bids].reverse()
    const totalBidQty = bids.reduce((sum, b) => sum + b.quantity, 0)
    const bidPts: HalfPoint[] = []
    let bidCum = totalBidQty
    for (const level of reversedBids) {
      bidPts.push({ price: level.price, cumulative: bidCum })
      bidCum -= level.quantity
    }
    // Pad both edges: far side extends the outermost level, spread side drops to zero
    if (bids.length > 0) {
      const bestBid = bids[0].price
      const worstBid = bids[bids.length - 1].price
      const priceRange = bids.length > 1 ? bestBid - worstBid : 0
      const pad = Math.max(priceRange * 0.15, bestBid * 0.03, 1)
      bidPts.unshift({ price: worstBid - pad, cumulative: totalBidQty })
      bidPts.push({ price: bestBid + pad, cumulative: 0 })
    }

    // Asks: API gives price ASC (best ask first). Cumulative builds outward.
    const askPts: HalfPoint[] = []
    if (asks.length > 0) {
      const bestAsk = asks[0].price
      const worstAsk = asks[asks.length - 1].price
      const priceRange = asks.length > 1 ? worstAsk - bestAsk : 0
      const pad = Math.max(priceRange * 0.15, bestAsk * 0.03, 1)
      askPts.push({ price: bestAsk - pad, cumulative: 0 })
    }
    for (const level of asks) {
      askPts.push({ price: level.price, cumulative: level.cumulative })
    }
    if (asks.length > 0) {
      const worstAsk = asks[asks.length - 1]
      const priceRange = asks.length > 1 ? worstAsk.price - asks[0].price : 0
      const pad = Math.max(priceRange * 0.15, asks[0].price * 0.03, 1)
      askPts.push({ price: worstAsk.price + pad, cumulative: worstAsk.cumulative })
    }

    return { bidData: bidPts, askData: askPts }
  }, [bids, asks])

  const hasBids = bidData.length > 0
  const hasAsks = askData.length > 0

  if (!hasBids && !hasAsks) {
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

  // Shared Y domain so both halves use the same scale
  const maxBidCum = bidData.length > 0 ? Math.max(...bidData.map((d) => d.cumulative)) : 0
  const maxAskCum = askData.length > 0 ? Math.max(...askData.map((d) => d.cumulative)) : 0
  const yMax = Math.max(maxBidCum, maxAskCum)

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
      <div className={styles.splitChart}>
        {/* Bid side — own x-axis range */}
        <div className={hasBids && hasAsks ? styles.halfChart : styles.fullChart}>
          {hasBids ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={bidData} margin={{ top: 10, right: 0, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BID_COLOR} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={BID_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="price"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  {...AXIS_STYLE}
                />
                <YAxis
                  domain={[0, yMax]}
                  tickFormatter={formatQty}
                  {...AXIS_STYLE}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(val) => `Price: ${Number(val).toLocaleString()}`}
                  formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : '-', 'Bid Depth']}
                />
                <Area
                  type="stepAfter"
                  dataKey="cumulative"
                  stroke={BID_COLOR}
                  strokeWidth={2}
                  fill="url(#bidGrad)"
                  fillOpacity={1}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.noData}>No bids</div>
          )}
        </div>

        {/* Spread divider */}
        {hasBids && hasAsks && <div className={styles.spreadDivider} />}

        {/* Ask side — own x-axis range */}
        <div className={hasBids && hasAsks ? styles.halfChart : styles.fullChart}>
          {hasAsks ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={askData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ASK_COLOR} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={ASK_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="price"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  {...AXIS_STYLE}
                />
                <YAxis
                  domain={[0, yMax]}
                  tickFormatter={formatQty}
                  orientation="right"
                  {...AXIS_STYLE}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(val) => `Price: ${Number(val).toLocaleString()}`}
                  formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : '-', 'Ask Depth']}
                />
                <Area
                  type="stepAfter"
                  dataKey="cumulative"
                  stroke={ASK_COLOR}
                  strokeWidth={2}
                  fill="url(#askGrad)"
                  fillOpacity={1}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.noData}>No asks</div>
          )}
        </div>
      </div>
    </div>
  )
}
