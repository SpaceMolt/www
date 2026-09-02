'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Package,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Ship,
  Gift,
  ChevronDown,
  ChevronRight,
  Send,
  MapPin,
} from 'lucide-react'
import {
  useAccountStore,
  useCargo,
  useCommandMutation,
  useCommandQuery,
  useLocationState,
  usePendingAction,
} from '@/lib/spacemolt'
import type { StorageResponse } from '@spacemolt/lib'
import { usePlay } from '../../PlayProvider'
import { ItemName } from '../../ItemTooltip'
import { Credits, shared } from '../../shared'
import { titleCase } from '@/lib/format'
import styles from './StorageView.module.css'
import { resolveGiftAction, isGiftSubmitDisabled } from './giftValidation'

// StorageResponse is one generated union across every branch of the unified
// storage action (self view, faction view, deposit/withdraw/gift results) —
// narrow to the branch view({target: 'self' | undefined}) actually returns.
type PersonalStorageView = Extract<StorageResponse, { hint: string; ships: Array<unknown> }> & {
  // The server sends `locations` on every self view (gameserver 0.555.0+); the
  // generated union predates it.
  locations?: Array<{ base_id: string }>
}

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

/** Station ids for the remote-storage picker, from the structured location list (gh#2070). */
export function storageStationIds(view: PersonalStorageView | undefined): string[] {
  return (view?.locations ?? []).map((loc) => loc.base_id)
}

export function StorageView() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const location = useLocationState()
  const dockedAt = location?.docked_at
  const isDocked = Boolean(dockedAt)
  const rawCargo = useCargo()
  const cargo = useMemo(() => normalizeCargo(rawCargo), [rawCargo])
  const actionPending = usePendingAction() !== null
  const mutate = useCommandMutation()

  const reportError = useCallback((err: unknown) => {
    const text = errorMessage(err)
    uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    uiStore.dispatch({ type: 'event', kind: 'danger', text })
  }, [uiStore])

  const { data: storageData, refetch: refetchStorage } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view()).structuredContent as PersonalStorageView | undefined,
    [dockedAt],
    { enabled: isDocked, refreshOnSections: ['cargo'] },
  )

  // Remote viewing state (undocked)
  const [remoteStations, setRemoteStations] = useState<string[]>([])
  const [selectedStation, setSelectedStation] = useState('')
  const [remoteData, setRemoteData] = useState<PersonalStorageView | null>(null)
  const [remoteLoading, setRemoteLoading] = useState(false)

  // Item withdraw qty tracking (keyed by item_id)
  const [withdrawQtys, setWithdrawQtys] = useState<Record<string, string>>({})
  // Item deposit qty tracking (keyed by item_id)
  const [depositQtys, setDepositQtys] = useState<Record<string, string>>({})

  // Expandable sections
  const [showGifts, setShowGifts] = useState(true)
  const [showSendGift, setShowSendGift] = useState(false)
  const [giftRecipient, setGiftRecipient] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [giftCredits, setGiftCredits] = useState('')
  const [giftItemId, setGiftItemId] = useState('')
  const [giftItemQty, setGiftItemQty] = useState('')
  const [giftShipId, setGiftShipId] = useState('')
  const [sendingGift, setSendingGift] = useState(false)

  // When undocked, probe for station list (bypasses toast dispatch on the expected "not docked" error)
  useEffect(() => {
    if (isDocked) {
      setRemoteStations([])
      setSelectedStation('')
      setRemoteData(null)
      return
    }
    let cancelled = false
    store.account.commands.spacemolt_storage.view().then((result) => {
      if (cancelled) return
      setRemoteStations(storageStationIds(result.structuredContent as PersonalStorageView | undefined))
    }).catch(() => {
      if (cancelled) return
      setRemoteStations([])
    })
    return () => {
      cancelled = true
    }
  }, [isDocked, store])

  // Fetch remote station storage
  useEffect(() => {
    if (!selectedStation || isDocked) return
    let cancelled = false
    setRemoteLoading(true)
    store.account.commands.spacemolt_storage.view({ station_id: selectedStation }).then((result) => {
      if (cancelled) return
      setRemoteData((result.structuredContent as PersonalStorageView | undefined) ?? null)
      setRemoteLoading(false)
    }).catch(() => {
      if (cancelled) return
      setRemoteLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedStation, isDocked, store])

  const handleRefresh = useCallback(() => {
    if (isDocked) {
      refetchStorage()
    } else if (selectedStation) {
      setRemoteLoading(true)
      store.account.commands.spacemolt_storage.view({ station_id: selectedStation }).then((result) => {
        setRemoteData((result.structuredContent as PersonalStorageView | undefined) ?? null)
        setRemoteLoading(false)
      }).catch(() => setRemoteLoading(false))
    }
  }, [isDocked, selectedStation, store, refetchStorage])

  // Item operations (docked only)
  const handleWithdrawItem = useCallback(
    async (itemId: string, maxQty: number) => {
      if (actionPending) return
      const qtyStr = withdrawQtys[itemId] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      try {
        await mutate((c) => c.spacemolt_storage.withdraw({ item_id: itemId, quantity }), { label: 'withdraw_items' })
        setWithdrawQtys((prev) => ({ ...prev, [itemId]: '' }))
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, withdrawQtys, actionPending, reportError]
  )

  const handleDepositItem = useCallback(
    async (itemId: string, maxQty: number) => {
      if (actionPending) return
      const qtyStr = depositQtys[itemId] ?? String(maxQty)
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      try {
        await mutate((c) => c.spacemolt_storage.deposit({ item_id: itemId, quantity }), { label: 'deposit_items' })
        setDepositQtys((prev) => ({ ...prev, [itemId]: '' }))
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, depositQtys, actionPending, reportError]
  )

  const handleSendGift = useCallback(async () => {
    const target = giftRecipient.trim()
    if (!target) return
    // send_gift routes to spacemolt_storage.deposit on v2. The backend payload
    // uses target=<player_name> for recipient and item_id for the thing being
    // gifted (item id, "credits", or a ship instance ID). A single send_gift
    // call transfers one of items, credits, or ship, so resolveGiftAction picks
    // exactly one. The item/ship pickers list station storage contents, so item
    // transfers source from storage.
    const action = resolveGiftAction({
      credits: giftCredits,
      itemId: giftItemId,
      itemQty: giftItemQty,
      shipId: giftShipId,
    })
    // Nothing valid to send: leave the form filled in so a no-op cannot look
    // like a completed gift (dc#689374).
    if (!action) return
    const message = giftMessage.trim() || undefined
    setSendingGift(true)
    try {
      if (action.kind === 'ship') {
        await mutate((c) => c.spacemolt_storage.deposit({ target, item_id: action.shipId, message }), { label: 'send_gift' })
      } else if (action.kind === 'item') {
        await mutate((c) => c.spacemolt_storage.deposit({ target, item_id: action.itemId, quantity: action.quantity, source: 'storage', message }), { label: 'send_gift' })
      } else {
        await mutate((c) => c.spacemolt_storage.deposit({ target, credits: action.credits, message }), { label: 'send_gift' })
      }
      setGiftRecipient('')
      setGiftMessage('')
      setGiftCredits('')
      setGiftItemId('')
      setGiftItemQty('')
      setGiftShipId('')
      setShowSendGift(false)
      refetchStorage()
    } catch (err) {
      reportError(err)
    } finally {
      setSendingGift(false)
    }
  }, [mutate, giftRecipient, giftMessage, giftCredits, giftItemId, giftItemQty, giftShipId, refetchStorage, reportError])

  // --- Undocked: remote station viewer ---
  if (!isDocked) {
    const viewData = remoteData
    const viewItems = viewData?.items || []
    const viewShips = viewData?.ships || []

    return (
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <span className={styles.sectionLabel}>
            <MapPin size={12} />
            Remote Storage View
          </span>
          {selectedStation && (
            <button
              className={shared.refreshBtn}
              onClick={handleRefresh}
              title="Refresh"
              type="button"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>

        {remoteStations.length > 0 ? (
          <div className={styles.section}>
            <select
              className={shared.selectInput}
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
            >
              <option value="">Select a station...</option>
              {remoteStations.map((stationId) => (
                <option key={stationId} value={stationId}>
                  {titleCase(stationId)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className={shared.emptyState}>Nothing stored at any station</div>
        )}

        {remoteLoading && (
          <div className={styles.loading}>Loading storage...</div>
        )}

        {selectedStation && !remoteLoading && viewData && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Box size={12} />
                Stored Items ({viewItems.length})
              </div>
              {viewItems.length > 0 ? (
                <div className={styles.itemList}>
                  {viewItems.map((item) => (
                    <div key={item.item_id} className={styles.itemRow}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}><ItemName itemId={item.item_id}>{item.name}</ItemName></span>
                        <span className={styles.itemQty}>x{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={shared.emptyState}>No items at this station</div>
              )}
            </div>

            {viewShips.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Ship size={12} />
                  Stored Ships ({viewShips.length})
                </div>
                <div className={styles.shipList}>
                  {viewShips.map((ship) => (
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
          </>
        )}
      </div>
    )
  }

  // --- Docked: full storage with controls ---
  if (!storageData) {
    return <div className={styles.loading}>Loading storage data...</div>
  }

  const storedItems = storageData.items || []
  const storedShips = storageData.ships || []
  const gifts = storageData.gifts || []

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.sectionLabel}>
          <Package size={12} />
          Station Storage
        </span>
        <button
          className={shared.refreshBtn}
          onClick={handleRefresh}
          title="Refresh storage"
          type="button"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Gifts notification */}
      {gifts.length > 0 && (
        <div className={styles.giftsSection}>
          <button
            className={styles.giftToggle}
            onClick={() => setShowGifts(!showGifts)}
            type="button"
          >
            <Gift size={12} />
            <span className={styles.giftBadge}>{gifts.length}</span>
            Gifts Received
            {showGifts ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {showGifts && (
            <div className={styles.giftList}>
              {gifts.map((gift, idx) => (
                <div key={`${gift.sender_id}-${idx}`} className={styles.giftCard}>
                  <div className={styles.giftHeader}>
                    <span className={styles.giftSender}>From: {gift.sender}</span>
                    <span className={styles.giftTime}>{gift.timestamp}</span>
                  </div>
                  {gift.message && (
                    <div className={styles.giftMessage}>{gift.message}</div>
                  )}
                  <div className={styles.giftContents}>
                    {gift.items && gift.items.length > 0 && (
                      <span className={styles.giftItems}>
                        {gift.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                      </span>
                    )}
                    {gift.ships && gift.ships.length > 0 && (
                      <span className={styles.giftShips}>
                        {gift.ships.map((s) => s.class_name || s.class_id).join(', ')}
                      </span>
                    )}
                    {gift.credits != null && gift.credits > 0 && (
                      <span className={styles.giftCredits}>
                        <Credits amount={gift.credits} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Send Gift */}
      <div className={styles.section}>
        <button
          className={styles.giftToggle}
          onClick={() => setShowSendGift(!showSendGift)}
          type="button"
        >
          <Send size={12} />
          Send Gift
          {showSendGift ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {showSendGift && (
          <div className={styles.giftSendForm}>
            <input
              className={shared.textInput}
              type="text"
              placeholder="Recipient username"
              value={giftRecipient}
              onChange={(e) => setGiftRecipient(e.target.value)}
            />
            <input
              className={shared.textInput}
              type="text"
              placeholder="Message (optional)"
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
            />
            <div className={styles.giftSendRow}>
              <input
                className={shared.textInput}
                type="number"
                min={0}
                placeholder="Credits"
                value={giftCredits}
                onChange={(e) => setGiftCredits(e.target.value)}
              />
            </div>
            {storedItems.length > 0 && (
              <div className={styles.giftSendRow}>
                <select
                  className={shared.selectInput}
                  value={giftItemId}
                  onChange={(e) => setGiftItemId(e.target.value)}
                >
                  <option value="">-- Select item --</option>
                  {storedItems.map((item) => (
                    <option key={item.item_id} value={item.item_id}>
                      {item.name} (x{item.quantity})
                    </option>
                  ))}
                </select>
                {giftItemId && (
                  <input
                    className={shared.textInput}
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={giftItemQty}
                    onChange={(e) => setGiftItemQty(e.target.value)}
                  />
                )}
              </div>
            )}
            {storedShips.length > 0 && (
              <div className={styles.giftSendRow}>
                <select
                  className={shared.selectInput}
                  value={giftShipId}
                  onChange={(e) => setGiftShipId(e.target.value)}
                >
                  <option value="">-- Gift a ship --</option>
                  {storedShips.map((ship) => (
                    <option key={ship.ship_id} value={ship.ship_id}>
                      {ship.class_name || ship.class_id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              className={shared.confirmBtn}
              onClick={handleSendGift}
              disabled={
                sendingGift ||
                isGiftSubmitDisabled({
                  recipient: giftRecipient,
                  credits: giftCredits,
                  itemId: giftItemId,
                  itemQty: giftItemQty,
                  shipId: giftShipId,
                })
              }
              type="button"
            >
              <Send size={10} />
              {sendingGift ? 'Sending...' : 'Send Gift'}
            </button>
          </div>
        )}
      </div>

      {/* Stored items */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Box size={12} />
          Stored Items ({storedItems.length})
        </div>
        {storedItems.length > 0 ? (
          <div className={styles.itemList}>
            {storedItems.map((item) => {
              const qtyStr = withdrawQtys[item.item_id] ?? String(item.quantity)
              return (
                <div key={item.item_id} className={styles.itemRow}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}><ItemName itemId={item.item_id}>{item.name}</ItemName></span>
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
                      title={actionPending ? 'Another action is pending' : 'Withdraw to cargo'}
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
          <div className={shared.emptyState}>No items in storage</div>
        )}
      </div>

      {/* Ship cargo (for depositing) */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Package size={12} />
          Ship Cargo ({cargo.length})
        </div>
        {cargo.length > 0 ? (
          <div className={styles.itemList}>
            {cargo.map((item) => {
              const qtyStr = depositQtys[item.item_id] ?? String(item.quantity)
              return (
                <div key={item.item_id} className={styles.itemRow}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}><ItemName itemId={item.item_id}>{item.name ?? item.item_id}</ItemName></span>
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
                      onClick={() => handleDepositItem(item.item_id, item.quantity)}
                      disabled={
                        actionPending ||
                        !qtyStr ||
                        parseInt(qtyStr, 10) < 1 ||
                        parseInt(qtyStr, 10) > item.quantity
                      }
                      title={actionPending ? 'Another action is pending' : 'Deposit to storage'}
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

      {/* Stored ships */}
      {storedShips.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Ship size={12} />
            Stored Ships ({storedShips.length})
          </div>
          <div className={styles.shipList}>
            {storedShips.map((ship) => (
              <div key={ship.ship_id} className={styles.shipCard}>
                <span className={styles.shipName}>
                  {ship.class_name || ship.class_id}
                </span>
                <div className={styles.shipMeta}>
                  <span className={styles.shipStat}>
                    Modules: {ship.modules}
                  </span>
                  <span className={styles.shipStat}>
                    Cargo: {ship.cargo_used}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
