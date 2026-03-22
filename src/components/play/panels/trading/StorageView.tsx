'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { useGame } from '../../GameProvider'
import { GameApiError } from '@/lib/gameApi'
import styles from './StorageView.module.css'

/** Parse station IDs from the hint string: "X items in storage at station1, station2" */
function parseStationsFromHint(hint: string): string[] {
  const match = hint.match(/storage at (.+)$/)
  if (!match) return []
  return match[1].split(',').map((s) => s.trim()).filter(Boolean)
}

export function StorageView() {
  const { state, sendCommand, api } = useGame()
  const isDocked = state.isDocked
  const storageData = state.storageData
  const cargo = state.ship?.cargo || []

  // Remote viewing state (undocked)
  const [remoteStations, setRemoteStations] = useState<string[]>([])
  const [selectedStation, setSelectedStation] = useState('')
  const [remoteData, setRemoteData] = useState<typeof storageData>(null)
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

  // When docked, auto-fetch storage
  useEffect(() => {
    if (isDocked && !storageData) {
      sendCommand('view_storage')
    }
  }, [isDocked, storageData, sendCommand])

  // When undocked, probe for station list using the API directly
  // (bypasses sendCommand error dispatch to avoid showing error toasts)
  useEffect(() => {
    if (isDocked) {
      setRemoteStations([])
      setSelectedStation('')
      setRemoteData(null)
      return
    }
    if (!api) return
    api.command('view_storage').then((result) => {
      const hint = (result as Record<string, unknown>).hint as string || ''
      if (hint) {
        setRemoteStations(parseStationsFromHint(hint))
      }
    }).catch((err: unknown) => {
      // The not_docked error message contains the station list hint
      if (err instanceof GameApiError) {
        const stations = parseStationsFromHint(err.message)
        setRemoteStations(stations)
      }
    })
  }, [isDocked, api])

  // Fetch remote station storage
  useEffect(() => {
    if (!selectedStation || isDocked || !api) return
    setRemoteLoading(true)
    api.command('view_storage', { station_id: selectedStation }).then((result) => {
      setRemoteData(result as typeof storageData)
      setRemoteLoading(false)
    }).catch(() => {
      setRemoteLoading(false)
    })
  }, [selectedStation, isDocked, api])

  const handleRefresh = useCallback(() => {
    if (isDocked) {
      sendCommand('view_storage')
    } else if (selectedStation && api) {
      setRemoteLoading(true)
      api.command('view_storage', { station_id: selectedStation }).then((result) => {
        setRemoteData(result as typeof storageData)
        setRemoteLoading(false)
      }).catch(() => setRemoteLoading(false))
    }
  }, [sendCommand, isDocked, selectedStation, api])

  // Item operations (docked only)
  const handleWithdrawItem = useCallback(
    (itemId: string, maxQty: number) => {
      const qtyStr = withdrawQtys[itemId] || ''
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      sendCommand('withdraw_items', { item_id: itemId, quantity })
      setWithdrawQtys((prev) => ({ ...prev, [itemId]: '' }))
    },
    [sendCommand, withdrawQtys]
  )

  const handleDepositItem = useCallback(
    (itemId: string, maxQty: number) => {
      const qtyStr = depositQtys[itemId] || ''
      const quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity < 1 || quantity > maxQty) return
      sendCommand('deposit_items', { item_id: itemId, quantity })
      setDepositQtys((prev) => ({ ...prev, [itemId]: '' }))
    },
    [sendCommand, depositQtys]
  )

  const handleSendGift = useCallback(async () => {
    if (!giftRecipient.trim()) return
    setSendingGift(true)
    try {
      const params: Record<string, unknown> = { recipient: giftRecipient.trim() }
      if (giftMessage.trim()) params.message = giftMessage.trim()
      const credits = parseInt(giftCredits, 10)
      if (!isNaN(credits) && credits > 0) params.credits = credits
      if (giftItemId && giftItemQty) {
        const qty = parseInt(giftItemQty, 10)
        if (!isNaN(qty) && qty > 0) {
          params.items = { [giftItemId]: qty }
        }
      }
      if (giftShipId) params.ship_id = giftShipId
      await sendCommand('send_gift', params)
      setGiftRecipient('')
      setGiftMessage('')
      setGiftCredits('')
      setGiftItemId('')
      setGiftItemQty('')
      setGiftShipId('')
      setShowSendGift(false)
      sendCommand('view_storage')
    } finally {
      setSendingGift(false)
    }
  }, [sendCommand, giftRecipient, giftMessage, giftCredits, giftItemId, giftItemQty, giftShipId])

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
              className={styles.refreshBtn}
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
              className={styles.stationSelect}
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
            >
              <option value="">Select a station...</option>
              {remoteStations.map((stationId) => (
                <option key={stationId} value={stationId}>
                  {stationId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className={styles.emptyState}>No items stored at any station</div>
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
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemQty}>x{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>No items at this station</div>
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
          className={styles.refreshBtn}
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
                        {gift.credits.toLocaleString()} cr
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
              className={styles.creditInput}
              type="text"
              placeholder="Recipient username"
              value={giftRecipient}
              onChange={(e) => setGiftRecipient(e.target.value)}
            />
            <input
              className={styles.creditInput}
              type="text"
              placeholder="Message (optional)"
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
            />
            <div className={styles.giftSendRow}>
              <input
                className={styles.creditInput}
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
                  className={styles.creditInput}
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
                    className={styles.qtyInput}
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
                  className={styles.creditInput}
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
              className={styles.depositBtn}
              onClick={handleSendGift}
              disabled={sendingGift || !giftRecipient.trim() || (!giftCredits && !giftItemId && !giftShipId)}
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
              const qtyStr = withdrawQtys[item.item_id] || ''
              return (
                <div key={item.item_id} className={styles.itemRow}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.name}</span>
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
                      placeholder="Qty"
                      value={qtyStr}
                      onChange={(e) =>
                        setWithdrawQtys((prev) => ({
                          ...prev,
                          [item.item_id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      className={styles.withdrawBtn}
                      onClick={() => handleWithdrawItem(item.item_id, item.quantity)}
                      disabled={
                        !qtyStr ||
                        parseInt(qtyStr, 10) < 1 ||
                        parseInt(qtyStr, 10) > item.quantity
                      }
                      title="Withdraw to cargo"
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
          <div className={styles.emptyState}>No items in storage</div>
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
              const qtyStr = depositQtys[item.item_id] || ''
              return (
                <div key={item.item_id} className={styles.itemRow}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.name}</span>
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
                      placeholder="Qty"
                      value={qtyStr}
                      onChange={(e) =>
                        setDepositQtys((prev) => ({
                          ...prev,
                          [item.item_id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      className={styles.depositBtn}
                      onClick={() => handleDepositItem(item.item_id, item.quantity)}
                      disabled={
                        !qtyStr ||
                        parseInt(qtyStr, 10) < 1 ||
                        parseInt(qtyStr, 10) > item.quantity
                      }
                      title="Deposit to storage"
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
          <div className={styles.emptyState}>Cargo hold is empty</div>
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
