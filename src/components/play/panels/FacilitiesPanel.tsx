'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Building2,
  Warehouse,
  User,
  Hammer,
  Users,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { PanelWithTabs, Loading, shared } from '../shared'
import type { FacilityListResponse } from '@/lib/gameTypes'
import { StationView } from './facilities/StationView'
import { OwnedView } from './facilities/OwnedView'
import { BuildView } from './facilities/BuildView'
import { FactionView } from './facilities/FactionView'

type TabId = 'station' | 'owned' | 'build' | 'faction'

export function FacilitiesPanel() {
  const { state, api } = useGame()
  const isDocked = state.isDocked
  const hasFaction = !!state.player?.faction_id

  const [activeTab, setActiveTab] = useState<TabId>('station')
  const [facilityData, setFacilityData] = useState<FacilityListResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const tabs = useMemo(() => [
    { id: 'station', label: 'Station', icon: <Warehouse size={13} /> },
    { id: 'owned', label: 'My Facilities', icon: <User size={13} /> },
    { id: 'build', label: 'Build', icon: <Hammer size={13} /> },
    { id: 'faction', label: 'Faction', icon: <Users size={13} />, hidden: !hasFaction },
  ], [hasFaction])

  const refreshFacilities = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const data = await api.callStructured<FacilityListResponse>('spacemolt_facility', 'list', {})
      if (data) setFacilityData(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [api])

  // Clear stale data on undock so re-docking triggers a fresh fetch
  useEffect(() => {
    if (!isDocked) {
      setFacilityData(null)
    }
  }, [isDocked])

  // Auto-fetch when docked and data is null
  useEffect(() => {
    if (isDocked && !facilityData && !loading) {
      refreshFacilities()
    }
  }, [isDocked, facilityData, loading, refreshFacilities])

  if (!isDocked) {
    return (
      <div className={shared.dockedOnly}>
        Dock at a base to access facilities
      </div>
    )
  }

  return (
    <PanelWithTabs
      title="Facilities"
      icon={<Building2 size={16} />}
      color="var(--shell-orange)"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {loading && !facilityData && <Loading message="Loading facilities..." />}
      {facilityData && activeTab === 'station' && <StationView facilityData={facilityData} />}
      {facilityData && activeTab === 'owned' && <OwnedView facilityData={facilityData} onRefresh={refreshFacilities} />}
      {activeTab === 'build' && <BuildView onRefresh={refreshFacilities} />}
      {facilityData && activeTab === 'faction' && <FactionView facilityData={facilityData} onRefresh={refreshFacilities} />}
    </PanelWithTabs>
  )
}
