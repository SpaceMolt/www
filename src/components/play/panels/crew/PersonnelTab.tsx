'use client'

import { useState } from 'react'
import { ArrowRightLeft, HeartPulse, Landmark, Users, Zap } from 'lucide-react'
import type { FactionPersonnelResponse, MutationResult } from '@spacemolt/lib'
import {
  useAccountStore,
  useCommandMutation,
  useCommandQuery,
  useLocationState,
  useModules,
  usePlayer,
  useShip,
} from '@/lib/spacemolt'
import { ConfirmAction, Credits, QtyButtons, shared, useAction } from '../../shared'
import styles from '../CrewPanel.module.css'
import { CREW_RECRUIT_PRICE, MARINE_RECRUIT_PRICE, freeBerths, parseCount, recruitCost, transferableFitCrew } from './crewLogic'

type Counts = Record<string, string>

function CountField({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (v: string) => void }) {
  return (
    <label className={styles.field}>
      {label} (max {max})
      <span className={styles.row}>
        <input
          className={`${shared.textInput} ${styles.numInput}`}
          inputMode="numeric"
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value)}
        />
        <QtyButtons max={max} current={value} onChange={onChange} />
      </span>
    </label>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  )
}

export function PersonnelTab() {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const ship = useShip()
  const player = usePlayer()
  const location = useLocationState()
  const modules = useModules()
  const { busy: running, run } = useAction()
  const busy = running !== null
  const [confirm, setConfirm] = useState<string | null>(null)
  const [recruit, setRecruit] = useState<Counts>({})
  const [treat, setTreat] = useState<Counts>({})
  const [provider, setProvider] = useState<'station' | 'field' | 'faction'>('station')
  const [treatTarget, setTreatTarget] = useState('')
  const [treatReserve, setTreatReserve] = useState(false)
  const [transfer, setTransfer] = useState<Counts>({})
  const [transferTarget, setTransferTarget] = useState('')
  const [reserveAction, setReserveAction] = useState<'deposit' | 'withdraw' | 'recruit'>('deposit')
  const [reserveCounts, setReserveCounts] = useState<Counts>({})
  const [generatorLine, setGeneratorLine] = useState<string | null>(null)

  const docked = location?.docked_at ?? null
  const inFaction = Boolean(player?.faction_id)
  const p = ship?.personnel
  const crewCap = ship?.effective_crew_capacity ?? 0
  const marineCap = ship?.effective_marine_capacity ?? 0
  const free = freeBerths(p, crewCap, marineCap)
  const credits = player?.credits ?? 0
  const nearby = location?.nearby_players ?? []
  const hasGenerator = Boolean(modules?.some((m) => m.type_id === 'field_generator'))

  const facilities = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.list()).structuredContent,
    [docked],
    { enabled: Boolean(docked), refreshOnEvents: ['personnel_update'] },
  )
  const pools = facilities.data?.service_pools
  // faction_personnel status is a read on the server (query override), so ask it as a query.
  const reserve = useCommandQuery(
    async (account) =>
      (await account.query('spacemolt_ship', 'faction_personnel', { personnel_action: 'status' }))
        .structuredContent as FactionPersonnelResponse | undefined,
    [docked, player?.faction_id],
    { enabled: Boolean(docked) && inFaction, refreshOnEvents: ['personnel_update'] },
  )
  const { refetch: refetchReserve } = reserve
  const { refetch: refetchFacilities } = facilities

  const n = (counts: Counts, key: string, max = Infinity) => parseCount(counts[key] ?? '', max)
  const blankOr = (counts: Counts, key: string) => (counts[key]?.trim() ? n(counts, key) : undefined)

  const recruitCrew = n(recruit, 'crew', free.crew)
  const recruitMarines = n(recruit, 'marines', free.marines)
  const cost = recruitCost(recruitCrew, recruitMarines)

  const doRecruit = () =>
    run('crew',
      () => mutate((c) => c.spacemolt_ship.recruit_personnel({ crew: recruitCrew, marines: recruitMarines }), { label: 'recruit_personnel' }),
      (r) => {
        const d = r.delta.details
        return d ? `Recruited ${d.crew_recruited} crew and ${d.marines_recruited} marines for ${d.cost.toLocaleString()} cr` : undefined
      },
    ).then((r) => {
      setConfirm(null)
      if (r) setRecruit({})
      refetchFacilities()
    })

  const doTreat = () =>
    run('crew',
      () =>
        mutate(
          (c) =>
            c.spacemolt_ship.treat_personnel({
              provider,
              crew: blankOr(treat, 'crew'),
              marines: blankOr(treat, 'marines'),
              id: provider === 'field' && treatTarget ? treatTarget : undefined,
              reserve: provider === 'faction' && treatReserve ? true : undefined,
            }),
          { label: 'treat_personnel' },
        ),
      (r) => {
        const d = r.delta.details
        if (!d) return undefined
        const paid = d.cost ? ` for ${d.cost.toLocaleString()} cr` : d.supplies_used ? ` using ${d.supplies_used} medical supplies` : ''
        return `Treated ${d.crew_treated} crew and ${d.marines_treated} marines${paid}`
      },
    ).then(() => {
      setConfirm(null)
      refetchFacilities()
      refetchReserve()
    })

  const doTransfer = () =>
    run('crew',
      () =>
        mutate(
          (c) =>
            c.spacemolt_ship.transfer_personnel({
              id: transferTarget,
              fit_crew: n(transfer, 'fit_crew'),
              injured_crew: n(transfer, 'injured_crew'),
              fit_marines: n(transfer, 'fit_marines'),
              injured_marines: n(transfer, 'injured_marines'),
            }),
          { label: 'transfer_personnel' },
        ),
      (r) => {
        const d = r.delta.details
        if (!d) return undefined
        const sent = d.fit_crew_transferred + d.injured_crew_transferred
        const marines = d.fit_marines_transferred + d.injured_marines_transferred
        const swapped = d.injured_crew_swapped + d.injured_marines_swapped
        return `Sent ${sent} crew and ${marines} marines to ${d.target}${swapped ? `, ${swapped} injured swapped back` : ''}`
      },
    ).then((r) => r && setTransfer({}))

  const doReserve = () =>
    run('crew',
      () =>
        mutate(
          (c) =>
            c.spacemolt_ship.faction_personnel({
              personnel_action: reserveAction,
              fit_crew: n(reserveCounts, 'fit_crew'),
              fit_marines: n(reserveCounts, 'fit_marines'),
              injured_crew: reserveAction === 'recruit' ? undefined : n(reserveCounts, 'injured_crew'),
              injured_marines: reserveAction === 'recruit' ? undefined : n(reserveCounts, 'injured_marines'),
            }),
          { label: 'faction_personnel' },
        ),
      (r) => {
        const d = r.delta.details
        if (!d) return undefined
        return `Reserve ${reserveAction}: ${d.crew_moved ?? 0} crew, ${d.marines_moved ?? 0} marines${d.cost ? ` for ${d.cost.toLocaleString()} cr` : ''}`
      },
    ).then((r) => {
      setConfirm(null)
      if (r) setReserveCounts({})
      refetchReserve()
    })

  const doGenerator = (disconnect: boolean) =>
    run('crew',
      () =>
        mutate(
          () =>
            store.account.send('spacemolt_ship', 'generator', { disconnect }) as Promise<
              MutationResult<{ message?: string; connected?: boolean; output?: number; end_tick?: number }>
            >,
          { label: 'generator' },
        ),
      (r) => r.delta.details?.message,
    ).then((r) => {
      const d = r?.delta.details
      if (d) setGeneratorLine(d.connected ? `Connected: ${d.output ?? 0} power/tick${d.end_tick ? `, until tick ${d.end_tick}` : ''}` : 'Disconnected')
    })

  const medical = pools?.medical
  const reserveData = reserve.data

  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Users size={14} /> Ship complement
        </div>
        <div className={styles.statGrid}>
          <Stat label="Fit crew" value={p?.fit_crew ?? 0} />
          <Stat label="Injured crew" value={p?.injured_crew ?? 0} />
          <Stat label="Crew berths" value={crewCap} />
          <Stat label="Fit marines" value={p?.fit_marines ?? 0} />
          <Stat label="Injured marines" value={p?.injured_marines ?? 0} />
          <Stat label="Marine berths" value={marineCap} />
          <Stat label="Minimum crew" value={ship?.minimum_crew ?? 0} />
          <Stat label="Crew efficiency" value={`${Math.round((ship?.crew_efficiency ?? 0) * 100)}%`} />
        </div>
        {(ship?.personnel_recovery_ticks_remaining ?? 0) > 0 && (
          <div className={styles.hint}>Injured personnel recover on their own in {ship?.personnel_recovery_ticks_remaining} ticks.</div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Users size={14} /> Recruit
        </div>
        {!docked ? (
          <div className={styles.hint}>Dock at a station with a personnel service (crew) or marine training (marines) to recruit.</div>
        ) : (
          <>
            <div className={styles.meta}>
              <span>
                Crew <b>{CREW_RECRUIT_PRICE} cr</b> each{pools?.personnel ? `, ${pools.personnel.remaining} in pool` : ', no personnel service here'}
              </span>
              <span>
                Marines <b>{MARINE_RECRUIT_PRICE} cr</b> each{pools?.marine_training ? `, ${pools.marine_training.remaining} in pool` : ', no marine training here'}
              </span>
            </div>
            <div className={styles.row}>
              <CountField label="Crew" value={recruit.crew ?? ''} max={free.crew} onChange={(v) => setRecruit({ ...recruit, crew: v })} />
              <CountField label="Marines" value={recruit.marines ?? ''} max={free.marines} onChange={(v) => setRecruit({ ...recruit, marines: v })} />
            </div>
            {confirm === 'recruit' ? (
              <ConfirmAction
                message={`Recruit ${recruitCrew} crew and ${recruitMarines} marines for up to ${cost.toLocaleString()} cr?`}
                onConfirm={doRecruit}
                onCancel={() => setConfirm(null)}
                confirmDisabled={busy}
                variant="accent"
                confirmLabel="Recruit"
              />
            ) : (
              <div className={styles.row}>
                <button
                  className={shared.accentBtn}
                  disabled={busy || recruitCrew + recruitMarines === 0 || cost > credits}
                  onClick={() => setConfirm('recruit')}
                  type="button"
                >
                  Recruit (<Credits amount={cost} />)
                </button>
                {cost > credits && <span className={styles.hint}>Not enough credits.</span>}
              </div>
            )}
            <div className={styles.hint}>Partial fills happen when berths, credits or the station pool run short.</div>
          </>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <HeartPulse size={14} /> Treat injured
        </div>
        <div className={styles.row}>
          <select
            className={shared.selectInput}
            value={provider}
            onChange={(e) => setProvider(e.target.value as typeof provider)}
            aria-label="Medical provider"
          >
            <option value="station">Station infirmary (credits)</option>
            <option value="field">Field (onboard medical module)</option>
            <option value="faction" disabled={!inFaction}>Faction hospital</option>
          </select>
          {provider === 'field' && (
            <select className={shared.selectInput} value={treatTarget} onChange={(e) => setTreatTarget(e.target.value)} aria-label="Treat whose ship">
              <option value="">My ship</option>
              {nearby.map((pl) => (
                <option key={pl.player_id} value={pl.username}>
                  {pl.username}
                </option>
              ))}
            </select>
          )}
          {provider === 'faction' && (
            <label className={styles.row}>
              <input type="checkbox" checked={treatReserve} onChange={(e) => setTreatReserve(e.target.checked)} />
              <span className={styles.hint}>Treat the faction reserve (ManageTreasury)</span>
            </label>
          )}
        </div>
        <div className={styles.row}>
          <CountField label="Crew" value={treat.crew ?? ''} max={p?.injured_crew ?? 0} onChange={(v) => setTreat({ ...treat, crew: v })} />
          <CountField label="Marines" value={treat.marines ?? ''} max={p?.injured_marines ?? 0} onChange={(v) => setTreat({ ...treat, marines: v })} />
        </div>
        <div className={styles.hint}>
          Blank counts treat as many as possible.{' '}
          {provider === 'station' &&
            (medical
              ? `Station price: ${medical.crew_treatment_price ?? 25} cr/crew, ${medical.marine_treatment_price ?? 50} cr/marine; ${medical.remaining} treatments left in the pool.`
              : 'Station treatment costs at least 25 cr/crew and 50 cr/marine. Requires docking at a station with a medical service.')}
          {provider === 'field' && 'Field treatment uses 1 medical_supplies per 5 patients from cargo and needs a medical module. Allies must be at your POI.'}
          {provider === 'faction' &&
            (reserveData ? `Faction hospital here: ${reserveData.medical_available}/${reserveData.medical_capacity} treatments available.` : 'Uses your faction hospital at this station, no personal charge.')}
        </div>
        {(provider === 'station' || provider === 'faction') && !docked ? (
          <div className={styles.hint}>Dock to use this provider.</div>
        ) : confirm === 'treat' ? (
          <ConfirmAction
            message={provider === 'station' ? 'Pay the station infirmary to treat injured personnel?' : 'Treat injured personnel?'}
            onConfirm={doTreat}
            onCancel={() => setConfirm(null)}
            confirmDisabled={busy}
            variant="accent"
            confirmLabel="Treat"
          />
        ) : (
          <div className={styles.row}>
            <button className={shared.accentBtn} disabled={busy} onClick={() => setConfirm('treat')} type="button">
              <HeartPulse size={12} /> Treat
            </button>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <ArrowRightLeft size={14} /> Transfer to an allied ship
        </div>
        {nearby.length === 0 ? (
          <div className={styles.hint}>No other ships at your POI.</div>
        ) : (
          <>
            <select className={shared.selectInput} value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)} aria-label="Transfer target">
              <option value="">Choose a ship...</option>
              {nearby.map((pl) => (
                <option key={pl.player_id} value={pl.username}>
                  {pl.username}
                  {pl.ship_class ? ` (${pl.ship_class})` : ''}
                </option>
              ))}
            </select>
            <div className={styles.row}>
              <CountField label="Fit crew" value={transfer.fit_crew ?? ''} max={transferableFitCrew(p)} onChange={(v) => setTransfer({ ...transfer, fit_crew: v })} />
              <CountField label="Injured crew" value={transfer.injured_crew ?? ''} max={p?.injured_crew ?? 0} onChange={(v) => setTransfer({ ...transfer, injured_crew: v })} />
              <CountField label="Fit marines" value={transfer.fit_marines ?? ''} max={p?.fit_marines ?? 0} onChange={(v) => setTransfer({ ...transfer, fit_marines: v })} />
              <CountField
                label="Injured marines"
                value={transfer.injured_marines ?? ''}
                max={p?.injured_marines ?? 0}
                onChange={(v) => setTransfer({ ...transfer, injured_marines: v })}
              />
            </div>
            <div className={styles.row}>
              <button className={shared.actionBtn} disabled={busy || !transferTarget} onClick={doTransfer} type="button">
                <ArrowRightLeft size={12} /> Transfer
              </button>
            </div>
            <div className={styles.hint}>
              Both ships must be out of combat. You keep one fit crew. If the target is full, your fit personnel swap places with their injured.
            </div>
          </>
        )}
      </div>

      {inFaction && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Landmark size={14} /> Faction reserve
          </div>
          {!docked ? (
            <div className={styles.hint}>Dock at a station where your faction keeps a personnel reserve.</div>
          ) : reserve.error ? (
            <div className={styles.hint}>{reserve.error}</div>
          ) : !reserveData ? (
            <div className={styles.hint}>Loading reserve...</div>
          ) : (
            <>
              <div className={styles.statGrid}>
                <Stat label="Fit crew" value={reserveData.fit_crew} />
                <Stat label="Injured crew" value={reserveData.injured_crew} />
                <Stat label="Crew berths" value={reserveData.crew_capacity} />
                <Stat label="Fit marines" value={reserveData.fit_marines} />
                <Stat label="Injured marines" value={reserveData.injured_marines} />
                <Stat label="Marine berths" value={reserveData.marine_capacity} />
                <Stat label="Inbound crew" value={`${reserveData.inbound_crew} (${reserveData.inbound_prizes} prizes)`} />
              </div>
              <select
                className={shared.selectInput}
                value={reserveAction}
                onChange={(e) => setReserveAction(e.target.value as typeof reserveAction)}
                aria-label="Reserve action"
              >
                <option value="deposit">Deposit from my ship</option>
                <option value="withdraw">Withdraw to my ship (ManageTreasury)</option>
                <option value="recruit">Recruit with treasury (ManageTreasury)</option>
              </select>
              <div className={styles.row}>
                {(reserveAction === 'recruit' ? ['fit_crew', 'fit_marines'] : ['fit_crew', 'injured_crew', 'fit_marines', 'injured_marines']).map((key) => (
                  <label key={key} className={styles.field}>
                    {key.replace('_', ' ')}
                    <input
                      className={`${shared.textInput} ${styles.numInput}`}
                      inputMode="numeric"
                      placeholder="0"
                      value={reserveCounts[key] ?? ''}
                      onChange={(e) => setReserveCounts({ ...reserveCounts, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              {confirm === 'reserve' ? (
                <ConfirmAction
                  message={
                    reserveAction === 'recruit'
                      ? `Spend about ${recruitCost(n(reserveCounts, 'fit_crew'), n(reserveCounts, 'fit_marines')).toLocaleString()} cr of faction treasury?`
                      : `${reserveAction} these personnel?`
                  }
                  onConfirm={doReserve}
                  onCancel={() => setConfirm(null)}
                  confirmDisabled={busy}
                  variant="accent"
                />
              ) : (
                <div className={styles.row}>
                  <button
                    className={shared.actionBtn}
                    disabled={busy}
                    onClick={() => (reserveAction === 'recruit' ? setConfirm('reserve') : doReserve())}
                    type="button"
                  >
                    Apply
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Zap size={14} /> Field generator
        </div>
        <div className={styles.hint}>
          Feed the docked station&apos;s power grid. Burns 1 fuel per tick; the link ends on undock, after 360 ticks, or below 10% fuel.
        </div>
        {!docked ? (
          <div className={styles.hint}>Dock at a station to connect.</div>
        ) : !hasGenerator ? (
          <div className={styles.hint}>Fit a field_generator module to use this.</div>
        ) : (
          <div className={styles.row}>
            <button className={shared.accentBtn} disabled={busy} onClick={() => doGenerator(false)} type="button">
              <Zap size={12} /> Connect
            </button>
            <button className={shared.subtleBtn} disabled={busy} onClick={() => doGenerator(true)} type="button">
              Disconnect
            </button>
            {generatorLine && <span className={styles.hint}>{generatorLine}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
