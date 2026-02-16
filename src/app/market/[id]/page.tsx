'use client'

import { useState, useEffect, useCallback, useRef, lazy, Suspense, Fragment } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import { ItemDetailContent, type CatalogItem, type CatalogResponse } from '@/components/ItemDetail'

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

type OrderFilter = 'bids' | 'asks' | 'both' | null

type SortKey = 'item_name' | 'category' | 'base_value' | 'best_bid' | 'bid_quantity' | 'best_ask' | 'ask_quantity' | 'spread'

const TABLE_COL_COUNT = 8

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

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Order side filter (single-select: pick one or none)
  const [orderFilter, setOrderFilter] = useState<OrderFilter>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Depth chart state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const expandedItemIdRef = useRef<string | null>(null)
  const [depthData, setDepthData] = useState<DepthResponse | null>(null)
  const [depthLoading, setDepthLoading] = useState(false)

  // Item catalog state
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>({})

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

  // Fetch item catalog once on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/items`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: CatalogResponse) => {
        setCatalog(data.items || {})
      })
      .catch(() => {
        // Catalog is supplementary
      })
  }, [])

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    if (filterOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [filterOpen])

  const toggleDepth = useCallback(async (itemId: string) => {
    if (expandedItemIdRef.current === itemId) {
      expandedItemIdRef.current = null
      setExpandedItemId(null)
      setDepthData(null)
      return
    }

    expandedItemIdRef.current = itemId
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
  }, [stationId])

  const toggleOrderFilter = (key: OrderFilter) => {
    setOrderFilter((prev) => (prev === key ? null : key))
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc')
      } else {
        // Third click: clear sort
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

  // Apply filters: category → search → order side → sort
  let filteredItems = data.items

  if (activeCategory) {
    filteredItems = filteredItems.filter((item) => item.category === activeCategory)
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filteredItems = filteredItems.filter((item) => item.item_name.toLowerCase().includes(q))
  }

  if (orderFilter) {
    filteredItems = filteredItems.filter((item) => {
      switch (orderFilter) {
        case 'bids': return item.best_bid > 0
        case 'asks': return item.best_ask > 0
        case 'both': return item.best_bid > 0 && item.best_ask > 0
      }
    })
  }

  if (sortKey) {
    const dir = sortDir === 'asc' ? 1 : -1
    filteredItems = [...filteredItems].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'item_name':
          cmp = a.item_name.localeCompare(b.item_name)
          break
        case 'category':
          cmp = a.category.localeCompare(b.category)
          break
        default:
          cmp = (a[sortKey] as number) - (b[sortKey] as number)
      }
      return cmp * dir
    })
  }

  const hasCatalog = Object.keys(catalog).length > 0

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
          Click any row to view order book depth chart{hasCatalog ? ' and item details' : ''}.
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

      {/* Search + Order Filter toolbar */}
      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className={styles.filterWrapper} ref={filterRef}>
          <button
            className={`${styles.filterBtn} ${orderFilter ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterOpen((prev) => !prev)}
          >
            {orderFilter === 'bids' ? 'Has Bids' : orderFilter === 'asks' ? 'Has Asks' : orderFilter === 'both' ? 'Has Both' : 'Filter Orders'}
          </button>
          {filterOpen && (
            <div className={styles.filterDropdown}>
              <button
                className={`${styles.filterOption} ${orderFilter === 'bids' ? styles.filterOptionActive : ''}`}
                onClick={() => { toggleOrderFilter('bids'); setFilterOpen(false) }}
              >
                Has Bids
              </button>
              <button
                className={`${styles.filterOption} ${orderFilter === 'asks' ? styles.filterOptionActive : ''}`}
                onClick={() => { toggleOrderFilter('asks'); setFilterOpen(false) }}
              >
                Has Asks
              </button>
              <button
                className={`${styles.filterOption} ${orderFilter === 'both' ? styles.filterOptionActive : ''}`}
                onClick={() => { toggleOrderFilter('both'); setFilterOpen(false) }}
              >
                Has Both
              </button>
            </div>
          )}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className={styles.emptyState}>No active orders at this station.</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.colItem} ${styles.sortable}`} onClick={() => handleSort('item_name')}>
                  Item{sortIndicator('item_name')}
                </th>
                <th className={`${styles.colCategory} ${styles.sortable}`} onClick={() => handleSort('category')}>
                  Category{sortIndicator('category')}
                </th>
                <th className={`${styles.colValue} ${styles.sortable}`} onClick={() => handleSort('base_value')}>
                  Base Value{sortIndicator('base_value')}
                </th>
                <th className={`${styles.colBid} ${styles.sortable}`} onClick={() => handleSort('best_bid')}>
                  Best Bid{sortIndicator('best_bid')}
                </th>
                <th className={`${styles.colBidQty} ${styles.sortable}`} onClick={() => handleSort('bid_quantity')}>
                  Bid Qty{sortIndicator('bid_quantity')}
                </th>
                <th className={`${styles.colAsk} ${styles.sortable}`} onClick={() => handleSort('best_ask')}>
                  Best Ask{sortIndicator('best_ask')}
                </th>
                <th className={`${styles.colAskQty} ${styles.sortable}`} onClick={() => handleSort('ask_quantity')}>
                  Ask Qty{sortIndicator('ask_quantity')}
                </th>
                <th className={`${styles.colSpread} ${styles.sortable}`} onClick={() => handleSort('spread')}>
                  Spread{sortIndicator('spread')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isExpanded = expandedItemId === item.item_id
                const catalogItem = hasCatalog ? catalog[item.item_id] : undefined
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
                        <td colSpan={TABLE_COL_COUNT} className={styles.depthCell}>
                          {depthLoading && (
                            <div className={styles.depthLoading}>Loading depth data...</div>
                          )}
                          {!depthLoading && depthData && (
                            <Suspense fallback={<div className={styles.depthLoading}>Loading chart...</div>}>
                              <DepthChart
                                bids={depthData.bids || []}
                                asks={depthData.asks || []}
                                itemName={depthData.item_name}
                                onClose={() => { expandedItemIdRef.current = null; setExpandedItemId(null); setDepthData(null) }}
                              />
                            </Suspense>
                          )}
                          {!depthLoading && !depthData && (
                            <div className={styles.depthLoading}>No depth data available.</div>
                          )}
                          {catalogItem && (
                            <ItemDetailContent item={catalogItem} compact />
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
