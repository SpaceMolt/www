'use client'

import { useState } from 'react'
import { BarChart3, Eye, Radar, Search, Store } from 'lucide-react'
import type {
  EspionageResponse,
  FactionIntelStatusResponse,
  FactionQueryIntelResponse,
  FactionQueryTradeIntelResponse,
  FactionScanPoiResponse,
  FactionTradeIntelStatusResponse,
} from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, useCommandQuery, useLocationState, usePlayer, useSystem } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { ActionButton } from '../../ActionButton'
import { ConfirmAction, shared, useAction } from '../../shared'
import { tradeIntelStation } from './intelPayload'
import { Pager } from './MembersSection'
import fp from '../FactionPanel.module.css'
import styles from './IntelSection.module.css'

const PAGE = 20

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={fp.intelStatItem}>
      <span className={fp.intelStatLabel}>{label}</span>
      <span className={fp.intelStatValue}>{value}</span>
    </div>
  )
}

export function IntelSection() {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const player = usePlayer()
  const location = useLocationState()
  const systemData = useSystem().data
  const pois = systemData && 'system' in systemData ? systemData.system.pois : []
  const isDocked = Boolean(location?.docked_at)

  const { data: factionInfo } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_faction.info({ limit: 1 })).structuredContent,
    [player?.faction_id],
    { enabled: Boolean(player?.faction_id) },
  )
  const allies = factionInfo?.allies ?? []

  const { busy, run } = useAction()
  const [systemFilter, setSystemFilter] = useState({ system_name: '', poi_type: '', resource_type: '', source_faction_id: '' })
  const [intel, setIntel] = useState<FactionQueryIntelResponse | null>(null)
  const [intelStatus, setIntelStatus] = useState<FactionIntelStatusResponse | null>(null)
  const [tradeFilter, setTradeFilter] = useState({ item_id: '', station_name: '', source_faction_id: '' })
  const [trade, setTrade] = useState<FactionQueryTradeIntelResponse | null>(null)
  const [tradeStatus, setTradeStatus] = useState<FactionTradeIntelStatusResponse | null>(null)
  const [scanPoi, setScanPoi] = useState('')
  const [scan, setScan] = useState<FactionScanPoiResponse | null>(null)
  const [confirmSpy, setConfirmSpy] = useState(false)
  const [spy, setSpy] = useState<EspionageResponse | null>(null)

  const info = (text: string) => uiStore.dispatch({ type: 'toast', kind: 'success', text })
  // Drop empty filters so the server sees only what the player set.
  const nonEmpty = <T extends Record<string, string>>(f: T) => Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim()))

  const submitIntel = () => run('submit', async () => {
    if (!location?.system_id) return
    const r = await mutate((c) => c.spacemolt_intel.submit_intel({ systems: [{ system_id: location.system_id, name: location.system_name }] }), { label: 'submit_intel' })
    info(r.delta.details?.message ?? 'Intel submitted')
  })
  const queryIntel = (offset: number) => run('query', async () => {
    setIntel((await store.account.commands.spacemolt_intel.query_intel({ ...nonEmpty(systemFilter), limit: PAGE, offset })).structuredContent ?? null)
  })
  const loadIntelStatus = () => run('status', async () => {
    setIntelStatus((await store.account.commands.spacemolt_intel.intel_status()).structuredContent ?? null)
  })
  const submitTrade = () => run('submitTrade', async () => {
    const market = (await store.account.commands.spacemolt_market.view_market()).structuredContent
    if (!market) return
    const r = await mutate((c) => c.spacemolt_intel.submit_trade_intel({ stations: [tradeIntelStation(market, location?.system_id)] }), { label: 'submit_trade_intel' })
    info(r.delta.details?.message ?? 'Market prices submitted')
  })
  const queryTrade = (offset: number) => run('queryTrade', async () => {
    setTrade((await store.account.commands.spacemolt_intel.query_trade_intel({ ...nonEmpty(tradeFilter), limit: PAGE, offset })).structuredContent ?? null)
  })
  const loadTradeStatus = () => run('tradeStatus', async () => {
    setTradeStatus((await store.account.commands.spacemolt_intel.trade_intel_status()).structuredContent ?? null)
  })
  const runScan = () => run('scan', async () => {
    const r = await mutate((c) => c.spacemolt_intel.scan_poi({ poi_id: scanPoi.trim() }), { label: 'faction_scan_poi' })
    setScan(r.delta.details ?? null)
  })
  const runEspionage = () => {
    setConfirmSpy(false)
    return run('spy', async () => {
      const r = await mutate((c) => c.spacemolt_intel.espionage(), { label: 'espionage' })
      setSpy(r.delta.details ?? null)
    })
  }

  const sourceSelect = (value: string, onChange: (v: string) => void) => allies.length > 0 && (
    <select className={fp.select} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Intel source">
      <option value="">Our faction</option>
      {allies.map((a) => <option key={a.id} value={a.id}>[{a.tag}] {a.name}</option>)}
    </select>
  )

  return (
    <div className={fp.intelSection}>
      <div className={styles.heading}>System intel</div>
      <ActionButton label="Submit Current System" icon={<Radar size={12} />} onClick={submitIntel}
        disabled={!location?.system_id || busy !== null} loading={busy === 'submit'} size="sm" />
      <div className={styles.filters}>
        <input className={fp.inviteInput} placeholder="System name" value={systemFilter.system_name}
          onChange={(e) => setSystemFilter({ ...systemFilter, system_name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && queryIntel(0)} />
        <input className={fp.inviteInput} placeholder="POI type (e.g. asteroid_belt)" value={systemFilter.poi_type}
          onChange={(e) => setSystemFilter({ ...systemFilter, poi_type: e.target.value })} />
        <input className={fp.inviteInput} placeholder="Resource (e.g. iron_ore)" value={systemFilter.resource_type}
          onChange={(e) => setSystemFilter({ ...systemFilter, resource_type: e.target.value })} />
        {sourceSelect(systemFilter.source_faction_id, (v) => setSystemFilter({ ...systemFilter, source_faction_id: v }))}
        <ActionButton label="Query" icon={<Search size={12} />} onClick={() => queryIntel(0)}
          disabled={busy !== null} loading={busy === 'query'} size="sm" />
      </div>
      {intel && (intel.entries.length === 0
        ? <div className={shared.emptyState}>No matching systems.</div>
        : (
          <div className={fp.intelList}>
            {intel.entries.map((entry) => (
              <div key={entry.system_id} className={fp.intelItem}>
                <span className={fp.intelSystemName}>{entry.name}</span>
                {entry.submitter_name && <span className={fp.intelMeta}>by {entry.submitter_name}</span>}
                <span className={fp.intelMeta}>police: {entry.police_level}</span>
                {entry.pois && <span className={fp.intelMeta}>{entry.pois.length} POIs</span>}
              </div>
            ))}
          </div>
        ))}
      {intel && <Pager offset={intel.offset ?? 0} limit={PAGE} total={intel.total} onPage={queryIntel} />}
      <ActionButton label="Intel Status" icon={<BarChart3 size={12} />} onClick={loadIntelStatus}
        disabled={busy !== null} loading={busy === 'status'} variant="secondary" size="sm" />
      {intelStatus && (
        <div className={fp.intelStats}>
          <Stat label="Intel Level" value={intelStatus.intel_level} />
          <Stat label="Coverage" value={`${intelStatus.coverage_pct}%`} />
          <Stat label="Systems Known" value={`${intelStatus.systems_known}${intelStatus.total_systems !== undefined ? ` / ${intelStatus.total_systems}` : ''}`} />
          <Stat label="POIs Known" value={intelStatus.pois_known} />
          {intelStatus.contributors !== undefined && <Stat label="Contributors" value={intelStatus.contributors} />}
          {intelStatus.top_contributor && <Stat label="Top Contributor" value={`${intelStatus.top_contributor} (${intelStatus.top_contributions ?? 0})`} />}
        </div>
      )}

      <div className={styles.heading}>Trade intel</div>
      <ActionButton label="Submit This Market" icon={<Store size={12} />} onClick={submitTrade}
        disabled={!isDocked || busy !== null} loading={busy === 'submitTrade'} size="sm" />
      <div className={styles.filters}>
        <input className={fp.inviteInput} placeholder="Item ID (e.g. iron_ore)" value={tradeFilter.item_id}
          onChange={(e) => setTradeFilter({ ...tradeFilter, item_id: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && queryTrade(0)} />
        <input className={fp.inviteInput} placeholder="Station name" value={tradeFilter.station_name}
          onChange={(e) => setTradeFilter({ ...tradeFilter, station_name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && queryTrade(0)} />
        {sourceSelect(tradeFilter.source_faction_id, (v) => setTradeFilter({ ...tradeFilter, source_faction_id: v }))}
        <ActionButton label="Query" icon={<Search size={12} />} onClick={() => queryTrade(0)}
          disabled={busy !== null} loading={busy === 'queryTrade'} size="sm" />
      </div>
      {trade && (trade.entries.length === 0
        ? <div className={shared.emptyState}>No matching price reports.</div>
        : (
          <table className={styles.table}>
            <thead>
              <tr><th>Station</th><th>Item</th><th>Best buy</th><th>Best sell</th><th>Tick</th></tr>
            </thead>
            <tbody>
              {trade.entries.flatMap((st) => st.items.map((it) => (
                <tr key={`${st.base_id}-${it.item_id}`}>
                  <td>{st.station_name}</td>
                  <td>{it.item_name}</td>
                  <td>{it.best_buy ? `${it.best_buy.toLocaleString()} (${it.buy_volume})` : '-'}</td>
                  <td>{it.best_sell ? `${it.best_sell.toLocaleString()} (${it.sell_volume})` : '-'}</td>
                  <td>{st.submitted_at_tick}</td>
                </tr>
              )))}
            </tbody>
          </table>
        ))}
      {trade && <Pager offset={trade.offset ?? 0} limit={PAGE} total={trade.total} onPage={queryTrade} />}
      <ActionButton label="Trade Intel Status" icon={<BarChart3 size={12} />} onClick={loadTradeStatus}
        disabled={busy !== null} loading={busy === 'tradeStatus'} variant="secondary" size="sm" />
      {tradeStatus && (
        <div className={fp.intelStats}>
          <Stat label="Intel Level" value={tradeStatus.intel_level} />
          <Stat label="Coverage" value={`${tradeStatus.coverage_pct}%`} />
          <Stat label="Stations Known" value={`${tradeStatus.stations_known}${tradeStatus.total_stations !== undefined ? ` / ${tradeStatus.total_stations}` : ''}`} />
          <Stat label="Items Tracked" value={tradeStatus.items_tracked} />
          {tradeStatus.top_contributor && <Stat label="Top Contributor" value={`${tradeStatus.top_contributor} (${tradeStatus.top_contributions ?? 0})`} />}
        </div>
      )}

      <div className={styles.heading}>Sensor scan</div>
      <div className={styles.hint}>Needs a faction Sensor Dome. Range grows with its level.</div>
      <div className={fp.intelQueryRow}>
        <input className={fp.inviteInput} list="intel-scan-pois" placeholder="POI or base ID" value={scanPoi}
          onChange={(e) => setScanPoi(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && scanPoi.trim() && runScan()} />
        <datalist id="intel-scan-pois">
          {pois.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </datalist>
        <ActionButton label="Scan" icon={<Radar size={12} />} onClick={runScan}
          disabled={!scanPoi.trim() || busy !== null} loading={busy === 'scan'} size="sm" />
      </div>
      {scan && (
        <div className={styles.result}>
          <div>{scan.message}</div>
          <div className={fp.intelMeta}>
            {scan.poi_name ?? scan.poi_id} · power {scan.scan_power} · {scan.hops} jump{scan.hops === 1 ? '' : 's'}
          </div>
          {(scan.contacts ?? []).map((c) => (
            <div key={c.target_id} className={fp.intelItem}>
              <span className={fp.intelSystemName}>{c.username ?? 'Unknown pilot'}</span>
              {c.ship_class && <span className={fp.intelMeta}>{c.ship_class}</span>}
              {c.cloaked && <span className={fp.intelMeta}>cloaked</span>}
            </div>
          ))}
          {[...(scan.npcs ?? []), ...(scan.pirates ?? [])].map((n) => (
            <div key={n.id} className={fp.intelItem}>
              <span className={fp.intelSystemName}>{n.name ?? n.id}</span>
              {n.role && <span className={fp.intelMeta}>{n.role}</span>}
              {n.ship_class && <span className={fp.intelMeta}>{n.ship_class}</span>}
            </div>
          ))}
          {(scan.leviathans ?? []).length > 0 && <div className={fp.intelMeta}>{scan.leviathans?.length} leviathan contact(s)</div>}
        </div>
      )}

      <div className={styles.heading}>Espionage</div>
      <div className={styles.hint}>Needs a faction Espionage HQ. Runs at the docked station and takes about 8 ticks.</div>
      {confirmSpy ? (
        <ConfirmAction message="Send a spy into this station? You cannot act until it resolves." icon={<Eye size={12} />}
          onConfirm={runEspionage} onCancel={() => setConfirmSpy(false)} variant="accent" confirmLabel="Send spy" cancelLabel="Cancel" />
      ) : (
        <ActionButton label="Send Spy" icon={<Eye size={12} />} onClick={() => setConfirmSpy(true)}
          disabled={!isDocked || busy !== null} loading={busy === 'spy'} size="sm" />
      )}
      {spy && (
        <div className={styles.result}>
          <div className={fp.intelMeta}>{spy.outcome}{spy.intel_type ? ` · ${spy.intel_type}` : ''}</div>
          <div>{spy.story}</div>
        </div>
      )}
    </div>
  )
}
