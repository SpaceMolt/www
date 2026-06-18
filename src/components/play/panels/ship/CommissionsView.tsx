'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Clock,
  Check,
  X,
  AlertTriangle,
  MapPin,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { Loading, ConfirmAction, shared } from '../../shared'
import { formatItemId } from '@/data/catalog'
import styles from './CommissionsView.module.css'

interface Commission {
  commission_id: string
  ship_class_id: string
  status: string
  ship_name: string
  base_name: string
  ticks_remaining: number
  built_ship_id?: string
  // sourcing state: how much of each build material the shipyard has acquired
  materials_gathered?: Record<string, number>
  required_materials?: Record<string, number>
}

export function CommissionsView() {
  const { sendCommand } = useGame()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)

  const fetchStatus = useCallback(() => {
    setLoading(true)
    sendCommand('commission_status').then((result) => {
      const r = result as Record<string, unknown>
      setCommissions((r.commissions || []) as Commission[])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [sendCommand])

  // Auto-fetch on mount
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Finished ships are delivered straight into your fleet (docked at the build
  // station). Switching to the built ship is how you take the helm.
  const handleSwitchTo = useCallback((shipId: string) => {
    sendCommand('switch_ship', { ship_id: shipId }).then(() => fetchStatus())
  }, [sendCommand, fetchStatus])

  const handleCancel = useCallback((commissionId: string) => {
    sendCommand('cancel_commission', { commission_id: commissionId }).then(() => {
      setCancelConfirm(null)
      fetchStatus()
    })
  }, [sendCommand, fetchStatus])

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
        {commissions.map((c) => {
          const isReady = c.status === 'ready'
          const isBuilding = c.status === 'building'
          const isSourcing = c.status === 'sourcing'

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
                {!isReady && c.ticks_remaining > 0 && (
                  <div className={styles.commissionStat}>
                    <Clock size={10} />
                    <span>{c.ticks_remaining} ticks (~{Math.round(c.ticks_remaining * 10 / 60)} min)</span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {isBuilding && c.ticks_remaining > 0 && (
                <div className={styles.progressBarOuter}>
                  <div className={styles.progressBarInner} style={{ width: `${Math.max(5, 100 - (c.ticks_remaining * 2))}%` }} />
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

              {/* Materials progress (sourcing state, credits-only commissions) */}
              {isSourcing && c.required_materials && Object.keys(c.required_materials).length > 0 && (
                <div className={styles.materialsProgress}>
                  {Object.entries(c.required_materials).map(([itemId, need]) => {
                    const have = c.materials_gathered?.[itemId] ?? 0
                    return (
                      <div key={itemId} className={styles.materialProgressRow}>
                        <span className={styles.materialProgressName}>{formatItemId(itemId)}</span>
                        <span className={have >= need ? styles.materialProgressComplete : styles.materialProgressValue}>
                          {have}/{need}
                        </span>
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
