'use client'

import { useEffect, useState } from 'react'
import { Anchor, Flag, Fuel, Navigation, Pause, Play, Wrench } from 'lucide-react'
import { fetchStations, type StationSummary } from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, useLocationState, usePlayer, useSection } from '@/lib/spacemolt'
import { shared } from '../../shared'
import styles from '../CrewPanel.module.css'
import { parseCount } from './crewLogic'
import { useCrewAction } from './useCrewAction'

const GAMESERVER_URL = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

const WAIT_REASONS: Record<string, string> = {
  no_route: 'no route to destination',
  no_fuel: 'out of fuel',
  destination_missing: 'destination lost, redirect it',
  incapacitated: 'hull incapacitated, repair it',
  manual_stop: 'stopped by you',
}

const describe = (p: { ship_name?: string; ship_class: string }) => p.ship_name || p.ship_class.replace(/_/g, ' ')

export function PrizesTab() {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const location = useLocationState()
  const player = usePlayer()
  const recoveries = useSection('prize_recoveries') ?? []
  const { busy, run } = useCrewAction()
  const [stations, setStations] = useState<StationSummary[]>([])
  const [destination, setDestination] = useState('')
  const [disposition, setDisposition] = useState<'aboard' | 'faction_reserve'>('aboard')
  const [redirect, setRedirect] = useState<Record<string, string>>({})
  const [qty, setQty] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchStations(GAMESERVER_URL).then(
      (list) => setStations(list.stations.filter((s) => !s.wrecked).sort((a, b) => a.name.localeCompare(b.name))),
      () => setStations([]),
    )
  }, [])

  // Prize pushes carry no state delta; re-read the status blob so prize_recoveries updates.
  useEffect(() => {
    const refresh = () => void store.account.refresh().catch(() => undefined)
    const offs = [store.account.on('prize_update', refresh), store.account.on('ship_captured', refresh)]
    return () => offs.forEach((off) => off())
  }, [store])

  const dest = destination || player?.home_base || ''
  const stationName = (baseId: string) => stations.find((s) => s.base_id === baseId)?.name ?? baseId
  const claimable = (location?.nearby_prizes ?? []).filter((p) => p.status === 'available')
  const others = (location?.nearby_prizes ?? []).filter((p) => p.status !== 'available' && !recoveries.some((r) => r.prize_id === p.prize_id))

  const stationOptions = stations.map((s) => (
    <option key={s.base_id} value={s.base_id}>
      {s.name} ({s.system_name})
    </option>
  ))

  const claim = (id: string) =>
    run(
      () => mutate((c) => c.spacemolt_salvage.claim_prize({ id, target: dest, crew_disposition: disposition }), { label: 'claim_prize' }),
      (r) => {
        const d = r.delta.details
        return d && `${d.ship_name}: ${d.crew_assigned} prize crew flying it to ${d.destination_name}`
      },
    )

  const service = (id: string, service_action: 'stop' | 'resume' | 'redirect' | 'refuel' | 'repair') =>
    run(
      () =>
        mutate(
          (c) =>
            c.spacemolt_salvage.service_prize({
              id,
              service_action,
              target: service_action === 'redirect' ? redirect[id] : undefined,
              quantity: service_action === 'refuel' || service_action === 'repair' ? parseCount(qty[`${service_action}:${id}`] ?? '') || undefined : undefined,
            }),
          { label: 'service_prize' },
        ),
      (r) => {
        const d = r.delta.details
        if (!d) return undefined
        if (d.fuel_transferred) return `Transferred ${d.fuel_transferred} fuel to the prize`
        if (d.hull_repaired) return `Repaired ${d.hull_repaired} hull with ${d.repair_kits_used ?? 0} kits`
        return `Prize ${service_action}: now ${d.status.replace('_', ' ')}`
      },
    )

  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Anchor size={14} /> Intact prizes here
        </div>
        {claimable.length === 0 && others.length === 0 ? (
          <div className={styles.hint}>No captured ships at this POI. Board and capture a ship in battle to take it as a prize.</div>
        ) : (
          <>
            <div className={styles.row}>
              <label className={`${styles.field} ${styles.grow}`}>
                Fly to
                <select className={shared.selectInput} value={dest} onChange={(e) => setDestination(e.target.value)}>
                  {!stations.some((s) => s.base_id === dest) && dest && <option value={dest}>{dest}</option>}
                  {stationOptions}
                </select>
              </label>
              <label className={styles.field}>
                Prize crew returns to
                <select className={shared.selectInput} value={disposition} onChange={(e) => setDisposition(e.target.value as typeof disposition)}>
                  <option value="aboard">My ship</option>
                  <option value="faction_reserve" disabled={!player?.faction_id}>
                    Faction reserve at destination
                  </option>
                </select>
              </label>
            </div>
            <div className={styles.hint}>
              Claiming assigns the hull&apos;s minimum crew from your fit crew (you keep one). You must be out of combat. A prize stays
              exclusive to its boarder for a while, then anyone may claim it.
            </div>
            {[...claimable, ...others].map((p) => (
              <div key={p.prize_id} className={shared.listCard}>
                <span className={shared.listCardName}>{describe(p)}</span>
                <span className={shared.listCardMeta}>
                  <span>
                    hull {p.hull}/{p.max_hull}
                  </span>
                  {p.in_combat && <span className={shared.badgeRed}>In combat</span>}
                  {p.status === 'available' ? (
                    <button
                      className={shared.accentBtn}
                      disabled={busy || p.in_combat || !dest}
                      onClick={() => claim(p.prize_id)}
                      type="button"
                    >
                      <Flag size={12} /> Claim
                    </button>
                  ) : (
                    <span className={shared.badgeGrey}>{p.status.replace('_', ' ')}</span>
                  )}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Navigation size={14} /> My prize recoveries
        </div>
        {recoveries.length === 0 && <div className={styles.hint}>You have no prizes in recovery.</div>}
        {recoveries.map((r) => {
          const here = r.poi_id === location?.poi_id
          const moving = Boolean(r.transit_kind)
          const active = r.status === 'claimed' || r.status === 'in_transit'
          return (
            <div key={r.prize_id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>{describe(r)}</div>
                <span className={shared.badgeCyan}>{r.status.replace('_', ' ')}</span>
              </div>
              <div className={styles.meta}>
                <span>
                  to <b>{stationName(r.destination_base_id)}</b>
                </span>
                <span>
                  <Fuel size={10} /> {r.fuel}/{r.max_fuel}
                </span>
                <span>
                  <Wrench size={10} /> {r.hull}/{r.max_hull}
                </span>
                <span>{r.prize_crew_fit} crew aboard</span>
                {moving && <span>{r.transit_kind === 'jump' ? `jumping to ${r.transit_to_system_id}` : `travelling to ${r.transit_to_poi_id}`}</span>}
                {!moving && r.poi_id && <span>{here ? 'at your POI' : `at ${r.poi_id}`}</span>}
                {r.wait_reason && <span className={shared.badgeOrange}>{WAIT_REASONS[r.wait_reason] ?? r.wait_reason}</span>}
              </div>
              {active && (
                <>
                  {!here && <div className={styles.hint}>Go to the prize&apos;s POI to service it.</div>}
                  <div className={styles.row}>
                    {r.wait_reason === 'manual_stop' ? (
                      <button className={shared.actionBtn} disabled={busy || !here || moving} onClick={() => service(r.prize_id, 'resume')} type="button">
                        <Play size={12} /> Resume
                      </button>
                    ) : (
                      <button className={shared.actionBtn} disabled={busy || !here || moving} onClick={() => service(r.prize_id, 'stop')} type="button">
                        <Pause size={12} /> Stop
                      </button>
                    )}
                    <input
                      className={`${shared.textInput} ${styles.numInput}`}
                      inputMode="numeric"
                      placeholder="max"
                      value={qty[`refuel:${r.prize_id}`] ?? ''}
                      onChange={(e) => setQty({ ...qty, [`refuel:${r.prize_id}`]: e.target.value })}
                      aria-label="Fuel to transfer"
                    />
                    <button className={shared.actionBtn} disabled={busy || !here} onClick={() => service(r.prize_id, 'refuel')} type="button">
                      <Fuel size={12} /> Refuel
                    </button>
                    <input
                      className={`${shared.textInput} ${styles.numInput}`}
                      inputMode="numeric"
                      placeholder="1 kit"
                      value={qty[`repair:${r.prize_id}`] ?? ''}
                      onChange={(e) => setQty({ ...qty, [`repair:${r.prize_id}`]: e.target.value })}
                      aria-label="Repair kits to use"
                    />
                    <button className={shared.actionBtn} disabled={busy || !here} onClick={() => service(r.prize_id, 'repair')} type="button">
                      <Wrench size={12} /> Repair
                    </button>
                  </div>
                  <div className={styles.row}>
                    <select
                      className={`${shared.selectInput} ${styles.grow}`}
                      value={redirect[r.prize_id] ?? ''}
                      onChange={(e) => setRedirect({ ...redirect, [r.prize_id]: e.target.value })}
                      aria-label="New destination"
                    >
                      <option value="">Redirect to...</option>
                      {stationOptions}
                    </select>
                    <button
                      className={shared.actionBtn}
                      disabled={busy || !here || !redirect[r.prize_id]}
                      onClick={() => service(r.prize_id, 'redirect')}
                      type="button"
                    >
                      <Navigation size={12} /> Redirect
                    </button>
                  </div>
                  <div className={styles.hint}>
                    Stop, resume and redirect work only while the prize is stationary. Refuel draws from your tank (keeps 1); repair uses
                    repair kits from your cargo.
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
