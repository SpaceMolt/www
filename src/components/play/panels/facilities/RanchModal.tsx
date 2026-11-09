'use client'

import { useState } from 'react'
import { PawPrint, Loader2 } from 'lucide-react'
import { useCommandMutation, useCommandQuery } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Loading, Modal, errorMessage, shared } from '../../shared'
import styles from './facilities.module.css'

/** Herd status and cull target for one faction ranch. */
export function RanchModal({ facilityId, onClose }: { facilityId: string; onClose: () => void }) {
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const [cull, setCull] = useState('')
  const [saving, setSaving] = useState(false)
  const { data: ranch, loading, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.ranch_status({ facility_id: facilityId })).structuredContent,
    [facilityId],
  )

  const cullValue = Number(cull)
  const handleSetCull = async () => {
    setSaving(true)
    try {
      const r = await mutate((c) => c.spacemolt_facility.ranch_set_cull({ facility_id: facilityId, cull_target: cullValue }), { label: 'ranch_set_cull' })
      uiStore.dispatch({ type: 'event', kind: 'info', text: r.delta.details?.message ?? `Cull target set to ${cullValue}` })
      setCull('')
      refetch()
    } catch (err) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    }
    setSaving(false)
  }

  const rows: [string, string][] = ranch ? [
    ['Species', ranch.species_name],
    ['Herd', `${ranch.herd} / ${ranch.capacity}`],
    ['Growth', `${ranch.growth_per_cycle.toFixed(1)} head/cycle`],
    ['Cull target', `${ranch.cull_target} (max ${ranch.max_cull_per_cycle}/cycle)`],
    ['Fed', `${Math.round(ranch.fed_fraction * 100)}%${ranch.supplies_ok ? '' : ' (supplies short)'}`],
    ['Range health', `${Math.round(ranch.range_health * 100)}%`],
    ['Wild population', String(ranch.wild_population)],
    ['Domestication', ranch.domestication_active ? `active (${ranch.domestication_reserve} in reserve)` : 'idle'],
  ] : []

  return (
    <Modal title={ranch ? `Ranch — ${ranch.facility_name}` : 'Ranch'} icon={<PawPrint size={14} />} onClose={onClose}>
      {loading && !ranch && <Loading message="Loading herd..." />}
      {ranch && (
        <>
          <div className={styles.cardDescription}>{ranch.message}</div>
          <div className={styles.costBreakdown}>
            {rows.map(([k, v]) => (
              <div key={k} className={styles.costRow}>
                <span className={styles.costLabel}>{k}</span>
                <span className={styles.costValue}>{v}</span>
              </div>
            ))}
            {ranch.feed.length > 0 && (
              <div className={styles.costRow}>
                <span className={styles.costLabel}>Feed</span>
                <span className={styles.materialList}>
                  {ranch.feed.map((f) => (
                    <span key={f.resource} className={f.cycles_left > 0 ? styles.materialOk : styles.materialMissing}>
                      {f.resource} {f.stocked} ({f.per_cycle}/cycle, {f.cycles_left} cycles)
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
          <div className={styles.cardActions}>
            <input
              className={shared.textInput}
              type="number"
              min={0}
              step={1}
              placeholder="Cull target (head)"
              value={cull}
              onChange={(e) => setCull(e.target.value)}
              style={{ width: '9rem' }}
            />
            <button
              className={shared.confirmBtn}
              onClick={handleSetCull}
              disabled={saving || cull === '' || !Number.isInteger(cullValue) || cullValue < 0}
              type="button"
            >
              {saving ? <Loader2 size={11} className={shared.spinner} /> : <PawPrint size={11} />} Set cull
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
