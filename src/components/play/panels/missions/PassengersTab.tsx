'use client'

import { useState } from 'react'
import { LogIn, LogOut, RotateCcw, Users } from 'lucide-react'
import type { PassengerView, UnloadPassengerCommandResponse } from '@spacemolt/lib'
import { useCommandMutation, useCommandQuery, useLocationState, usePendingAction } from '@/lib/spacemolt'
import { ConfirmAction, Credits, shared } from '../../shared'
import { groupByDestination } from './logic'
import { useNotify } from './ShippingTab'
import css from './missions.module.css'

const DOCK_HINT = 'Dock at a station to load or unload passengers.'

function unloadText(d?: UnloadPassengerCommandResponse): string {
  if (!d) return 'Passengers unloaded.'
  return 'fare_collected' in d && d.fare_collected > 0 ? `${d.message} (+${d.fare_collected.toLocaleString()} cr)` : d.message
}

export function PassengersTab() {
  const mutate = useCommandMutation()
  const notify = useNotify()
  const pending = usePendingAction() !== null
  const dockedAt = useLocationState()?.docked_at ?? null
  const [target, setTarget] = useState('')
  const [confirm, setConfirm] = useState<PassengerView | 'all' | null>(null)
  const [loadingAll, setLoadingAll] = useState(false)

  const aboard = useCommandQuery(
    async (a) => (await a.commands.spacemolt.list_passengers()).structuredContent,
    [dockedAt],
    { refreshOnSections: ['ship'] },
  )
  const station = useCommandQuery(
    async (a) => (await a.commands.spacemolt.list_station_passengers()).structuredContent,
    [dockedAt],
    { enabled: Boolean(dockedAt) },
  )
  const refreshAll = () => {
    aboard.refetch()
    if (dockedAt) station.refetch()
  }

  const passengers = aboard.data?.passengers ?? []
  const berths = aboard.data?.berths
  const groups = groupByDestination(station.data?.waiting ?? [])
  const handoff = target.trim()

  const unload = async (id: string) => {
    setConfirm(null)
    try {
      const r = await mutate((c) => c.spacemolt.unload_passenger({ id, ...(handoff ? { target: handoff } : {}) }), { label: 'unload_passenger' })
      notify.ok(unloadText(r.delta.details))
      refreshAll()
    } catch (err) {
      notify.fail(err)
    }
  }

  const load = async (destination: string) => {
    const r = await mutate((c) => c.spacemolt.load_passenger({ id: destination }), { label: 'load_passenger' })
    const d = r.delta.details
    notify.ok(d ? `${d.message}${d.skipped_unfunded ? ` (${d.skipped_unfunded} could not board: station cannot fund the fare)` : ''}` : 'Passengers loaded.')
  }

  const loadOne = async (destination: string) => {
    try {
      await load(destination)
    } catch (err) {
      notify.fail(err)
    }
    refreshAll()
  }

  // load_passenger takes one destination per call; walk the groups richest-first until berths run out.
  const loadAll = async () => {
    setLoadingAll(true)
    try {
      for (const g of groups) await load(g.destination)
    } catch (err) {
      notify.fail(err)
    } finally {
      setLoadingAll(false)
      refreshAll()
    }
  }

  const who = confirm === 'all' ? 'everyone' : confirm?.name
  const strands = !handoff && (confirm === 'all' ? passengers : confirm ? [confirm] : []).some((p) => p.destination !== dockedAt)
  const confirmText = `${handoff ? `Hand off ${who} to ${handoff}?` : `Put ${who} off here?`}${
    strands ? ' Passengers not bound here pay nothing, and you lose a little standing with their empire.' : ''
  }`

  return (
    <>
      <div className={`${css.row} ${css.spread}`}>
        <span className={shared.sectionTitle}>
          <Users size={12} /> Aboard ({passengers.length})
        </span>
        <button type="button" className={shared.refreshBtn} onClick={refreshAll} title="Refresh">
          <RotateCcw size={12} />
        </button>
      </div>

      {berths ? (
        <div className={css.row}>
          {(['economy', 'business', 'first'] as const)
            .filter((k) => berths[k].total > 0)
            .map((k) => (
              <span key={k} className={css.meta}>
                {k}: {berths[k].free}/{berths[k].total} free
              </span>
            ))}
        </div>
      ) : (
        aboard.data && <div className={css.hint}>This ship has no passenger berths. Liner hulls and passenger cabin modules add them.</div>
      )}
      {aboard.data?.onboard_service && <div className={css.hint}>{aboard.data.onboard_service}</div>}
      {aboard.error && <div className={css.hint}>{aboard.error}</div>}

      {passengers.map((p) => (
        <div key={p.citizen_id} className={`${css.card} ${p.ticks_remaining <= 0 ? css.cardWarn : ''}`}>
          <div className={`${css.row} ${css.spread}`}>
            <span className={css.name}>{p.name}</span>
            <span className={`${css.value} ${css.good}`}>
              <Credits amount={p.base_fare} />
              {p.speed_bonus ? <> + <Credits amount={p.speed_bonus} /></> : null}
            </span>
          </div>
          <div className={css.row}>
            <span className={css.meta}>
              to {p.destination_name}
              {p.destination_system ? ` [${p.destination_system}]` : ''}
            </span>
            <span className={css.meta}>{p.berth_class ?? p.class}</span>
            <span className={css.meta}>{p.ticks_remaining > 0 ? `${p.ticks_remaining} ticks left` : 'fare guarantee expired'}</span>
            {p.connecting && <span className={css.meta}>connecting</span>}
            {p.destination === dockedAt && <span className={`${css.meta} ${css.good}`}>arrived</span>}
          </div>
          {confirm !== 'all' && confirm?.citizen_id === p.citizen_id ? (
            <ConfirmAction message={confirmText} confirmLabel="Unload" onConfirm={() => unload(p.citizen_id)} onCancel={() => setConfirm(null)} />
          ) : (
            <button
              type="button"
              className={p.destination === dockedAt ? shared.confirmBtn : shared.subtleBtn}
              disabled={pending || !dockedAt}
              title={dockedAt ? undefined : DOCK_HINT}
              onClick={() => (p.destination === dockedAt && !handoff ? unload(p.citizen_id) : setConfirm(p))}
            >
              <LogOut size={12} /> {handoff ? 'Hand off' : p.destination === dockedAt ? 'Deliver' : 'Unload'}
            </button>
          )}
        </div>
      ))}

      {passengers.length > 0 && (
        <>
          <div className={css.row}>
            <input
              className={shared.textInput}
              placeholder="Hand-off target: blank, lounge, or ship id/name"
              aria-label="Hand-off target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <button
              type="button"
              className={shared.warningBtn}
              disabled={pending || !dockedAt}
              title={dockedAt ? undefined : DOCK_HINT}
              onClick={() => setConfirm('all')}
            >
              <LogOut size={12} /> {handoff ? 'Hand off all' : 'Unload all'}
            </button>
          </div>
          <div className={css.hint}>
            Hand-off keeps fares and deadlines: lounge checks them into your faction Transit Lounge here; a ship id or name moves them to a docked ship of yours or a faction mate.
          </div>
          {confirm === 'all' && (
            <ConfirmAction message={confirmText} confirmLabel="Unload all" onConfirm={() => unload('all')} onCancel={() => setConfirm(null)} />
          )}
        </>
      )}

      <div className={shared.sectionTitle}>
        <LogIn size={12} /> Waiting at this station
      </div>
      {!dockedAt && <div className={shared.dockedOnly}>{DOCK_HINT}</div>}
      {dockedAt && station.loading && !station.data && <div className={css.hint}><span className={shared.spinner} /> Loading passengers...</div>}
      {dockedAt && station.error && <div className={css.hint}>{station.error}</div>}
      {dockedAt && station.data && (
        <>
          <div className={css.hint}>
            Demand {station.data.demand_level}, fares x{station.data.fare_surge.toFixed(2)}. {station.data.market_conditions}
          </div>
          {station.data.transit_lounge && (
            <div className={css.meta}>
              {station.data.transit_lounge.lounge}: {station.data.transit_lounge.occupancy}/{station.data.transit_lounge.capacity} connecting passengers (they board with the matching destination)
            </div>
          )}
          {groups.length === 0 && <div className={shared.emptyState}>Nobody is waiting for a ride here.</div>}
          {groups.length > 1 && (
            <button type="button" className={shared.accentBtn} disabled={pending || loadingAll || !berths} onClick={loadAll}>
              {loadingAll ? <span className={shared.spinner} /> : <LogIn size={12} />} Load all destinations
            </button>
          )}
          {groups.map((g) => (
            <div key={g.destination} className={css.card}>
              <div className={`${css.row} ${css.spread}`}>
                <span className={css.name}>
                  {g.destination_name}
                  {g.destination_system ? ` [${g.destination_system}]` : ''}
                </span>
                <span className={`${css.value} ${css.good}`}>~<Credits amount={g.estimated_fare} /></span>
              </div>
              <span className={css.meta}>
                {g.passengers.length} waiting: {g.passengers.map((p) => `${p.name} (${p.class})`).join(', ')}
              </span>
              <button
                type="button"
                className={shared.accentBtn}
                disabled={pending || loadingAll || !berths}
                title={berths ? undefined : 'Your ship has no passenger berths.'}
                onClick={() => loadOne(g.destination)}
              >
                <LogIn size={12} /> Load
              </button>
            </div>
          ))}
        </>
      )}
    </>
  )
}
