'use client'

import { useCommandQuery, useLocationState, usePlayer } from '@/lib/spacemolt'

/**
 * Whether the faction has an active facility with this service at the docked station
 * (e.g. 'faction_admin' from a Faction Desk, 'faction_missions' from a Notice Board).
 * False without a faction; undefined until known.
 */
export function useFactionService(service: string): boolean | undefined {
  const dockedAt = useLocationState()?.docked_at
  const inFaction = Boolean(usePlayer()?.faction_id)
  const { data } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.faction_list()).structuredContent,
    [dockedAt, inFaction],
    { enabled: Boolean(dockedAt) && inFaction },
  )
  if (!inFaction) return false
  return data && data.faction_facilities.some((f) => f.faction_service === service && f.status === 'active')
}
