'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Database } from 'lucide-react'
import styles from './page.module.css'
import { ItemDetail, type CatalogItem, type CatalogResponse } from '@/components/ItemDetail'
import { useTranslation } from '@/i18n'
import { useVisiblePoll } from '@/lib/useVisiblePoll'
import { firmDepth, depthBreakdownTitle, type DepthQuantities } from '@/lib/depth'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const POLL_INTERVAL = 30_000

interface MarketItem {
  item_id: string
  item_name: string
  category: string
  base_value: number
  empire: string
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

interface EmpireInfo {
  id: string
  name: string
}

interface MarketResponse {
  items: MarketItem[]
  categories: string[]
  empires: EmpireInfo[]
}

interface EmpireCell {
  bid: number
  ask: number
  bidQty: number
  askQty: number
  bidQtyAtBest?: number
  askQtyAtBest?: number
  bidQtyReasonable?: number
  askQtyReasonable?: number
  bidQtyStationMgr?: number
  askQtyStationMgr?: number
}

/** Data for one item pivoted across empires */
interface PivotRow {
  item_id: string
  item_name: string
  category: string
  base_value: number
  empires: Record<string, EmpireCell | undefined>
}

/** Station info from /api/stations */
interface StationInfo {
  id: string
  name: string
  empire: string
  empire_name: string
  services: { market: boolean }
}

const EMPIRE_COLORS: Record<string, string> = {
  solarian: styles.empireSolarian,
  voidborn: styles.empireVoidborn,
  crimson: styles.empireCrimson,
  nebula: styles.empireNebula,
  outerrim: styles.empireOuterrim,
}

const EMPIRE_LINK_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#c39bd3',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function pivotItems(items: MarketItem[]): PivotRow[] {
  const map = new Map<string, PivotRow>()

  for (const item of items) {
    let row = map.get(item.item_id)
    if (!row) {
      row = {
        item_id: item.item_id,
        item_name: item.item_name,
        category: item.category,
        base_value: item.base_value,
        empires: {},
      }
      map.set(item.item_id, row)
    }
    row.empires[item.empire] = {
      bid: item.best_bid,
      ask: item.best_ask,
      bidQty: item.bid_quantity,
      askQty: item.ask_quantity,
      bidQtyAtBest: item.bid_quantity_at_best,
      askQtyAtBest: item.ask_quantity_at_best,
      bidQtyReasonable: item.bid_quantity_reasonable,
      askQtyReasonable: item.ask_quantity_reasonable,
      bidQtyStationMgr: item.bid_quantity_station_mgr,
      askQtyStationMgr: item.ask_quantity_station_mgr,
    }
  }

  // Sort by category then by name
  return Array.from(map.values()).sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category)
    if (catCmp !== 0) return catCmp
    return a.item_name.localeCompare(b.item_name)
  })
}

export default function MarketPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<PivotRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [empires, setEmpires] = useState<EmpireInfo[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Item catalog state (fetched once, not polled)
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>({})
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // Station links (fetched once, grouped by empire)
  const [stationsByEmpire, setStationsByEmpire] = useState<Record<string, StationInfo[]>>({})

  const fetchMarket = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true)
    }
    setError(false)
    try {
      const response = await fetch(`${API_BASE}/api/market`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: MarketResponse = await response.json()
      setRows(pivotItems(data.items || []))
      setCategories(data.categories || [])
      setEmpires(data.empires || [])
      setLastUpdated(new Date())
    } catch {
      if (isInitial) {
        setError(true)
      }
    } finally {
      if (isInitial) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchMarket(true)
  }, [fetchMarket])

  useVisiblePoll(() => fetchMarket(false), POLL_INTERVAL)

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
        // Catalog is supplementary; market page still works without it
      })
  }, [])

  // Fetch stations list once on mount, group by empire
  useEffect(() => {
    fetch(`${API_BASE}/api/stations`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { stations: StationInfo[] }) => {
        const grouped: Record<string, StationInfo[]> = {}
        for (const station of data.stations || []) {
          if (station.empire) {
            if (!grouped[station.empire]) grouped[station.empire] = []
            grouped[station.empire].push(station)
          }
        }
        for (const empire of Object.keys(grouped)) {
          grouped[empire].sort((a, b) => a.name.localeCompare(b.name))
        }
        setStationsByEmpire(grouped)
      })
      .catch(() => {
        // Stations supplementary; empire-level data still works
      })
  }, [])

  const filteredRows = activeCategory
    ? rows.filter((r) => r.category === activeCategory)
    : rows

  const hasAnyOrders = rows.some((r) =>
    Object.values(r.empires).some(
      (e) => e && (e.bid > 0 || e.ask > 0)
    )
  )

  // Total number of columns: Item + Category + BaseValue + (2 per empire)
  const totalCols = 3 + empires.length * 2

  const toggleExpanded = (itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId))
  }

  const hasStations = Object.keys(stationsByEmpire).length > 0

  return (
    <div className="console-page">
      <header className="console-page-header">
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">{t('market.pageTitle')}</h1>
        <p className="console-page-sub">{t('market.pageSubtitle')}</p>
        <p className={styles.headerDescription}>
          {t('market.pageDescription')}
        </p>
        <div className={styles.headerLinks}>
          <Link href="/ticker" className={styles.activityLink}>
            {t('market.viewLiveActivity')}
            <ArrowRight size={12} aria-hidden />
          </Link>
          <Link href="/market/report" className={styles.activityLink}>
            {t('market.viewReport')}
            <ArrowRight size={12} aria-hidden />
          </Link>
        </div>
      </header>

      {loading && (
        <div className={styles.loading}>{t('market.loading')}</div>
      )}

      {!loading && !error && !hasAnyOrders && (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyStateTitle}>{t('market.noOrdersTitle')}</h2>
          <p>
            {t('market.noOrdersDesc')}
          </p>
        </div>
      )}

      {!loading && !error && hasAnyOrders && (
        <>
          <div className={styles.categories}>
            <button
              className={`${styles.categoryBtn} ${
                activeCategory === '' ? styles.categoryBtnActive : ''
              }`}
              onClick={() => setActiveCategory('')}
            >
              {t('market.filterAll')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`${styles.categoryBtn} ${
                  activeCategory === cat ? styles.categoryBtnActive : ''
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Station Markets links */}
          {hasStations && (
            <section className={`console-panel ${styles.stationPanel}`}>
              <div className="console-panel-header">
                <h2 className={styles.panelHeading}>{t('market.stationMarkets')}</h2>
              </div>
              <div className="console-panel-body">
              <p className={styles.stationLinksSubtitle}>
                {t('market.stationMarketsSubtitle')}
              </p>
              <div className={styles.stationGrid}>
                {empires.map((emp) => {
                  const stations = stationsByEmpire[emp.id]
                  if (!stations || stations.length === 0) return null
                  return (
                    <div key={emp.id} className={styles.stationGroup}>
                      <h3
                        className={styles.stationGroupTitle}
                        style={{ color: EMPIRE_LINK_COLORS[emp.id] || '#a8c5d6' }}
                      >
                        {emp.name}
                      </h3>
                      <div className={styles.stationGroupList}>
                        {stations.map((station) => (
                          <Link
                            key={station.id}
                            href={`/market/${station.id}`}
                            className={styles.stationLink}
                            style={{ borderColor: EMPIRE_LINK_COLORS[emp.id] || '#3d5a6c' }}
                          >
                            {station.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>
            </section>
          )}

          <p className={styles.depthLegend}>{t('market.depthLegend')}</p>

          <section className={`console-panel ${styles.tablePanel}`}>
            <div className="console-panel-header">
              <Database size={12} aria-hidden />
              <span>Order Book</span>
              <span className={styles.panelMeta}>
                {filteredRows.length} {filteredRows.length === 1 ? 'record' : 'records'}
              </span>
            </div>
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Order book">
            <table className={styles.table}>
              <thead>
                {/* Empire header row */}
                <tr className={styles.empireHeaderRow}>
                  <th className={styles.colItem} rowSpan={2}>Item</th>
                  <th className={styles.colCategory} rowSpan={2}>Category</th>
                  <th className={styles.colBaseValue} rowSpan={2}>Base Value</th>
                  {empires.map((emp) => (
                    <th
                      key={emp.id}
                      colSpan={2}
                      className={`${EMPIRE_COLORS[emp.id] || ''} ${styles.empireColStart}`}
                    >
                      {emp.name}
                    </th>
                  ))}
                </tr>
                {/* Bid/Ask sub-header row */}
                <tr className={styles.subHeaderRow}>
                  {empires.map((emp) => (
                    <Fragment key={emp.id}>
                      <th className={`${styles.subHeaderBid} ${styles.empireColStart}`}>Bid</th>
                      <th className={styles.subHeaderAsk}>Ask</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isExpanded = expandedItemId === row.item_id
                  const catalogItem = catalog[row.item_id]
                  const hasCatalog = Object.keys(catalog).length > 0

                  return (
                    <Fragment key={row.item_id}>
                      <tr
                        className={isExpanded ? styles.expandedRow : ''}
                        onClick={hasCatalog ? () => toggleExpanded(row.item_id) : undefined}
                        style={hasCatalog ? { cursor: 'pointer' } : undefined}
                      >
                        <td className={styles.cellItem}>
                          <span className={styles.itemNameWrapper}>
                            {hasCatalog && (
                              <ChevronRight
                                size={12}
                                aria-hidden
                                className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                              />
                            )}
                            {row.item_name}
                          </span>
                        </td>
                        <td className={styles.cellCategory}>{row.category}</td>
                        <td className={styles.cellBaseValue}>
                          {formatNumber(row.base_value)}
                        </td>
                        {empires.map((emp) => {
                          const data = row.empires[emp.id]
                          const hasBid = data && data.bid > 0
                          const hasAsk = data && data.ask > 0
                          const bidDepth: DepthQuantities | null = data
                            ? { total: data.bidQty, atBest: data.bidQtyAtBest, reasonable: data.bidQtyReasonable, stationMgr: data.bidQtyStationMgr }
                            : null
                          const askDepth: DepthQuantities | null = data
                            ? { total: data.askQty, atBest: data.askQtyAtBest, reasonable: data.askQtyReasonable, stationMgr: data.askQtyStationMgr }
                            : null
                          return (
                            <Fragment key={emp.id}>
                              <td
                                className={`${styles.empireColStart} ${
                                  hasBid ? styles.cellBid : styles.cellDash
                                }`}
                              >
                                {hasBid && bidDepth ? (
                                  <>
                                    {formatNumber(data.bid)}
                                    <span className={styles.quantity} title={depthBreakdownTitle(bidDepth, 'bid')}>
                                      ({formatNumber(firmDepth(bidDepth))})
                                    </span>
                                  </>
                                ) : (
                                  '\u2014'
                                )}
                              </td>
                              <td
                                className={hasAsk ? styles.cellAsk : styles.cellDash}
                              >
                                {hasAsk && askDepth ? (
                                  <>
                                    {formatNumber(data.ask)}
                                    <span className={styles.quantity} title={depthBreakdownTitle(askDepth, 'ask')}>
                                      ({formatNumber(firmDepth(askDepth))})
                                    </span>
                                  </>
                                ) : (
                                  '\u2014'
                                )}
                              </td>
                            </Fragment>
                          )
                        })}
                      </tr>
                      {isExpanded && catalogItem && (
                        <ItemDetail item={catalogItem} totalCols={totalCols} />
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            </div>
          </section>

          {lastUpdated && (
            <div className={styles.lastUpdated}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </>
      )}

      {!loading && error && (
        <div className={styles.error}>
          Unable to load market data. The game server may be offline.
        </div>
      )}
    </div>
  )
}
