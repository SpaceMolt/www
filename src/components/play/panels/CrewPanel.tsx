'use client'

import { useState } from 'react'
import { Anchor, Users, UserCog } from 'lucide-react'
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
  return (
    <PanelWithTabs title="Crew" icon={<Users size={16} />} tabs={TABS} activeTab={tab} onTabChange={setTab}>
      {tab === 'fleet' && <FleetTab />}
      {tab === 'personnel' && <PersonnelTab />}
      {tab === 'prizes' && <PrizesTab />}
    </PanelWithTabs>
  )
}
