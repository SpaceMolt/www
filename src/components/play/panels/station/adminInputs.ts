/** Services a station can gate per `set_service_access` (gameserver station_admin.go). */
export const GATED_SERVICES = ['market', 'refuel', 'repair', 'shipyard', 'crafting', 'salvage_yard', 'missions'] as const

export const SERVICE_ACCESS = ['public', 'allies', 'faction'] as const

/** `market_fee_bps` (basis points) as the percent `set_market_fee` takes. */
export const feePercent = (bps = 0): number => bps / 100

/** Comma/space/newline separated item ids, trimmed, deduped, empties dropped. */
export const parseItemIds = (text: string): string[] =>
  [...new Set(text.split(/[\s,]+/).filter(Boolean))]

/** A non-negative whole number from an input (the server takes ints), or null when it is not one. */
export function parseAmount(text: string): number | null {
  const n = Number(text)
  return text.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : null
}

const ACCESS_DONE: Record<string, string> = {
  allow_player: 'Allowed {} to dock',
  remove_player: 'Removed {} from the allow list',
  ban: 'Banned {}',
  unban: 'Unbanned {}',
  allow_faction: 'Allowed {} to dock',
  remove_faction: 'Removed {} from the allow list',
}

/** The server answers dock-list changes as "allow_player: Name."; say it as a sentence. Other messages pass through. */
export function readableStationMessage(message: string): string {
  const m = /^([a-z_]+): (.+)\.$/.exec(message)
  const template = m && ACCESS_DONE[m[1]]
  return template ? template.replace('{}', m[2]) : message
}
