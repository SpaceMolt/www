import type { Recipe } from '@/components/play/types'
import { formatItemId } from '@/data/catalog'
import { titleCase } from '@/lib/format'

export interface ItemQty {
  item_id: string
  quantity: number
}

export interface SkillEntry {
  level: number
  xp: number
  next_level_xp: number
}

/**
 * Decide whether a recipe is craftable given the player's skills and the
 * inventory the gameserver will draw from on a `craft` command.
 *
 * Crafting is now station-storage-centric: the gameserver escrows a recipe's
 * inputs from the player's STATION STORAGE at the docked base (not ship cargo)
 * and delivers outputs back there on completion — see
 * gameserver/internal/handlers/crafting.go ("crafting is now
 * station-storage-centric (no cargo path)"). A faithful client-side check must
 * therefore compare recipe inputs against station storage only; materials
 * sitting in ship cargo are not eligible until deposited into storage.
 *
 * `storageItems` may be `null`/`undefined` when the player isn't docked or
 * storage hasn't been fetched yet; in that case material availability is
 * unknown and the inputs are reported as missing.
 */
export function canCraftRecipe(
  recipe: Recipe,
  skills: Record<string, SkillEntry> | undefined,
  storageItems?: ItemQty[] | null,
): { craftable: boolean; reasons: string[] } {
  const reasons: string[] = []

  // Check skills
  if (recipe.required_skills && Object.keys(recipe.required_skills).length > 0) {
    for (const [skillId, reqLevel] of Object.entries(recipe.required_skills)) {
      const playerLevel = skills?.[skillId]?.level ?? 0
      if (playerLevel < (reqLevel as number)) {
        const name = titleCase(skillId)
        reasons.push(`Need ${name} Lv${reqLevel} (have ${playerLevel})`)
      }
    }
  }

  // Check materials against station storage (the pool the gameserver consumes).
  for (const input of recipe.inputs ?? []) {
    const have = availableQuantity(input.item_id, storageItems)
    if (have < input.quantity) {
      reasons.push(`Need ${input.quantity}x ${formatItemId(input.item_id)} (have ${have})`)
    }
  }

  return { craftable: reasons.length === 0, reasons }
}

/**
 * Quantity of `itemId` in station storage — the inventory pool the gameserver
 * escrows crafting inputs from. Returns 0 when storage is unknown.
 */
export function availableQuantity(
  itemId: string,
  storageItems?: ItemQty[] | null,
): number {
  return (storageItems ?? []).find((s) => s.item_id === itemId)?.quantity ?? 0
}
