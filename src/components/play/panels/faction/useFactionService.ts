'use client'

import { useMemo } from 'react'
import { useCommandQuery, useLocationState, usePlayer } from '@/lib/spacemolt'

/**
 * The services of the faction's active facilities at the docked station
 * (e.g. 'faction_admin' from a Faction Desk, 'faction_missions' from a Notice Board).
 * Empty without a faction; undefined until known.
 */
export function useFactionServices(): Set<string> | undefined {
  const dockedAt = useLocationState()?.docked_at
  const inFaction = Boolean(usePlayer()?.faction_id)
  const { data } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.faction_list()).structuredContent,
    [dockedAt, inFaction],
    { enabled: Boolean(dockedAt) && inFaction },
  )
  return useMemo(() => {
    if (!inFaction) return new Set<string>()
    return data && new Set(data.faction_facilities.flatMap((f) => (f.status === 'active' && f.faction_service ? [f.faction_service] : [])))
  }, [data, inFaction])
}

/** Whether the faction has an active facility with this service at the docked station. False without a faction; undefined until known. */
export function useFactionService(service: string): boolean | undefined {
  return useFactionServices()?.has(service)
}
