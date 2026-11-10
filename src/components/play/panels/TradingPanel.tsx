'use client'

import { useState } from 'react'
import {
  TrendingUp,
  ShoppingCart,
  ClipboardList,
  ArrowLeftRight,
} from 'lucide-react'
import { usePlayUi } from '../PlayProvider'
import { useStationServices } from '../hooks/useGates'
import { PanelWithTabs } from '../shared'
import { MarketView } from './trading/MarketView'
import { OrdersView } from './trading/OrdersView'
import { TradesList } from './trading/TradesList'
import styles from './TradingPanel.module.css'

type TabId = 'market' | 'orders' | 'trades'

export function TradingPanel() {
  const hasMarket = useStationServices().includes('market')
  const pendingTrades = usePlayUi((s) => s.pendingTrades)
  const [activeTab, setActiveTab] = useState<TabId>('market')

  // Without a market here, show orders; the market tab returns once the station's services load.
  const shownTab = activeTab === 'market' && !hasMarket ? 'orders' : activeTab

  const tabs = [
    { id: 'market', label: 'Market', icon: <ShoppingCart size={13} />, hidden: !hasMarket },
    { id: 'orders', label: 'Orders', icon: <ClipboardList size={13} /> },
    {
      id: 'trades',
      label: 'Trades',
      badge: pendingTrades.length > 0 && <span className={styles.tabBadge}>{pendingTrades.length}</span>,
      icon: <ArrowLeftRight size={13} />,
    },
  ]

  return (
    <PanelWithTabs
      title="Market"
      icon={<TrendingUp size={16} />}
      color="var(--bio-green)"
      tabs={tabs}
      activeTab={shownTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {shownTab === 'market' && <MarketView />}
      {shownTab === 'orders' && <OrdersView />}
      {shownTab === 'trades' && <TradesList />}
    </PanelWithTabs>
  )
}
