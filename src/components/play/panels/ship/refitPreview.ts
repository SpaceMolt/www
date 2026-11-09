import { getItem, getShip, formatItemId, type RawCatalogItem } from '@/data/catalog'

/** The ship stats a refit resets, as the ship state reports them. */
export interface RefitStats {
  max_hull: number
  max_shield: number
  shield_recharge: number
  armor: number
  speed: number
  max_fuel: number
  cargo_capacity: number
  cpu_capacity: number
  power_capacity: number
  weapon_slots: number
  defense_slots: number
  utility_slots: number
}

const STATS: [keyof RefitStats, string][] = [
  ['max_hull', 'Hull'],
  ['max_shield', 'Shield'],
  ['shield_recharge', 'Shield recharge'],
  ['armor', 'Armor'],
  ['speed', 'Speed'],
  ['max_fuel', 'Fuel tank'],
  ['cargo_capacity', 'Cargo'],
  ['cpu_capacity', 'CPU'],
  ['power_capacity', 'Power'],
  ['weapon_slots', 'Weapon slots'],
  ['defense_slots', 'Defense slots'],
  ['utility_slots', 'Utility slots'],
]

const sum = (mods: RawCatalogItem[], pick: (m: RawCatalogItem) => number | undefined) =>
  mods.reduce((total, m) => total + (pick(m) ?? 0), 0)

/** The stats refit_ship leaves: the class's base stats plus its standard modules' bonuses. */
function statsAfterRefit(classId: string): RefitStats | undefined {
  const cls = getShip(classId)
  if (!cls) return undefined
  const mods = (cls.default_modules ?? []).flatMap((id) => getItem(id) ?? [])
  return {
    max_hull: (cls.base_hull ?? 0) + sum(mods, (m) => m.hull_bonus) - sum(mods, (m) => m.hull_penalty),
    max_shield: (cls.base_shield ?? 0) + sum(mods, (m) => m.shield_bonus),
    shield_recharge: (cls.base_shield_recharge ?? 0) + sum(mods, (m) => m.shield_recharge_bonus),
    armor: (cls.base_armor ?? 0) + sum(mods, (m) => m.armor_bonus),
    // The server clamps speed at 1 after module penalties.
    speed: Math.max(1, (cls.base_speed ?? 0) + sum(mods, (m) => m.speed_bonus) - sum(mods, (m) => m.speed_penalty)),
    max_fuel: (cls.base_fuel ?? 0) + sum(mods, (m) => m.max_fuel_bonus),
    cargo_capacity: (cls.cargo_capacity ?? 0) + sum(mods, (m) => m.cargo_bonus),
    cpu_capacity: (cls.cpu_capacity ?? 0) + sum(mods, (m) => m.cpu_bonus),
    power_capacity: (cls.power_capacity ?? 0) + sum(mods, (m) => m.power_bonus),
    weapon_slots: cls.weapon_slots ?? 0,
    defense_slots: cls.defense_slots ?? 0,
    utility_slots: cls.utility_slots ?? 0,
  }
}

export interface RefitPreview {
  /** Stats that change, before and after. */
  changes: { label: string; before: number; after: number }[]
  /** Fitted modules that go to station storage. */
  removed: string[]
  /** The class's standard modules the refit installs. */
  installed: string[]
}

/** What refit_ship will do to this ship, from the live ship and the catalog class. */
export function refitPreview(classId: string, ship: RefitStats, fittedNames: string[]): RefitPreview | undefined {
  const after = statsAfterRefit(classId)
  if (!after) return undefined
  return {
    changes: STATS.filter(([key]) => ship[key] !== after[key]).map(([key, label]) => ({ label, before: ship[key], after: after[key] })),
    removed: fittedNames,
    installed: (getShip(classId)?.default_modules ?? []).map((id) => getItem(id)?.name ?? formatItemId(id)),
  }
}
