'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  ShoppingCart,
  ClipboardList,
  ArrowLeftRight,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { MarketView } from './trading/MarketView'
import { OrdersView } from './trading/OrdersView'
import { TradesList } from './trading/TradesList'
import styles from './TradingPanel.module.css'

type TabId = 'market' | 'orders' | 'trades'

export function TradingPanel() {
  const { state } = useGame()
  const [activeTab, setActiveTab] = useState<TabId>('market')
  const pendingTrades = state.pendingTrades || []
  const isDocked = state.isDocked

  // If undocked and on market tab, switch to orders
  useEffect(() => {
    if (!isDocked && activeTab === 'market') {
      setActiveTab('orders')
    }
  }, [isDocked, activeTab])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <TrendingUp size={16} />
          </span>
          Market
        </div>
      </div>

      <div className={styles.tabs}>
        {isDocked && (
          <button
            className={`${styles.tab} ${activeTab === 'market' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('market')}
            type="button"
          >
            <ShoppingCart size={13} />
            Market
          </button>
        )}
        <button
          className={`${styles.tab} ${activeTab === 'orders' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('orders')}
          type="button"
        >
          <ClipboardList size={13} />
          Orders
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'trades' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('trades')}
          type="button"
        >
          <ArrowLeftRight size={13} />
          Trades
          {pendingTrades.length > 0 && (
            <span className={styles.tabBadge}>{pendingTrades.length}</span>
          )}
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'market' && isDocked && <MarketView />}
        {activeTab === 'orders' && <OrdersView />}
        {activeTab === 'trades' && <TradesList />}
      </div>
    </div>
  )
}
