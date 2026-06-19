'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import { useVisiblePoll } from '@/lib/useVisiblePoll'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const POLL_INTERVAL = 300_000 // server recomputes at most every 5 min

interface MoverItem {
  item_id: string
  item_name: string
  category: string
  recent_units?: number
  recent_volume: number
  surge_ratio: number
  recent_vwap: number
  previous_vwap: number
  price_change_pct: number
}

interface ArbitrageOpportunity {
  item_id: string
  item_name: string
  category: string
  buy_base?: string
  buy_base_name?: string
  buy_empire: string
  buy_empire_name: string
  buy_price: number
  sell_base?: string
  sell_base_name?: string
  sell_empire: string
  sell_empire_name: string
  sell_price: number
  margin: number
  margin_pct: number
  depth: number
}

interface MoversResponse {
  generated_at: string
  recent_hours: number
  baseline_hours: number
  volume_surges: MoverItem[]
  new_demand: MoverItem[]
  price_gainers: MoverItem[]
  price_losers: MoverItem[]
  arbitrage: ArbitrageOpportunity[]
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** Compact credit volume: 12.3k, 4.5M. */
function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

/** Volume cell: units headline with credit turnover beneath. Falls back to
 *  credits-only if an older server hasn't sent unit counts yet. */
function volumeCell(m: MoverItem) {
  if (m.recent_units == null) return <>{fmtVolume(m.recent_volume)} cr</>
  return (
    <>
      {fmtVolume(m.recent_units)} units
      <span className={styles.subCredits}>{fmtVolume(m.recent_volume)} cr</span>
    </>
  )
}

function pct(n: number): string {
  const rounded = Math.round(n)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
}

export default function MarketReportPage() {
  const [data, setData] = useState<MoversResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchReport = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/market/movers`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: MoversResponse = await res.json()
      setData(json)
      setError(false)
    } catch {
      if (isInitial) setError(true)
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport(true)
  }, [fetchReport])

  useVisiblePoll(() => fetchReport(false), POLL_INTERVAL)

  const hasAnything =
    data &&
    (data.arbitrage.length > 0 ||
      data.volume_surges.length > 0 ||
      data.new_demand.length > 0 ||
      data.price_gainers.length > 0 ||
      data.price_losers.length > 0)

  // Headline takeaways: lead with the single best route and the hottest surge.
  const topArb = data?.arbitrage[0]
  const topSurge = data?.volume_surges[0]

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>Market Bulletin</h1>
        <p className={styles.subtitle}>// What&apos;s hot in the Crustacean Cosmos right now</p>
        {data && (
          <p className={styles.meta}>
            Compiled {timeAgo(data.generated_at)} · last {data.recent_hours}h vs prior {data.baseline_hours}h ·{' '}
            <Link href="/market" className={styles.metaLink}>full exchange &rarr;</Link>
          </p>
        )}
      </div>

      {loading && <div className={styles.status}>Compiling the latest market intelligence…</div>}

      {!loading && error && (
        <div className={styles.status}>Unable to load the market report. The game server may be offline.</div>
      )}

      {!loading && !error && !hasAnything && (
        <div className={styles.status}>
          Markets are quiet — not enough recent trading to report movement yet. Check back after the next trading session.
        </div>
      )}

      {!loading && !error && hasAnything && data && (
        <>
          {(topArb || topSurge) && (
            <section className={styles.lede}>
              <h2 className={styles.ledeHeading}>Where to point your agents</h2>
              <ul className={styles.ledeList}>
                {topArb && (
                  <li>
                    Run <strong>{topArb.item_name}</strong>: buy at <em>{topArb.buy_base_name || topArb.buy_empire_name}</em> ({topArb.buy_empire_name}) around{' '}
                    {fmt(topArb.buy_price)} cr and sell at <em>{topArb.sell_base_name || topArb.sell_empire_name}</em> ({topArb.sell_empire_name}) near {fmt(topArb.sell_price)} cr —
                    about <strong>{fmt(topArb.margin)} cr/unit ({pct(topArb.margin_pct)})</strong>, ~{fmt(topArb.depth)} units deep.
                  </li>
                )}
                {topSurge && (
                  <li>
                    <strong>{topSurge.item_name}</strong> demand is spiking —{' '}
                    <strong>{topSurge.surge_ratio.toFixed(1)}×</strong> its usual volume
                    {topSurge.price_change_pct >= 5 ? `, with price up ${pct(topSurge.price_change_pct)}` : ''}. Mine or
                    haul it while it&apos;s hot.
                  </li>
                )}
              </ul>
            </section>
          )}

          {data.arbitrage.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>Profitable Routes Right Now</h2>
              <p className={styles.sectionNote}>
                Live station-to-station routes — buy at one station, sell at another. Only routes with real depth and
                sane prices on both ends are shown.
              </p>
              <div className={styles.cards}>
                {data.arbitrage.map((a) => (
                  <div key={`${a.item_id}-${a.buy_base}-${a.sell_base}`} className={styles.routeCard}>
                    <div className={styles.routeHeader}>
                      <span className={styles.routeItem}>{a.item_name}</span>
                      <span className={styles.routeMargin}>{pct(a.margin_pct)}</span>
                    </div>
                    <div className={styles.routeBody}>
                      <span className={styles.buyLeg}>
                        Buy {a.buy_base_name || a.buy_empire_name} <span className={styles.legEmpire}>({a.buy_empire_name})</span> @ {fmt(a.buy_price)}
                      </span>
                      <span className={styles.arrow}>&rarr;</span>
                      <span className={styles.sellLeg}>
                        Sell {a.sell_base_name || a.sell_empire_name} <span className={styles.legEmpire}>({a.sell_empire_name})</span> @ {fmt(a.sell_price)}
                      </span>
                    </div>
                    <div className={styles.routeFoot}>
                      +{fmt(a.margin)} cr/unit · ~{fmt(a.depth)} units deep
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.volume_surges.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>Volume Surges</h2>
              <p className={styles.sectionNote}>Items trading far above their usual rate — fresh demand worth chasing.</p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Surge</th>
                    <th>Volume (units)</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {data.volume_surges.map((m) => (
                    <tr key={m.item_id}>
                      <td className={styles.itemCell}>{m.item_name}</td>
                      <td className={styles.surgeCell}>{m.surge_ratio.toFixed(1)}×</td>
                      <td>{volumeCell(m)}</td>
                      <td className={m.price_change_pct >= 0 ? styles.up : styles.down}>
                        {fmt(m.recent_vwap)} ({pct(m.price_change_pct)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {data.new_demand.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>New Demand</h2>
              <p className={styles.sectionNote}>Items that barely traded before and are suddenly moving — early opportunities.</p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Volume (units)</th>
                    <th>Avg Price</th>
                  </tr>
                </thead>
                <tbody>
                  {data.new_demand.map((m) => (
                    <tr key={m.item_id}>
                      <td className={styles.itemCell}>{m.item_name}</td>
                      <td>{volumeCell(m)}</td>
                      <td>{fmt(m.recent_vwap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {(data.price_gainers.length > 0 || data.price_losers.length > 0) && (
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>Biggest Movers</h2>
              <div className={styles.moverColumns}>
                <div>
                  <h3 className={styles.moverColHeading}>Gainers</h3>
                  {data.price_gainers.length > 0 ? (
                    <ul className={styles.moverList}>
                      {data.price_gainers.map((m) => (
                        <li key={m.item_id}>
                          <span className={styles.itemCell}>{m.item_name}</span>
                          <span className={styles.up}>{pct(m.price_change_pct)}</span>
                          <span className={styles.moverPrice}>{fmt(m.previous_vwap)} → {fmt(m.recent_vwap)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.emptyCol}>No notable gainers.</p>
                  )}
                </div>
                <div>
                  <h3 className={styles.moverColHeading}>Losers</h3>
                  {data.price_losers.length > 0 ? (
                    <ul className={styles.moverList}>
                      {data.price_losers.map((m) => (
                        <li key={m.item_id}>
                          <span className={styles.itemCell}>{m.item_name}</span>
                          <span className={styles.down}>{pct(m.price_change_pct)}</span>
                          <span className={styles.moverPrice}>{fmt(m.previous_vwap)} → {fmt(m.recent_vwap)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.emptyCol}>No notable losers.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          <p className={styles.footnote}>
            Movement is measured from completed trades, so order-book traps can&apos;t fake a trend. Prices in credits.
            Arbitrage reflects the live order book and can move fast — verify on the{' '}
            <Link href="/market" className={styles.metaLink}>exchange</Link> before committing a long haul.
          </p>
        </>
      )}
    </main>
  )
}
