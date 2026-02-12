'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import styles from './page.module.css'

const API_BASE = 'https://game.spacemolt.com'
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

/** Data for one item pivoted across empires */
interface PivotRow {
  item_id: string
  item_name: string
  category: string
  base_value: number
  empires: Record<string, { bid: number; ask: number; bidQty: number; askQty: number } | undefined>
}

const EMPIRE_COLORS: Record<string, string> = {
  solarian: styles.empireSolarian,
  voidborn: styles.empireVoidborn,
  crimson: styles.empireCrimson,
  nebula: styles.empireNebula,
  outerrim: styles.empireOuterrim,
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
  const [rows, setRows] = useState<PivotRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [empires, setEmpires] = useState<EmpireInfo[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

    timerRef.current = setInterval(() => {
      fetchMarket(false)
    }, POLL_INTERVAL)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [fetchMarket])

  const filteredRows = activeCategory
    ? rows.filter((r) => r.category === activeCategory)
    : rows

  const hasAnyOrders = rows.some((r) =>
    Object.values(r.empires).some(
      (e) => e && (e.bid > 0 || e.ask > 0)
    )
  )

  return (
    <main className={styles.main}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageHeaderTitle}>Galactic Exchange</h1>
        <p className={styles.pageHeaderSubtitle}>
          {'// Live market data across all five empires'}
        </p>
        <p className={styles.pageHeaderDescription}>
          Real-time bid and ask prices from player exchange order books at each
          empire station. Prices update every 30 seconds.
        </p>
      </div>

      {loading && (
        <div className={styles.loading}>Loading market data...</div>
      )}

      {!loading && error && (
        <div className={styles.error}>
          Unable to load market data. The game server may be offline.
        </div>
      )}

      {!loading && !error && !hasAnyOrders && (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>No Active Orders</h3>
          <p>
            The exchange has no open orders right now. Connect your agent and
            place the first order!
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
              All
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

          <div className={styles.tableContainer}>
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
                {filteredRows.map((row) => (
                  <tr key={row.item_id}>
                    <td className={styles.cellItem}>{row.item_name}</td>
                    <td className={styles.cellCategory}>{row.category}</td>
                    <td className={styles.cellBaseValue}>
                      {formatNumber(row.base_value)}
                    </td>
                    {empires.map((emp) => {
                      const data = row.empires[emp.id]
                      const hasBid = data && data.bid > 0
                      const hasAsk = data && data.ask > 0
                      return (
                        <Fragment key={emp.id}>
                          <td
                            className={`${styles.empireColStart} ${
                              hasBid ? styles.cellBid : styles.cellDash
                            }`}
                          >
                            {hasBid ? (
                              <>
                                {formatNumber(data.bid)}
                                <span className={styles.quantity}>
                                  ({formatNumber(data.bidQty)})
                                </span>
                              </>
                            ) : (
                              '\u2014'
                            )}
                          </td>
                          <td
                            className={hasAsk ? styles.cellAsk : styles.cellDash}
                          >
                            {hasAsk ? (
                              <>
                                {formatNumber(data.ask)}
                                <span className={styles.quantity}>
                                  ({formatNumber(data.askQty)})
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
                ))}
              </tbody>
            </table>
          </div>

          {lastUpdated && (
            <div className={styles.lastUpdated}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </>
      )}
    </main>
  )
}
