'use client'

import { useState } from 'react'
import { Flag, Tent, Loader2 } from 'lucide-react'
import { useAccountStore, useCargo, useCommandMutation, useCommandQuery, useLocationState, usePlayer } from '@/lib/spacemolt'
import { ConfirmAction, Credits, Loading, shared, useAction } from '../../shared'
import fac from '../facilities/facilities.module.css'
import styles from './station.module.css'
import { Row } from './StationStatus'

const OUTPOST_KIT = 'outpost_kit'
// ponytail: mirrors gameserver OutpostFoundingFee (outpost_founding.go); base_cost reports only the station fee.
const OUTPOST_FEE = 100_000
// base_cost judges station founding. These two reasons do not stop an outpost (outpost_founding.go).
const STATION_ONLY_REASON = /only one station may be founded per system|need a Station Core/

/**
 * Found a faction station (Station Core) or deploy an outpost (Outpost Kit) at
 * the current POI. Both need an undocked ship in lawless space; `base_cost`
 * says whether this spot qualifies.
 */
export function FoundingSection() {
  const mutate = useCommandMutation()
  const store = useAccountStore()
  const player = usePlayer()
  const location = useLocationState()
  const cargo = useCargo() ?? []
  const isDocked = Boolean(location?.docked_at)

  const { data: cost, loading } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.base_cost()).structuredContent,
    [location?.poi_id, location?.docked_at],
  )

  const [name, setName] = useState('')
  const [publicAccess, setPublicAccess] = useState(false)
  const [confirm, setConfirm] = useState<'station' | 'outpost' | null>(null)
  const { busy: running, run } = useAction()
  const busy = running !== null

  const has = (itemId: string) => cargo.some((c) => c.item_id === itemId && (c.quantity ?? 0) > 0)
  const coreItem = cost?.station_core_item ?? 'station_core'
  const hasCore = has(coreItem)
  const hasKit = has(OUTPOST_KIT)
  const outpostOk = Boolean(cost && !cost.eligible_here && hasKit && STATION_ONLY_REASON.test(cost.reason ?? ''))
  const canAct = !isDocked && Boolean(player?.faction_id) && name.trim() !== '' && !busy

  const found = async (kind: 'station' | 'outpost') => {
    setConfirm(null)
    const result = await run(
      kind,
      async () => {
        const r = await (kind === 'station'
          ? mutate((c) => c.spacemolt_facility.found_station({ name: name.trim(), public_access: publicAccess }), { label: 'found_station' })
          : mutate((c) => c.spacemolt_facility.deploy_outpost({ name: name.trim() }), { label: 'deploy_outpost' }))
        // The delta omits the ship section (cargo_used for the header) after the core/kit is spent; re-read state.
        void store.account.refresh().catch(() => {})
        return r
      },
      `${kind === 'station' ? 'Station' : 'Outpost'} founded: ${name.trim()}`,
      'toast',
    )
    if (result) setName('')
  }

  if (loading && !cost) return <Loading message="Checking founding requirements..." />

  return (
    <>
      {cost && (
        <div className={fac.costBreakdown}>
          <div className={fac.costRow}>
            <span className={fac.costLabel}>This spot</span>
            <span className={cost.eligible_here || outpostOk ? fac.materialOk : fac.materialMissing}>
              {cost.eligible_here
                ? `Eligible: ${location?.poi_name ?? 'current POI'}`
                : outpostOk ? `Outpost eligible. Station: ${cost.reason}` : cost.reason ?? 'Not eligible'}
            </span>
          </div>
          <Row label="Founding fee">
            Station <Credits amount={cost.founding_fee} />, outpost <Credits amount={OUTPOST_FEE} /> (treasury first, then wallet)
          </Row>
          <Row label="Station cap">{cost.max_per_faction} per faction</Row>
          <div className={fac.costRow}>
            <span className={fac.costLabel}>In cargo</span>
            <span className={styles.chips}>
              <span className={hasCore ? fac.materialOk : fac.materialMissing}>Station Core {hasCore ? 'yes' : 'no'}</span>
              <span className={hasKit ? fac.materialOk : fac.materialMissing}>Outpost Kit {hasKit ? 'yes' : 'no'}</span>
            </span>
          </div>
        </div>
      )}
      {cost?.requirements && <div className={styles.hint}>{cost.requirements}</div>}
      <div className={styles.hint}>
        A Station Core is assembled at a Station Core Foundry; an Outpost Kit at an Outpost Frame Assembler.
        Build either in Facilities &gt; Build &gt; Production at any station, run its recipe, then fly the item to a lawless POI.
      </div>

      {!player?.faction_id ? (
        <div className={shared.emptyState}>Join or create a faction to found a station.</div>
      ) : isDocked ? (
        <div className={shared.emptyState}>Undock at a lawless POI to found a station or outpost here.</div>
      ) : (
        <div className={styles.form}>
          <div className={styles.row}>
            <input className={shared.textInput} type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <label className={styles.row}>
            <input type="checkbox" checked={publicAccess} onChange={(e) => setPublicAccess(e.target.checked)} />
            Public docking (station only)
          </label>
          {confirm ? (
            <ConfirmAction
              message={confirm === 'station'
                ? `Deploy your Station Core here as "${name.trim()}" for ${cost?.founding_fee.toLocaleString() ?? '?'} cr?`
                : `Deploy your Outpost Kit here as "${name.trim()}" for ${OUTPOST_FEE.toLocaleString()} cr?`}
              confirmLabel="Deploy"
              variant="confirm"
              onConfirm={() => found(confirm)}
              onCancel={() => setConfirm(null)}
            />
          ) : (
            <div className={styles.row}>
              <button className={shared.confirmBtn} disabled={!canAct || !hasCore} onClick={() => setConfirm('station')} type="button">
                {busy ? <Loader2 size={11} className={shared.spinner} /> : <Flag size={11} />} Found Station
              </button>
              <button className={shared.actionBtn} disabled={!canAct || !hasKit} onClick={() => setConfirm('outpost')} type="button">
                <Tent size={11} /> Deploy Outpost
              </button>
              {!busy && (!name.trim() || !hasCore || !hasKit) && (
                <span className={styles.hint}>
                  {!name.trim() ? 'Enter a name first.' : !hasCore && !hasKit ? 'Carry a Station Core or an Outpost Kit.' : !hasCore ? 'Found Station needs a Station Core in cargo.' : 'Deploy Outpost needs an Outpost Kit in cargo.'}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
