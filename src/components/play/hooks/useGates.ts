'use client'

/**
 * What the player can do here, so panels can hide controls the server would only reject.
 * Each hook reads data the client already has; only faction permissions cost one request.
 */
import { useMemo } from 'react'
import type { FactionInfoResponse } from '@spacemolt/lib'
import { useCommandQuery, useLocationState, useModules, usePlayer, useStations } from '@/lib/spacemolt'
import { getItem, type RawCatalogItem } from '@/data/catalog'

/** Services of the docked station (shipyard, market, storage, crafting, missions, refuel, repair, salvage_yard...). Empty when undocked or not loaded yet. */
export function useStationServices(): string[] {
  const dockedAt = useLocationState()?.docked_at
  const stations = useStations().data
  return useMemo(() => (dockedAt && stations?.find((s) => s.base_id === dockedAt)?.services) || [], [dockedAt, stations])
}

/** Catalog entries for every fitted module, for loadout checks such as cloak_strength or survey_power. */
export function useFittedModules(): RawCatalogItem[] {
  const modules = useModules()
  return useMemo(() => (modules ?? []).flatMap((m) => getItem(m.type_id) ?? []), [modules])
}

export type FactionPermission =
  | 'invite' | 'kick' | 'promote' | 'manage_roles' | 'manage_diplomacy' | 'manage_bases'
  | 'manage_treasury' | 'broadcast' | 'manage_facilities' | 'officer_room_access'

/**
 * Whether a faction role grants a permission (gameserver models.Faction.HasPermission). The role is
 * the player's faction_rank, matched by role id or name. An unknown role allows, so the server decides.
 */
export function roleCan(info: Pick<FactionInfoResponse, 'roles'> | undefined, rank: string | undefined, permission: FactionPermission): boolean {
  const role = info?.roles?.find((r) => r.id === rank || r.name === rank)
  return role ? Boolean((role.permissions as Record<string, boolean | undefined>)[permission]) : true
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
