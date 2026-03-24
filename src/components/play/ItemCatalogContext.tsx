'use client'

import { createContext, useContext, useCallback, type ReactNode } from 'react'
import type { CatalogItem, CatalogRecipe, CatalogModuleStats } from '../ItemDetail'
import { getItem as getRawItem, items as allRawItems, recipes as allRawRecipes, formatItemId } from '@/data/catalog'
import type { RawCatalogItem } from '@/data/catalog'

// Module stat fields to extract from flat item into nested module object
const MODULE_STAT_KEYS: (keyof CatalogModuleStats)[] = [
  'type', 'cpu_usage', 'power_usage', 'damage', 'damage_type', 'range', 'cooldown',
  'shield_bonus', 'armor_bonus', 'hull_bonus', 'mining_power', 'mining_range',
  'harvest_power', 'harvest_range', 'special', 'speed_bonus', 'cargo_bonus',
  'scanner_power', 'cloak_strength', 'fuel_efficiency', 'drone_capacity', 'drone_bandwidth',
]

/** Transform a raw catalog item + related recipes into the CatalogItem shape used by ItemDetail */
function transformItem(raw: RawCatalogItem): CatalogItem {
  const item: CatalogItem = {
    id: raw.id,
    name: raw.name,
    description: raw.description || '',
    category: raw.category || raw.type || '',
    size: raw.size || 0,
    base_value: raw.base_value || 0,
    rarity: raw.rarity,
    stackable: raw.stackable ?? false,
    tradeable: raw.tradeable ?? false,
  }

  // Extract module stats from flat fields
  if (raw.cpu_usage != null || raw.power_usage != null || raw.slot != null) {
    const mod = {} as Record<string, unknown>
    for (const key of MODULE_STAT_KEYS) {
      const val = (raw as unknown as Record<string, unknown>)[key]
      if (val != null) mod[key] = val
    }
    if (Object.keys(mod).length > 0) {
      item.module = mod as unknown as CatalogModuleStats
    }
  }

  // Cross-reference bundled recipes to find produced_by / consumed_by
  const producedBy: CatalogRecipe[] = []
  const consumedBy: CatalogRecipe[] = []

  for (const r of allRawRecipes.values()) {
    const inputs = r.inputs || []
    const outputs = r.outputs || []

    const inOutputs = outputs.some(o => o.item_id === raw.id)
    const inInputs = inputs.some(i => i.item_id === raw.id)

    if (inOutputs || inInputs) {
      const recipe: CatalogRecipe = {
        recipe_id: r.id,
        recipe_name: r.name,
        recipe_category: r.category || '',
        crafting_time: r.crafting_time || 0,
        required_skills: r.required_skills,
        inputs: inputs.map(i => ({ item_id: i.item_id, item_name: formatItemId(i.item_id), quantity: i.quantity })),
        outputs: outputs.map(o => ({ item_id: o.item_id, item_name: formatItemId(o.item_id), quantity: o.quantity })),
      }
      if (inOutputs) producedBy.push(recipe)
      if (inInputs) consumedBy.push(recipe)
    }
  }

  if (producedBy.length > 0) item.produced_by = producedBy
  if (consumedBy.length > 0) item.consumed_by = consumedBy

  return item
}

// Lazily-populated cache of transformed CatalogItems
const transformedCache = new Map<string, CatalogItem>()

function getTransformedItem(id: string): CatalogItem | undefined {
  const cached = transformedCache.get(id)
  if (cached) return cached

  const raw = getRawItem(id)
  if (!raw) return undefined

  const item = transformItem(raw)
  transformedCache.set(id, item)
  return item
}

interface ItemCatalogContextValue {
  getItem: (id: string) => CatalogItem | undefined
  fetchItem: (id: string) => Promise<CatalogItem | undefined>
  isLoading: (id: string) => boolean
}

const ItemCatalogContext = createContext<ItemCatalogContextValue | null>(null)

export function useItemCatalog() {
  const ctx = useContext(ItemCatalogContext)
  if (!ctx) throw new Error('useItemCatalog must be used within ItemCatalogProvider')
  return ctx
}

export function ItemCatalogProvider({ children }: { children: ReactNode }) {
  // All data is now bundled — lookups are synchronous
  const getItem = useCallback((id: string): CatalogItem | undefined => {
    return getTransformedItem(id)
  }, [])

  // fetchItem kept for API compatibility but now resolves instantly
  const fetchItem = useCallback(async (id: string): Promise<CatalogItem | undefined> => {
    return getTransformedItem(id)
  }, [])

  const isLoading = useCallback((_id: string): boolean => {
    return false
  }, [])

  return (
    <ItemCatalogContext.Provider value={{ getItem, fetchItem, isLoading }}>
      {children}
    </ItemCatalogContext.Provider>
  )
}
