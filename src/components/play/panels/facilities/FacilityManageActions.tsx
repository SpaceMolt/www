'use client'

import { useState, useCallback } from 'react'
import { Pencil, Wrench, Tag, Trash2, Loader2 } from 'lucide-react'
import { useAccountStore, useCommandMutation } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { ConfirmAction, Modal, errorMessage, shared } from '../../shared'
import styles from './facilities.module.css'

interface ManagedFacility {
  facility_id: string
  name: string
  custom_name?: string
  damaged?: boolean
  dismantling?: boolean
  repair_complete_tick?: number
  /** Only production facilities can be listed for sale. */
  category?: string
}

interface FacilityManageActionsProps {
  facility: ManagedFacility
  /** Faction-owned facilities use faction_dismantle and list for sale from the faction. */
  scope: 'player' | 'faction'
  onRefresh: () => void
}

type Mode = 'customize' | 'sell' | 'dismantle' | null

/** Rename, describe, repair, sell, and dismantle buttons for one facility the viewer owns (docked at its station). */
export function FacilityManageActions({ facility, scope, onRefresh }: FacilityManageActionsProps) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const [mode, setMode] = useState<Mode>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = facility.facility_id
  const label = facility.custom_name || facility.name

  const run = useCallback(async (fn: () => Promise<string | undefined>) => {
    setBusy(true)
    setError(null)
    try {
      const text = await fn()
      if (text) uiStore.dispatch({ type: 'toast', kind: 'success', text })
      setMode(null)
      onRefresh()
    } catch (err) {
      setError(errorMessage(err)) // shown in the open modal
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    }
    setBusy(false)
  }, [uiStore, onRefresh])

  const handleCustomize = () => run(async () => {
    if (name.trim() !== (facility.custom_name ?? '')) {
      await mutate((c) => c.spacemolt_facility.set_name({ facility_id: id, custom_name: name.trim() }), { label: 'facility_set_name' })
    }
    if (description.trim()) {
      const resp = await store.account.commands.spacemolt_facility.facility_set_description({ facility_id: id, description: description.trim() })
      return resp.structuredContent?.message
    }
    return `Updated ${name.trim() || facility.name}`
  })

  const handleRepair = () => run(async () => {
    await mutate((c) => c.spacemolt_facility.repair({ facility_id: id }), { label: 'facility_repair' })
    return `Repair started: ${label}`
  })

  const handleDismantle = () => run(async () => {
    await (scope === 'faction'
      ? mutate((c) => c.spacemolt_facility.faction_dismantle({ facility_id: id }), { label: 'facility_faction_dismantle' })
      : mutate((c) => c.spacemolt_facility.dismantle({ facility_id: id }), { label: 'facility_dismantle' }))
    return `Dismantling ${label}`
  })

  const handleSell = () => run(async () => {
    const r = await mutate(
      (c) => c.spacemolt_facility.list_for_sale({ facility_id: id, price: Number(price), faction: scope === 'faction' }),
      { label: 'facility_list_for_sale' },
    )
    return r.delta.details?.message ?? `Listed ${label} for sale`
  })

  if (mode === 'dismantle') {
    return (
      <ConfirmAction
        message={`Dismantle ${label}? It goes offline now. Materials return as packages; credits are not refunded.`}
        icon={<Trash2 size={11} />}
        confirmLabel={busy ? 'Dismantling...' : 'Dismantle'}
        confirmDisabled={busy}
        onConfirm={handleDismantle}
        onCancel={() => setMode(null)}
      />
    )
  }

  const priceValue = Number(price)
  return (
    <>
      <button
        className={shared.subtleBtn}
        onClick={() => { setName(facility.custom_name ?? ''); setDescription(''); setError(null); setMode('customize') }}
        type="button"
        title="Rename or describe this facility"
      >
        <Pencil size={11} /> Rename
      </button>
      {facility.damaged && !facility.repair_complete_tick && (
        <button className={shared.warningBtn} onClick={handleRepair} disabled={busy} type="button" title="Costs 30% of build materials and build time">
          {busy ? <Loader2 size={11} className={shared.spinner} /> : <Wrench size={11} />} Repair
        </button>
      )}
      {!facility.dismantling && (
        <>
          {facility.category === 'production' && (
            <button className={shared.subtleBtn} onClick={() => { setPrice(''); setError(null); setMode('sell') }} type="button">
              <Tag size={11} /> Sell
            </button>
          )}
          <button className={shared.dangerBtn} onClick={() => setMode('dismantle')} type="button">
            <Trash2 size={11} /> Dismantle
          </button>
        </>
      )}

      {mode === 'customize' && (
        <Modal
          title={`Customize ${label}`}
          icon={<Pencil size={14} />}
          onClose={() => setMode(null)}
          actions={
            <>
              <button className={shared.confirmBtn} onClick={handleCustomize} disabled={busy} type="button">
                {busy ? <Loader2 size={11} className={shared.spinner} /> : <Pencil size={11} />} Save
              </button>
              <button className={shared.subtleBtn} onClick={() => setMode(null)} type="button">Cancel</button>
            </>
          }
        >
          <div className={styles.decorateFields}>
            <div className={styles.decorateField}>
              <label>
                Name (empty restores the default)
                <input className={shared.textInput} value={name} onChange={(e) => setName(e.target.value)} placeholder={facility.name} />
              </label>
            </div>
            <div className={styles.decorateField}>
              <label>
                Description (leave empty to keep the current one)
                <textarea className={shared.textInput} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
              </label>
            </div>
            {error && <div className={styles.maintenanceWarning}>{error}</div>}
          </div>
        </Modal>
      )}

      {mode === 'sell' && (
        <Modal
          title={`Sell ${label}`}
          icon={<Tag size={14} />}
          onClose={() => setMode(null)}
          actions={
            <>
              <button
                className={shared.confirmBtn}
                onClick={handleSell}
                disabled={busy || !Number.isInteger(priceValue) || priceValue < 1}
                type="button"
              >
                {busy ? <Loader2 size={11} className={shared.spinner} /> : <Tag size={11} />} List for sale
              </button>
              <button className={shared.subtleBtn} onClick={() => setMode(null)} type="button">Cancel</button>
            </>
          }
        >
          <div className={styles.decorateFields}>
            <div className={styles.decorateField}>
              <label>
                Asking price (whole credits{scope === 'faction' ? ', paid to the faction treasury' : ''})
                <input className={shared.textInput} type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
              </label>
            </div>
            <div className={styles.cardDescription}>
              Buyers at this station find it under Facilities &gt; For Sale. A listing fee of 1% applies; cancel any time to keep the facility.
            </div>
            {error && <div className={styles.maintenanceWarning}>{error}</div>}
          </div>
        </Modal>
      )}
    </>
  )
}
