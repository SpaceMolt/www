import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight } from 'lucide-react'
import { formatCompact, formatNumber, titleCase } from '@/lib/format'
import { ActivityChart, BondFlowChart, BondPriceChart, FlowsChart, Legend, PriceChart, SupplyChart, TradeChart } from './charts'
import { C } from './chartTheme'
import {
  bondHeadline, bondSummary, chartRows, compact, summaryOnlyUntil, tradeGapNote, dayLabel, exchangeVolume, flowCaption, holders, inBrief, INDEX_NAME, indexedCategories, lastDays,
  playerHeld, priceHeadline, signed, signedPct, summarize, tradeHeadline, utcDateTime, type EconomyReport,
} from './economy'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

/** Every period figure on the page covers the last WINDOW days (or all of them, if fewer). */
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

const cr = (n: number) => `${compact(n)} cr`
const signedCr = (n: number) => `${signed(n)} cr`

/** A numbered section: topic in the panel bar, the finding as its title, then a plain explanation. */
function Chapter({ n, topic, title, lede, children }: { n: string; topic: string; title: string; lede: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`console-panel ${styles.chapter}`} aria-labelledby={`ch-${n}`}>
      <div className="console-panel-header">
        <span className={styles.chapterNum}>{n}</span>
        {topic}
      </div>
      <div className={styles.chapterBody}>
        <h2 id={`ch-${n}`} className={styles.finding}>{title}</h2>
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

/** Plain notes for the created/destroyed rows that need one. */
const FAUCET_NOTES: Record<string, string> = {
  missions: 'rewards no empire or faction pays for',
  respawns: 'topping pilots up to the minimum balance after a death',
  dev_team: 'credits the dev team handed out',
  npc_seeding: 'start-up money for new NPC stations',
}
const SINK_NOTES: Record<string, string> = {
  shipbuilding: 'cancelled ship orders, and builds at outposts',
  labor: 'station work no citizen pool is paid for',
  dev_team: 'credits the dev team took out',
}

function Kpi({ label, window, value, unit, sub }: { label: string; window: string; value: string; unit?: string; sub: React.ReactNode }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>
        {label}
        <span>{window}</span>
      </span>
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
        How the galaxy&apos;s single currency, the credit (cr), moves: where new credits come from, who holds
        them, and where they go. Galaxy-wide totals; no player is named.
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
            The report is not available right now. After a server restart it takes a few minutes. Check back shortly.
          </p>
        </section>
      </div>
    )
  }

  const { current, days } = report
  const ms = current.money_supply
  const last = days.at(-1)
  const recent = lastDays(days, WINDOW)
  const rows = chartRows(recent)
  const s = summarize(recent)
  const span = `${s.days} days`
  const players = playerHeld(ms)
  const playerShare = ms.total ? (players / ms.total) * 100 : 0
  const categories = indexedCategories(recent)
  const { price_index_base_start: baseStart, price_index_base_end: baseEnd } = report
  const baseWeek = `${dayLabel(baseStart)}–${dayLabel(baseEnd)}`
  const indexName = (cat: string) => INDEX_NAME[cat as keyof typeof INDEX_NAME] ?? titleCase(cat)
  const inflation = Object.entries(current.inflation_7d.by_category).sort((a, b) => b[1] - a[1])
  const maxInflation = Math.max(0.1, ...inflation.map(([, v]) => Math.abs(v)))
  // Days before detailed accounting carry totals only: no created/destroyed split, gap or authenticator use.
  const summaryUntil = summaryOnlyUntil(recent)
  const flowSpan = `${s.detailedDays} days`
  const accountingNote = summaryUntil && s.detailedFrom
    ? `Breakdowns start ${dayLabel(s.detailedFrom)}. Shaded days show totals only.`
    : null
  const pct = Math.abs(s.changePct)
  const supplyTitle = pct < 1
    ? `Supply is steady: ${signedPct(s.changePct, 2)} in ${span}`
    : `Supply ${s.change > 0 ? 'grew' : 'shrank'} ${pct.toFixed(1)}% in ${span}`
  const caption = flowCaption(recent)
  const topCategory = report.top_categories[0]
  // Active players are counted only from detailed accounting on.
  const activeDays = recent.filter((d) => d.active_players !== null)
  const firstActive = activeDays.length > 1 ? activeDays[0].active_players! : 0
  const lastActive = activeDays.at(-1)?.active_players ?? 0
  const activeSpan = activeDays.length > 1 ? `${activeDays.length} days` : span
  const bonds = bondSummary(recent, current.trade_authenticators)
  const bondStock = current.trade_authenticators
  const signedCount = (n: number) => `${n > 0 ? '+' : n < 0 ? '\u2212' : ''}${formatNumber(Math.abs(n))}`
  const segmentColor: Record<string, string> = {
    window_sold_to_players: C.window, window_sold_to_stations: C.window, window_bought_back: C.window,
    players_to_stations: C.p2s, stations_to_players: C.s2p, player_to_player: C.p2p, station_to_station: C.neutral,
  }
  const activeChange = firstActive ? ((lastActive - firstActive) / firstActive) * 100 : 0
  // Fill-based figures miss instant matches before detailed accounting; the report dates it.
  const tradesSince = report.detailed_accounting_since
  const fillNote = tradeGapNote(tradesSince, recent[0]?.date ?? '')
  const categoriesFrom = last ? new Date(Date.parse(`${last.date}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10) : ''
  const categoriesNote = tradeGapNote(tradesSince, categoriesFrom)
  // The fixed base week keeps its gap even after the days in view are complete.
  const baseNote = tradeGapNote(tradesSince, baseStart)
    ? `The base week (${baseWeek}) also misses orders that filled instantly.`
    : null

  return (
    <div className="console-page">
      <Header>
        <p className={styles.meta}>
          <span>Data as of {utcDateTime(current.captured_at)}</span>
          {last && <span>Daily figures {dayLabel(s.from)}–{dayLabel(s.to)} ({span}, UTC)</span>}
          <span>Updated hourly</span>
        </p>
      </Header>

      {last && (
        <section className={`console-panel ${styles.brief}`} aria-labelledby="brief">
          <h2 id="brief" className="console-panel-header">In brief</h2>
          <ul>
            {inBrief(s, current).map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      )}

      <div className={styles.kpis}>
        <Kpi
          label="Money supply"
          window="now"
          value={compact(ms.total)}
          unit="cr"
          sub={last ? (
            <>
              {s.change >= 0 ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
              {signedPct(s.changePct, 2)} over {span}
            </>
          ) : 'No complete day yet'}
        />
        <Kpi label="Held by players" window="now" value={`${playerShare.toFixed(1)}%`} sub={`${compact(players)} of ${cr(ms.total)}`} />
        <Kpi
          label="Net new credits"
          window={flowSpan}
          value={s.detailedFrom ? signed(s.net) : '—'}
          unit={s.detailedFrom ? 'cr' : undefined}
          sub={last?.faucets && last.sinks ? `Yesterday: ${signed(last.faucets.total - last.sinks.total)}` : 'No breakdown yet'}
        />
        <Kpi
          label="Market trade"
          window={span}
          value={last ? compact(s.trade.total) : '—'}
          unit={last ? 'cr' : undefined}
          sub={last ? `Yesterday: ${compact(exchangeVolume(last.trade))}` : 'No complete day yet'}
        />
        <Kpi label="Active players" window="last 24h" value={formatNumber(current.players.active_24h)} sub={`of ${formatNumber(current.players.registered)} registered`} />
      </div>

      {!last ? (
        <section className="console-panel">
          <h2 className="console-panel-header">Daily series</h2>
          <p className={`console-panel-body ${styles.muted}`}>No complete UTC day has been recorded yet. Daily charts appear after the first full day.</p>
        </section>
      ) : (
        <>
          <Chapter
            n="01"
            topic="Money supply"
            title={supplyTitle}
            lede={
              <>
                All credits in wallets, treasuries and market orders, counted daily. Money held in contracts is not
                counted. If the game creates credits faster than it destroys them, prices rise. Players hold{' '}
                <strong>{playerShare.toFixed(1)}%</strong>; NPCs hold the rest.
              </>
            }
          >
            <div className={styles.split}>
              <div className={styles.chart}>
                <h3 className={styles.subhead}>Change in supply since the start of {dayLabel(s.from)}</h3>
                <SupplyChart rows={rows} since={dayLabel(s.from)} />
                <h3 className={`${styles.subhead} ${styles.figureHead}`}>Who holds the wealth</h3>
                <dl className={`${styles.figures} ${styles.figureRow}`}>
                  <div>
                    <dt>Richest 10% of earners</dt>
                    <dd>{current.players.top_10pct_share.toFixed(1)}%</dd>
                    <span>of wallet credits, among players who have earned</span>
                  </div>
                  <div>
                    <dt>Median wallet</dt>
                    <dd>{formatNumber(current.players.median_wallet)} cr</dd>
                    <span>half of those players hold less</span>
                  </div>
                  <div>
                    <dt>Player factions</dt>
                    <dd>{formatNumber(current.factions)}</dd>
                    <span>player groups with a shared treasury</span>
                  </div>
                  <div>
                    <dt>Station facilities</dt>
                    <dd>{formatNumber(current.active_facilities)}</dd>
                    <span>running at all stations</span>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className={styles.subhead}>Who holds it now</h3>
                <Legend items={[['Players', C.player], ['NPCs', C.npc]]} />
                <BarList
                  rows={holders(ms).map((h) => ({
                    label: h.label,
                    note: h.note,
                    value: h.value,
                    color: h.side === 'player' ? C.player : C.npc,
                    figure: `${cr(h.value)} · ${ms.total ? ((h.value / ms.total) * 100).toFixed(1) : '0'}%`,
                  }))}
                />
              </div>
            </div>
          </Chapter>

          <Chapter
            n="02"
            topic="Credits created and destroyed"
            title={
              !s.detailedFrom
                ? 'No breakdown yet'
                : s.net === 0
                  ? `Credits created and destroyed balanced out over ${flowSpan}`
                  : `More credits ${s.net > 0 ? 'created than destroyed' : 'destroyed than created'}: net ${signedCr(s.net)} in ${flowSpan}`
            }
            lede={
              <>
                The game creates credits when it pays players directly: pirate bounties, some mission rewards,
                starting money. It destroys them when players pay the game, such as a station founding fee. Trades,
                taxes and fees only move credits between holders.
                {s.partial && s.detailedFrom && <> Totals cover the {flowSpan} since {dayLabel(s.detailedFrom)}.</>}
              </>
            }
          >
            <FlowsChart rows={rows} summaryUntil={summaryUntil} />
            {accountingNote && <p className={styles.caption}>{accountingNote}</p>}
            {caption && <p className={styles.caption}>{caption}</p>}
            {s.detailedFrom && <p className={styles.note}>
              Created minus destroyed: <strong>{signedCr(s.net)}</strong>. Actual supply change:{' '}
              <strong>{signedCr(s.detailedChange)}</strong>. The <strong>{cr(Math.abs(s.gap))}</strong> difference
              {s.gapPct !== null && <> ({s.gapPct.toFixed(0)}%)</>} is money moving in and out of contracts, plus
              anything we do not track yet.
            </p>}
            <div className={styles.pair}>
              <BarList
                title={`Where new credits came from · ${flowSpan}`}
                rows={s.faucets.map((f) => ({ ...f, color: C.created, note: FAUCET_NOTES[f.key] }))}
              />
              <BarList
                title={`Where credits were destroyed · ${flowSpan}`}
                rows={s.sinks.map((f) => ({ ...f, color: C.destroyed, note: SINK_NOTES[f.key] }))}
              />
            </div>
          </Chapter>

          <Chapter
            n="03"
            topic="Trade"
            title={tradeHeadline(s.trade)}
            lede={
              <>
                NPC stations buy what players mine and make, and sell supplies back. Players also trade with each
                other. Total over {span}: <strong>{cr(s.trade.total)}</strong>.
              </>
            }
          >
            <div className={styles.split}>
              <TradeChart rows={rows} />
              <dl className={styles.figures}>
                <div>
                  <dt>Taxes & fines</dt>
                  <dd>{cr(s.taxes)}</dd>
                  <span>{span} · paid to the five empires</span>
                </div>
                <div>
                  <dt>Direct player deals</dt>
                  <dd>{cr(s.trade.direct)}</dd>
                  <span>{span} · trades off the market</span>
                </div>
                <div>
                  <dt>Waiting on the market</dt>
                  <dd>{cr(current.exchange.player_sell_value + current.exchange.player_buy_value)}</dd>
                  <span>
                    now · {formatNumber(current.exchange.player_sell_orders)} player sell orders,{' '}
                    {formatNumber(current.exchange.player_buy_orders)} buy orders
                  </span>
                </div>
              </dl>
            </div>
          </Chapter>

          <Chapter
            n="04"
            topic="Prices"
            title={priceHeadline(last.price_index, categories)}
            lede={
              <>
                The price of a fixed basket of goods. 100 = the average over {baseWeek}.
                {categories.some((k) => last.price_index[k] !== null) && (
                  <>
                    {' '}Since then:{' '}
                    {categories.filter((k) => last.price_index[k] !== null).map((k, i, all) => (
                      <span key={k}>
                        {INDEX_NAME[k].toLowerCase()} <strong>{signedPct(last.price_index[k]! - 100)}</strong>
                        {i < all.length - 1 ? ', ' : '.'}
                      </span>
                    ))}
                  </>
                )}
              </>
            }
          >
            <div className={styles.split}>
              <div className={styles.chart}>
                {categories.length > 0 ? <PriceChart rows={rows} categories={categories} /> : <p className={styles.muted}>No category traded in the base week yet.</p>}
                {fillNote && <p className={styles.caption}>{fillNote}</p>}
                {baseNote && <p className={styles.caption}>{baseNote}</p>}
              </div>
              <div className={styles.barList}>
                <h3 className={styles.subhead}>Price change vs. a week ago</h3>
                {current.inflation_7d.basket_items === 0 ? (
                  <p className={styles.muted}>Not enough trade to compare with a week ago.</p>
                ) : (
                  <>
                    <p className={styles.inflationHead}>
                      <span>{signedPct(current.inflation_7d.composite_pct)}</span>
                      all traded items
                    </p>
                    <p className={styles.muted}>
                      Last 24 hours vs. the same hours a week earlier, {formatNumber(current.inflation_7d.basket_items)} items.
                    </p>
                    <ul className={styles.diverging}>
                      {inflation.map(([cat, p]) => (
                        <li key={cat}>
                          <span className={styles.barLabel}>{indexName(cat)}</span>
                          <span className={styles.divTrack}>
                            <span
                              className={p >= 0 ? styles.divUp : styles.divDown}
                              style={{ width: `${(Math.abs(p) / maxInflation) * 50}%` }}
                            />
                          </span>
                          <span className={styles.barFigure}>
                            {p > 0 ? <ArrowUp size={11} aria-label="up" /> : p < 0 ? <ArrowDown size={11} aria-label="down" /> : null}
                            {signedPct(p)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {inflation.some(([cat]) => !categories.includes(cat as keyof typeof INDEX_NAME)) && (
                      <p className={styles.muted}>Includes categories the chart does not show.</p>
                    )}
                  </>
                )}
                {categories.length < 3 && (
                  <p className={styles.muted}>
                    {(['ore', 'refined', 'component'] as const).filter((k) => !categories.includes(k)).map((k) => INDEX_NAME[k]).join(', ')}:
                    no trades in the base week, so no index.
                  </p>
                )}
              </div>
            </div>
          </Chapter>

          <Chapter
            n="05"
            topic="Trade authenticators"
            title={bondHeadline(bonds, s.from)}
            lede={
              <>
                A bond the Nebula Trade Federation sells and buys back at a fixed price. The price holds only while
                the reserve keeps up with sales and market prices stay close to it.
              </>
            }
          >
            <div className={styles.explainer}>
              <h3 className={styles.subhead}>What is a trade authenticator?</h3>
              <dl>
                <dt>A bearer bond</dt>
                <dd>Whoever holds one owns it. The Federation mints them into its reserve.</dd>
                <dt>The window</dt>
                <dd>At Grand Exchange Station. It sells at a fixed price and buys back for a little less.</dd>
                <dt>What they are for</dt>
                <dd>Stations burn them to run trade facilities. A few top Nebula ships need them to build.</dd>
                <dt>Why stations pay more</dt>
                <dd>Stations bid about 1.2× the window price, so haulers profit by carrying them over.</dd>
                <dt>Reading the charts</dt>
                <dd>Green: minted. Orange: used up. Amber line: sold by the window. Prices near the amber line mean the fixed price holds.</dd>
              </dl>
            </div>

            <dl className={`${styles.figures} ${styles.figureRow4}`}>
              <div>
                <dt>Window price</dt>
                <dd>{bondStock.window_sell_price ? `${formatNumber(bondStock.window_sell_price)} cr` : 'Closed'}</dd>
                <span>{bondStock.window_buy_price ? `buys back at ${formatNumber(bondStock.window_buy_price)} cr` : 'not buying back'}</span>
              </div>
              <div>
                <dt>In the reserve</dt>
                <dd>{formatNumber(bondStock.reserve)}</dd>
                <span>
                  {bonds.coverDays === null
                    ? `no window sales in ${span}`
                    : `about ${bonds.coverDays.toFixed(0)} days of sales at ${formatNumber(Math.round(bonds.soldPerDay))} a day`}
                </span>
              </div>
              <div>
                <dt>In circulation</dt>
                <dd>{formatNumber(bondStock.in_circulation)}</dd>
                <span>{bonds.circulationChange !== null && bonds.circulationFrom ? `${signedCount(bonds.circulationChange)} since ${dayLabel(bonds.circulationFrom)}` : bonds.circulationFrom ? `counted from ${dayLabel(bonds.circulationFrom)}` : 'not counted yet'}</span>
              </div>
              <div>
                <dt>Stations paid players</dt>
                <dd>{bonds.stationPrice === null ? '—' : `${formatNumber(Math.round(bonds.stationPrice))} cr`}</dd>
                <span>
                  {bonds.premium === null ? `no sales to stations in ${span}` : `${bonds.premium.toFixed(2)}× window price, ${s.days}-day average`}
                </span>
              </div>
            </dl>

            <div className={styles.split}>
              <div className={styles.chart}>
                <h3 className={styles.subhead}>Made, sold and used up each day</h3>
                <BondFlowChart rows={rows} summaryUntil={summaryUntil} />
              </div>
              <div className={styles.multiples}>
                <div>
                  <h3 className={styles.subhead}>
                    In the reserve
                    <span><small>{dayLabel(last.date)}</small> {formatNumber(last.trade_authenticators.reserve)}</span>
                  </h3>
                  <ActivityChart rows={rows} field="bReserve" unit="In the reserve" color={C.window} />
                </div>
                <div>
                  <h3 className={styles.subhead}>
                    In circulation
                    <span><small>{dayLabel(last.date)}</small> {last.trade_authenticators.in_circulation === null ? '—' : formatNumber(last.trade_authenticators.in_circulation)}</span>
                  </h3>
                  <ActivityChart rows={rows} field="bCirculating" unit="In circulation" summaryUntil={summaryUntil} />
                </div>
              </div>
            </div>

            <div className={`${styles.split} ${styles.splitGap}`}>
              <div className={styles.chart}>
                <h3 className={styles.subhead}>Price per authenticator, daily average</h3>
                <BondPriceChart rows={rows} summaryUntil={summaryUntil} />
                {accountingNote && <p className={styles.caption}>{accountingNote} On those days the window line is the average window trade price.</p>}
                {fillNote && <p className={styles.caption}>{fillNote}</p>}
              </div>
              <BarList
                title={`Where they changed hands · ${span}`}
                rows={bonds.segments.map((x) => ({
                  label: x.label,
                  value: x.units,
                  color: segmentColor[x.key],
                  figure: `${formatNumber(x.units)}${x.avg === null ? '' : ` · ${formatNumber(Math.round(x.avg))} cr`}`,
                }))}
              />
            </div>
          </Chapter>

          <div className={styles.pair}>
            <Chapter
              n="06"
              topic="Most traded"
              title={topCategory ? `Top category: ${indexName(topCategory.category).toLowerCase()}, ${topCategory.share_pct.toFixed(0)}% of market trade by value` : 'No market trade in the last 30 days'}
              lede={
                <>
                  Trade value by item category over the last 30 days, NPC stations included. Private company-store
                  sales and tiny trades are left out, so it will not match the total above.{categoriesNote && <> {categoriesNote}</>}
                </>
              }
            >
              <BarList
                rows={report.top_categories.map((c) => ({
                  label: indexName(c.category),
                  value: c.notional,
                  color: C.neutral,
                  figure: `${cr(c.notional)} · ${c.share_pct.toFixed(1)}%`,
                  note: `${formatNumber(c.units)} units`,
                }))}
              />
            </Chapter>

            <Chapter
              n="07"
              topic="Activity"
              title={
                !firstActive
                  ? activeDays.length ? `${formatNumber(lastActive)} active players on ${dayLabel(activeDays[0].date)}` : 'What players did each day'
                  : Math.abs(activeChange) < 1
                    ? `Player activity is steady over ${activeSpan}`
                    : `Active players ${activeChange > 0 ? 'up' : 'down'} ${Math.abs(activeChange).toFixed(0)}% in ${activeSpan}`
              }
              lede={
                <>
                  Each day: players who sent a command, ore mined, and items crafted.{activeDays.length > 0 && activeDays[0].date !== recent[0]?.date && <> Active players are counted from {dayLabel(activeDays[0].date)}.</>}
                </>
              }
            >
              <div className={styles.multiples}>
                {([['active', 'Active players', 'Players'], ['mined', 'Ore mined', 'Units'], ['crafted', 'Items crafted', 'Units']] as const).map(([field, title, unit]) => (
                  <div key={field}>
                    <h3 className={styles.subhead}>
                      {title}
                      <span>
                        <small>{dayLabel(last.date)}</small> {rows.at(-1)?.[field] == null ? '—' : formatNumber(rows.at(-1)![field]!)}
                      </span>
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
          <dt>Credits (cr)</dt>
          <dd>The one currency. Rounded to 3 digits: 8.05B is about 8.05 billion.</dd>
          <dt>Money supply</dt>
          <dd>Credits in player and NPC wallets, treasuries and market buy orders. Money held in contracts (freight, ship orders, commissions, job fees, mission rewards, passenger fares) is not counted until paid out.</dd>
          <dt>Active player</dt>
          <dd>A player who sent a command in the last 24 hours. NPCs are not counted.</dd>
          <dt>Unexplained difference</dt>
          <dd>Supply change minus (created − destroyed): contract money moving in or out, plus anything we do not track yet.</dd>
          <dt>NPC</dt>
          <dd>A game-run account, such as a station manager or empire treasury.</dd>
          <dt>Price index</dt>
          <dd>A fixed basket per category, weighted by value traded in the base week ({baseWeek}). 100 = base-week prices. A gap means no data.</dd>
          <dt>Trade authenticator</dt>
          <dd>A Nebula Trade Federation bond. Stations burn them as upkeep; some Nebula ships need them to build.</dd>
          <dt>Window</dt>
          <dd>The Federation desk at Grand Exchange Station that sells and buys back authenticators at fixed prices.</dd>
          <dt>Reserve</dt>
          <dd>Authenticators the empire treasuries hold, including those for sale at the window.</dd>
          <dt>In circulation</dt>
          <dd>Authenticators outside the reserve: cargo, storage and other sell orders. Wrecks, packages and ship orders are not counted.</dd>
          <dt>Days of cover</dt>
          <dd>The reserve divided by average daily window sales.</dd>
          <dt>Cadence</dt>
          <dd>Rebuilt hourly. Daily figures are full UTC days, so the latest is yesterday. Period figures cover up to the last {WINDOW} days.</dd>
        </dl>
      </section>
    </div>
  )
}
