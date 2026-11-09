'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, RefreshCw, X } from 'lucide-react'
import { mergeTradeSnapshot, useAccountStore, useCommandMutation, useCommandQuery, type TradeOffer } from '@/lib/spacemolt'
import { usePlay, usePlayUi } from '../../PlayProvider'
import { ConfirmAction, Credits, errorMessage, shared } from '../../shared'
import { TradeOfferForm } from './TradeOfferForm'
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

const describeItems = (items: TradeItemStack[], credits = 0) =>
  [...items.map((item) => `${item.item_id} x${item.quantity}`), credits > 0 ? `${credits.toLocaleString()} cr` : '']
    .filter(Boolean)
    .join(', ')

export function TradesList() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const pendingTrades = usePlayUi((s) => s.pendingTrades)
  const mutate = useCommandMutation()
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)

  const { data: trades, refetch: refetchTrades } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_transfer.get_trades()).structuredContent,
    [],
  )
  const outgoing = trades?.outgoing ?? []

  // Pushes sent while this tab was closed or offline never arrive; each fetch also resyncs incoming offers.
  useEffect(() => {
    if (trades) uiStore.dispatch({ type: 'seed_trades', trades: mergeTradeSnapshot(uiStore.getState().pendingTrades, trades.incoming) })
  }, [trades, uiStore])

  const reportError = useCallback((err: unknown) => {
    const text = errorMessage(err)
    uiStore.dispatch({ type: 'toast', kind: 'danger', text })
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

  const handleCancelTrade = useCallback(
    async (tradeId: string) => {
      setCancelId(null)
      setBusyTradeId(tradeId)
      try {
        await store.account.commands.spacemolt_transfer.trade_cancel({ trade_id: tradeId })
        refetchTrades()
      } catch (err) {
        reportError(err)
      } finally {
        setBusyTradeId(null)
      }
    },
    [store, refetchTrades, reportError]
  )

  return (
    <div>
      <div className={styles.tradesToolbar}>
        <button className={shared.actionBtn} onClick={() => setShowForm(!showForm)} type="button">
          <Plus size={12} /> New Trade
        </button>
        <button className={shared.refreshBtn} onClick={refetchTrades} title="Refresh trades" type="button">
          <RefreshCw size={13} />
        </button>
      </div>
      {showForm && <TradeOfferForm onSent={refetchTrades} onClose={() => setShowForm(false)} />}

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
            const stationSale = Boolean(trade.station_id)

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

                {stationSale && (
                  <div className={styles.tradeItems}>
                    <div>Station or outpost: {trade.station_id}</div>
                    <div>Seller faction: {trade.seller_faction_id || 'the offering leader’s faction'}</div>
                    <div>Your faction pays: <Credits amount={requestCredits} /> from its treasury.</div>
                    <div>
                      Seller pays: <Credits amount={trade.labor_cost ?? 1_000_000} /> labor to station citizens
                      {' + '}<Credits amount={trade.transfer_tax ?? 3_000_000} /> tax to its primary taxable empire.
                    </div>
                    <div>Includes the seller’s facilities and faction storage contents at acceptance.</div>
                    <div>Only the receiving faction leader can accept. Station caps and facility limits still apply.</div>
                  </div>
                )}

                {offerItems.length > 0 && (
                  <div className={styles.tradeItems}>Offering: {describeItems(offerItems)}</div>
                )}

                {!stationSale && (requestItems.length > 0 || requestCredits > 0) && (
                  <div className={styles.tradeItems}>Requesting: {describeItems(requestItems, requestCredits)}</div>
                )}

                <div className={styles.tradeActions}>
                  <button
                    className={shared.confirmBtn}
                    onClick={() => handleAcceptTrade(trade.trade_id)}
                    disabled={busy}
                    type="button"
                  >
                    <Check size={12} />
                    {stationSale ? 'Buy for faction' : 'Accept'}
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

      {outgoing.length > 0 && (
        <>
          <div className={shared.sectionTitle}>Your Offers ({outgoing.length})</div>
          <div className={styles.tradesList}>
            {outgoing.map((trade) => (
              <div key={trade.trade_id} className={styles.tradeCard}>
                <div className={styles.tradeHeader}>
                  <span className={styles.tradeFrom}>To: {trade.target_name || 'another player'}</span>
                </div>
                <div className={styles.tradeItems}>Offering: {describeItems(tradeItems(trade.offer_items), trade.offer_credits) || 'nothing'}</div>
                {(trade.request_items.length > 0 || (trade.request_credits ?? 0) > 0) && (
                  <div className={styles.tradeItems}>Requesting: {describeItems(tradeItems(trade.request_items), trade.request_credits)}</div>
                )}
                {cancelId === trade.trade_id ? (
                  <ConfirmAction message="Withdraw this offer?" onConfirm={() => handleCancelTrade(trade.trade_id)} onCancel={() => setCancelId(null)} />
                ) : (
                  <div className={styles.tradeActions}>
                    <button className={shared.dangerBtn} onClick={() => setCancelId(trade.trade_id)} disabled={busyTradeId === trade.trade_id} type="button">
                      <X size={12} /> Cancel Offer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
