'use client'

import { useState } from 'react'
import {
  Warehouse,
  Layers,
  Hammer,
  Tag,
} from 'lucide-react'
import { PanelWithTabs } from '../shared'
import { ShipCatalog } from './ship/ShipCatalog'
import { CommissionsView } from './ship/CommissionsView'
import { SellView } from './ship/SellView'

type TabId = 'ships' | 'sell' | 'commissions'

const tabs = [
  { id: 'ships', label: 'Ships', icon: <Layers size={13} /> },
  { id: 'sell', label: 'Sell', icon: <Tag size={13} /> },
  { id: 'commissions', label: 'Commissions', icon: <Hammer size={13} /> },
]

export function ShipyardPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('ships')

  return (
    <PanelWithTabs
      title="Shipyard"
      icon={<Warehouse size={16} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {activeTab === 'ships' && <ShipCatalog />}
      {activeTab === 'sell' && <SellView />}
      {activeTab === 'commissions' && <CommissionsView />}
    </PanelWithTabs>
  )
}
