/** Compact public catalog projection. This module never imports the catalog bundle. */
export type ShipFamily = 'fighter' | 'warship' | 'capital' | 'carrier' | 'industrial' | 'scout' | 'support' | 'drone' | 'station' | 'creature'
export type ShipEmpire = 'solarian' | 'voidborn' | 'crimson' | 'nebula' | 'outerrim' | 'neutral'
export interface ShipAppearance {
  family: ShipFamily
  empire: ShipEmpire
  /** Suggested cinematic world length; geometry itself is normalized to one. */
  length: number
  beam: number
  height: number
  accent: number
  hull: number
  tier: number
}
export type ShipAppearanceMap = Record<string, ShipAppearance>

const palettes: Record<ShipEmpire, [number, number]> = {
  solarian: [0x7795ab, 0xffcd75],
  voidborn: [0x4c5477, 0xae85ff],
  crimson: [0x695b59, 0xff6744],
  nebula: [0x88aaae, 0x56efff],
  outerrim: [0x8c7961, 0x96edb4],
  neutral: [0x687c89, 0x8bd7ff],
}
const proportions: Record<ShipFamily, [number, number]> = {
  fighter: [.56, .16], warship: [.34, .20], capital: [.42, .24],
  carrier: [.52, .21], industrial: [.44, .28], scout: [.38, .12],
  support: [.40, .24], drone: [.70, .24], station: [.90, .70], creature: [.55, .32],
}

export function resolveAppearance(shipClass: string, empire?: string, scale = 2, category = '', tier = 1, kind: 'ship' | 'drone' | 'station' | 'creature' = 'ship'): ShipAppearance {
  const name = shipClass.toLowerCase()
  let family: ShipFamily = 'warship'
  if (/creature|leviathan|whale|kraken|serpent|organism/.test(name)) family = 'creature'
  else if (/station|base|platform/.test(name)) family = 'station'
  else if (/carrier/.test(name)) family = 'carrier'
  else if (/drone/.test(name)) family = 'drone'
  else if (/dreadnought|battleship|capital|command/.test(name)) family = 'capital'
  else if (/freight|hauler|miner|salvag|refinery|tanker|harvest|construction|industrial|transport|liner/.test(name) || /industrial|commercial/i.test(category)) family = 'industrial'
  else if (/scout|explor|courier|shuttle|yacht|recon|pathfinder|runner|smuggler/.test(name)) family = 'scout'
  else if (/support|logistic|repair|medical|research|electronic|intelligence|multirole/.test(name) || /support/i.test(category)) family = 'support'
  else if (/fighter|interceptor|patrol|raider/.test(name) || (scale <= 1 && /combat/i.test(category))) family = 'fighter'
  else if (scale >= 4) family = 'capital'
  if (kind !== 'ship') family = kind
  const empireName = (empire ?? '').toLowerCase().replace(/[ _-]/g, '')
  const resolvedEmpire: ShipEmpire = Object.prototype.hasOwnProperty.call(palettes, empireName) ? empireName as ShipEmpire : 'neutral'
  const [hull, accent] = palettes[resolvedEmpire]
  const [beam, height] = proportions[family]
  // gameserver/data/ships/CLAUDE.md, "Scale ladder (canonical)": Personal 8–25m,
  // Small 25–80m, Medium 80–250m, Large 250–700m, Capital 700m–km+.
  // Compress representative physical lengths mildly for framing while retaining a
  // >20x Personal-to-Capital ratio. Tier is a skill/cost gate, never a size input.
  const safeScale = Number.isFinite(scale) ? Math.max(1, Math.min(5, scale)) : 2
  const lengths = [16, 48, 150, 450, 1200]
  const lower = Math.floor(safeScale) - 1
  const upper = Math.min(lower + 1, lengths.length - 1)
  const meters = lengths[lower] * Math.pow(lengths[upper] / lengths[lower], safeScale - Math.floor(safeScale))
  return { family, empire: resolvedEmpire, length: 1.8 * Math.pow(meters / 16, .72), beam, height, hull, accent, tier: Math.max(0, Math.min(5, tier || 0)) }
}

export function buildShipAppearances(ships: readonly { id: string; class?: string; category?: string; faction?: string; scale?: number; tier?: number }[]): ShipAppearanceMap {
  return Object.fromEntries(ships.map(ship => [ship.id, resolveAppearance(ship.class ?? '', ship.faction, ship.scale, ship.category, ship.tier)]))
}
