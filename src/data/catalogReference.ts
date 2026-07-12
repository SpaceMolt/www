/**
 * Reference-only game catalog data — skills, facilities and achievements.
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

/**
 * An achievement as published by the catalog dump.
 *
 * HIDDEN ACHIEVEMENTS ARE NOT IN HERE. The game server strips every entry
 * flagged `hidden` — the secrets stay secret — and publishes only a count of
 * them (`hiddenAchievementCount` below), so the codex total still reconciles
 * with the total the game reports in-game.
 *
 * Everything after `criteria` is `omitempty` on the server: treat it as optional.
 */
export interface RawAchievement {
  id: string
  name: string
  description: string
  /** combat | commerce | collection | economy | exploration | industry | logistics | mastery | progression | salvage | smuggling | social */
  category: string
  points: number
  /** Rendered, human-readable unlock condition, e.g. "Mine 1,000 units of ore" */
  criteria: string
  /** Chain this achievement belongs to, e.g. "prospector" */
  series?: string
  /** The achievement that must be earned before this one (chain predecessor) */
  after?: string
  /** Title granted on unlock (a faction title on faction achievements) */
  title?: string
  /** Emblem id — art lives at /images/achievements/<id>.webp */
  emblem?: string
  credits?: number
  /** Skill XP granted on unlock, keyed by skill id */
  skill_xp?: Record<string, number>
  /** True on faction-tier achievements */
  faction?: boolean
}

interface ReferenceData {
  skills: Record<string, RawSkill>
  facilities: Record<string, RawFacility>
  achievements: Record<string, RawAchievement>
  faction_achievements: Record<string, RawAchievement>
  _meta: CatalogMeta<{
    skills: number
    facilities: number
    achievements: number
    faction_achievements: number
  }> & {
    /** How many player achievements are secret (withheld from the dump) */
    hidden_achievement_count?: number
    /** How many faction achievements are secret (withheld from the dump) */
    hidden_faction_achievement_count?: number
  }
}

const reference = rawReference as unknown as ReferenceData

// ── Exports ─────────────────────────────────────────────────────────────

/** All skills keyed by ID */
export const skillsById: Readonly<Record<string, RawSkill>> = reference.skills

/** All facilities keyed by ID */
export const facilitiesById: Readonly<Record<string, RawFacility>> = reference.facilities

/**
 * All (non-hidden) player achievements keyed by ID.
 *
 * Defaulted: the achievements sections are newer than the file on disk may be —
 * a build running against a game server that doesn't publish them yet (or one
 * that kept a stale reference file) sees `undefined` here, and the codex pages
 * degrade to an "unavailable" state rather than crashing the build.
 */
export const achievementsById: Readonly<Record<string, RawAchievement>> =
  reference.achievements ?? {}

/** All (non-hidden) faction achievements keyed by ID */
export const factionAchievementsById: Readonly<Record<string, RawAchievement>> =
  reference.faction_achievements ?? {}

/** How many player achievements are secret — published but not enumerated */
export const hiddenAchievementCount: number = reference._meta?.hidden_achievement_count ?? 0

/** How many faction achievements are secret */
export const hiddenFactionAchievementCount: number =
  reference._meta?.hidden_faction_achievement_count ?? 0

/** Provenance: when this data was fetched, from which server, at which game version */
export const referenceMeta: Readonly<ReferenceData['_meta']> = reference._meta

/** Get a single skill by ID */
export function getSkill(id: string): RawSkill | undefined {
  return reference.skills[id]
}

/** Get a single achievement by ID — player tier first, then faction tier */
export function getAchievement(id: string): RawAchievement | undefined {
  return achievementsById[id] ?? factionAchievementsById[id]
}

/** Get a single faction achievement by ID */
export function getFactionAchievement(id: string): RawAchievement | undefined {
  return factionAchievementsById[id]
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

/** All (non-hidden) player achievements as a flat array (cached) */
let _achievements: RawAchievement[] | null = null
export function allAchievements(): RawAchievement[] {
  if (!_achievements) _achievements = Object.values(achievementsById)
  return _achievements
}

/** All (non-hidden) faction achievements as a flat array (cached) */
let _factionAchievements: RawAchievement[] | null = null
export function allFactionAchievements(): RawAchievement[] {
  if (!_factionAchievements) _factionAchievements = Object.values(factionAchievementsById)
  return _factionAchievements
}

/** Player achievements grouped by category ("exploration", "mastery", ...) — cached */
let _achievementsByCategory: Record<string, RawAchievement[]> | null = null
export function achievementsByCategory(): Readonly<Record<string, RawAchievement[]>> {
  if (!_achievementsByCategory) _achievementsByCategory = groupBy(allAchievements(), a => a.category)
  return _achievementsByCategory
}

/** Faction achievements grouped by category — cached */
let _factionAchievementsByCategory: Record<string, RawAchievement[]> | null = null
export function factionAchievementsByCategory(): Readonly<Record<string, RawAchievement[]>> {
  if (!_factionAchievementsByCategory) {
    _factionAchievementsByCategory = groupBy(allFactionAchievements(), a => a.category)
  }
  return _factionAchievementsByCategory
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
