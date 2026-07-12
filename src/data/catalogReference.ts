/**
 * Reference-only game catalog data — skills and facilities.
 * Fetched at build time by scripts/fetch-catalog.mjs into catalog-reference.json.
 *
 * ⚠️ SERVER-ONLY BY DESIGN. Do not remove the `server-only` import below.
 *
 * catalog-reference.json is ~2.2 MB (2652 facilities alone), and a static JSON
 * import gets inlined wholesale into whatever bundle reaches it. The /play web
 * client imports the sibling `catalog.ts` from six 'use client' components — if
 * skills/facilities lived there too, every player would download ~2.2 MB of JSON
 * they never use. Keeping this module server-only means the /codex/* pages
 * (server components, rendered at build time) can use the data freely while the
 * browser never sees a byte of it.
 *
 * The `import 'server-only'` line makes that guarantee enforceable: importing
 * this module from a client component fails the build loudly instead of silently
 * shipping megabytes.
 *
 * Items, recipes and ships live in the client-safe `catalog.ts`.
 */

import 'server-only'

import rawReference from './catalog-reference.json'
import { groupBy, type CatalogMeta, type ItemStack } from './catalog'

// ── Raw types matching the JSON shape from the game server ──────────────

export interface RawSkill {
  id: string
  name: string
  description: string
  /** Combat | Commerce | Drones | Empire | Engineering | Exploration | Industry | Ships | Wildlife | Wormholes */
  category: string
  max_level: number
  /** Cumulative XP thresholds, one entry per level (length === max_level) */
  xp_per_level: number[]
  /** Human-readable description of how the skill is trained */
  training_source: string
  /** Per-level bonuses, e.g. { armorEffectiveness: 1, hullHP: 1 } */
  bonus_per_level?: Record<string, number>
  /** Only trainable by citizens of this empire */
  empire_restriction?: string
}

export interface RawFacility {
  id: string
  name: string
  description: string
  /** faction | infrastructure | personal | production | service */
  category: string
  /** Upgrade tier within its chain */
  level: number
  always_on: boolean
  build_cost: number
  /** In ticks */
  build_time: number
  labor_cost: number
  build_materials?: ItemStack[]
  /** Facility id this one upgrades from (chain predecessor) */
  upgrades_from?: string
  /** The single recipe this production facility runs */
  recipe_id?: string
  power_draw?: number
  power_supply?: number
  life_support_draw?: number
  life_support_supply?: number
  /** Ongoing inputs consumed to stay operational */
  maintenance_inputs?: ItemStack[]
  /** Flavour shown when maintenance inputs are met / starved */
  satisfied_description?: string
  degraded_description?: string
  lore?: string
  /** Restricted to one empire */
  empire?: string
  /** Station service provided: shipyard | market | repair | refuel | storage | crafting | missions | police | salvage_yard */
  service_type?: string
  faction_service_type?: string
  personal_service_type?: string
  /** Requires another facility providing this service to already exist */
  requires_service_type?: string
  /** Only one may exist (per station) */
  unique?: boolean
  faction_cap?: number
  pirate_base_only?: boolean
  player_station_buildable?: boolean
  station_or_faction_only?: boolean
  personal_bonus_type?: string
  personal_bonus_value?: number
  fleet_upkeep?: boolean
  tourism_upkeep?: boolean
  dining_points?: number
  leisure_points?: number
  fuel_output?: boolean
  fuel_capacity?: number
  battery_capacity?: number
  /** This facility is an expansion of another (scales its capacity) */
  expansion_of?: string
  expansion_scale?: number
  scan_power?: number
  scan_falloff?: number
  transit_deadline_bonus?: number
  disguised?: boolean
  allows_contraband?: boolean
}

interface ReferenceData {
  skills: Record<string, RawSkill>
  facilities: Record<string, RawFacility>
  _meta: CatalogMeta<{ skills: number; facilities: number }>
}

const reference = rawReference as unknown as ReferenceData

// ── Exports ─────────────────────────────────────────────────────────────

/** All skills keyed by ID */
export const skillsById: Readonly<Record<string, RawSkill>> = reference.skills

/** All facilities keyed by ID */
export const facilitiesById: Readonly<Record<string, RawFacility>> = reference.facilities

/** Provenance: when this data was fetched, from which server, at which game version */
export const referenceMeta: Readonly<ReferenceData['_meta']> = reference._meta

/** Get a single skill by ID */
export function getSkill(id: string): RawSkill | undefined {
  return reference.skills[id]
}

/** Get a single facility by ID */
export function getFacility(id: string): RawFacility | undefined {
  return reference.facilities[id]
}

/** All skills as a flat array (cached) */
let _skills: RawSkill[] | null = null
export function allSkills(): RawSkill[] {
  if (!_skills) _skills = Object.values(reference.skills)
  return _skills
}

/** All facilities as a flat array (cached) */
let _facilities: RawFacility[] | null = null
export function allFacilities(): RawFacility[] {
  if (!_facilities) _facilities = Object.values(reference.facilities)
  return _facilities
}

/** Skills grouped by category ("Combat", "Industry", ...) — cached */
let _skillsByCategory: Record<string, RawSkill[]> | null = null
export function skillsByCategory(): Readonly<Record<string, RawSkill[]>> {
  if (!_skillsByCategory) _skillsByCategory = groupBy(allSkills(), s => s.category)
  return _skillsByCategory
}

/** Facilities grouped by category ("production", "service", ...) — cached */
let _facilitiesByCategory: Record<string, RawFacility[]> | null = null
export function facilitiesByCategory(): Readonly<Record<string, RawFacility[]>> {
  if (!_facilitiesByCategory) _facilitiesByCategory = groupBy(allFacilities(), f => f.category)
  return _facilitiesByCategory
}

/** Facilities that produce the given recipe (a facility runs at most one recipe) */
let _facilitiesByRecipe: Map<string, RawFacility[]> | null = null
export function facilitiesForRecipe(recipeId: string): RawFacility[] {
  if (!_facilitiesByRecipe) {
    _facilitiesByRecipe = new Map()
    for (const facility of allFacilities()) {
      if (!facility.recipe_id) continue
      const list = _facilitiesByRecipe.get(facility.recipe_id)
      if (list) list.push(facility)
      else _facilitiesByRecipe.set(facility.recipe_id, [facility])
    }
  }
  return _facilitiesByRecipe.get(recipeId) ?? []
}
