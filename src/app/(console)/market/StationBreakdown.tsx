'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './StationBreakdown.module.css'
import { firmDepth, depthBreakdownTitle, bidDepthOf, askDepthOf, headlinePrices, type MarketDepthFields } from '@/lib/depth'
import { formatNumber } from '@/lib/format'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

/** One station's own book for the item, from /api/market/item/{itemID}. */
interface ItemStationQuote extends MarketDepthFields {
  base_id: string
  base_name: string
  empire: string
  best_bid: number
  best_ask: number
}

/**
 * Per-station breakdown for one item, shown inside its expanded row.
 *
 * The empire columns above collapse every station in an empire into one best
 * bid and one best ask. Those two prices often come from different stations, so
 * an empire cell can read as a crossed book that no single station shows. This
 * table is where that resolves: each row is one station's own book.
 */
export function StationBreakdown({ itemId, totalCols }: { itemId: string; totalCols: number }) {
  const [stations, setStations] = useState<ItemStationQuote[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setStations(null)
    setFailed(false)
    fetch(`${API_BASE}/api/market/item/${encodeURIComponent(itemId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { stations?: ItemStationQuote[] }) => {
        if (!cancelled) setStations(data.stations || [])
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [itemId])

  // The two prices the empire cell above shows, so this table can mark where
  // each one lives.
  const { bestBid, bestAsk } = headlinePrices(stations ?? [])

  return (
    <tr className={styles.row}>
      <td colSpan={totalCols} className={styles.cell}>
        <div className={styles.content}>
          <p className={styles.explainer}>
            Each row is one station&apos;s own book. The empire columns above take the
            highest bid and the lowest ask across every station in that empire, so
            those two prices can come from two different stations.
          </p>

          {failed && <p className={styles.status}>Per-station data unavailable.</p>}
          {!failed && stations === null && <p className={styles.status}>Loading stations…</p>}
          {!failed && stations?.length === 0 && (
            <p className={styles.status}>No station currently quotes this item.</p>
          )}

          {stations && stations.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Empire</th>
                  <th className={styles.num}>Bid</th>
                  <th className={styles.num}>Ask</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s) => {
                  const bid = bidDepthOf(s)
                  const ask = askDepthOf(s)
                  return (
                  <tr key={s.base_id}>
                    <td>
                      <Link href={`/market/${s.base_id}`} className={styles.stationLink}>
                        {s.base_name}
                      </Link>
                    </td>
                    <td className={styles.empire}>{s.empire || 'unaligned'}</td>
                    <td className={`${styles.num} ${styles.bid}`}>
                      {s.best_bid > 0 ? (
                        <>
                          <span className={s.best_bid === bestBid ? styles.best : undefined}>
                            {formatNumber(s.best_bid)}
                          </span>
                          <span className={styles.quantity} title={depthBreakdownTitle(bid, 'bid')}>
                            ({formatNumber(firmDepth(bid))})
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`${styles.num} ${styles.ask}`}>
                      {s.best_ask > 0 ? (
                        <>
                          <span className={s.best_ask === bestAsk ? styles.best : undefined}>
                            {formatNumber(s.best_ask)}
                          </span>
                          <span className={styles.quantity} title={depthBreakdownTitle(ask, 'ask')}>
                            ({formatNumber(firmDepth(ask))})
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  )
}
