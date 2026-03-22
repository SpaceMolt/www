'use client'

import { useState } from 'react'
import {
  Warehouse,
  Layers,
  Hammer,
  Store,
} from 'lucide-react'
import { PanelWithTabs } from '../shared'
import { ShipCatalog } from './ship/ShipCatalog'
import { CommissionsView } from './ship/CommissionsView'
import { MarketplaceView } from './ship/MarketplaceView'

type TabId = 'catalog' | 'commissions' | 'marketplace'

const tabs = [
  { id: 'catalog', label: 'Catalog', icon: <Layers size={13} /> },
  { id: 'commissions', label: 'Commissions', icon: <Hammer size={13} /> },
  { id: 'marketplace', label: 'Marketplace', icon: <Store size={13} /> },
]

export function ShipyardPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('catalog')

  return (
    <PanelWithTabs
      title="Shipyard"
      icon={<Warehouse size={16} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {activeTab === 'catalog' && <ShipCatalog />}
      {activeTab === 'commissions' && <CommissionsView />}
      {activeTab === 'marketplace' && <MarketplaceView />}
    </PanelWithTabs>
  )
}
