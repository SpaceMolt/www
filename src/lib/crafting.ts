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
 * combined inventory the gameserver will draw from on a `craft` command.
 *
 * The gameserver's craft handler accepts inputs from BOTH ship cargo AND the
 * current station's storage (see gameserver/internal/handlers/crafting.go),
 * so a faithful client-side check has to merge those two sources before
 * comparing against recipe inputs. Earlier versions only consulted ship
 * cargo, which hid recipes whose inputs were sitting in station storage —
 * see GitHub issue #794 (Ragthar / "Purify Argon").
 *
 * `storageItems` may be `null`/`undefined` when the player isn't docked or
 * storage hasn't been fetched yet; in that case we fall back to cargo only.
 */
export function canCraftRecipe(
  recipe: Recipe,
  skills: Record<string, SkillEntry> | undefined,
  cargoItems: ItemQty[],
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

  // Check materials against cargo + station storage combined.
  for (const input of recipe.inputs ?? []) {
    const have = availableQuantity(input.item_id, cargoItems, storageItems)
    if (have < input.quantity) {
      reasons.push(`Need ${input.quantity}x ${formatItemId(input.item_id)} (have ${have})`)
    }
  }

  return { craftable: reasons.length === 0, reasons }
}

/**
 * Combined quantity of `itemId` across ship cargo and (optional) station
 * storage. Mirrors the inventory pool the gameserver will consume from.
 */
export function availableQuantity(
  itemId: string,
  cargoItems: ItemQty[],
  storageItems?: ItemQty[] | null,
): number {
  const inCargo = cargoItems.find((c) => c.item_id === itemId)?.quantity ?? 0
  const inStorage = (storageItems ?? []).find((s) => s.item_id === itemId)?.quantity ?? 0
  return inCargo + inStorage
}
