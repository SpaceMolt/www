/**
 * Ship glyph silhouettes for the battle viewer.
 *
 * Every participant is drawn as one of a small set of silhouette archetypes
 * so a battle reads at a glance: pointy things shoot, boxy things haul,
 * pincered things mine. The ~50 catalog ship classes map onto the archetypes
 * via CLASS_ARCHETYPES, with a category-based fallback for classes the
 * (build-time) catalog doesn't know yet.
 *
 * All paths are traced nose-forward along +X, symmetric about Y=0, in units
 * of `size`, and are rotated into the ship's facing by the caller.
 */

export type GlyphArchetype =
  | 'fighter'
  | 'warship'
  | 'capital'
  | 'carrier'
  | 'hauler'
  | 'miner'
  | 'scout'
  | 'support'
  | 'drone'
  | 'creature'

/** Nose extent of each archetype (units of size), for attaching the muzzle cue. */
export const GLYPH_NOSE_X: Record<GlyphArchetype, number> = {
  fighter: 1.25,
  warship: 1.3,
  capital: 1.35,
  carrier: 1.0,
  hauler: 1.0,
  miner: 1.2,
  scout: 1.25,
  support: 1.0,
  drone: 1.0,
  creature: 0.9,
}

/** Catalog ship class (lowercase) → silhouette archetype. */
export const CLASS_ARCHETYPES: Record<string, GlyphArchetype> = {
  // Small, fast combatants
  fighter: 'fighter',
  'heavy fighter': 'fighter',
  interceptor: 'fighter',
  raider: 'fighter',
  patrol: 'fighter',
  'customs patrol': 'fighter',
  // Mid-size warships
  cruiser: 'warship',
  battlecruiser: 'warship',
  assault: 'warship',
  interdictor: 'warship',
  monitor: 'warship',
  bombardment: 'warship',
  exotic: 'warship',
  // Stealth hulls are combat-fit gunships, not couriers — keep them warship.
  stealth: 'warship',
  // Capital slabs
  dreadnought: 'capital',
  'command dreadnought': 'capital',
  battleship: 'capital',
  capital: 'capital',
  command: 'capital',
  'mobile base': 'capital',
  // Flight decks
  carrier: 'carrier',
  'drone carrier': 'carrier',
  'fleet carrier': 'carrier',
  'assault carrier': 'carrier',
  // Cargo boxes
  freighter: 'hauler',
  'bulk hauler': 'hauler',
  tanker: 'hauler',
  'hazmat freighter': 'hauler',
  liner: 'hauler',
  transport: 'hauler',
  // Resource extraction (pincer jaws)
  miner: 'miner',
  salvager: 'miner',
  refinery: 'miner',
  'ice harvester': 'miner',
  'gas harvester': 'miner',
  whaler: 'miner',
  hunter: 'miner',
  construction: 'miner',
  mining: 'miner',
  industrial: 'miner',
  // Small, quick, mostly harmless
  scout: 'scout',
  explorer: 'scout',
  courier: 'scout',
  shuttle: 'scout',
  yacht: 'scout',
  research: 'scout',
  recon: 'scout',
  reconnaissance: 'scout',
  pathfinder: 'scout',
  smuggler: 'scout',
  'blockade runner': 'scout',
  // Utility pods
  'electronic warfare': 'support',
  logistics: 'support',
  repair: 'support',
  medical: 'support',
  support: 'support',
  intelligence: 'support',
  multirole: 'support',
}

/**
 * Resolve a participant to a silhouette archetype. Class match first, then
 * category fallback (covers classes newer than the build-time catalog), then
 * the generic scout teardrop for anything unknown.
 */
export function archetypeForShip(
  kind: 'ship' | 'drone' | 'creature',
  shipClass: string | undefined,
  category: string | undefined,
  scale: number,
): GlyphArchetype {
  if (kind !== 'ship') return kind

  const byClass = CLASS_ARCHETYPES[(shipClass ?? '').toLowerCase().trim()]
  if (byClass) return byClass

  switch ((category ?? '').toLowerCase().trim()) {
    case 'combat':
      return scale >= 4 ? 'capital' : scale >= 3 ? 'warship' : 'fighter'
    case 'combat support':
    case 'support':
    case 'multirole':
      return 'support'
    case 'industrial':
      return 'miner'
    case 'commercial':
    case 'civilian':
      return 'hauler'
    case 'exploration':
    case 'covert':
      return 'scout'
    default:
      return 'scout'
  }
}

/**
 * Trace the hull outline for an archetype (beginPath … closePath). The caller
 * fills/strokes. `seed` feeds the creature blob's deterministic lumpiness.
 */
export function traceGlyphPath(
  ctx: CanvasRenderingContext2D,
  archetype: GlyphArchetype,
  size: number,
  seed: number,
): void {
  ctx.beginPath()
  switch (archetype) {
    case 'drone':
      ctx.moveTo(size, 0)
      ctx.lineTo(-size * 0.8, size * 0.7)
      ctx.lineTo(-size * 0.4, 0)
      ctx.lineTo(-size * 0.8, -size * 0.7)
      break
    case 'creature':
      // Organic: lumpy blob.
      for (let a = 0; a <= 12; a++) {
        const t = (a / 12) * Math.PI * 2
        const r = size * (0.75 + 0.25 * Math.sin(t * 3 + seed))
        const px = Math.cos(t) * r
        const py = Math.sin(t) * r
        if (a === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      break
    case 'fighter':
      // Sharp fighter: nose, swept wings, notched tail.
      ctx.moveTo(size * 1.25, 0)
      ctx.lineTo(-size * 0.35, size * 0.5)
      ctx.lineTo(-size * 0.95, size * 0.95)
      ctx.lineTo(-size * 0.6, size * 0.18)
      ctx.lineTo(-size * 0.6, -size * 0.18)
      ctx.lineTo(-size * 0.95, -size * 0.95)
      ctx.lineTo(-size * 0.35, -size * 0.5)
      break
    case 'warship':
      // Angular gunship: long prow, weapon sponsons, notched stern.
      ctx.moveTo(size * 1.3, 0)
      ctx.lineTo(size * 0.35, size * 0.42)
      ctx.lineTo(-size * 0.25, size * 0.7)
      ctx.lineTo(-size * 0.75, size * 0.55)
      ctx.lineTo(-size * 1.0, size * 0.3)
      ctx.lineTo(-size * 0.7, 0)
      ctx.lineTo(-size * 1.0, -size * 0.3)
      ctx.lineTo(-size * 0.75, -size * 0.55)
      ctx.lineTo(-size * 0.25, -size * 0.7)
      ctx.lineTo(size * 0.35, -size * 0.42)
      break
    case 'capital':
      // Long slab battleship: wedge prow, parallel flanks, stepped stern.
      ctx.moveTo(size * 1.35, 0)
      ctx.lineTo(size * 0.7, size * 0.35)
      ctx.lineTo(size * 0.55, size * 0.42)
      ctx.lineTo(-size * 0.85, size * 0.42)
      ctx.lineTo(-size * 1.05, size * 0.28)
      ctx.lineTo(-size * 1.05, -size * 0.28)
      ctx.lineTo(-size * 0.85, -size * 0.42)
      ctx.lineTo(size * 0.55, -size * 0.42)
      ctx.lineTo(size * 0.7, -size * 0.35)
      break
    case 'carrier':
      // Flight-deck box: blunt bow, squared stern.
      ctx.moveTo(size * 1.0, size * 0.35)
      ctx.lineTo(size * 1.0, -size * 0.35)
      ctx.lineTo(size * 0.6, -size * 0.55)
      ctx.lineTo(-size * 1.0, -size * 0.55)
      ctx.lineTo(-size * 1.0, size * 0.55)
      ctx.lineTo(size * 0.6, size * 0.55)
      break
    case 'hauler':
      // Boxy hauler hull.
      ctx.moveTo(size * 1.0, size * 0.32)
      ctx.lineTo(size * 1.0, -size * 0.32)
      ctx.lineTo(size * 0.35, -size * 0.62)
      ctx.lineTo(-size * 0.95, -size * 0.62)
      ctx.lineTo(-size * 0.95, size * 0.62)
      ctx.lineTo(size * 0.35, size * 0.62)
      break
    case 'miner':
      // Box hull with forward mandible prongs and a gap between the jaws.
      ctx.moveTo(-size * 0.9, size * 0.55)
      ctx.lineTo(size * 0.3, size * 0.55)
      ctx.lineTo(size * 1.2, size * 0.3)
      ctx.lineTo(size * 0.85, size * 0.12)
      ctx.lineTo(size * 0.3, size * 0.18)
      ctx.lineTo(size * 0.3, -size * 0.18)
      ctx.lineTo(size * 0.85, -size * 0.12)
      ctx.lineTo(size * 1.2, -size * 0.3)
      ctx.lineTo(size * 0.3, -size * 0.55)
      ctx.lineTo(-size * 0.9, -size * 0.55)
      break
    case 'scout':
      // Sleek slim teardrop.
      ctx.moveTo(size * 1.25, 0)
      ctx.quadraticCurveTo(size * 0.1, size * 0.55, -size * 0.9, size * 0.35)
      ctx.lineTo(-size * 0.65, 0)
      ctx.lineTo(-size * 0.9, -size * 0.35)
      ctx.quadraticCurveTo(size * 0.1, -size * 0.55, size * 1.25, 0)
      break
    case 'support':
      // Hexagonal utility pod.
      ctx.moveTo(size * 1.0, 0)
      ctx.lineTo(size * 0.4, size * 0.6)
      ctx.lineTo(-size * 0.75, size * 0.6)
      ctx.lineTo(-size * 1.0, 0)
      ctx.lineTo(-size * 0.75, -size * 0.6)
      ctx.lineTo(size * 0.4, -size * 0.6)
      break
  }
  ctx.closePath()
}

/**
 * Accent strokes drawn over the filled hull (non-ghost only): spines, deck
 * slots, container seams, sensor masts. Kept subtle — same palette as the
 * hull outline.
 */
export function strokeGlyphDetail(
  ctx: CanvasRenderingContext2D,
  archetype: GlyphArchetype,
  size: number,
): void {
  ctx.strokeStyle = 'rgba(232,244,248,0.5)'
  ctx.lineWidth = 0.8
  switch (archetype) {
    case 'warship':
      // Dorsal centerline.
      ctx.beginPath()
      ctx.moveTo(size * 0.9, 0)
      ctx.lineTo(-size * 0.7, 0)
      ctx.stroke()
      break
    case 'capital':
      // Dorsal spine plus turret pips.
      ctx.beginPath()
      ctx.moveTo(size * 0.9, 0)
      ctx.lineTo(-size * 0.8, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(size * 0.35, 0, size * 0.12, 0, Math.PI * 2)
      ctx.arc(-size * 0.35, 0, size * 0.12, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(232,244,248,0.5)'
      ctx.fill()
      break
    case 'carrier':
      // Inset launch-bay slot.
      ctx.strokeRect(-size * 0.6, -size * 0.12, size * 1.4, size * 0.24)
      break
    case 'hauler':
      // Container seams (skipped when the glyph is too small to read them).
      if (size >= 10) {
        ctx.beginPath()
        ctx.moveTo(-size * 0.15, -size * 0.62)
        ctx.lineTo(-size * 0.15, size * 0.62)
        ctx.moveTo(-size * 0.55, -size * 0.62)
        ctx.lineTo(-size * 0.55, size * 0.62)
        ctx.stroke()
      }
      break
    case 'support':
      // Perpendicular sensor mast.
      ctx.beginPath()
      ctx.moveTo(-size * 0.3, -size * 0.85)
      ctx.lineTo(-size * 0.3, size * 0.85)
      ctx.stroke()
      break
    default:
      break
  }
}
