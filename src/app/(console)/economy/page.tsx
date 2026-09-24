import { ArrowDownRight, ArrowUpRight, ExternalLink } from 'lucide-react'
import { formatCompact, formatNumber, titleCase } from '@/lib/format'
import { ActivityChart, FlowsChart, Legend, PriceChart, SupplyChart, TradeChart } from './charts'
import { C } from './chartTheme'
import {
  chartRows, dayLabel, exchangeVolume, flowTotals, holders, indexedCategories, lastDays, playerHeld,
  signedPct, supplyChange, utcDateTime, type EconomyReport,
} from './economy'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const REPORT_URL = 'https://game.spacemolt.com/api/economy'
const DOCS_URL = 'https://game.spacemolt.com/api/market/docs'

/** Window for the "last 30 days" breakdowns and the headline supply change. */
const WINDOW = 30

async function fetchReport(): Promise<EconomyReport | null> {
  try {
    // The server rebuilds the report hourly; Vercel serves this page from cache
    // for 15 minutes, so browsers never hit the gameserver for it.
    const res = await fetch(`${API_BASE}/api/economy`, { next: { revalidate: 900 } })
    if (!res.ok) return null
    return (await res.json()) as EconomyReport
  } catch {
    return null
  }
}

/** 3 significant digits: 8.05B, 242M. formatCompact's one decimal turns 8.048B into a flat "8B". */
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 }).format
const cr = (n: number) => `${compact(n)} cr`
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${compact(Math.abs(n))}`
const signedCr = (n: number) => `${signed(n)} cr`

function Chapter({ n, title, lede, children }: { n: string; title: string; lede: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`console-panel ${styles.chapter}`} aria-labelledby={`ch-${n}`}>
      <header className="console-panel-header">
        <span className={styles.chapterNum}>{n}</span>
        <h2 id={`ch-${n}`} className={styles.panelHeading}>{title}</h2>
      </header>
      <div className={styles.chapterBody}>
        <p className={styles.lede}>{lede}</p>
        {children}
      </div>
    </section>
  )
}

interface BarRow {
  label: string
  value: number
  color: string
  /** Right-hand figure; defaults to the compact credit value. */
  figure?: string
  /** Muted text after the label. */
  note?: string
}

/** Labelled horizontal bars, scaled to the largest row. Zero rows are dropped. */
function BarList({ title, rows }: { title?: string; rows: BarRow[] }) {
  const shown = rows.filter((r) => r.value > 0)
  const max = Math.max(1, ...shown.map((r) => r.value))
  return (
    <div className={styles.barList}>
      {title && <h3 className={styles.subhead}>{title}</h3>}
      {shown.length === 0 ? (
        <p className={styles.muted}>None in this period.</p>
      ) : (
        <ul>
          {shown.map((r) => (
            <li key={r.label}>
              <span className={styles.barLabel}>
                {r.label}
                {r.note && <small>{r.note}</small>}
              </span>
              <span className={styles.barFigure}>{r.figure ?? cr(r.value)}</span>
              <span className={styles.barTrack}>
                <span className={styles.barFill} style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Kpi({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub: React.ReactNode }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>
        {value}
        {unit && <small>{unit}</small>}
      </span>
      <span className={styles.kpiSub}>{sub}</span>
    </div>
  )
}

function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="console-page-header">
      <span className="console-page-kicker">Galaxy · Economic report</span>
      <h1 className="console-page-title">Galactic Economy</h1>
      <p className="console-page-sub">
        Where the credits are, where they come from, and where they go. Galaxy-wide totals, no player named.
      </p>
      {children}
    </header>
  )
}

export default async function EconomyPage() {
  const report = await fetchReport()

  if (!report) {
    return (
      <div className="console-page">
        <Header />
        <section className="console-panel">
          <h2 className="console-panel-header">Report unavailable</h2>
          <p className={`console-panel-body ${styles.muted}`}>
            The game server did not return the economy report. It rebuilds once an hour, and the
            first report after a server restart takes a few minutes. Check back shortly, or read the
            raw report at{' '}
            <a href={REPORT_URL} rel="noopener">game.spacemolt.com/api/economy</a>.
          </p>
        </section>
      </div>
    )
  }

  const { current, days } = report
  const ms = current.money_supply
  const last = days.at(-1)
  const recent = lastDays(days, WINDOW)
  const rows = chartRows(days)
  const flows = flowTotals(recent)
  const growth = supplyChange(days, WINDOW)
  const players = playerHeld(ms)
  const playerShare = ms.total ? (players / ms.total) * 100 : 0
  const categories = indexedCategories(days)
  const { price_index_base_start: baseStart, price_index_base_end: baseEnd } = report
  const tradeTotal = recent.reduce((s, d) => s + exchangeVolume(d.trade), 0)
  const p2pTotal = recent.reduce((s, d) => s + d.trade.player_to_player, 0)
  const periodLabel = recent.length < WINDOW ? `the ${recent.length} days since ${dayLabel(days[0]?.date ?? report.series_start)}` : `the last ${WINDOW} days`
  const inflation = Object.entries(current.inflation_7d.by_category).sort((a, b) => b[1] - a[1])
  const maxInflation = Math.max(0.1, ...inflation.map(([, v]) => Math.abs(v)))

  return (
    <div className="console-page">
      <Header>
        <p className={styles.meta}>
          <span>Data as of {utcDateTime(current.captured_at)}</span>
          {last && <span>Daily figures through {dayLabel(last.date)}</span>}
          <span>Updated hourly</span>
        </p>
      </Header>

      <div className={styles.kpis}>
        <Kpi
          label="Money supply"
          value={compact(ms.total)}
          unit="cr"
          sub={growth ? (
            <>
              {growth.delta >= 0 ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
              {signedPct(growth.pct, 2)} since {dayLabel(growth.from)}
            </>
          ) : 'Not enough days yet'}
        />
        <Kpi label="Held by players" value={`${playerShare.toFixed(1)}%`} sub={`${cr(players)} of ${cr(ms.total)}`} />
        <Kpi
          label="Net created"
          value={last ? signed(last.faucets.total - last.sinks.total) : '—'}
          unit={last ? 'cr' : undefined}
          sub={last ? `${compact(last.faucets.total)} in · ${compact(last.sinks.total)} out · ${dayLabel(last.date)}` : 'No complete day yet'}
        />
        <Kpi
          label="Exchange trade"
          value={last ? compact(exchangeVolume(last.trade)) : '—'}
          unit={last ? 'cr' : undefined}
          sub={last ? `${formatNumber(last.trade.fills)} fills · ${dayLabel(last.date)}` : 'No complete day yet'}
        />
        <Kpi label="Active players" value={formatNumber(current.players.active_24h)} sub={`last 24h · ${formatNumber(current.players.registered)} registered`} />
      </div>

      {days.length === 0 ? (
        <section className="console-panel">
          <h2 className="console-panel-header">Daily series</h2>
          <p className={`console-panel-body ${styles.muted}`}>No complete UTC day has been recorded yet. Daily charts appear after the first full day.</p>
        </section>
      ) : (
        <>
          <Chapter
            n="01"
            title="Money supply"
            lede={<>Players hold <strong>{playerShare.toFixed(1)}%</strong> of the <strong>{cr(ms.total)}</strong> in existence. The rest sits with station managers, empire treasuries and other NPCs.</>}
          >
            <div className={styles.split}>
              <SupplyChart rows={rows} />
              <BarList
                title="Who holds it now"
                rows={holders(ms).map((h) => ({
                  label: h.label,
                  value: h.value,
                  color: h.side === 'player' ? C.player : C.npc,
                  figure: `${cr(h.value)} · ${ms.total ? ((h.value / ms.total) * 100).toFixed(1) : '0'}%`,
                }))}
              />
            </div>
          </Chapter>

          <Chapter
            n="02"
            title="Faucets and sinks"
            lede={<>Over {periodLabel} the galaxy created <strong>{cr(flows.created)}</strong> and destroyed <strong>{cr(flows.destroyed)}</strong>, a net <strong>{signedCr(flows.created - flows.destroyed)}</strong>. Taxes, trades and treasury-paid rewards move credits between holders, so they appear in neither.</>}
          >
            <FlowsChart rows={rows} />
            <p className={styles.note}>
              <strong>Unattributed</strong> is the supply change the counters do not explain: credits
              entering or leaving contract escrow (freight, commissions, fares), plus any path without a
              counter. Over {periodLabel}: <strong>{signedCr(flows.unattributed)}</strong> against a supply
              change of <strong>{signedCr(flows.change)}</strong>.
            </p>
            <div className={styles.pair}>
              <BarList title={`Created by source · ${recent.length}d`} rows={flows.faucets.map((f) => ({ ...f, color: C.faucet }))} />
              <BarList title={`Destroyed by cause · ${recent.length}d`} rows={flows.sinks.map((f) => ({ ...f, color: C.sink }))} />
            </div>
          </Chapter>

          <Chapter
            n="03"
            title="Trade"
            lede={<>Players moved <strong>{cr(tradeTotal)}</strong> through the exchange over {periodLabel}; <strong>{tradeTotal ? ((p2pTotal / tradeTotal) * 100).toFixed(0) : 0}%</strong> of it with other players. NPC means station managers and empire treasuries.</>}
          >
            <div className={styles.split}>
              <TradeChart rows={rows} />
              <dl className={styles.figures}>
                <div>
                  <dt>Taxes & fines collected</dt>
                  <dd>{cr(recent.reduce((s, d) => s + d.taxes_and_fines, 0))}</dd>
                  <span>{recent.length}d · paid to empire treasuries, a transfer</span>
                </div>
                <div>
                  <dt>Direct player trades</dt>
                  <dd>{cr(recent.reduce((s, d) => s + d.trade.direct_trades, 0))}</dd>
                  <span>{recent.length}d · credits in completed trade offers</span>
                </div>
                <div>
                  <dt>Resting on the order books</dt>
                  <dd>{cr(current.exchange.player_sell_value + current.exchange.player_buy_value)}</dd>
                  <span>
                    {formatNumber(current.exchange.player_sell_orders)} player sells · {formatNumber(current.exchange.player_buy_orders)} buys
                  </span>
                </div>
              </dl>
            </div>
          </Chapter>

          <Chapter
            n="04"
            title="Prices"
            lede={
              <>
                Fixed-basket price indices, 100 = average prices over {dayLabel(baseStart)}–{dayLabel(baseEnd ?? baseStart)}.
                {last && categories.map((k) => {
                  const v = last.price_index[k]
                  return v === null ? null : <span key={k}> {titleCase(k)} is at <strong>{v.toFixed(1)}</strong>.</span>
                })}
              </>
            }
          >
            <div className={styles.split}>
              {categories.length > 0 ? <PriceChart rows={rows} categories={categories} /> : <p className={styles.muted}>No category traded in the base period yet.</p>}
              <div className={styles.barList}>
                <h3 className={styles.subhead}>Last 7 days</h3>
                {current.inflation_7d.basket_items === 0 ? (
                  <p className={styles.muted}>Not enough trade to compare this week with last.</p>
                ) : (
                  <>
                    <p className={styles.inflationHead}>
                      <span>{signedPct(current.inflation_7d.composite_pct)}</span>
                      composite, across {formatNumber(current.inflation_7d.basket_items)} items
                    </p>
                    <ul className={styles.diverging}>
                      {inflation.map(([cat, pct]) => (
                        <li key={cat}>
                          <span className={styles.barLabel}>{titleCase(cat)}</span>
                          <span className={styles.divTrack}>
                            <span
                              className={pct >= 0 ? styles.divUp : styles.divDown}
                              style={{ width: `${(Math.abs(pct) / maxInflation) * 50}%` }}
                            />
                          </span>
                          <span className={styles.barFigure}>{signedPct(pct)}</span>
                        </li>
                      ))}
                    </ul>
                    <Legend items={[['Rising', C.sink], ['Falling', C.player]]} />
                  </>
                )}
                {categories.length < 3 && (
                  <p className={styles.muted}>
                    {(['ore', 'refined', 'component'] as const).filter((k) => !categories.includes(k)).map(titleCase).join(', ')}: no
                    base-period trades, so no index yet.
                  </p>
                )}
              </div>
            </div>
          </Chapter>

          <div className={styles.pair}>
            <Chapter n="05" title="Most traded" lede={<>Exchange value by item category over the last 30 days.</>}>
              <BarList
                rows={report.top_categories.map((c) => ({
                  label: titleCase(c.category),
                  value: c.notional,
                  color: C.player,
                  figure: `${cr(c.notional)} · ${c.share_pct.toFixed(1)}%`,
                  note: `${formatCompact(c.units)} units`,
                }))}
              />
            </Chapter>

            <Chapter n="06" title="Activity" lede={<>What players did each day.</>}>
              <div className={styles.multiples}>
                {([['active', 'Active players', 'players'], ['mined', 'Ore mined', 'units'], ['crafted', 'Items crafted', 'units']] as const).map(([field, title, unit]) => (
                  <div key={field}>
                    <h3 className={styles.subhead}>
                      {title}
                      <span>{formatCompact(rows.at(-1)?.[field] ?? 0)}</span>
                    </h3>
                    <ActivityChart rows={rows} field={field} unit={unit} />
                  </div>
                ))}
              </div>
            </Chapter>
          </div>
        </>
      )}

      <section className={`console-panel ${styles.method}`} aria-labelledby="method">
        <h2 id="method" className="console-panel-header">How we measure</h2>
        <dl className="console-panel-body">
          <dt>Money supply</dt>
          <dd>Every credit that exists: player wallets, player buy orders and faction treasuries (held by players), plus station managers, empire treasuries, citizen pools, NPC buy orders, the ship insurer and other NPC accounts. Credits held in contract escrow sit outside it until released.</dd>
          <dt>Faucet</dt>
          <dd>A game event that creates credits, such as a pirate bounty or a mission no treasury pays for.</dd>
          <dt>Sink</dt>
          <dd>A game event that destroys credits, such as shipbuilding labor or a station founding fee.</dd>
          <dt>Transfer</dt>
          <dd>Credits moving from one holder to another: trades, taxes, fees, treasury-paid rewards. Transfers never change the supply, so they are neither faucets nor sinks.</dd>
          <dt>Unattributed</dt>
          <dd>Supply change minus (faucets − sinks). Mostly credits entering or leaving contract escrow; anything else is a path we do not count yet.</dd>
          <dt>NPC</dt>
          <dd>In trade figures, station managers and empire treasuries. In the money supply, every non-player account listed above.</dd>
          <dt>Price index</dt>
          <dd>A fixed basket per category, weighted by traded value in the base period ({baseStart} to {baseEnd}). 100 means base-period prices. A gap means no data, not zero.</dd>
          <dt>Cadence</dt>
          <dd>The server rebuilds the report hourly. Daily figures cover complete UTC days, so the latest day is yesterday. This page refreshes every 15 minutes.</dd>
        </dl>
        <p className={styles.sources}>
          <a href={REPORT_URL} rel="noopener">Raw report (JSON) <ExternalLink size={11} aria-hidden /></a>
          <a href={DOCS_URL} rel="noopener">API docs <ExternalLink size={11} aria-hidden /></a>
        </p>
      </section>
    </div>
  )
}
