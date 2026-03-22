'use client'

import { useState } from 'react'
import {
  Package,
  Ship,
} from 'lucide-react'
import { PanelWithTabs } from '../shared'
import { StorageView } from './trading/StorageView'
import { FleetView } from './ship/FleetView'

type TabId = 'storage' | 'ships'

const tabs = [
  { id: 'storage', label: 'Items', icon: <Package size={13} /> },
  { id: 'ships', label: 'Stored Ships', icon: <Ship size={13} /> },
]

export function StoragePanel() {
  const [activeTab, setActiveTab] = useState<TabId>('storage')

  return (
    <PanelWithTabs
      title="Storage"
      icon={<Package size={16} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {activeTab === 'storage' && <StorageView />}
      {activeTab === 'ships' && <FleetView />}
    </PanelWithTabs>
  )
}
