'use client'

import { useCallback, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useAccountStore, useCommandMutation, type TradeOffer } from '@/lib/spacemolt'
import { usePlay, usePlayUi } from '../../PlayProvider'
import { Credits, shared } from '../../shared'
import styles from '../TradingPanel.module.css'

interface TradeItemStack {
  item_id: string
  quantity: number
}

/** offer_items/request_items are loosely typed on the wire (Array<Record<string, unknown>>) — narrow defensively. */
function tradeItems(items: TradeOffer['offer_items']): TradeItemStack[] {
  return (items ?? []).map((item) => ({
    item_id: typeof item.item_id === 'string' ? item.item_id : '',
    quantity: typeof item.quantity === 'number' ? item.quantity : 0,
  }))
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export function TradesList() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const pendingTrades = usePlayUi((s) => s.pendingTrades)
  const mutate = useCommandMutation()
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null)

  const reportError = useCallback((err: unknown) => {
    const text = errorMessage(err)
    uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    uiStore.dispatch({ type: 'event', kind: 'danger', text })
  }, [uiStore])

  const handleAcceptTrade = useCallback(
    async (tradeId: string) => {
      setBusyTradeId(tradeId)
      try {
        await mutate((c) => c.spacemolt_transfer.trade_accept({ trade_id: tradeId }), { label: 'trade_accept' })
        uiStore.dispatch({ type: 'trade_closed', tradeId })
      } catch (err) {
        reportError(err)
      } finally {
        setBusyTradeId(null)
      }
    },
    [mutate, uiStore, reportError]
  )

  const handleDeclineTrade = useCallback(
    async (tradeId: string) => {
      setBusyTradeId(tradeId)
      try {
        await store.account.commands.spacemolt_transfer.trade_decline({ trade_id: tradeId })
        uiStore.dispatch({ type: 'trade_closed', tradeId })
      } catch (err) {
        reportError(err)
      } finally {
        setBusyTradeId(null)
      }
    },
    [store, uiStore, reportError]
  )

  return (
    <div>
      <div className={shared.sectionTitle}>
        Pending Trades ({pendingTrades.length})
      </div>
      {pendingTrades.length > 0 ? (
        <div className={styles.tradesList}>
          {pendingTrades.map((trade) => {
            const offerItems = tradeItems(trade.offer_items)
            const requestItems = tradeItems(trade.request_items)
            const offerCredits = trade.offer_credits ?? 0
            const requestCredits = trade.request_credits ?? 0
            const busy = busyTradeId === trade.trade_id

            return (
              <div key={trade.trade_id} className={styles.tradeCard}>
                <div className={styles.tradeHeader}>
                  <span className={styles.tradeFrom}>
                    From: {trade.offerer_name || 'another player'}
                  </span>
                  {offerCredits > 0 && (
                    <span className={styles.tradeCredits}>
                      <Credits amount={offerCredits} />
                    </span>
                  )}
                </div>

                {offerItems.length > 0 && (
                  <div className={styles.tradeItems}>
                    Offering:{' '}
                    {offerItems
                      .map((item) => `${item.item_id} x${item.quantity}`)
                      .join(', ')}
                  </div>
                )}

                {(requestItems.length > 0 || requestCredits > 0) && (
                  <div className={styles.tradeItems}>
                    Requesting:{' '}
                    {[
                      ...requestItems.map(
                        (item) => `${item.item_id} x${item.quantity}`
                      ),
                      requestCredits > 0
                        ? `${requestCredits.toLocaleString()} cr`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}

                <div className={styles.tradeActions}>
                  <button
                    className={shared.confirmBtn}
                    onClick={() => handleAcceptTrade(trade.trade_id)}
                    disabled={busy}
                    type="button"
                  >
                    <Check size={12} />
                    Accept
                  </button>
                  <button
                    className={shared.dangerBtn}
                    onClick={() => handleDeclineTrade(trade.trade_id)}
                    disabled={busy}
                    type="button"
                  >
                    <X size={12} />
                    Decline
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={shared.emptyState}>No pending trade offers</div>
      )}
    </div>
  )
}
