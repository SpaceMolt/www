/**
 * Static game catalog data — items (including modules), recipes, and ships.
 * Fetched at build time by scripts/fetch-catalog.mjs.
 *
 * Import from here instead of making runtime API calls for catalog data.
 *
 * ⚠️ THIS MODULE IS CLIENT-SAFE AND MUST STAY SMALL.
 * Six 'use client' components in /play import it, and the `catalog.json` static
 * import is inlined wholesale into the client bundle — so every byte added here
 * is downloaded by every player loading the web client. Skills and facilities
 * (another ~2.2 MB) deliberately live in the server-only sibling module
 * `catalogReference.ts` instead. Do not import them here.
 *
 * The types below are derived from the *actual* payload, not from a spec: every
 * field is present on at least one live entry. Fields are optional wherever the
 * server omits them on some entries, which is most of them — treat anything
 * beyond `id`/`name` as possibly-absent.
 */

import rawCatalog from './catalog.json'
import { titleCase } from '@/lib/format'

// ── Shared sub-shapes ───────────────────────────────────────────────────

/** An item + quantity pair, used by recipe inputs/outputs and build materials. */
export interface ItemStack {
  item_id: string
  quantity: number
}

/** Consumable / ammo behaviour, present on ~85 items. */
export interface RawItemEffect {
  /** e.g. "buff", "ammo", "repair" */
  type?: string
  /** e.g. "torpedo", "missile" (ammo only) */
  subtype?: string
  /** Buff magnitude */
  amount?: number
  /** Stat the buff applies to, e.g. "all_combat" */
  stat?: string
  /** Buff duration in ticks */
  duration?: number
  /** Ammo modifiers */
  ammo?: {
    damage_mod?: number
    shield_bypass?: number
    armor_bypass?: number
    [key: string]: number | undefined
  }
}

/** An innate ship ability, e.g. `{ type: "integrated_cloak", value: 30 }`. */
export interface ShipCapability {
  type: string
  value: number
}

// ── Raw types matching the JSON shape from the game server ──────────────

/**
 * An item. NOTE: items are a union of two disjoint kinds and you must branch:
 *  - **Modules** (210 entries) have `type`/`slot`/`type_id` and module stats,
 *    but NO `category`/`rarity`/`stackable`/`tradeable`.
 *  - **Non-module items** (500 entries) have `category`/`rarity`/`stackable`/
 *    `tradeable`, but NO `type`/`slot`.
 * Use `isModule()` / `getItemCategory()` rather than reading `category` directly.
 */
export interface RawCatalogItem {
  id: string
  name: string
  description?: string
  /** Non-modules only: ore | refined | material | component | consumable | ammo | drone | contraband | misc */
  category?: string
  /** Modules only: weapon | defense | mining | utility */
  type?: string
  /** Modules only: weapon | defense | utility (always mirrors `type` except mining → utility) */
  slot?: string
  /** Modules only: the underlying module definition id */
  type_id?: string
  size?: number
  base_value?: number
  /** Non-modules only: common | uncommon | rare | exotic | legendary */
  rarity?: string
  stackable?: boolean
  tradeable?: boolean
  required_skills?: Record<string, number>

  // Consumable / ammo behaviour
  effect?: RawItemEffect
  /** Consumables: e.g. "alcohol", "meal" */
  food_type?: string
  /** Ammo: the weapon family this ammo feeds, e.g. "autocannon" */
  ammo_type?: string
  magazine_size?: number
  /** How this item is obtained, e.g. "mining" */
  extracted_by?: string
  /** Recipe automatically run by a ship carrying this item */
  passive_recipe?: string
  /** Empires this item is restricted to */
  region_lock?: string[]
  hazardous?: boolean
  quest_item?: boolean

  // Module stats (flat on the item)
  cpu_usage?: number
  power_usage?: number
  damage?: number
  damage_type?: string
  reach?: number
  cooldown?: number
  accuracy_bonus?: number
  tracking_bonus?: number
  precision_factor?: number
  armor_bypass_bonus?: number
  shield_bypass_bonus?: number
  shield_bonus?: number
  armor_bonus?: number
  hull_bonus?: number
  hull_penalty?: number
  shield_recharge_bonus?: number
  armor_repair_rate?: number
  remote_repair_power?: number
  damage_reduction?: number
  resistance_bonus?: Record<string, number>
  mining_power?: number
  mining_range?: number
  harvest_power?: number
  harvest_range?: number
  survey_power?: number
  survey_range?: number
  scanner_power?: number
  cloak_strength?: number
  signature_bonus?: number
  speed_bonus?: number
  speed_penalty?: number
  tow_speed_penalty?: number
  cargo_bonus?: number
  fuel_efficiency?: number
  max_fuel_bonus?: number
  power_bonus?: number
  cpu_bonus?: number
  drone_capacity?: number
  drone_bandwidth?: number
  webify_strength?: number
  warp_stabilization?: number
  disruptor_power?: number
  scramble_power?: number
  passenger_economy_berths?: number
  passenger_business_berths?: number
  passenger_first_berths?: number
  /** Free-text special behaviour tag, e.g. "adaptive_resistance_10" */
  special?: string
}

export interface RawRecipe {
  id: string
  name: string
  description?: string
  /** e.g. Refining, Components, Modules, Shipbuilding, Facility Only, ... */
  category?: string
  /** In ticks */
  crafting_time?: number
  inputs?: ItemStack[]
  outputs?: ItemStack[]
  /** Can only be run inside a facility, not from a ship */
  facility_only?: boolean
  /** Outputs cannot be recycled back into inputs */
  no_recycle?: boolean
  /** Fuel produced directly (fuel-production recipes) */
  fuel_output?: number
  /**
   * Not currently emitted by the server for any recipe, but tolerated so the
   * /play crafting UI keeps compiling if it comes back.
   */
  required_skills?: Record<string, number>
}

export interface RawShip {
  id: string
  name: string
  description?: string
  lore?: string
  /** Civilian | Combat | Combat Support | Commercial | Covert | Exploration | Industrial | Multirole | Support */
  category?: string
  /** Hull class, e.g. Shuttle, Frigate, Cruiser, Dreadnought (46 distinct values) */
  class?: string
  /** Owning empire: solarian | voidborn | crimson | nebula | outerrim | pirate */
  faction?: string
  tier?: number
  price?: number
  scale?: number
  cargo_capacity?: number
  cpu_capacity?: number
  power_capacity?: number
  weapon_slots?: number
  defense_slots?: number
  utility_slots?: number
  base_hull?: number
  base_shield?: number
  base_armor?: number
  base_speed?: number
  base_fuel?: number
  base_shield_recharge?: number
  starter_ship?: boolean
  shipyard_tier?: number
  build_materials?: ItemStack[]
  build_time?: number
  default_modules?: string[]
  default_loadout_version?: number
  flavor_tags?: string[]
  /** Piloting skill level required to fly this hull */
  piloting_required?: number
  /** Innate hull abilities (scan resistance, integrated cloak, ...) */
  inherent_capabilities?: ShipCapability[]
  /** Recipes this hull runs passively while flying */
  passive_recipes?: string[]
  tow_speed_bonus?: number
  /** Empire reputation required to purchase */
  required_reputation?: number
  required_achievement?: string
  required_faction_achievement?: string
  required_faction_leader?: boolean
  /** Player-facing explanation of a prestige gate */
  prestige_lock?: string
  /** NPC-only hulls, e.g. "boss_flagship" */
  npc_role?: string
  /** For NPC variants: the player hull this is derived from */
  based_on?: string
  special?: string
}

/**
 * Provenance written by scripts/fetch-catalog.mjs.
 * `Counts` is generic because the two data files count different sections.
 */
export interface CatalogMeta<Counts = Record<string, number>> {
  fetchedAt: string
  server: string
  /** Game server version the catalog was dumped from, e.g. "0.492.1" */
  version: string | null
  counts: Counts
  /**
   * Which source the build fetched from: 'dump' is GET /api/catalog.json (the
   * whole catalog), 'paged' is the POST /api/v2/spacemolt_catalog fallback that
   * runs when the dump is rate-limited. Absent on a file left by an older build.
   */
  source?: 'dump' | 'paged'
  /** True when the source could not supply every section of this file. */
  partial?: boolean
}

interface CatalogData {
  items: Record<string, RawCatalogItem>
  recipes: Record<string, RawRecipe>
  ships: Record<string, RawShip>
  _meta: CatalogMeta<{ items: number; recipes: number; ships: number }>
}

const catalog = rawCatalog as unknown as CatalogData

// ── Exports ─────────────────────────────────────────────────────────────

/** All items keyed by ID (includes modules) — plain object, O(1) lookups */
export const itemsById: Readonly<Record<string, RawCatalogItem>> = catalog.items

/** All recipes keyed by ID */
export const recipesById: Readonly<Record<string, RawRecipe>> = catalog.recipes

/** All ships keyed by ID */
export const shipsById: Readonly<Record<string, RawShip>> = catalog.ships

/** Provenance: when this catalog was fetched, from which server, at which game version */
export const catalogMeta: Readonly<CatalogData['_meta']> = catalog._meta

/** Get a single item by ID */
export function getItem(id: string): RawCatalogItem | undefined {
  return catalog.items[id]
}

/** Get a single recipe by ID */
export function getRecipe(id: string): RawRecipe | undefined {
  return catalog.recipes[id]
}

/** Get a single ship by ID */
export function getShip(id: string): RawShip | undefined {
  return catalog.ships[id]
}

/** Get the effective category for an item (modules use 'type' instead of 'category') */
export function getItemCategory(item: RawCatalogItem): string {
  return item.category || item.type || 'unknown'
}

const MODULE_TYPES = new Set(['weapon', 'defense', 'mining', 'utility', 'drone'])

/** Check if an item is a module */
export function isModule(item: RawCatalogItem): boolean {
  return MODULE_TYPES.has(item.type ?? '') || item.slot != null
}

/** Format an item_id as a display name ("iron_ore" → "Iron Ore") */
export function formatItemId(itemId: string): string {
  const item = catalog.items[itemId]
  if (item) return item.name
  return titleCase(itemId)
}

/** All items as a flat array (cached) */
let _itemArray: RawCatalogItem[] | null = null
export function allItems(): RawCatalogItem[] {
  if (!_itemArray) _itemArray = Object.values(catalog.items)
  return _itemArray
}

/** All tradeable items as a flat array (cached) */
let _tradeableItems: RawCatalogItem[] | null = null
export function tradeableItems(): RawCatalogItem[] {
  if (!_tradeableItems) _tradeableItems = allItems().filter(i => i.tradeable !== false)
  return _tradeableItems
}

/** Only the module items (weapons, defenses, mining, utility) — cached */
let _modules: RawCatalogItem[] | null = null
export function allModules(): RawCatalogItem[] {
  if (!_modules) _modules = allItems().filter(isModule)
  return _modules
}

/** Only the non-module items (ores, materials, components, consumables, ...) — cached */
let _nonModules: RawCatalogItem[] | null = null
export function allNonModuleItems(): RawCatalogItem[] {
  if (!_nonModules) _nonModules = allItems().filter(i => !isModule(i))
  return _nonModules
}

/** All recipes as a flat array (cached) */
let _recipes: RawRecipe[] | null = null
export function allRecipes(): RawRecipe[] {
  if (!_recipes) _recipes = Object.values(catalog.recipes)
  return _recipes
}

/** All ships as a flat array (cached) */
let _ships: RawShip[] | null = null
export function allShips(): RawShip[] {
  if (!_ships) _ships = Object.values(catalog.ships)
  return _ships
}

// ── Cross-reference indexes ─────────────────────────────────────────────
//
// Built once, lazily, on first use. Prefer these over scanning allRecipes() per
// item — a page rendering hundreds of items would otherwise be O(items × recipes).

interface RecipeIndex {
  producedBy: Map<string, RawRecipe[]>
  consumedBy: Map<string, RawRecipe[]>
}

let _recipeIndex: RecipeIndex | null = null

function recipeIndex(): RecipeIndex {
  if (_recipeIndex) return _recipeIndex

  const producedBy = new Map<string, RawRecipe[]>()
  const consumedBy = new Map<string, RawRecipe[]>()

  const push = (map: Map<string, RawRecipe[]>, itemId: string, recipe: RawRecipe) => {
    const list = map.get(itemId)
    if (list) {
      if (!list.includes(recipe)) list.push(recipe)
    } else {
      map.set(itemId, [recipe])
    }
  }

  for (const recipe of allRecipes()) {
    for (const out of recipe.outputs ?? []) push(producedBy, out.item_id, recipe)
    for (const inp of recipe.inputs ?? []) push(consumedBy, inp.item_id, recipe)
  }

  _recipeIndex = { producedBy, consumedBy }
  return _recipeIndex
}

/** Recipes that output the given item */
export function recipesProducing(itemId: string): RawRecipe[] {
  return recipeIndex().producedBy.get(itemId) ?? []
}

/** Recipes that take the given item as an input */
export function recipesConsuming(itemId: string): RawRecipe[] {
  return recipeIndex().consumedBy.get(itemId) ?? []
}

/** Ships that require the given item to build */
let _shipsByMaterial: Map<string, RawShip[]> | null = null
export function shipsBuiltFrom(itemId: string): RawShip[] {
  if (!_shipsByMaterial) {
    _shipsByMaterial = new Map()
    for (const ship of allShips()) {
      for (const mat of ship.build_materials ?? []) {
        const list = _shipsByMaterial.get(mat.item_id)
        if (list) list.push(ship)
        else _shipsByMaterial.set(mat.item_id, [ship])
      }
    }
  }
  return _shipsByMaterial.get(itemId) ?? []
}

/**
 * Group a list of entries by a key, dropping entries where the key is absent.
 * Exported so the server-only catalogReference module can reuse it.
 */
export function groupBy<T>(entries: T[], key: (entry: T) => string | undefined): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const entry of entries) {
    const k = key(entry)
    if (k == null) continue
    ;(out[k] ??= []).push(entry)
  }
  return out
}

/** Ships grouped by hull class ("Shuttle", "Cruiser", ...) — cached */
let _shipsByClass: Record<string, RawShip[]> | null = null
export function shipsByClass(): Readonly<Record<string, RawShip[]>> {
  if (!_shipsByClass) _shipsByClass = groupBy(allShips(), s => s.class)
  return _shipsByClass
}

/** Ships grouped by owning empire/faction ("solarian", "pirate", ...) — cached */
let _shipsByFaction: Record<string, RawShip[]> | null = null
export function shipsByFaction(): Readonly<Record<string, RawShip[]>> {
  if (!_shipsByFaction) _shipsByFaction = groupBy(allShips(), s => s.faction)
  return _shipsByFaction
}

// Skills and facilities live in the server-only sibling module:
// see src/data/catalogReference.ts
