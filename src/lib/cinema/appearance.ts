/** Compact public catalog projection. This module never imports the catalog bundle. */
export type ShipFamily = 'fighter' | 'warship' | 'capital' | 'carrier' | 'industrial' | 'scout' | 'support' | 'drone' | 'station' | 'creature'
export type ShipEmpire = 'solarian' | 'voidborn' | 'crimson' | 'nebula' | 'outerrim' | 'pirate' | 'neutral'
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
  // House art source: content-gen/style/empires/*.json. Hull colors remain
  // recognizable over large surfaces; the accent also colors engine emission.
  solarian: [0x3e5c82, 0xc9a227],
  voidborn: [0x2a0f52, 0x3fe6ff],
  crimson: [0x8b1a1a, 0xe8641c],
  nebula: [0x1f4a34, 0xc9922e],
  outerrim: [0xc4a878, 0x2fb6c4],
  // Pirate ship lore describes stolen frames rebuilt with steel and salvage,
  // rather than the original empire's proprietary armor and construction.
  pirate: [0x633c31, 0xff6540],
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
  const [baseBeam, baseHeight] = proportions[family]
  const silhouette: Record<ShipEmpire, [number, number]> = {
    solarian: [.92, 1.07], voidborn: [1.14, .78], crimson: [1.2, 1.16],
    nebula: [1.12, .92], outerrim: [.86, .88], pirate: [1.04, 1.13], neutral: [1, 1],
  }
  const beam = baseBeam * silhouette[resolvedEmpire][0]
  const height = baseHeight * silhouette[resolvedEmpire][1]
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
