import { availableQuantity, type ItemQty } from '@/lib/crafting'
import type { Recipe } from '../types'

// The server converts an output quantity to whole runs with the first output's yield.
const perRun = (recipe: Recipe) => Math.max(1, recipe.outputs?.[0]?.quantity ?? 1)

export const runsFor = (recipe: Recipe, quantity: number) => Math.max(1, Math.ceil(quantity / perRun(recipe)))

/** Most output items `items` can pay for, in whole runs. */
export function maxCraftable(recipe: Recipe, items: ItemQty[]): number {
  const inputs = recipe.inputs ?? []
  if (inputs.length === 0) return 0
  const runs = Math.min(...inputs.map((i) => Math.floor(availableQuantity(i.item_id, items) / i.quantity)))
  return runs * perRun(recipe)
}

/** Inputs that storage lacks for `runs`, capped at what cargo holds — the deposit that fills the gap. */
export function missingFromCargo(recipe: Recipe, runs: number, storage: ItemQty[], cargo: ItemQty[]): ItemQty[] {
  return (recipe.inputs ?? [])
    .map((i) => ({
      item_id: i.item_id,
      quantity: Math.min(
        availableQuantity(i.item_id, cargo),
        i.quantity * runs - availableQuantity(i.item_id, storage),
      ),
    }))
    .filter((i) => i.quantity > 0)
}

export type Ask = { price_each: number; quantity: number; my_quantity?: number }
export type BuyLine = ItemQty & { cost: number; short: number }

/**
 * Inputs that `held` (storage + cargo) lacks for `runs`, priced by walking the
 * cheapest asks first. Own orders are skipped: the server never self-matches.
 * `short` is what the local book cannot fill. Cost leaves out sales tax.
 */
export const buyPlan = (recipe: Recipe, runs: number, held: ItemQty[], asksFor: (itemId: string) => Ask[]): BuyLine[] =>
  (recipe.inputs ?? [])
    .map((i) => ({ item_id: i.item_id, quantity: i.quantity * runs - availableQuantity(i.item_id, held) }))
    .filter((i) => i.quantity > 0)
    .map((i) => [...asksFor(i.item_id)]
      .sort((a, b) => a.price_each - b.price_each)
      .reduce((line, a) => {
        const take = Math.min(line.short, a.quantity - (a.my_quantity ?? 0))
        return take > 0 ? { ...line, cost: line.cost + take * a.price_each, short: line.short - take } : line
      }, { ...i, cost: 0, short: i.quantity }))

/** Sum two inventories by item id. */
export const combineItems = (a: ItemQty[], b: ItemQty[]): ItemQty[] =>
  Object.entries(
    [...a, ...b].reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.item_id]: (acc[i.item_id] ?? 0) + i.quantity }), {}),
  ).map(([item_id, quantity]) => ({ item_id, quantity }))

// ponytail: mirrors gameserver RecycleBlockedCategory (station_economy.go); the catalog has no flag for it.
const IRREVERSIBLE = new Set(['Refining', 'Ice Refining', 'Gas Processing', 'Fuel Production', 'Fuel Synthesis', 'Biological Refining', 'Ship Passive'])

/** False for recipes no recycler can run in reverse: irreversible categories and no_recycle recipes. */
export const isRecyclable = (recipe: Pick<Recipe, 'category'> & { no_recycle?: boolean }) =>
  !recipe.no_recycle && !IRREVERSIBLE.has(recipe.category)
