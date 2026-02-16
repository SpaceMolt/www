'use client'

import { useState, useEffect, useCallback, lazy, Suspense, Fragment } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'

const DepthChart = lazy(() => import('@/components/DepthChart'))

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface StationMarketItem {
  item_id: string
  item_name: string
  category: string
  base_value: number
  best_bid: number
  best_ask: number
  bid_quantity: number
  ask_quantity: number
  spread: number
  spread_pct: number
}

interface StationMarketResponse {
  base_id: string
  base_name: string
  empire: string
  empire_name: string
  items: StationMarketItem[]
  categories: string[]
}

interface DepthLevel {
  price: number
  quantity: number
  cumulative: number
}

interface DepthResponse {
  base_id: string
  base_name: string
  item_id: string
  item_name: string
  bids: DepthLevel[]
  asks: DepthLevel[]
}

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

export default function StationMarketPage() {
  const params = useParams()
  const stationId = params.id as string

  const [data, setData] = useState<StationMarketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('')

  // Depth chart state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [depthData, setDepthData] = useState<DepthResponse | null>(null)
  const [depthLoading, setDepthLoading] = useState(false)

  useEffect(() => {
    if (!stationId) return

    setLoading(true)
    setError(null)

    fetch(`${API_BASE}/api/market/station/${encodeURIComponent(stationId)}`)
      .then((res) => {
        if (res.status === 404) throw new Error('Station not found or has no market.')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((d: StationMarketResponse) => {
        setData(d)
        document.title = `${d.base_name} Market — SpaceMolt`
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [stationId])

  const toggleDepth = useCallback(async (itemId: string) => {
    if (expandedItemId === itemId) {
      setExpandedItemId(null)
      setDepthData(null)
      return
    }

    setExpandedItemId(itemId)
    setDepthData(null)
    setDepthLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/market/depth/${encodeURIComponent(stationId)}/${encodeURIComponent(itemId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d: DepthResponse = await res.json()
      setDepthData(d)
    } catch {
      setDepthData(null)
    } finally {
      setDepthLoading(false)
    }
  }, [stationId, expandedItemId])

  if (loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loading}>Loading station market data...</div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className={styles.main}>
        <div className={styles.error}>
          <p>{error || 'Unable to load station market data.'}</p>
          <Link href="/market" className={styles.backLink}>&larr; Back to Galactic Exchange</Link>
        </div>
      </main>
    )
  }

  const empireColor = EMPIRE_COLORS[data.empire] || '#a8c5d6'

  const filteredItems = activeCategory
    ? data.items.filter((item) => item.category === activeCategory)
    : data.items

  return (
    <main className={styles.main}>
      <Link href="/market" className={styles.backLink}>&larr; Back to Galactic Exchange</Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageHeaderTitle} style={{ color: empireColor }}>
          {data.base_name}
        </h1>
        <p className={styles.pageHeaderSubtitle}>
          {data.empire_name} — {filteredItems.length} items with active orders
        </p>
        <p className={styles.pageHeaderDescription}>
          Click any row to view order book depth chart.
        </p>
      </div>

      {data.categories.length > 1 && (
        <div className={styles.categories}>
          <button
            className={`${styles.categoryBtn} ${activeCategory === '' ? styles.categoryBtnActive : ''}`}
            onClick={() => setActiveCategory('')}
          >
            All
          </button>
          {data.categories.map((cat) => (
            <button
              key={cat}
              className={`${styles.categoryBtn} ${activeCategory === cat ? styles.categoryBtnActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className={styles.emptyState}>No active orders at this station.</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colItem}>Item</th>
                <th className={styles.colCategory}>Category</th>
                <th className={styles.colValue}>Base Value</th>
                <th className={styles.colBid}>Best Bid</th>
                <th className={styles.colBidQty}>Bid Qty</th>
                <th className={styles.colAsk}>Best Ask</th>
                <th className={styles.colAskQty}>Ask Qty</th>
                <th className={styles.colSpread}>Spread</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isExpanded = expandedItemId === item.item_id
                return (
                  <Fragment key={item.item_id}>
                    <tr
                      className={`${styles.row} ${isExpanded ? styles.rowExpanded : ''}`}
                      onClick={() => toggleDepth(item.item_id)}
                    >
                      <td className={styles.cellItem}>
                        <span className={styles.itemNameWrapper}>
                          <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>
                            {'\u25B6'}
                          </span>
                          {item.item_name}
                        </span>
                      </td>
                      <td className={styles.cellCategory}>{item.category}</td>
                      <td className={styles.cellValue}>{formatNumber(item.base_value)}</td>
                      <td className={styles.cellBid}>
                        {item.best_bid > 0 ? formatNumber(item.best_bid) : '\u2014'}
                      </td>
                      <td className={styles.cellBidQty}>
                        {item.bid_quantity > 0 ? formatNumber(item.bid_quantity) : '\u2014'}
                      </td>
                      <td className={styles.cellAsk}>
                        {item.best_ask > 0 ? formatNumber(item.best_ask) : '\u2014'}
                      </td>
                      <td className={styles.cellAskQty}>
                        {item.ask_quantity > 0 ? formatNumber(item.ask_quantity) : '\u2014'}
                      </td>
                      <td className={styles.cellSpread}>
                        {item.spread > 0 ? (
                          <>
                            {formatNumber(item.spread)}
                            <span className={styles.spreadPct}>
                              ({item.spread_pct.toFixed(1)}%)
                            </span>
                          </>
                        ) : (
                          '\u2014'
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className={styles.depthRow}>
                        <td colSpan={8} className={styles.depthCell}>
                          {depthLoading && (
                            <div className={styles.depthLoading}>Loading depth data...</div>
                          )}
                          {!depthLoading && depthData && (
                            <Suspense fallback={<div className={styles.depthLoading}>Loading chart...</div>}>
                              <DepthChart
                                bids={depthData.bids || []}
                                asks={depthData.asks || []}
                                itemName={depthData.item_name}
                                onClose={() => { setExpandedItemId(null); setDepthData(null) }}
                              />
                            </Suspense>
                          )}
                          {!depthLoading && !depthData && (
                            <div className={styles.depthLoading}>No depth data available.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
