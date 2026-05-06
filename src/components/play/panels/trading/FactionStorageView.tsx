'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Ship,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { GameApiError } from '@/lib/gameApi'
import { ItemName } from '../../ItemTooltip'
import { shared } from '../../shared'
import type { ViewStorageResponse } from '@/lib/gameTypes'
import styles from './StorageView.module.css'

/**
 * FactionStorageView shows the contents of the faction lockbox at the current
 * base. Visible only when the player is docked AND a member of a faction. If
 * the base does not have a faction lockbox the gameserver returns an error,
 * which we surface as an empty-state hint.
 */
export function FactionStorageView() {
  const { state, sendCommand, api } = useGame()
  const isDocked = state.isDocked
  const hasFaction = !!state.player?.faction_id
  const cargo = state.ship?.cargo || []
  const personalStorage = state.storageData?.items || []
  const actionPending = state.pendingAction !== null

  const [factionData, setFactionData] = useState<ViewStorageResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Per-row qty inputs
  const [withdrawQtys, setWithdrawQtys] = useState<Record<string, string>>({})
  const [depositQtys, setDepositQtys] = useState<Record<string, string>>({})

  const fetchFactionStorage = useCallback(async () => {
    if (!api || !isDocked || !hasFaction) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.command('view_storage', { target: 'faction' }) as ViewStorageResponse
      setFactionData(result)
    } catch (err) {
      if (err instanceof GameApiError) {
        setError(err.message || 'Faction storage is not available here.')
      } else {
        setError('Failed to load faction storage.')
      }
      setFactionData(null)
    } finally {
      setLoading(false)
    }
  }, [api, isDocked, hasFaction])

  // Fetch on mount and when docked/faction state changes
  useEffect(() => {
    fetchFactionStorage()
  }, [fetchFactionStorage])

  // Withdraw from faction storage to personal cargo (source=faction)
  const handleWithdrawItem = useCallback(
    async (itemId: string, maxQty: number) => {
      if (actionPending || !api) return
      const qtyStr = withdrawQtys[itemId] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      try {
        await api.command('withdraw_items', {
          item_id: itemId,
          quantity,
          source: 'faction',
        })
        setWithdrawQtys((prev) => ({ ...prev, [itemId]: '' }))
        // Refresh both faction storage and personal/cargo state
        await fetchFactionStorage()
        sendCommand('view_storage')
      } catch (err) {
        if (err instanceof GameApiError) setError(err.message)
      }
    },
    [api, sendCommand, withdrawQtys, actionPending, fetchFactionStorage]
  )

  // Deposit from cargo to faction storage (target=faction)
  const handleDepositFromCargo = useCallback(
    async (itemId: string, maxQty: number) => {
      if (actionPending || !api) return
      const qtyStr = depositQtys[itemId] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      try {
        await api.command('deposit_items', {
          item_id: itemId,
          quantity,
          target: 'faction',
        })
        setDepositQtys((prev) => ({ ...prev, [itemId]: '' }))
        await fetchFactionStorage()
        sendCommand('view_storage')
      } catch (err) {
        if (err instanceof GameApiError) setError(err.message)
      }
    },
    [api, sendCommand, depositQtys, actionPending, fetchFactionStorage]
  )

  // Move from personal storage to faction storage (source=storage, target=faction)
  const handleMoveFromPersonal = useCallback(
    async (itemId: string, maxQty: number) => {
      if (actionPending || !api) return
      const qtyStr = depositQtys[`personal:${itemId}`] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      try {
        await api.command('deposit_items', {
          item_id: itemId,
          quantity,
          source: 'storage',
          target: 'faction',
        })
        setDepositQtys((prev) => ({ ...prev, [`personal:${itemId}`]: '' }))
        await fetchFactionStorage()
        sendCommand('view_storage')
      } catch (err) {
        if (err instanceof GameApiError) setError(err.message)
      }
    },
    [api, sendCommand, depositQtys, actionPending, fetchFactionStorage]
  )

  if (!isDocked) {
    return (
      <div className={shared.dockedOnly}>
        Dock at a base to view faction storage
      </div>
    )
  }

  if (!hasFaction) {
    return (
      <div className={shared.emptyState}>
        Join a faction to access faction storage.
      </div>
    )
  }

  const factionItems = factionData?.items || []
  const factionShips = factionData?.ships || []

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.sectionLabel}>
          <Users size={12} />
          Faction Storage
        </span>
        <button
          className={shared.refreshBtn}
          onClick={fetchFactionStorage}
          title="Refresh faction storage"
          type="button"
          disabled={loading}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {loading && !factionData && (
        <div className={styles.loading}>Loading faction storage...</div>
      )}

      {error && !loading && !factionData && (
        <div className={shared.emptyState}>
          {error}
          <div style={{ marginTop: '0.4rem', fontSize: '0.65rem', opacity: 0.75 }}>
            Build a faction lockbox at this base to enable faction storage.
          </div>
        </div>
      )}

      {/* Faction stored items */}
      {factionData && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Box size={12} />
            Faction Items ({factionItems.length})
          </div>
          {factionItems.length > 0 ? (
            <div className={styles.itemList}>
              {factionItems.map((item) => {
                const qtyStr = withdrawQtys[item.item_id] ?? String(item.quantity)
                return (
                  <div key={item.item_id} className={styles.itemRow}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>
                        <ItemName itemId={item.item_id}>{item.name}</ItemName>
                      </span>
                      <span className={styles.itemQty}>x{item.quantity}</span>
                      {item.size != null && item.size > 0 && (
                        <span className={styles.itemSize}>{item.size}u</span>
                      )}
                    </div>
                    <div className={styles.itemAction}>
                      <input
                        className={styles.qtyInput}
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={qtyStr}
                        onChange={(e) =>
                          setWithdrawQtys((prev) => ({
                            ...prev,
                            [item.item_id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className={shared.accentBtn}
                        onClick={() => handleWithdrawItem(item.item_id, item.quantity)}
                        disabled={
                          actionPending ||
                          !qtyStr ||
                          parseInt(qtyStr, 10) < 1 ||
                          parseInt(qtyStr, 10) > item.quantity
                        }
                        title={
                          actionPending
                            ? 'Another action is pending'
                            : 'Withdraw to your cargo'
                        }
                        type="button"
                      >
                        <ArrowUpFromLine size={10} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={shared.emptyState}>No items in faction storage</div>
          )}
        </div>
      )}

      {/* Faction stored ships */}
      {factionData && factionShips.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Ship size={12} />
            Faction Ships ({factionShips.length})
          </div>
          <div className={styles.shipList}>
            {factionShips.map((ship) => (
              <div key={ship.ship_id} className={styles.shipCard}>
                <span className={styles.shipName}>
                  {ship.class_name || ship.class_id}
                </span>
                <div className={styles.shipMeta}>
                  <span className={styles.shipStat}>Modules: {ship.modules}</span>
                  <span className={styles.shipStat}>Cargo: {ship.cargo_used}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deposit from ship cargo */}
      {factionData && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Box size={12} />
            Deposit from Cargo ({cargo.length})
          </div>
          {cargo.length > 0 ? (
            <div className={styles.itemList}>
              {cargo.map((item) => {
                const qtyStr = depositQtys[item.item_id] ?? String(item.quantity)
                return (
                  <div key={item.item_id} className={styles.itemRow}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>
                        <ItemName itemId={item.item_id}>{item.name ?? item.item_id}</ItemName>
                      </span>
                      <span className={styles.itemQty}>x{item.quantity}</span>
                      {item.size != null && item.size > 0 && (
                        <span className={styles.itemSize}>{item.size}u</span>
                      )}
                    </div>
                    <div className={styles.itemAction}>
                      <input
                        className={styles.qtyInput}
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={qtyStr}
                        onChange={(e) =>
                          setDepositQtys((prev) => ({
                            ...prev,
                            [item.item_id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className={shared.confirmBtn}
                        onClick={() => handleDepositFromCargo(item.item_id, item.quantity)}
                        disabled={
                          actionPending ||
                          !qtyStr ||
                          parseInt(qtyStr, 10) < 1 ||
                          parseInt(qtyStr, 10) > item.quantity
                        }
                        title={
                          actionPending
                            ? 'Another action is pending'
                            : 'Deposit to faction storage'
                        }
                        type="button"
                      >
                        <ArrowDownToLine size={10} />
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
      )}

      {/* Move from personal storage */}
      {factionData && personalStorage.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Box size={12} />
            Move from Personal Storage ({personalStorage.length})
          </div>
          <div className={styles.itemList}>
            {personalStorage.map((item) => {
              const key = `personal:${item.item_id}`
              const qtyStr = depositQtys[key] ?? String(item.quantity)
              return (
                <div key={item.item_id} className={styles.itemRow}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>
                      <ItemName itemId={item.item_id}>{item.name}</ItemName>
                    </span>
                    <span className={styles.itemQty}>x{item.quantity}</span>
                    {item.size != null && item.size > 0 && (
                      <span className={styles.itemSize}>{item.size}u</span>
                    )}
                  </div>
                  <div className={styles.itemAction}>
                    <input
                      className={styles.qtyInput}
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={qtyStr}
                      onChange={(e) =>
                        setDepositQtys((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                    />
                    <button
                      className={shared.confirmBtn}
                      onClick={() => handleMoveFromPersonal(item.item_id, item.quantity)}
                      disabled={
                        actionPending ||
                        !qtyStr ||
                        parseInt(qtyStr, 10) < 1 ||
                        parseInt(qtyStr, 10) > item.quantity
                      }
                      title={
                        actionPending
                          ? 'Another action is pending'
                          : 'Move to faction storage'
                      }
                      type="button"
                    >
                      <ArrowDownToLine size={10} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
