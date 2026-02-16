'use client'

import { useCallback } from 'react'
import { Check, X } from 'lucide-react'
import { useGame } from '../../GameProvider'
import styles from '../TradingPanel.module.css'

export function TradesList() {
  const { state, sendCommand } = useGame()
  const pendingTrades = state.pendingTrades || []

  const handleAcceptTrade = useCallback(
    (tradeId: string) => {
      sendCommand('trade_accept', { trade_id: tradeId })
    },
    [sendCommand]
  )

  const handleDeclineTrade = useCallback(
    (tradeId: string) => {
      sendCommand('trade_decline', { trade_id: tradeId })
    },
    [sendCommand]
  )

  return (
    <div>
      <div className={styles.sectionTitle}>
        Pending Trades ({pendingTrades.length})
      </div>
      {pendingTrades.length > 0 ? (
        <div className={styles.tradesList}>
          {pendingTrades.map((trade) => (
            <div key={trade.trade_id} className={styles.tradeCard}>
              <div className={styles.tradeHeader}>
                <span className={styles.tradeFrom}>
                  From: {trade.from_name}
                </span>
                {trade.offer_credits > 0 && (
                  <span className={styles.tradeCredits}>
                    {trade.offer_credits.toLocaleString()} cr
                  </span>
                )}
              </div>

              {trade.offer_items.length > 0 && (
                <div className={styles.tradeItems}>
                  Offering:{' '}
                  {trade.offer_items
                    .map(
                      (item) => `${item.item_id} x${item.quantity}`
                    )
                    .join(', ')}
                </div>
              )}

              {(trade.request_items.length > 0 ||
                trade.request_credits > 0) && (
                <div className={styles.tradeItems}>
                  Requesting:{' '}
                  {[
                    ...trade.request_items.map(
                      (item) => `${item.item_id} x${item.quantity}`
                    ),
                    trade.request_credits > 0
                      ? `${trade.request_credits.toLocaleString()} cr`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}

              <div className={styles.tradeActions}>
                <button
                  className={styles.acceptBtn}
                  onClick={() => handleAcceptTrade(trade.trade_id)}
                  type="button"
                >
                  <Check size={12} />
                  Accept
                </button>
                <button
                  className={styles.declineBtn}
                  onClick={() => handleDeclineTrade(trade.trade_id)}
                  type="button"
                >
                  <X size={12} />
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>No pending trade offers</div>
      )}
    </div>
  )
}
