'use client'

import { useState, useMemo } from 'react'
import {
  Package,
  Ship,
  Users,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { PanelWithTabs } from '../shared'
import { StorageView } from './trading/StorageView'
import { FactionStorageView } from './trading/FactionStorageView'
import { FleetView } from './ship/FleetView'

type TabId = 'storage' | 'faction' | 'ships'

export function StoragePanel() {
  const { state } = useGame()
  const hasFaction = !!state.player?.faction_id

  const [activeTab, setActiveTab] = useState<TabId>('storage')

  const tabs = useMemo(() => [
    { id: 'storage', label: 'Items', icon: <Package size={13} /> },
    { id: 'faction', label: 'Faction', icon: <Users size={13} />, hidden: !hasFaction },
    { id: 'ships', label: 'Stored Ships', icon: <Ship size={13} /> },
  ], [hasFaction])

  return (
    <PanelWithTabs
      title="Storage"
      icon={<Package size={16} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {activeTab === 'storage' && <StorageView />}
      {activeTab === 'faction' && <FactionStorageView />}
      {activeTab === 'ships' && <FleetView />}
    </PanelWithTabs>
  )
}
