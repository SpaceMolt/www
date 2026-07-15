'use client'

import { useState, useEffect, useCallback, useRef, lazy, Suspense, Fragment } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, Database } from 'lucide-react'
import styles from './page.module.css'
import { ItemDetailContent, type CatalogItem, type CatalogResponse } from '@/components/ItemDetail'
import { useTranslation } from '@/i18n'
import { firmDepth, depthBreakdownTitle, type DepthQuantities } from '@/lib/depth'

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
  bid_quantity_at_best?: number
  ask_quantity_at_best?: number
  bid_quantity_reasonable?: number
  ask_quantity_reasonable?: number
  bid_quantity_station_mgr?: number
  ask_quantity_station_mgr?: number
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

export const EMPIRE_COLORS: Record<string, string> = {
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

function bidDepthOf(item: StationMarketItem): DepthQuantities {
  return {
    total: item.bid_quantity,
    atBest: item.bid_quantity_at_best,
    reasonable: item.bid_quantity_reasonable,
    stationMgr: item.bid_quantity_station_mgr,
  }
}

function askDepthOf(item: StationMarketItem): DepthQuantities {
  return {
    total: item.ask_quantity,
    atBest: item.ask_quantity_at_best,
    reasonable: item.ask_quantity_reasonable,
    stationMgr: item.ask_quantity_station_mgr,
  }
}

export default function StationMarketPage() {
  const { t } = useTranslation()
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
    if (sortKey !== key) {
      return <ChevronsUpDown size={11} aria-hidden className={styles.sortIcon} />
    }
    return sortDir === 'asc'
      ? <ChevronUp size={11} aria-hidden className={styles.sortIconActive} />
      : <ChevronDown size={11} aria-hidden className={styles.sortIconActive} />
  }

  if (loading) {
    return (
      <div className="console-page">
        <div className={styles.loading}>{t('market.loading')}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="console-page">
        <div className={styles.error}>
          <p>{error || t('marketDetail.errorFallback')}</p>
          <Link href="/market" className={styles.backLink}>
            <ArrowLeft size={12} aria-hidden />
            {t('marketDetail.backToMarket')}
          </Link>
        </div>
      </div>
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
        case 'bid_quantity':
          // Sort by the same trap-resistant figure the cell displays.
          cmp = firmDepth(bidDepthOf(a)) - firmDepth(bidDepthOf(b))
          break
        case 'ask_quantity':
          cmp = firmDepth(askDepthOf(a)) - firmDepth(askDepthOf(b))
          break
        default:
          cmp = (a[sortKey] as number) - (b[sortKey] as number)
      }
      return cmp * dir
    })
  }

  const hasCatalog = Object.keys(catalog).length > 0

  return (
    <div className="console-page">
      <Link href="/market" className={styles.backLink}>
        <ArrowLeft size={12} aria-hidden />
        {t('marketDetail.backToMarket')}
      </Link>

      <header className="console-page-header">
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title" style={{ color: empireColor }}>
          {data.base_name}
        </h1>
        <p className="console-page-sub">
          {data.empire_name} — {t('marketDetail.itemsWithOrders', { count: String(filteredItems.length) })}
        </p>
        <p className={styles.headerDescription}>
          {hasCatalog ? t('marketDetail.clickRowHintWithDetails') : t('marketDetail.clickRowHint')}
        </p>
        <p className={styles.depthLegend}>{t('marketDetail.depthLegend')}</p>
      </header>

      {data.categories.length > 1 && (
        <div className={styles.categories}>
          <button
            className={`${styles.categoryBtn} ${activeCategory === '' ? styles.categoryBtnActive : ''}`}
            onClick={() => setActiveCategory('')}
          >
            {t('market.filterAll')}
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
          placeholder={t('marketDetail.searchItems')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className={styles.filterWrapper} ref={filterRef}>
          <button
            className={`${styles.filterBtn} ${orderFilter ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterOpen((prev) => !prev)}
          >
            {orderFilter === 'bids' ? t('marketDetail.hasBids') : orderFilter === 'asks' ? t('marketDetail.hasAsks') : orderFilter === 'both' ? t('marketDetail.hasBoth') : t('marketDetail.filterOrders')}
          </button>
          {filterOpen && (
            <div className={styles.filterDropdown}>
              <button
                className={`${styles.filterOption} ${orderFilter === 'bids' ? styles.filterOptionActive : ''}`}
                onClick={() => { toggleOrderFilter('bids'); setFilterOpen(false) }}
              >
                {t('marketDetail.hasBids')}
              </button>
              <button
                className={`${styles.filterOption} ${orderFilter === 'asks' ? styles.filterOptionActive : ''}`}
                onClick={() => { toggleOrderFilter('asks'); setFilterOpen(false) }}
              >
                {t('marketDetail.hasAsks')}
              </button>
              <button
                className={`${styles.filterOption} ${orderFilter === 'both' ? styles.filterOptionActive : ''}`}
                onClick={() => { toggleOrderFilter('both'); setFilterOpen(false) }}
              >
                {t('marketDetail.hasBoth')}
              </button>
            </div>
          )}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className={styles.emptyState}>{t('marketDetail.noOrders')}</div>
      ) : (
        <section className={`console-panel ${styles.tablePanel}`}>
          <div className="console-panel-header">
            <Database size={12} aria-hidden />
            <span>Order Book</span>
            <span className={styles.panelMeta}>
              {filteredItems.length} {filteredItems.length === 1 ? 'record' : 'records'}
            </span>
          </div>
          <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.colItem} ${styles.sortable}`} onClick={() => handleSort('item_name')}>
                  {t('marketDetail.colItem')}{sortIndicator('item_name')}
                </th>
                <th className={`${styles.colCategory} ${styles.sortable}`} onClick={() => handleSort('category')}>
                  {t('marketDetail.colCategory')}{sortIndicator('category')}
                </th>
                <th className={`${styles.colValue} ${styles.sortable}`} onClick={() => handleSort('base_value')}>
                  {t('marketDetail.colBaseValue')}{sortIndicator('base_value')}
                </th>
                <th className={`${styles.colBid} ${styles.sortable}`} onClick={() => handleSort('best_bid')}>
                  {t('marketDetail.colBestBid')}{sortIndicator('best_bid')}
                </th>
                <th className={`${styles.colBidQty} ${styles.sortable}`} onClick={() => handleSort('bid_quantity')}>
                  {t('marketDetail.colBidQty')}{sortIndicator('bid_quantity')}
                </th>
                <th className={`${styles.colAsk} ${styles.sortable}`} onClick={() => handleSort('best_ask')}>
                  {t('marketDetail.colBestAsk')}{sortIndicator('best_ask')}
                </th>
                <th className={`${styles.colAskQty} ${styles.sortable}`} onClick={() => handleSort('ask_quantity')}>
                  {t('marketDetail.colAskQty')}{sortIndicator('ask_quantity')}
                </th>
                <th className={`${styles.colSpread} ${styles.sortable}`} onClick={() => handleSort('spread')}>
                  {t('marketDetail.colSpread')}{sortIndicator('spread')}
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
                          <ChevronRight
                            size={12}
                            aria-hidden
                            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                          />
                          {item.item_name}
                        </span>
                      </td>
                      <td className={styles.cellCategory}>{item.category}</td>
                      <td className={styles.cellValue}>{formatNumber(item.base_value)}</td>
                      <td className={styles.cellBid}>
                        {item.best_bid > 0 ? formatNumber(item.best_bid) : '\u2014'}
                      </td>
                      <td className={styles.cellBidQty}>
                        {item.bid_quantity > 0 ? (
                          <span className={styles.qtyValue} title={depthBreakdownTitle(bidDepthOf(item), 'bid')}>
                            {formatNumber(firmDepth(bidDepthOf(item)))}
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td className={styles.cellAsk}>
                        {item.best_ask > 0 ? formatNumber(item.best_ask) : '\u2014'}
                      </td>
                      <td className={styles.cellAskQty}>
                        {item.ask_quantity > 0 ? (
                          <span className={styles.qtyValue} title={depthBreakdownTitle(askDepthOf(item), 'ask')}>
                            {formatNumber(firmDepth(askDepthOf(item)))}
                          </span>
                        ) : '\u2014'}
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
                            <div className={styles.depthLoading}>{t('marketDetail.loadingDepth')}</div>
                          )}
                          {!depthLoading && depthData && (
                            <Suspense fallback={<div className={styles.depthLoading}>{t('marketDetail.loadingChart')}</div>}>
                              <DepthChart
                                bids={depthData.bids || []}
                                asks={depthData.asks || []}
                                itemName={depthData.item_name}
                                onClose={() => { expandedItemIdRef.current = null; setExpandedItemId(null); setDepthData(null) }}
                              />
                            </Suspense>
                          )}
                          {!depthLoading && !depthData && (
                            <div className={styles.depthLoading}>{t('marketDetail.noDepthData')}</div>
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
        </section>
      )}
    </div>
  )
}
