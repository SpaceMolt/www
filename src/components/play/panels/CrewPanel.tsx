'use client'

import { useState } from 'react'
import { Anchor, Users, UserCog } from 'lucide-react'
import { useLocationState, useSection } from '@/lib/spacemolt'
import { PanelWithTabs } from '../shared'
import { FleetTab } from './crew/FleetTab'
import { PersonnelTab } from './crew/PersonnelTab'
import { PrizesTab } from './crew/PrizesTab'

const TABS = [
  { id: 'fleet', label: 'Fleet', icon: <Users size={12} /> },
  { id: 'personnel', label: 'Personnel', icon: <UserCog size={12} /> },
  { id: 'prizes', label: 'Prizes', icon: <Anchor size={12} /> },
]

export function CrewPanel() {
  const [tab, setTab] = useState('fleet')
  // The Prizes tab shows only while a prize is here or one of yours is in recovery.
  const hasPrizes = (useLocationState()?.nearby_prizes?.length ?? 0) > 0 || (useSection('prize_recoveries')?.length ?? 0) > 0
  const tabs = hasPrizes ? TABS : TABS.filter((t) => t.id !== 'prizes')
  const active = tabs.some((t) => t.id === tab) ? tab : 'fleet'
  return (
    <PanelWithTabs title="Crew" icon={<Users size={16} />} tabs={tabs} activeTab={active} onTabChange={setTab}>
      {active === 'fleet' && <FleetTab />}
      {active === 'personnel' && <PersonnelTab />}
      {active === 'prizes' && <PrizesTab />}
    </PanelWithTabs>
  )
}
