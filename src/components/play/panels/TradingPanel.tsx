'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  ShoppingCart,
  ClipboardList,
  ArrowLeftRight,
} from 'lucide-react'
import { useLocationState } from '@/lib/spacemolt'
import { usePlayUi } from '../PlayProvider'
import { PanelWithTabs } from '../shared'
import { MarketView } from './trading/MarketView'
import { OrdersView } from './trading/OrdersView'
import { TradesList } from './trading/TradesList'
import styles from './TradingPanel.module.css'

type TabId = 'market' | 'orders' | 'trades'

export function TradingPanel() {
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const pendingTrades = usePlayUi((s) => s.pendingTrades)
  const [activeTab, setActiveTab] = useState<TabId>('market')

  // If undocked and on market tab, switch to orders
  useEffect(() => {
    if (!isDocked && activeTab === 'market') {
      setActiveTab('orders')
    }
  }, [isDocked, activeTab])

  const tabs = [
    { id: 'market', label: 'Market', icon: <ShoppingCart size={13} />, hidden: !isDocked },
    { id: 'orders', label: 'Orders', icon: <ClipboardList size={13} /> },
    {
      id: 'trades',
      label: pendingTrades.length > 0
        ? <>Trades <span className={styles.tabBadge}>{pendingTrades.length}</span></>
        : 'Trades',
      icon: <ArrowLeftRight size={13} />,
    },
  ]

  return (
    <PanelWithTabs
      title="Market"
      icon={<TrendingUp size={16} />}
      color="var(--bio-green)"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {activeTab === 'market' && isDocked && <MarketView />}
      {activeTab === 'orders' && <OrdersView />}
      {activeTab === 'trades' && <TradesList />}
    </PanelWithTabs>
  )
}
