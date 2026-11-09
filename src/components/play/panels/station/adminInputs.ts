/** Services a station can gate per `set_service_access` (gameserver station_admin.go). */
export const GATED_SERVICES = ['market', 'refuel', 'repair', 'shipyard', 'crafting', 'salvage_yard', 'missions'] as const

export const SERVICE_ACCESS = ['public', 'allies', 'faction'] as const

/** `market_fee_bps` (basis points) as the percent `set_market_fee` takes. */
export const feePercent = (bps = 0): number => bps / 100

/** Comma/space/newline separated item ids, trimmed, deduped, empties dropped. */
export const parseItemIds = (text: string): string[] =>
  [...new Set(text.split(/[\s,]+/).filter(Boolean))]

/** A non-negative number from an input, or null when it is not one. */
export function parseAmount(text: string): number | null {
  const n = Number(text)
  return text.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null
}
