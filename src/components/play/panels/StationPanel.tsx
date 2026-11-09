'use client'

import { Landmark, Activity, Settings2, Flag, RefreshCw } from 'lucide-react'
import { useCommandQuery, useLocationState, usePlayer } from '@/lib/spacemolt'
import { Panel, Loading, Section, shared } from '../shared'
import { FoundingSection } from './station/FoundingSection'
import { StationStatus } from './station/StationStatus'
import { StationAdmin } from './station/StationAdmin'
import { useFactionPermissions } from '../hooks/useGates'

/**
 * Station operations: status of the docked base, admin for a station your
 * faction owns, and founding a new station or outpost while undocked. Admin
 * and founding both need the manage_bases faction permission.
 */
export function StationPanel() {
  const player = usePlayer()
  const location = useLocationState()
  const dockedAt = location?.docked_at ?? null

  const { data, loading, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_base()).structuredContent,
    [dockedAt],
    { enabled: Boolean(dockedAt), refreshOnEvents: ['base_raid_update', 'station_repaired', 'facility_reclaimed'] },
  )

  // The last get_base survives undocking or a dismantled outpost; only trust it while docked there.
  const base = dockedAt && data?.base?.id === dockedAt ? data.base : undefined
  const ownsBase = Boolean(base?.faction_id && base.faction_id === player?.faction_id)
  const canManageBases = useFactionPermissions({ enabled: !dockedAt || ownsBase }).can('manage_bases')

  return (
    <Panel
      title={base?.name ?? 'Station'}
      icon={<Landmark size={16} />}
      color="var(--shell-orange)"
      headerRight={dockedAt ? (
        <button className={shared.refreshBtn} onClick={refetch} disabled={loading} title="Refresh station status" type="button">
          <RefreshCw size={14} />
        </button>
      ) : undefined}
    >
      {dockedAt && loading && !base && <Loading message="Loading station..." />}
      {base && data && (
        <Section title="Status" icon={<Activity size={12} />} defaultOpen>
          <StationStatus data={data} />
        </Section>
      )}
      {ownsBase && canManageBases && (
        <Section title="Administration" icon={<Settings2 size={12} />} defaultOpen>
          <StationAdmin isOutpost={base?.type === 'outpost'} onChanged={refetch} />
        </Section>
      )}
      {!dockedAt && canManageBases && (
        <Section title="Found a Station or Outpost" icon={<Flag size={12} />} defaultOpen>
          <FoundingSection />
        </Section>
      )}
    </Panel>
  )
}
