'use client'

/**
 * What the player can do here, so panels can hide controls the server would only reject.
 * Each hook reads data the client already has; only faction permissions cost one request.
 */
import { useMemo } from 'react'
import type { FactionCreateRolePermissions, FactionInfoResponse } from '@spacemolt/lib'
import { useCommandQuery, useLocationState, useModules, usePlayer, useStations } from '@/lib/spacemolt'
import { getItem, type RawCatalogItem } from '@/data/catalog'

/**
 * Services of the docked station (shipyard, market, storage, crafting, missions, refuel, repair, salvage_yard...).
 * Read from the station directory; if it failed to load or lacks this station (founded after page load),
 * read the docked base instead. Empty when undocked or not loaded yet.
 */
export function useStationServices(): string[] {
  const dockedAt = useLocationState()?.docked_at
  const directory = useStations()
  const listed = dockedAt ? directory.data?.find((s) => s.base_id === dockedAt)?.services : undefined
  const missing = Boolean(dockedAt) && !listed && Boolean(directory.data || directory.error)
  const { data } = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_base()).structuredContent,
    [dockedAt],
    { enabled: missing },
  )
  const live = missing && data?.base?.id === dockedAt ? data?.services : undefined
  return useMemo(() => listed ?? live ?? [], [listed, live])
}

/** Catalog entries for every fitted module, for loadout checks such as cloak_strength or survey_power. */
export function useFittedModules(): RawCatalogItem[] {
  const modules = useModules()
  return useMemo(() => (modules ?? []).flatMap((m) => getItem(m.type_id) ?? []), [modules])
}

export type FactionPermission = keyof FactionCreateRolePermissions

/**
 * Whether a faction role grants a permission (gameserver models.Faction.HasPermission). The role is
 * the player's faction_rank, matched by role id or name. An unknown role allows, so the server decides.
 */
export function roleCan(info: Pick<FactionInfoResponse, 'roles'> | undefined, rank: string | undefined, permission: FactionPermission): boolean {
  const role = info?.roles?.find((r) => r.id === rank || r.name === rank)
  return role ? Boolean(role.permissions[permission]) : true
}

/**
 * The player's faction permissions, loaded once per faction while `enabled`. `can` is false outside
 * a faction and until the roles have loaded, so gated controls appear only once allowed.
 */
export function useFactionPermissions({ enabled = true } = {}) {
  const player = usePlayer()
  const factionId = player?.faction_id
  const { data } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_faction.info({ limit: 1 })).structuredContent,
    [factionId],
    { enabled: enabled && Boolean(factionId) },
  )
  const rank = player?.faction_rank
  return useMemo(() => ({
    loaded: Boolean(data),
    can: (permission: FactionPermission) => Boolean(factionId && data) && roleCan(data, rank, permission),
  }), [data, factionId, rank])
}
