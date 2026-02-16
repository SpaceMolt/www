'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Package,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  Box,
  Ship,
  Gift,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import type { StorageItem, StorageShip, StorageGift } from '../../types'
import styles from './StorageView.module.css'

export function StorageView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const storageData = state.storageData
  const cargo = state.ship?.cargo || []
  const playerCredits = state.player?.credits ?? 0

  // Credits forms
  const [depositCreditsAmt, setDepositCreditsAmt] = useState('')
  const [withdrawCreditsAmt, setWithdrawCreditsAmt] = useState('')

  // Item withdraw qty tracking (keyed by item_id)
  const [withdrawQtys, setWithdrawQtys] = useState<Record<string, string>>({})
  // Item deposit qty tracking (keyed by item_id)
  const [depositQtys, setDepositQtys] = useState<Record<string, string>>({})

  // Expandable sections
  const [showGifts, setShowGifts] = useState(true)

  // Auto-fetch storage data when docked and data is null
  useEffect(() => {
    if (isDocked && !storageData) {
      sendCommand('view_storage')
    }
  }, [isDocked, storageData, sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('view_storage')
  }, [sendCommand])

  // Credit operations
  const handleDepositCredits = useCallback(() => {
    const amount = parseInt(depositCreditsAmt, 10)
    if (isNaN(amount) || amount < 1) return
    sendCommand('deposit_credits', { amount })
    setDepositCreditsAmt('')
  }, [sendCommand, depositCreditsAmt])

  const handleWithdrawCredits = useCallback(() => {
    const amount = parseInt(withdrawCreditsAmt, 10)
    if (isNaN(amount) || amount < 1) return
    sendCommand('withdraw_credits', { amount })
    setWithdrawCreditsAmt('')
  }, [sendCommand, withdrawCreditsAmt])

  // Item operations
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

  if (!isDocked) {
    return (
      <div className={styles.dockedOnly}>
        Dock at a base to access storage
      </div>
    )
  }

  if (!storageData) {
    return <div className={styles.loading}>Loading storage data...</div>
  }

  const storedItems: StorageItem[] = storageData.items || []
  const storedShips: StorageShip[] = storageData.ships || []
  const gifts: StorageGift[] = storageData.gifts || []

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
              {gifts.map((gift: StorageGift, idx: number) => (
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

      {/* Credits section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Coins size={12} />
          Credits
        </div>
        <div className={styles.creditsDisplay}>
          <div className={styles.creditRow}>
            <span className={styles.creditLabel}>Stored</span>
            <span className={styles.creditValue}>
              {storageData.credits.toLocaleString()} cr
            </span>
          </div>
          <div className={styles.creditRow}>
            <span className={styles.creditLabel}>Wallet</span>
            <span className={styles.creditValue}>
              {playerCredits.toLocaleString()} cr
            </span>
          </div>
        </div>
        <div className={styles.creditActions}>
          <div className={styles.creditForm}>
            <input
              className={styles.creditInput}
              type="number"
              min={1}
              placeholder="Amount"
              value={depositCreditsAmt}
              onChange={(e) => setDepositCreditsAmt(e.target.value)}
            />
            <button
              className={styles.depositBtn}
              onClick={handleDepositCredits}
              disabled={!depositCreditsAmt || parseInt(depositCreditsAmt, 10) < 1}
              title="Deposit credits to storage"
              type="button"
            >
              <ArrowDownToLine size={11} />
              Deposit
            </button>
          </div>
          <div className={styles.creditForm}>
            <input
              className={styles.creditInput}
              type="number"
              min={1}
              placeholder="Amount"
              value={withdrawCreditsAmt}
              onChange={(e) => setWithdrawCreditsAmt(e.target.value)}
            />
            <button
              className={styles.withdrawBtn}
              onClick={handleWithdrawCredits}
              disabled={!withdrawCreditsAmt || parseInt(withdrawCreditsAmt, 10) < 1}
              title="Withdraw credits from storage"
              type="button"
            >
              <ArrowUpFromLine size={11} />
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Stored items */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Box size={12} />
          Stored Items ({storedItems.length})
        </div>
        {storedItems.length > 0 ? (
          <div className={styles.itemList}>
            {storedItems.map((item: StorageItem) => {
              const qtyStr = withdrawQtys[item.item_id] || ''
              return (
                <div key={item.item_id} className={styles.itemRow}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemQty}>x{item.quantity}</span>
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
            {storedShips.map((ship: StorageShip) => (
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
