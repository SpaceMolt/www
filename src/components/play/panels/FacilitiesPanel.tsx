'use client'

import { useState, useMemo } from 'react'
import {
  Building2,
  Warehouse,
  User,
  Hammer,
  Users,
} from 'lucide-react'
import type { FacilityResponse } from '@spacemolt/lib'
import { useCommandQuery, useLocationState, usePlayer } from '@/lib/spacemolt'
import { PanelWithTabs, Loading, shared } from '../shared'
import { StationView } from './facilities/StationView'
import { OwnedView } from './facilities/OwnedView'
import { BuildView } from './facilities/BuildView'
import { FactionView } from './facilities/FactionView'

type TabId = 'station' | 'owned' | 'build' | 'faction'

// `{ station_facilities: unknown }` uniquely identifies the facility-list
// variant within the FacilityResponse union (see UpgradeModal.tsx for the
// discriminator pattern used throughout panels/facilities/*).
type FacilityListResponse = Extract<FacilityResponse, { station_facilities: unknown }>

export function FacilitiesPanel() {
  const player = usePlayer()
  const location = useLocationState()
  const dockedAt = location?.docked_at ?? null
  const isDocked = Boolean(dockedAt)
  const hasFaction = !!player?.faction_id

  const [activeTab, setActiveTab] = useState<TabId>('station')

  const tabs = useMemo(() => [
    { id: 'station', label: 'Station', icon: <Warehouse size={13} /> },
    { id: 'owned', label: 'My Facilities', icon: <User size={13} /> },
    { id: 'build', label: 'Build', icon: <Hammer size={13} /> },
    { id: 'faction', label: 'Faction', icon: <Users size={13} />, hidden: !hasFaction },
  ], [hasFaction])

  const { data: facilityData, loading, refetch: refreshFacilities } = useCommandQuery(
    async (account) => {
      const resp = await account.commands.spacemolt_facility.list()
      return resp.structuredContent as FacilityListResponse | undefined
    },
    [dockedAt],
    { enabled: isDocked },
  )

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
