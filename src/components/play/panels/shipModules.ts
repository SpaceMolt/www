import type { GameState, UseItemResponse } from '@spacemolt/lib'
import type { RawCatalogItem } from '@/data/catalog'

type ModuleEntry = NonNullable<GameState['modules']>[number]

/**
 * Mirrors the server's canFieldRefit for the player's own ship: docked, or a
 * Ship Maintenance Bay (refit_capability) fitted. The server also allows a
 * refit beside an undocked faction-mate's bay; the client cannot see that.
 */
export function canRefit(isDocked: boolean, modules: ModuleEntry[]): boolean {
  return isDocked || modules.some((m) => m.stats?.refit_capability === true)
}

/** Effect types HandleUseItem applies. Ammo, probes, beacons and countermeasures are refused. */
const USABLE_EFFECTS = new Set(['repair', 'shield', 'buff', 'emergency_jump', 'fuel', 'power'])
/** Effect types that honour `quantity`; the rest always consume one. */
const QTY_EFFECTS = new Set(['repair', 'shield', 'fuel'])

export function isUsableConsumable(entry: RawCatalogItem | undefined): boolean {
  return USABLE_EFFECTS.has(entry?.effect?.type ?? '')
}

export function usesQuantity(entry: RawCatalogItem | undefined): boolean {
  return QTY_EFFECTS.has(entry?.effect?.type ?? '')
}

/** Player-facing summary of a use_item result. The server only sets `message` for some effects. */
export function useItemResultText(d: UseItemResponse): string {
  if (d.message) return d.message
  const effect = d.hull_restored
    ? `Restored ${d.hull_restored} hull. `
    : d.shield_restored
      ? `Restored ${d.shield_restored} shield. `
      : d.fuel_added
        ? `Added ${d.fuel_added} fuel. `
        : d.stat
          ? `+${d.amount ?? 0} ${d.stat} for ${d.duration ?? 0} ticks. `
          : d.destination_system
            ? `Jumped to ${d.destination_system}. `
            : ''
  return `Used ${d.quantity_used}x ${d.item_name}. ${effect}${d.quantity_remaining} remaining.`
}
