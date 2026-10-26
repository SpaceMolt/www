'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Users,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Coins,
} from 'lucide-react'
import {
  useCargo,
  useCommandMutation,
  useCommandQuery,
  useLocationState,
  usePendingAction,
  usePlayer,
} from '@/lib/spacemolt'
import type { StorageResponse } from '@spacemolt/lib'
import { usePlay } from '../../PlayProvider'
import { ItemName } from '../../ItemTooltip'
import { Credits, shared } from '../../shared'
import { parseCreditAmount } from './giftValidation'
import styles from './StorageView.module.css'

// StorageResponse is one generated union across every branch of the unified
// storage action (self view, faction view, deposit/withdraw/gift results) —
// narrow to the branch each view() call here actually returns.
type PersonalStorageView = Extract<StorageResponse, { hint: string; ships: Array<unknown> }>
type FactionStorageResponse = Extract<StorageResponse, { hint: string; faction_id: string }>

interface CargoRow {
  item_id: string
  name: string
  quantity: number
  size?: number
}

/** useCargo() rows are all-optional (delta-friendly wire shape); drop incomplete entries and normalize item_name -> name. */
function normalizeCargo(raw: ReturnType<typeof useCargo>): CargoRow[] {
  return (raw ?? []).flatMap((c) => {
    if (!c.item_id || !c.quantity) return []
    return [{ item_id: c.item_id, name: c.item_name ?? c.item_id, quantity: c.quantity, size: c.size }]
  })
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * FactionStorageView shows the contents of the faction lockbox at the current
 * base. Visible only when the player is docked AND a member of a faction. If
 * the base does not have a faction lockbox the gameserver returns an error,
 * which we surface as an empty-state hint.
 */
export function FactionStorageView() {
  const { uiStore } = usePlay()
  const location = useLocationState()
  const dockedAt = location?.docked_at
  const isDocked = Boolean(dockedAt)
  const hasFaction = Boolean(usePlayer()?.faction_id)
  const walletCredits = usePlayer()?.credits ?? 0
  const rawCargo = useCargo()
  const cargo = useMemo(() => normalizeCargo(rawCargo), [rawCargo])
  const actionPending = usePendingAction() !== null
  const mutate = useCommandMutation()

  const reportError = useCallback((err: unknown) => {
    const text = errorMessage(err)
    uiStore.dispatch({ type: 'toast', kind: 'danger', text })
  }, [uiStore])

  const {
    data: factionData,
    loading: factionLoading,
    error: factionError,
    refetch: refetchFaction,
  } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view({ target: 'faction' })).structuredContent as FactionStorageResponse | undefined,
    [dockedAt, hasFaction],
    { enabled: isDocked && hasFaction, refreshOnSections: ['cargo'] },
  )

  const { data: personalData, refetch: refetchPersonal } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view()).structuredContent as PersonalStorageView | undefined,
    [dockedAt, hasFaction],
    { enabled: isDocked && hasFaction, refreshOnSections: ['cargo'] },
  )
  const personalStorage = personalData?.items ?? []

  // Per-row qty inputs
  const [withdrawQtys, setWithdrawQtys] = useState<Record<string, string>>({})
  const [depositQtys, setDepositQtys] = useState<Record<string, string>>({})

  // Withdraw from faction storage to personal cargo (source=faction)
  const handleWithdrawItem = useCallback(
    async (itemId: string, maxQty: number) => {
      if (actionPending) return
      const qtyStr = withdrawQtys[itemId] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      try {
        await mutate((c) => c.spacemolt_storage.withdraw({ item_id: itemId, quantity, source: 'faction' }), { label: 'faction_withdraw' })
        setWithdrawQtys((prev) => ({ ...prev, [itemId]: '' }))
        refetchFaction()
        refetchPersonal()
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, withdrawQtys, actionPending, refetchFaction, refetchPersonal, reportError, setWithdrawQtys]
  )

  // Deposit from cargo to faction storage (target=faction)
  const handleDepositFromCargo = useCallback(
    async (itemId: string, maxQty: number) => {
      if (actionPending) return
      const qtyStr = depositQtys[itemId] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      try {
        await mutate((c) => c.spacemolt_storage.deposit({ item_id: itemId, quantity, target: 'faction' }), { label: 'faction_deposit' })
        setDepositQtys((prev) => ({ ...prev, [itemId]: '' }))
        refetchFaction()
        refetchPersonal()
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, depositQtys, actionPending, refetchFaction, refetchPersonal, reportError, setDepositQtys]
  )

  // Treasury credits: wallet <-> faction (withdraw needs manage_treasury; the server returns no_permission otherwise)
  const [treasuryAmount, setTreasuryAmount] = useState('')
  const handleTreasury = useCallback(
    async (kind: 'deposit' | 'withdraw', quantity: number | null) => {
      if (actionPending || quantity === null) return
      try {
        const args = { item_id: 'credits', quantity, target: 'faction' }
        if (kind === 'deposit') await mutate((c) => c.spacemolt_storage.deposit(args), { label: 'faction_deposit_credits' })
        else await mutate((c) => c.spacemolt_storage.withdraw(args), { label: 'faction_withdraw_credits' })
        setTreasuryAmount('')
        refetchFaction()
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, actionPending, refetchFaction, reportError]
  )

  // Move from personal storage to faction storage (source=storage, target=faction)
  const handleMoveFromPersonal = useCallback(
    async (itemId: string, maxQty: number) => {
      if (actionPending) return
      const key = `personal:${itemId}`
      const qtyStr = depositQtys[key] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      try {
        await mutate((c) => c.spacemolt_storage.deposit({ item_id: itemId, quantity, source: 'storage', target: 'faction' }), { label: 'faction_deposit' })
        setDepositQtys((prev) => ({ ...prev, [key]: '' }))
        refetchFaction()
        refetchPersonal()
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, depositQtys, actionPending, refetchFaction, refetchPersonal, reportError, setDepositQtys]
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

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.sectionLabel}>
          <Users size={12} />
          Faction Storage
        </span>
        <button
          className={shared.refreshBtn}
          onClick={refetchFaction}
          title="Refresh faction storage"
          type="button"
          disabled={factionLoading}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {factionLoading && !factionData && (
        <div className={styles.loading}>Loading faction storage...</div>
      )}

      {factionError && !factionLoading && !factionData && (
        <div className={shared.emptyState}>
          {factionError}
          <div style={{ marginTop: '0.4rem', fontSize: '0.65rem', opacity: 0.75 }}>
            Build a faction lockbox at this base to enable faction storage.
          </div>
        </div>
      )}

      {/* Faction treasury credits */}
      {factionData && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Coins size={12} />
            Treasury: <Credits amount={factionData.credits} />
          </div>
          <div className={styles.itemRow}>
            <div className={styles.itemInfo}>
              <span className={styles.itemQty}>Wallet: <Credits amount={walletCredits} /></span>
            </div>
            <div className={styles.itemAction}>
              <input
                className={styles.qtyInput}
                type="number"
                min={1}
                step={1}
                placeholder="cr"
                value={treasuryAmount}
                onChange={(e) => setTreasuryAmount(e.target.value)}
              />
              <button
                className={shared.confirmBtn}
                onClick={() => handleTreasury('deposit', parseCreditAmount(treasuryAmount, Infinity))}
                disabled={actionPending || parseCreditAmount(treasuryAmount, Infinity) === null}
                title="Deposit credits to the faction treasury"
                type="button"
              >
                <ArrowDownToLine size={10} /> Deposit
              </button>
              <button
                className={shared.accentBtn}
                onClick={() => handleTreasury('withdraw', parseCreditAmount(treasuryAmount, factionData.credits))}
                disabled={actionPending || parseCreditAmount(treasuryAmount, factionData.credits) === null}
                title="Withdraw credits to your wallet"
                type="button"
              >
                <ArrowUpFromLine size={10} /> Withdraw
              </button>
            </div>
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
