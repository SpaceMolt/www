'use client'

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

const MarketTicker = lazy(() => import('@/components/MarketTicker'))

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface FillStats {
  total_count: number
  total_volume: number
  npc_fill_count: number
  npc_fill_volume: number
  player_fill_count: number
  player_fill_volume: number
}

interface TopItem {
  item_id: string
  item_name: string
  trade_count: number
  volume: number
  vwap: number
}

interface Fill {
  id: string
  timestamp: string
  item_id: string
  item_name: string
  station_id: string
  station_name: string
  quantity: number
  price_each: number
  total: number
  buyer_name: string
  seller_name: string
  is_npc: boolean
  order_type: string
}

type SortKey = 'timestamp' | 'item_name' | 'quantity' | 'price_each' | 'total' | 'station_name'

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatCredits(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`
  return n.toLocaleString('en-US')
}

function relativeTime(ts: string): string {
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function TickerPage() {
  const [stats, setStats] = useState<FillStats | null>(null)
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [fills, setFills] = useState<Fill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Relative time refresh
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, topRes, fillsRes] = await Promise.all([
        fetch(`${API_BASE}/api/market/fills/stats?hours=24`),
        fetch(`${API_BASE}/api/market/fills/top?hours=24&limit=10`),
        fetch(`${API_BASE}/api/market/fills?hours=24&limit=200`),
      ])

      if (statsRes.ok) {
        const s: FillStats = await statsRes.json()
        setStats(s)
      }
      if (topRes.ok) {
        const t = await topRes.json()
        setTopItems(t.items || [])
      }
      if (fillsRes.ok) {
        const f = await fillsRes.json()
        setFills(f.fills || [])
      }

      setError(null)
    } catch (err) {
      setError('Failed to load market data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [fetchData])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc')
      } else {
        setSortKey(null)
        setSortDir('asc')
      }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC'
  }

  // Filter and sort fills
  let filteredFills = fills
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filteredFills = filteredFills.filter(f =>
      f.item_name.toLowerCase().includes(q) ||
      f.buyer_name.toLowerCase().includes(q) ||
      f.seller_name.toLowerCase().includes(q) ||
      f.station_name.toLowerCase().includes(q)
    )
  }

  if (sortKey) {
    const dir = sortDir === 'asc' ? 1 : -1
    filteredFills = [...filteredFills].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'timestamp':
          cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          break
        case 'item_name':
        case 'station_name':
          cmp = a[sortKey].localeCompare(b[sortKey])
          break
        default:
          cmp = (a[sortKey] as number) - (b[sortKey] as number)
      }
      return cmp * dir
    })
  }

  // Top items — find max volume for bar scaling
  const maxVolume = topItems.length > 0 ? topItems[0].volume : 1

  const avgTradeSize = stats && stats.total_count > 0
    ? Math.round(stats.total_volume / stats.total_count)
    : 0

  const playerPct = stats && stats.total_count > 0
    ? Math.round((stats.player_fill_count / stats.total_count) * 100)
    : 0

  return (
    <>
      <Suspense fallback={<div className={styles.tickerPlaceholder} />}>
        <MarketTicker />
      </Suspense>

      <main className={styles.main}>
        <Link href="/market" className={styles.backLink}>&larr; Galactic Exchange</Link>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageHeaderTitle}>Market Activity</h1>
          <p className={styles.pageHeaderSubtitle}>
            Live exchange transactions across the galaxy
          </p>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading market data...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <>
            {/* Stat Cards */}
            {stats && (
              <div className={styles.statCards}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>24h Volume</div>
                  <div className={styles.statValue}>{formatCredits(stats.total_volume)}</div>
                  <div className={styles.statUnit}>credits</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Total Trades</div>
                  <div className={styles.statValue}>{formatNumber(stats.total_count)}</div>
                  <div className={styles.statUnit}>transactions</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Player Trades</div>
                  <div className={styles.statValue}>{formatNumber(stats.player_fill_count)}</div>
                  <div className={styles.statUnit}>{playerPct}% of total</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Avg Trade Size</div>
                  <div className={styles.statValue}>{formatCredits(avgTradeSize)}</div>
                  <div className={styles.statUnit}>credits/trade</div>
                </div>
              </div>
            )}

            {/* Top Items */}
            {topItems.length > 0 && (
              <section className={styles.topSection}>
                <h2 className={styles.sectionTitle}>Top Items by Volume (24h)</h2>
                <div className={styles.topItems}>
                  {topItems.map((item, i) => (
                    <div key={item.item_id} className={styles.topItem}>
                      <span className={styles.topRank}>#{i + 1}</span>
                      <span className={styles.topName}>{item.item_name}</span>
                      <div className={styles.topBarWrap}>
                        <div
                          className={styles.topBar}
                          style={{ width: `${(item.volume / maxVolume) * 100}%` }}
                        />
                      </div>
                      <span className={styles.topVolume}>{formatCredits(item.volume)}</span>
                      <span className={styles.topTrades}>{formatNumber(item.trade_count)} trades</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Trades */}
            <section className={styles.tradesSection}>
              <h2 className={styles.sectionTitle}>Recent Trades</h2>

              <div className={styles.toolbar}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search items, players, stations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredFills.length === 0 ? (
                <div className={styles.emptyState}>No trades found.</div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={`${styles.colTime} ${styles.sortable}`} onClick={() => handleSort('timestamp')}>
                          Time{sortIndicator('timestamp')}
                        </th>
                        <th className={`${styles.colItem} ${styles.sortable}`} onClick={() => handleSort('item_name')}>
                          Item{sortIndicator('item_name')}
                        </th>
                        <th className={`${styles.colQty} ${styles.sortable}`} onClick={() => handleSort('quantity')}>
                          Qty{sortIndicator('quantity')}
                        </th>
                        <th className={`${styles.colPrice} ${styles.sortable}`} onClick={() => handleSort('price_each')}>
                          Price{sortIndicator('price_each')}
                        </th>
                        <th className={`${styles.colTotal} ${styles.sortable}`} onClick={() => handleSort('total')}>
                          Total{sortIndicator('total')}
                        </th>
                        <th className={styles.colBuyer}>Buyer</th>
                        <th className={styles.colSeller}>Seller</th>
                        <th className={`${styles.colStation} ${styles.sortable}`} onClick={() => handleSort('station_name')}>
                          Station{sortIndicator('station_name')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFills.map(fill => (
                        <tr key={fill.id}>
                          <td className={styles.cellTime}>{relativeTime(fill.timestamp)}</td>
                          <td className={styles.cellItem}>{fill.item_name}</td>
                          <td className={styles.cellQty}>{formatNumber(fill.quantity)}</td>
                          <td className={styles.cellPrice}>{formatNumber(fill.price_each)}</td>
                          <td className={styles.cellTotal}>{formatNumber(fill.total)}</td>
                          <td className={styles.cellBuyer}>{fill.buyer_name}</td>
                          <td className={styles.cellSeller}>{fill.seller_name}</td>
                          <td className={styles.cellStation}>{fill.station_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  )
}
