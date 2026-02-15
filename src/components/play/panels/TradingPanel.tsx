'use client'

import { useState, useCallback } from 'react'
import {
  TrendingUp,
  ShoppingCart,
  ArrowLeftRight,
  Package,
  Check,
  X,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import styles from './TradingPanel.module.css'

type TabId = 'market' | 'trades' | 'storage'

export function TradingPanel() {
  const { state, sendCommand } = useGame()
  const [activeTab, setActiveTab] = useState<TabId>('market')

  // Buy form state
  const [buyItemId, setBuyItemId] = useState('')
  const [buyQty, setBuyQty] = useState('1')

  // Sell form state
  const [sellItemId, setSellItemId] = useState('')
  const [sellQty, setSellQty] = useState('1')

  const isDocked = state.isDocked
  const pendingTrades = state.pendingTrades || []
  const cargo = state.ship?.cargo || []

  const handleViewListings = useCallback(() => {
    sendCommand('get_listings')
  }, [sendCommand])

  const handleBuy = useCallback(() => {
    const quantity = parseInt(buyQty, 10)
    if (!buyItemId.trim() || isNaN(quantity) || quantity < 1) return
    sendCommand('buy', { item_id: buyItemId.trim(), quantity })
  }, [sendCommand, buyItemId, buyQty])

  const handleSell = useCallback(() => {
    const quantity = parseInt(sellQty, 10)
    if (!sellItemId || isNaN(quantity) || quantity < 1) return
    sendCommand('sell', { item_id: sellItemId, quantity })
  }, [sendCommand, sellItemId, sellQty])

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

  const handleViewStorage = useCallback(() => {
    sendCommand('view_storage')
  }, [sendCommand])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <TrendingUp size={16} />
          </span>
          Trading
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            activeTab === 'market' ? styles.tabActive : ''
          }`}
          onClick={() => setActiveTab('market')}
          type="button"
        >
          <ShoppingCart size={13} />
          Market
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === 'trades' ? styles.tabActive : ''
          }`}
          onClick={() => setActiveTab('trades')}
          type="button"
        >
          <ArrowLeftRight size={13} />
          Trades
          {pendingTrades.length > 0 && (
            <span className={styles.tabBadge}>{pendingTrades.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === 'storage' ? styles.tabActive : ''
          }`}
          onClick={() => setActiveTab('storage')}
          type="button"
        >
          <Package size={13} />
          Storage
        </button>
      </div>

      <div className={styles.content}>
        {/* Market Tab */}
        {activeTab === 'market' && (
          <div className={styles.marketSection}>
            {isDocked ? (
              <>
                {/* View listings */}
                <button
                  className={styles.viewBtn}
                  onClick={handleViewListings}
                  type="button"
                >
                  <ShoppingCart size={13} />
                  View Market Listings
                </button>

                {/* Buy form */}
                <div className={styles.formGroup}>
                  <div className={styles.formLabel}>Buy</div>
                  <div className={styles.formRow}>
                    <input
                      className={styles.formInput}
                      type="text"
                      placeholder="Item ID"
                      value={buyItemId}
                      onChange={(e) => setBuyItemId(e.target.value)}
                    />
                    <input
                      className={styles.formInput}
                      type="number"
                      placeholder="Qty"
                      min={1}
                      value={buyQty}
                      onChange={(e) => setBuyQty(e.target.value)}
                      style={{ maxWidth: '5rem' }}
                    />
                    <button
                      className={styles.formBtn}
                      onClick={handleBuy}
                      disabled={
                        !buyItemId.trim() ||
                        !buyQty ||
                        parseInt(buyQty, 10) < 1
                      }
                      type="button"
                    >
                      <ShoppingCart size={12} />
                      Buy
                    </button>
                  </div>
                </div>

                {/* Sell form */}
                <div className={styles.formGroup}>
                  <div className={styles.formLabel}>Sell</div>
                  <div className={styles.formRow}>
                    {cargo.length > 0 ? (
                      <select
                        className={styles.formSelect}
                        value={sellItemId}
                        onChange={(e) => setSellItemId(e.target.value)}
                      >
                        <option value="">Select item...</option>
                        {cargo.map((item) => (
                          <option key={item.item_id} value={item.item_id}>
                            {item.name} (x{item.quantity})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={styles.formInput}
                        type="text"
                        placeholder="No cargo"
                        disabled
                      />
                    )}
                    <input
                      className={styles.formInput}
                      type="number"
                      placeholder="Qty"
                      min={1}
                      value={sellQty}
                      onChange={(e) => setSellQty(e.target.value)}
                      style={{ maxWidth: '5rem' }}
                    />
                    <button
                      className={styles.sellBtn}
                      onClick={handleSell}
                      disabled={
                        !sellItemId ||
                        !sellQty ||
                        parseInt(sellQty, 10) < 1
                      }
                      type="button"
                    >
                      <TrendingUp size={12} />
                      Sell
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.dockedOnly}>
                Dock at a base to access the market
              </div>
            )}
          </div>
        )}

        {/* Trades Tab */}
        {activeTab === 'trades' && (
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
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <div>
            {isDocked ? (
              <button
                className={styles.storageBtn}
                onClick={handleViewStorage}
                type="button"
              >
                <Package size={13} />
                View Base Storage
              </button>
            ) : (
              <div className={styles.dockedOnly}>
                Dock at a base to access storage
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
