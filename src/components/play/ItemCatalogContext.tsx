'use client'

import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react'
import { useGame } from './GameProvider'
import type { CatalogItem, CatalogRecipe, CatalogModuleStats } from '../ItemDetail'

// Module stat fields that should be extracted from the flat item into a nested module object
const MODULE_STAT_KEYS: (keyof CatalogModuleStats)[] = [
  'type', 'cpu_usage', 'power_usage', 'damage', 'damage_type', 'range', 'cooldown',
  'shield_bonus', 'armor_bonus', 'hull_bonus', 'mining_power', 'mining_range',
  'harvest_power', 'harvest_range', 'special', 'speed_bonus', 'cargo_bonus',
  'scanner_power', 'cloak_strength', 'fuel_efficiency', 'drone_capacity', 'drone_bandwidth',
]

/** Format item_id as a display name (e.g. "iron_ore" → "Iron Ore") */
function formatItemName(itemId: string): string {
  return itemId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Transform the raw catalog API response into a proper CatalogItem */
function transformCatalogResponse(id: string, raw: Record<string, unknown>, rawItem: Record<string, unknown>): CatalogItem {
  const item: CatalogItem = {
    id: (rawItem.id as string) || id,
    name: (rawItem.name as string) || formatItemName(id),
    description: (rawItem.description as string) || '',
    category: (rawItem.category as string) || (rawItem.type as string) || '',
    size: (rawItem.size as number) || 0,
    base_value: (rawItem.base_value as number) || 0,
    rarity: rawItem.rarity as string | undefined,
    stackable: (rawItem.stackable as boolean) ?? false,
    tradeable: (rawItem.tradeable as boolean) ?? false,
  }

  // Extract module stats from flat item fields if present
  if (rawItem.cpu_usage != null || rawItem.power_usage != null || rawItem.slot != null) {
    const mod = {} as Record<string, unknown>
    for (const key of MODULE_STAT_KEYS) {
      if (rawItem[key] != null) mod[key] = rawItem[key]
    }
    if (Object.keys(mod).length > 0) {
      item.module = mod as unknown as CatalogModuleStats
    }
  }

  // Map top-level recipes into produced_by / consumed_by
  const recipes = (raw.recipes || []) as Array<Record<string, unknown>>
  if (recipes.length > 0) {
    const producedBy: CatalogRecipe[] = []
    const consumedBy: CatalogRecipe[] = []

    for (const r of recipes) {
      const inputs = (r.inputs || []) as Array<{ item_id: string; quantity: number; item_name?: string }>
      const outputs = (r.outputs || []) as Array<{ item_id: string; quantity: number; item_name?: string }>

      const recipe: CatalogRecipe = {
        recipe_id: (r.id as string) || '',
        recipe_name: (r.name as string) || '',
        recipe_category: (r.category as string) || '',
        crafting_time: (r.crafting_time as number) || 0,
        required_skills: r.required_skills as Record<string, number> | undefined,
        inputs: inputs.map(i => ({ item_id: i.item_id, item_name: i.item_name || formatItemName(i.item_id), quantity: i.quantity })),
        outputs: outputs.map(o => ({ item_id: o.item_id, item_name: o.item_name || formatItemName(o.item_id), quantity: o.quantity })),
      }

      const inOutputs = outputs.some(o => o.item_id === id)
      const inInputs = inputs.some(i => i.item_id === id)
      if (inOutputs) producedBy.push(recipe)
      if (inInputs) consumedBy.push(recipe)
      // If the item appears in neither (shouldn't happen), skip
    }

    if (producedBy.length > 0) item.produced_by = producedBy
    if (consumedBy.length > 0) item.consumed_by = consumedBy
  }

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
  const { api } = useGame()
  const cache = useRef<Map<string, CatalogItem>>(new Map())
  const inflight = useRef<Map<string, Promise<CatalogItem | undefined>>>(new Map())
  const loading = useRef<Set<string>>(new Set())

  const fetchItem = useCallback(async (id: string): Promise<CatalogItem | undefined> => {
    const cached = cache.current.get(id)
    if (cached) return cached

    // Deduplicate in-flight requests
    const existing = inflight.current.get(id)
    if (existing) return existing

    if (!api) return undefined

    loading.current.add(id)
    const promise = api.command('catalog', { type: 'items', id }).then((result) => {
      const r = result as Record<string, unknown>
      const rawItems = (r.items || []) as Array<Record<string, unknown>>
      if (rawItems.length > 0) {
        const item = transformCatalogResponse(id, r, rawItems[0])
        cache.current.set(id, item)
        return item
      }
      return undefined
    }).catch(() => undefined).finally(() => {
      loading.current.delete(id)
      inflight.current.delete(id)
    })

    inflight.current.set(id, promise)
    return promise
  }, [api])

  const getItem = useCallback((id: string): CatalogItem | undefined => {
    return cache.current.get(id)
  }, [])

  const isLoading = useCallback((id: string): boolean => {
    return loading.current.has(id)
  }, [])

  return (
    <ItemCatalogContext.Provider value={{ getItem, fetchItem, isLoading }}>
      {children}
    </ItemCatalogContext.Provider>
  )
}
