'use client'

import { useState, useCallback } from 'react'
import {
  Clock,
  Check,
  X,
  AlertTriangle,
  MapPin,
  Send,
} from 'lucide-react'
import type { CommissionStatusResponse } from '@spacemolt/lib'
import { useCommandMutation, useCommandQuery } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Loading, ConfirmAction, shared } from '../../shared'
import { formatItemId } from '@/data/catalog'
import styles from './CommissionsView.module.css'

type Commission = CommissionStatusResponse['commissions'][number]

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function CommissionsView() {
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [supplyQtys, setSupplyQtys] = useState<Record<string, string>>({})
  const [supplying, setSupplying] = useState<string | null>(null)

  const { data, loading, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_ship.commission_status({})).structuredContent,
    []
  )
  const commissions = data?.commissions ?? []

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorText(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
      uiStore.dispatch({ type: 'event', kind: 'danger', text })
    },
    [uiStore]
  )

  // Finished ships are delivered straight into your fleet (docked at the build
  // station). Switching to the built ship is how you take the helm.
  const handleSwitchTo = useCallback(
    (shipId: string) => {
      mutate((c) => c.spacemolt_ship.switch_ship({ id: shipId }), { label: 'switch_ship' })
        .then(() => refetch())
        .catch(reportError)
    },
    [mutate, refetch, reportError]
  )

  const handleCancel = useCallback(
    (commissionId: string) => {
      mutate((c) => c.spacemolt_ship.cancel_commission({ id: commissionId }), { label: 'cancel_commission' })
        .then(() => {
          setCancelConfirm(null)
          refetch()
        })
        .catch(reportError)
    },
    [mutate, refetch, reportError]
  )

  const handleSupply = useCallback(
    (commissionId: string, itemId: string, maxQty: number) => {
      const key = `${commissionId}:${itemId}`
      const qtyStr = supplyQtys[key] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1) return
      setSupplying(key)
      mutate((c) => c.spacemolt_ship.supply_commission({ id: commissionId, item_id: itemId, quantity }), { label: 'supply_commission' })
        .then(() => {
          setSupplying(null)
          setSupplyQtys((prev) => ({ ...prev, [key]: '' }))
          refetch()
        })
        .catch((err) => {
          setSupplying(null)
          reportError(err)
        })
    },
    [mutate, refetch, supplyQtys, reportError]
  )

  if (loading && commissions.length === 0) {
    return (
      <Loading message="Loading commissions..." />
    )
  }

  if (commissions.length === 0) {
    return (
      <div className={shared.emptyState}>
        No active commissions. Use the Catalog tab to commission a ship.
      </div>
    )
  }

  return (
    <>
      <div className={styles.commissionsList}>
        {commissions.map((c: Commission) => {
          const isReady = c.status === 'ready'
          const isBuilding = c.status === 'building'
          const isSourcing = c.status === 'sourcing'
          const ticksRemaining = c.ticks_remaining ?? 0

          const statusLabel = isReady ? 'Ready' : isSourcing ? 'Sourcing' : c.status === 'pending' ? 'Queued' : 'Building'
          const statusClass = isReady
            ? styles.statusReady
            : isSourcing
              ? styles.statusGathering
              : styles.statusBuilding

          return (
            <div key={c.commission_id} className={isReady ? styles.commissionCardReady : styles.commissionCard}>
              <div className={styles.commissionTop}>
                <div className={styles.commissionInfo}>
                  <span className={styles.commissionName}>{c.ship_name}</span>
                  <span className={statusClass}>{statusLabel}</span>
                </div>
                <div className={styles.commissionActions}>
                  {isReady && c.built_ship_id && (
                    <button
                      className={shared.confirmBtn}
                      onClick={() => handleSwitchTo(c.built_ship_id!)}
                      type="button"
                    >
                      <Check size={11} />
                      Take the helm
                    </button>
                  )}
                  {!isReady && cancelConfirm !== c.commission_id && (
                    <button
                      className={shared.dangerBtn}
                      onClick={() => setCancelConfirm(c.commission_id)}
                      type="button"
                    >
                      <X size={11} />
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Cancel confirmation */}
              {cancelConfirm === c.commission_id && (
                <ConfirmAction
                  message="Cancel? Refund may be partial."
                  icon={<AlertTriangle size={14} style={{ color: 'var(--claw-red)', flexShrink: 0 }} />}
                  onConfirm={() => handleCancel(c.commission_id)}
                  onCancel={() => setCancelConfirm(null)}
                />
              )}

              <div className={styles.commissionMeta}>
                <div className={styles.commissionStat}>
                  <MapPin size={10} />
                  <span>{c.base_name}</span>
                </div>
                {!isReady && ticksRemaining > 0 && (
                  <div className={styles.commissionStat}>
                    <Clock size={10} />
                    <span>{ticksRemaining} ticks (~{Math.round(ticksRemaining * 10 / 60)} min)</span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {isBuilding && ticksRemaining > 0 && (
                <div className={styles.progressBarOuter}>
                  <div className={styles.progressBarInner} style={{ width: `${Math.max(5, 100 - (ticksRemaining * 2))}%` }} />
                </div>
              )}
              {isReady && (
                <div className={styles.progressBarOuter}>
                  <div className={styles.progressBarReady} style={{ width: '100%' }} />
                </div>
              )}

              {isReady && (
                <div className={styles.commissionMeta}>
                  <span className={styles.materialProgressName}>
                    Delivered to your fleet, docked here. Switch to it to fly.
                  </span>
                </div>
              )}

              {/* Materials progress (sourcing state, credits-only commissions) — donate
                  materials directly to unstick a commission that's short on supply. */}
              {isSourcing && c.required_materials && Object.keys(c.required_materials).length > 0 && (
                <div className={styles.materialsProgress}>
                  {Object.entries(c.required_materials).map(([itemId, need]) => {
                    const have = c.materials_gathered?.[itemId] ?? 0
                    const remaining = Math.max(0, need - have)
                    const key = `${c.commission_id}:${itemId}`
                    const qtyStr = supplyQtys[key] ?? String(remaining)
                    const qtyNum = parseInt(qtyStr, 10)
                    const qtyValid = !isNaN(qtyNum) && qtyNum >= 1
                    return (
                      <div key={itemId} className={styles.materialProgressRow}>
                        <span className={styles.materialProgressName}>{formatItemId(itemId)}</span>
                        <span className={have >= need ? styles.materialProgressComplete : styles.materialProgressValue}>
                          {have}/{need}
                        </span>
                        {remaining > 0 && (
                          <span className={styles.commissionActions}>
                            <input
                              className={shared.textInput}
                              type="number"
                              min={1}
                              max={remaining}
                              value={qtyStr}
                              onChange={(e) =>
                                setSupplyQtys((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              title="Quantity to supply"
                            />
                            <button
                              className={shared.confirmBtn}
                              onClick={() => handleSupply(c.commission_id, itemId, remaining)}
                              disabled={supplying === key || !qtyValid}
                              title="Supply this material from your cargo/storage"
                              type="button"
                            >
                              <Send size={10} /> Supply
                            </button>
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
