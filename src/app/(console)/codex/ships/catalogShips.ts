/*
 * SERVER-side ship selection over the build-time catalog.
 *
 * Kept apart from `shipMeta.ts` because this module imports `@/data/catalog` —
 * the client browser must never reach it, or catalog.json lands in the bundle.
 */

import { allShips, type RawShip } from '@/data/catalog'
import { hasImage } from '@/data/images'
import { SHIP_FACTION_NAMES, type ShipListEntry } from './shipMeta'

/**
 * NPC hulls are hidden by default. These four purpose-built boarding-era pirate
 * variants are intentionally public because players can encounter and capture
 * them; keeping the allowlist explicit prevents boss and support hulls from
 * leaking into the player-facing catalog as new NPC roles are added.
 */
export const PUBLIC_PIRATE_SHIP_IDS = [
  'insider_trading',
  'bulk_discount',
  'flight_risk',
  'shell_company',
] as const

const publicPirateShipIDSet = new Set<string>(PUBLIC_PIRATE_SHIP_IDS)

/**
 * Prestige hulls are achievement-gated rather than empire-issued, so most carry
 * no faction — they must not be dropped for looking factionless.
 */
export function isPrestige(ship: RawShip): boolean {
  return Boolean(
    ship.required_achievement ||
      ship.required_faction_achievement ||
      ship.required_faction_leader ||
      ship.prestige_lock,
  )
}

export function isListableShip(ship: RawShip): boolean {
  return !ship.npc_role || (ship.faction === 'pirate' && publicPirateShipIDSet.has(ship.id))
}

/** Player hulls plus the deliberately documented pirate boarding variants. */
let _listable: RawShip[] | null = null
export function listableShips(): RawShip[] {
  if (!_listable) _listable = allShips().filter(isListableShip)
  return _listable
}

/**
 * Variant art is published separately from catalog data. Until it lands, use
 * the documented source hull rather than rendering a broken image.
 */
export function shipArtID(ship: RawShip): string {
  if (hasImage(`ships/catalog/${ship.id}.webp`)) return ship.id
  if (ship.based_on && hasImage(`ships/catalog/${ship.based_on}.webp`)) return ship.based_on
  return ship.id
}

export function toListEntry(ship: RawShip): ShipListEntry {
  const empire = ship.faction ?? ''
  return {
    id: ship.id,
    name: ship.name,
    description: ship.description ?? '',
    empire,
    empireName: SHIP_FACTION_NAMES[empire] ?? '',
    class: ship.class ?? '',
    category: ship.category ?? '',
    tier: ship.tier ?? 0,
    starter: Boolean(ship.starter_ship),
    prestige: isPrestige(ship),
    npcRole: ship.npc_role ?? '',
    basedOn: ship.based_on ?? '',
    artId: shipArtID(ship),
    special: ship.special ?? '',
    base_hull: ship.base_hull ?? 0,
    base_shield: ship.base_shield ?? 0,
    base_shield_recharge: ship.base_shield_recharge ?? 0,
    base_armor: ship.base_armor ?? 0,
    base_speed: ship.base_speed ?? 0,
    base_fuel: ship.base_fuel ?? 0,
    cargo_capacity: ship.cargo_capacity ?? 0,
    cpu_capacity: ship.cpu_capacity ?? 0,
    power_capacity: ship.power_capacity ?? 0,
    weapon_slots: ship.weapon_slots ?? 0,
    defense_slots: ship.defense_slots ?? 0,
    utility_slots: ship.utility_slots ?? 0,
  }
}
