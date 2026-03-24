/**
 * Static game catalog data, fetched at build time by scripts/fetch-catalog.mjs.
 *
 * Contains all items (including modules), recipes, and ships.
 * Import from here instead of making runtime API calls for catalog data.
 */

import rawCatalog from './catalog.json'

// ── Raw types matching the JSON shape from the game server ──────────────

export interface RawCatalogItem {
  id: string
  name: string
  description?: string
  category?: string
  // Module items use 'type' instead of 'category'
  type?: string
  slot?: string
  size?: number
  base_value?: number
  rarity?: string
  stackable?: boolean
  tradeable?: boolean
  // Module stats (flat on item)
  cpu_usage?: number
  power_usage?: number
  damage?: number
  damage_type?: string
  range?: number
  cooldown?: number
  shield_bonus?: number
  armor_bonus?: number
  hull_bonus?: number
  mining_power?: number
  mining_range?: number
  harvest_power?: number
  harvest_range?: number
  special?: string
  speed_bonus?: number
  cargo_bonus?: number
  scanner_power?: number
  cloak_strength?: number
  fuel_efficiency?: number
  drone_capacity?: number
  drone_bandwidth?: number
  required_skills?: Record<string, number>
  type_id?: string
}

export interface RawRecipe {
  id: string
  name: string
  category?: string
  description?: string
  crafting_time?: number
  required_skills?: Record<string, number>
  inputs?: Array<{ item_id: string; quantity: number }>
  outputs?: Array<{ item_id: string; quantity: number }>
}

export interface RawShip {
  id: string
  name: string
  description?: string
  lore?: string
  category?: string
  class?: string
  faction?: string
  tier?: number
  price?: number
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
  build_materials?: Array<{ item_id: string; quantity: number }>
  build_time?: number
  default_modules?: string[]
  flavor_tags?: string[]
  scale?: number
}

interface CatalogData {
  items: Record<string, RawCatalogItem>
  recipes: Record<string, RawRecipe>
  ships: Record<string, RawShip>
}

const catalog = rawCatalog as unknown as CatalogData

// ── Exports ─────────────────────────────────────────────────────────────

/** All items keyed by ID (includes modules) — plain object, O(1) lookups */
export const itemsById: Readonly<Record<string, RawCatalogItem>> = catalog.items

/** All recipes keyed by ID */
export const recipesById: Readonly<Record<string, RawRecipe>> = catalog.recipes

/** All ships keyed by ID */
export const shipsById: Readonly<Record<string, RawShip>> = catalog.ships

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

/** Check if an item is a module */
export function isModule(item: RawCatalogItem): boolean {
  return item.slot != null || item.cpu_usage != null
}

/** Format an item_id as a display name ("iron_ore" → "Iron Ore") */
export function formatItemId(itemId: string): string {
  const item = catalog.items[itemId]
  if (item) return item.name
  return itemId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
