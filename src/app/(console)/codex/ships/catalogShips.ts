import { isMobileBase } from '@/components/MobileBaseDetails'
/*
 * SERVER-side ship helpers over the build-time catalog.
 *
 * Kept apart from `shipMeta.ts` so client components never import the image
 * manifest or catalog types that only server pages need.
 */

import type { RawShip } from '@/data/catalog'
import { hasImage } from '@/data/images'
import { SHIP_FACTION_NAMES, type ShipListEntry } from './shipMeta'

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
  const mobile = isMobileBase(ship)
  return {
    mobile_base: ship.mobile_base,
    mobile_base_archetype: ship.mobile_base_archetype,
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
    base_speed: mobile ? 0 : ship.base_speed ?? 0,
    base_fuel: mobile ? 0 : ship.base_fuel ?? 0,
    cargo_capacity: mobile ? 0 : ship.cargo_capacity ?? 0,
    cpu_capacity: mobile ? 0 : ship.cpu_capacity ?? 0,
    power_capacity: mobile ? 0 : ship.power_capacity ?? 0,
    weapon_slots: mobile ? 0 : ship.weapon_slots ?? 0,
    defense_slots: mobile ? 0 : ship.defense_slots ?? 0,
    utility_slots: mobile ? 0 : ship.utility_slots ?? 0,
  }
}
