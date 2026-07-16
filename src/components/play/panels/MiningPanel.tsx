'use client'

import { useState, useCallback } from 'react'
import { Pickaxe, Package, Trash2, X, Check, Zap } from 'lucide-react'
import { SpacemoltError } from '@spacemolt/lib'
import { useCargo, useCommandMutation, useLocationState, useShip } from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { ProgressBar } from '../ProgressBar'
import { Panel, shared } from '../shared'
import styles from './MiningPanel.module.css'

interface JettisonTarget {
  itemId: string
  name: string
  maxQty: number
}

function errorMessage(err: unknown): string {
  if (err instanceof SpacemoltError) return err.message
  if (err instanceof Error) return err.message
  return 'Action failed'
}

export function MiningPanel() {
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const ship = useShip()
  const cargo = useCargo()
  const location = useLocationState()
  const [jettisonTarget, setJettisonTarget] = useState<JettisonTarget | null>(
    null
  )
  const [jettisonQty, setJettisonQty] = useState('1')

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorMessage(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
      uiStore.dispatch({ type: 'event', kind: 'danger', text })
    },
    [uiStore],
  )

  const handleMine = useCallback(async () => {
    try {
      const result = await mutate((c) => c.spacemolt.mine(), { label: 'mine' })
      const details = result.delta.details
      const text =
        details && 'message' in details
          ? details.message
          : details
            ? `Mined ${details.quantity}x ${details.resource_name || details.resource_id}`
            : 'Mining started'
      uiStore.dispatch({ type: 'event', kind: 'info', text })
    } catch (err) {
      reportError(err)
    }
  }, [mutate, uiStore, reportError])

  const handleUseItem = useCallback(
    async (itemId: string) => {
      try {
        const result = await mutate((c) => c.spacemolt.use_item({ id: itemId }), { label: 'use_item' })
        const text = result.delta.details?.message
        if (text) uiStore.dispatch({ type: 'event', kind: 'info', text })
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, uiStore, reportError],
  )

  const handleJettison = useCallback(async () => {
    if (!jettisonTarget) return
    const quantity = parseInt(jettisonQty, 10)
    if (isNaN(quantity) || quantity < 1) return
    try {
      const result = await mutate(
        (c) => c.spacemolt.jettison({ id: jettisonTarget.itemId, quantity }),
        { label: 'jettison' },
      )
      const details = result.delta.details
      const text =
        details && 'message' in details ? details.message : `Jettisoned ${quantity}x ${jettisonTarget.name}`
      uiStore.dispatch({ type: 'event', kind: 'info', text })
    } catch (err) {
      reportError(err)
    } finally {
      setJettisonTarget(null)
      setJettisonQty('1')
    }
  }, [mutate, jettisonTarget, jettisonQty, uiStore, reportError])

  const openJettison = useCallback(
    (itemId: string, name: string, maxQty: number) => {
      setJettisonTarget({ itemId, name, maxQty })
      setJettisonQty('1')
    },
    []
  )

  const cargoItems = cargo || []
  const cargoUsed = ship?.cargo_used ?? 0
  const cargoCapacity = ship?.cargo_capacity ?? 0
  const isDocked = Boolean(location?.docked_at)

  return (
    <Panel title="Mining" icon={<Pickaxe size={16} />} color="var(--shell-orange)">
        {/* Mine button */}
        <div className={styles.mineSection}>
          <button
            className={styles.mineBtn}
            onClick={handleMine}
            disabled={isDocked}
            type="button"
          >
            <Pickaxe size={20} />
            Mine
          </button>
          {isDocked && (
            <div className={styles.mineHint}>
              Undock to begin mining operations
            </div>
          )}
          {!isDocked && location?.poi_name && (
            <div className={styles.mineHint}>
              Mining at {location.poi_name} ({location.poi_type})
            </div>
          )}
        </div>

        {/* Cargo */}
        <div className={styles.cargoSection}>
          <div className={shared.sectionTitle}>Cargo Hold</div>
          <div className={styles.cargoBar}>
            <ProgressBar
              value={cargoUsed}
              max={cargoCapacity}
              label="Capacity"
              color="orange"
              size="sm"
            />
          </div>

          {cargoItems.length > 0 ? (
            <div className={styles.cargoList}>
              {cargoItems.map((item, i) => {
                const itemId = item.item_id ?? `cargo-${i}`
                const quantity = item.quantity ?? 0
                const name = item.item_name ?? item.item_id ?? itemId
                return (
                  <div key={itemId} className={styles.cargoItem}>
                    <div className={styles.cargoLeft}>
                      <span className={styles.cargoIcon}>
                        <Package size={13} />
                      </span>
                      <span className={styles.cargoName}>
                        {name}
                      </span>
                    </div>
                    <div className={styles.cargoRight}>
                      <span className={styles.cargoQty}>x{quantity}</span>
                      <button
                        className={styles.useBtn}
                        onClick={() => handleUseItem(itemId)}
                        title={`Use ${name}`}
                        type="button"
                      >
                        <Zap size={13} />
                      </button>
                      <button
                        className={styles.jettisonBtn}
                        onClick={() => openJettison(itemId, name, quantity)}
                        title={`Jettison ${name}`}
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={shared.emptyState}>Cargo hold is empty</div>
          )}
        </div>

      {/* Jettison quantity picker modal */}
      {jettisonTarget && (
        <div
          className={styles.quantityOverlay}
          onClick={() => setJettisonTarget(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles.quantityDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.quantityTitle}>
              Jettison {jettisonTarget.name}
            </div>
            <div className={styles.quantityInputRow}>
              <input
                className={styles.quantityInput}
                type="number"
                min={1}
                max={jettisonTarget.maxQty}
                value={jettisonQty}
                onChange={(e) => setJettisonQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJettison()
                }}
                autoFocus
              />
              <button
                className={styles.maxBtn}
                onClick={() =>
                  setJettisonQty(String(jettisonTarget.maxQty))
                }
                type="button"
              >
                Max
              </button>
            </div>
            <div className={styles.quantityActions}>
              <button
                className={styles.maxBtn}
                onClick={() => setJettisonTarget(null)}
                type="button"
              >
                <X size={12} /> Cancel
              </button>
              <button
                className={styles.maxBtn}
                onClick={handleJettison}
                disabled={
                  !jettisonQty ||
                  parseInt(jettisonQty, 10) < 1 ||
                  parseInt(jettisonQty, 10) > jettisonTarget.maxQty
                }
                type="button"
              >
                <Check size={12} /> Jettison
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
