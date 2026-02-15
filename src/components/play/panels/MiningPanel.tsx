'use client'

import { useState, useCallback } from 'react'
import { Pickaxe, Package, Trash2, X, Check } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ProgressBar } from '../ProgressBar'
import styles from './MiningPanel.module.css'

interface JettisonTarget {
  itemId: string
  name: string
  maxQty: number
}

export function MiningPanel() {
  const { state, sendCommand } = useGame()
  const [jettisonTarget, setJettisonTarget] = useState<JettisonTarget | null>(
    null
  )
  const [jettisonQty, setJettisonQty] = useState('1')

  const handleMine = useCallback(() => {
    sendCommand('mine')
  }, [sendCommand])

  const handleJettison = useCallback(() => {
    if (!jettisonTarget) return
    const quantity = parseInt(jettisonQty, 10)
    if (isNaN(quantity) || quantity < 1) return
    sendCommand('jettison', {
      item_id: jettisonTarget.itemId,
      quantity,
    })
    setJettisonTarget(null)
    setJettisonQty('1')
  }, [sendCommand, jettisonTarget, jettisonQty])

  const openJettison = useCallback(
    (itemId: string, name: string, maxQty: number) => {
      setJettisonTarget({ itemId, name, maxQty })
      setJettisonQty('1')
    },
    []
  )

  const ship = state.ship
  const cargo = ship?.cargo || []
  const cargoUsed = ship?.cargo_used ?? 0
  const cargoCapacity = ship?.cargo_capacity ?? 0
  const isDocked = state.isDocked

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Pickaxe size={16} />
          </span>
          Mining
        </div>
      </div>

      <div className={styles.content}>
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
          {!isDocked && state.poi && (
            <div className={styles.mineHint}>
              Mining at {state.poi.name} ({state.poi.type})
            </div>
          )}
        </div>

        {/* Cargo */}
        <div className={styles.cargoSection}>
          <div className={styles.sectionTitle}>Cargo Hold</div>
          <div className={styles.cargoBar}>
            <ProgressBar
              value={cargoUsed}
              max={cargoCapacity}
              label="Capacity"
              color="orange"
              size="sm"
            />
          </div>

          {cargo.length > 0 ? (
            <div className={styles.cargoList}>
              {cargo.map((item) => (
                <div key={item.item_id} className={styles.cargoItem}>
                  <div className={styles.cargoLeft}>
                    <span className={styles.cargoIcon}>
                      <Package size={13} />
                    </span>
                    <span className={styles.cargoName}>{item.name}</span>
                  </div>
                  <div className={styles.cargoRight}>
                    <span className={styles.cargoQty}>x{item.quantity}</span>
                    <button
                      className={styles.jettisonBtn}
                      onClick={() =>
                        openJettison(item.item_id, item.name, item.quantity)
                      }
                      title={`Jettison ${item.name}`}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>Cargo hold is empty</div>
          )}
        </div>
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
    </div>
  )
}
