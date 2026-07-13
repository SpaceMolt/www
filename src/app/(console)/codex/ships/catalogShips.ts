/*
 * SERVER-side ship selection over the build-time catalog.
 *
 * Kept apart from `shipMeta.ts` because this module imports `@/data/catalog` —
 * the client browser must never reach it, or catalog.json lands in the bundle.
 */

import { allShips, type RawShip } from '@/data/catalog'
import { EMPIRE_NAMES, type ShipListEntry } from './shipMeta'

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

/** Every player-flyable hull. NPC-only variants (pirate raiders, bosses) are not. */
let _listable: RawShip[] | null = null
export function listableShips(): RawShip[] {
  if (!_listable) _listable = allShips().filter((s) => !s.npc_role)
  return _listable
}

export function toListEntry(ship: RawShip): ShipListEntry {
  const empire = ship.faction ?? ''
  return {
    id: ship.id,
    name: ship.name,
    description: ship.description ?? '',
    empire,
    empireName: EMPIRE_NAMES[empire] ?? '',
    class: ship.class ?? '',
    category: ship.category ?? '',
    tier: ship.tier ?? 0,
    starter: Boolean(ship.starter_ship),
    prestige: isPrestige(ship),
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
