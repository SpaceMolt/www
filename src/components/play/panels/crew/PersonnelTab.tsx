'use client'

import { useState } from 'react'
import { ArrowRightLeft, HeartPulse, Landmark, Users, Zap } from 'lucide-react'
import type { FactionPersonnelResponse, MutationResult } from '@spacemolt/lib'
import {
  useAccountStore,
  useCommandMutation,
  useCommandQuery,
  useLocationState,
  usePlayer,
  useShip,
} from '@/lib/spacemolt'
import type { RawCatalogItem } from '@/data/catalog'
import { ConfirmAction, Credits, QtyButtons, shared, useAction } from '../../shared'
import { useFactionPermissions, useFittedModules, useStationServices } from '../../hooks/useGates'
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

/** One bar per berth type: fit, then injured, then empty berths, with an optional minimum marker. */
function BerthBar({ label, fit, injured, berths, minimum = 0 }: { label: string; fit: number; injured: number; berths: number; minimum?: number }) {
  const pct = (n: number) => `${Math.min(100, (n / berths) * 100)}%`
  return (
    <div className={styles.berthRow}>
      <span className={styles.berthLabel}>{label}</span>
      {berths > 0 ? (
        <div className={styles.berthBar}>
          <span className={styles.berthFit} style={{ width: pct(fit) }} />
          <span className={styles.berthInjured} style={{ width: pct(injured) }} />
          {minimum > 0 && <span className={styles.berthMin} style={{ left: pct(minimum) }} title={`Minimum crew: ${minimum}`} />}
        </div>
      ) : (
        <span className={styles.berthNone}>No berths</span>
      )}
      <span className={styles.berthCount}>
        <b>{fit}</b> fit
        {injured > 0 && <span className={styles.berthInjuredText}> + {injured} injured</span>}
        {' '}/ {berths}
        {minimum > 0 && <span className={styles.berthMinText}> (min {minimum})</span>}
      </span>
    </div>
  )
}

const efficiencyClass = (pct: number) => (pct >= 100 ? styles.effGood : pct >= 50 ? styles.effWarn : styles.effBad)

export function PersonnelTab() {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const ship = useShip()
  const player = usePlayer()
  const location = useLocationState()
  const fitted = useFittedModules()
  const services = useStationServices()
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
  const efficiency = Math.round((ship?.crew_efficiency ?? 0) * 100)
  const credits = player?.credits ?? 0
  const nearby = location?.nearby_players ?? []
  // Generator output needs an operational generator and fit crew aboard (gameserver ConnectGenerator).
  const canGenerate = Boolean(docked) && (p?.fit_crew ?? 0) > 0 && fitted.some((m) => (m.generator_output ?? 0) > 0)
  // medical_treatment_rate is in the catalog data but not yet in RawCatalogItem.
  const hasFieldMedical = fitted.some((m) => ((m as RawCatalogItem & { medical_treatment_rate?: number }).medical_treatment_rate ?? 0) > 0)
  const { can } = useFactionPermissions({ enabled: Boolean(docked) && inFaction })
  const canTreasury = can('manage_treasury')

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
  const reserveData = reserve.error ? undefined : reserve.data

  // Treatment: only providers that can act here, and only while someone is injured.
  const shipInjured = (p?.injured_crew ?? 0) + (p?.injured_marines ?? 0)
  const reserveInjured = canTreasury && reserveData ? reserveData.injured_crew + reserveData.injured_marines : 0
  const providers = (
    [
      ['station', 'Station infirmary (credits)', shipInjured > 0 && Boolean(docked) && (services.includes('medical') || Boolean(pools?.medical))],
      ['field', 'Field (onboard medical module)', shipInjured > 0 && hasFieldMedical],
      ['faction', 'Faction hospital', Boolean(docked) && inFaction && (shipInjured > 0 || reserveInjured > 0)],
    ] as const
  ).filter(([, , ok]) => ok)
  const activeProvider = providers.find(([id]) => id === provider)?.[0] ?? providers[0]?.[0]
  const treatingReserve = activeProvider === 'faction' && reserveInjured > 0 && (treatReserve || shipInjured === 0)

  // Recruiting needs the station's pool for that kind and a free berth.
  const canRecruitCrew = Boolean(pools?.personnel) && free.crew > 0
  const canRecruitMarines = Boolean(pools?.marine_training) && free.marines > 0
  // Withdrawing and treasury recruiting need manage_treasury; anyone can deposit.
  const reserveMode = canTreasury ? reserveAction : 'deposit'

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
              provider: activeProvider,
              crew: blankOr(treat, 'crew'),
              marines: blankOr(treat, 'marines'),
              id: activeProvider === 'field' && treatTarget ? treatTarget : undefined,
              reserve: treatingReserve || undefined,
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
              personnel_action: reserveMode,
              fit_crew: n(reserveCounts, 'fit_crew'),
              fit_marines: n(reserveCounts, 'fit_marines'),
              injured_crew: reserveMode === 'recruit' ? undefined : n(reserveCounts, 'injured_crew'),
              injured_marines: reserveMode === 'recruit' ? undefined : n(reserveCounts, 'injured_marines'),
            }),
          { label: 'faction_personnel' },
        ),
      (r) => {
        const d = r.delta.details
        if (!d) return undefined
        return `Reserve ${reserveMode}: ${d.crew_moved ?? 0} crew, ${d.marines_moved ?? 0} marines${d.cost ? ` for ${d.cost.toLocaleString()} cr` : ''}`
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

  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <div className={styles.complementHeader}>
          <div className={styles.cardTitle}>
            <Users size={14} /> Ship complement
          </div>
          <span className={`${styles.effBadge} ${efficiencyClass(efficiency)}`} title="Crew efficiency">
            {efficiency}% efficiency
          </span>
        </div>
        <BerthBar label="Crew" fit={p?.fit_crew ?? 0} injured={p?.injured_crew ?? 0} berths={crewCap} minimum={ship?.minimum_crew ?? 0} />
        {marineCap > 0 && <BerthBar label="Marines" fit={p?.fit_marines ?? 0} injured={p?.injured_marines ?? 0} berths={marineCap} />}
        {(p?.fit_crew ?? 0) < (ship?.minimum_crew ?? 0) && (
          <div className={styles.berthWarning}>Below minimum crew: this ship runs at reduced efficiency.</div>
        )}
        {(ship?.personnel_recovery_ticks_remaining ?? 0) > 0 && (
          <div className={styles.hint}>Injured personnel recover on their own in {ship?.personnel_recovery_ticks_remaining} ticks.</div>
        )}
      </div>

      {(canRecruitCrew || canRecruitMarines) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Users size={14} /> Recruit
          </div>
          <div className={styles.meta}>
            {canRecruitCrew && (
              <span>
                Crew <b>{CREW_RECRUIT_PRICE} cr</b> each, {pools?.personnel?.remaining} in pool
              </span>
            )}
            {canRecruitMarines && (
              <span>
                Marines <b>{MARINE_RECRUIT_PRICE} cr</b> each, {pools?.marine_training?.remaining} in pool
              </span>
            )}
          </div>
          <div className={styles.row}>
            {canRecruitCrew && <CountField label="Crew" value={recruit.crew ?? ''} max={free.crew} onChange={(v) => setRecruit({ ...recruit, crew: v })} />}
            {canRecruitMarines && <CountField label="Marines" value={recruit.marines ?? ''} max={free.marines} onChange={(v) => setRecruit({ ...recruit, marines: v })} />}
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
        </div>
      )}

      {activeProvider && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <HeartPulse size={14} /> Treat injured
          </div>
          <div className={styles.row}>
            <select
              className={shared.selectInput}
              value={activeProvider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
              aria-label="Medical provider"
            >
              {providers.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            {activeProvider === 'field' && (
              <select className={shared.selectInput} value={treatTarget} onChange={(e) => setTreatTarget(e.target.value)} aria-label="Treat whose ship">
                <option value="">My ship</option>
                {nearby.map((pl) => (
                  <option key={pl.player_id} value={pl.username}>
                    {pl.username}
                  </option>
                ))}
              </select>
            )}
            {activeProvider === 'faction' && reserveInjured > 0 && shipInjured > 0 && (
              <label className={styles.row}>
                <input type="checkbox" checked={treatReserve} onChange={(e) => setTreatReserve(e.target.checked)} />
                <span className={styles.hint}>Treat the faction reserve</span>
              </label>
            )}
          </div>
          <div className={styles.row}>
            <CountField label="Crew" value={treat.crew ?? ''} max={(treatingReserve ? reserveData?.injured_crew : p?.injured_crew) ?? 0} onChange={(v) => setTreat({ ...treat, crew: v })} />
            <CountField label="Marines" value={treat.marines ?? ''} max={(treatingReserve ? reserveData?.injured_marines : p?.injured_marines) ?? 0} onChange={(v) => setTreat({ ...treat, marines: v })} />
          </div>
          <div className={styles.hint}>
            Blank counts treat as many as possible.{' '}
            {activeProvider === 'station' &&
              (medical
                ? `Station price: ${medical.crew_treatment_price ?? 25} cr/crew, ${medical.marine_treatment_price ?? 50} cr/marine; ${medical.remaining} treatments left in the pool.`
                : 'Station treatment costs at least 25 cr/crew and 50 cr/marine.')}
            {activeProvider === 'field' && 'Field treatment uses 1 medical_supplies per 5 patients from cargo. Allies must be at your POI.'}
            {activeProvider === 'faction' &&
              (reserveData ? `Faction hospital here: ${reserveData.medical_available}/${reserveData.medical_capacity} treatments available.` : 'Uses your faction hospital at this station, no personal charge.')}
          </div>
          {confirm === 'treat' ? (
            <ConfirmAction
              message={activeProvider === 'station' ? 'Pay the station infirmary to treat injured personnel?' : 'Treat injured personnel?'}
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
      )}

      {nearby.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <ArrowRightLeft size={14} /> Transfer to an allied ship
          </div>
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
        </div>
      )}

      {docked && reserveData && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Landmark size={14} /> Faction reserve
          </div>
          <BerthBar label="Crew" fit={reserveData.fit_crew} injured={reserveData.injured_crew} berths={reserveData.crew_capacity} />
          <BerthBar label="Marines" fit={reserveData.fit_marines} injured={reserveData.injured_marines} berths={reserveData.marine_capacity} />
          {reserveData.inbound_crew > 0 && (
            <div className={styles.hint}>{reserveData.inbound_crew} crew inbound from {reserveData.inbound_prizes} prizes.</div>
          )}
          <select
            className={shared.selectInput}
            value={reserveMode}
            onChange={(e) => setReserveAction(e.target.value as typeof reserveAction)}
            aria-label="Reserve action"
          >
            <option value="deposit">Deposit from my ship</option>
            {canTreasury && <option value="withdraw">Withdraw to my ship</option>}
            {canTreasury && <option value="recruit">Recruit with treasury</option>}
          </select>
          <div className={styles.row}>
            {(reserveMode === 'recruit' ? ['fit_crew', 'fit_marines'] : ['fit_crew', 'injured_crew', 'fit_marines', 'injured_marines']).map((key) => (
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
                reserveMode === 'recruit'
                  ? `Spend about ${recruitCost(n(reserveCounts, 'fit_crew'), n(reserveCounts, 'fit_marines')).toLocaleString()} cr of faction treasury?`
                  : `${reserveMode} these personnel?`
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
                onClick={() => (reserveMode === 'recruit' ? setConfirm('reserve') : doReserve())}
                type="button"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      {canGenerate && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Zap size={14} /> Field generator
          </div>
          <div className={styles.hint}>
            Feed the docked station&apos;s power grid. Burns 1 fuel per tick; the link ends on undock, after 360 ticks, or below 10% fuel.
          </div>
          <div className={styles.row}>
            <button className={shared.accentBtn} disabled={busy} onClick={() => doGenerator(false)} type="button">
              <Zap size={12} /> Connect
            </button>
            <button className={shared.subtleBtn} disabled={busy} onClick={() => doGenerator(true)} type="button">
              Disconnect
            </button>
            {generatorLine && <span className={styles.hint}>{generatorLine}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
