'use client'

import { useMemo } from 'react'
import { useCommandQuery, useLocationState, usePlayer } from '@/lib/spacemolt'

type Facility = { status: string; faction_service?: string }
type BaseInfo = { id: string; type?: string; faction_id?: string }

/** Whether base is the docked station and a player station owned by factionId. Outposts do not count. */
export function isOwnStation(base: BaseInfo | undefined, factionId?: string | null, dockedAt?: string | null): boolean {
  return Boolean(base && dockedAt && base.id === dockedAt && base.type === 'station' && factionId && base.faction_id === factionId)
}

/**
 * The faction services at the docked station: active facilities, plus what the gameserver gives the
 * owner of a player station (stationOwnerFoldedFactionServiceLocked): storage, and a market where the station runs one.
 */
export function factionServicesAt({ facilities = [], base, services = [], factionId, dockedAt }: {
  facilities?: Facility[]
  base?: BaseInfo
  services?: string[]
  factionId?: string | null
  dockedAt?: string | null
}): Set<string> {
  const result = new Set(facilities.flatMap((f) => (f.status === 'active' && f.faction_service ? [f.faction_service] : [])))
  if (isOwnStation(base, factionId, dockedAt)) {
    result.add('faction_storage')
    if (services.includes('market')) result.add('faction_market')
  }
  return result
}

/**
 * The faction's services at the docked station (e.g. 'faction_admin' from a Faction Desk,
 * 'faction_missions' from a Notice Board). Empty without a faction; undefined until known.
 */
export function useFactionServices(): Set<string> | undefined {
  const dockedAt = useLocationState()?.docked_at
  const factionId = usePlayer()?.faction_id
  const inFaction = Boolean(factionId)
  const enabled = Boolean(dockedAt) && inFaction
  const { data } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.faction_list()).structuredContent,
    [dockedAt, inFaction],
    { enabled },
  )
  const station = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_base()).structuredContent,
    [dockedAt, inFaction],
    { enabled },
  )
  const baseKnown = station.data?.base?.id === dockedAt || Boolean(station.error)
  return useMemo(() => {
    if (!inFaction) return new Set<string>()
    if (!data || !baseKnown) return undefined
    return factionServicesAt({ facilities: data.faction_facilities, base: station.data?.base, services: station.data?.services, factionId, dockedAt })
  }, [data, baseKnown, station.data, inFaction, factionId, dockedAt])
}

/** Whether the faction has this service at the docked station. False without a faction; undefined until known. */
export function useFactionService(service: string): boolean | undefined {
  return useFactionServices()?.has(service)
}
