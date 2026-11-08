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
  | 'bug'
  | 'lobster'
  | 'whale'
  | 'jelly'
  | 'ray'
  | 'eel'
  | 'station'

/**
 * Nose extent of each archetype (units of size), for attaching the muzzle cue.
 * A station has no nose — it is radially symmetric and never rotated — so its
 * entry is the plain core radius and the caller skips the muzzle line for it.
 */
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
  bug: 1.1,
  lobster: 1.3,
  whale: 1.15,
  jelly: 1.0,
  ray: 0.95,
  eel: 0.95,
  station: 1.0,
}

/**
 * Creature name → body plan. Battle logs carry the species display name, not
 * its id, so match on the name. First match wins; anything unmatched (eggs,
 * crystal drifters, corals, urchins) keeps the generic blob.
 */
const CREATURE_BODIES: Array<[RegExp, GlyphArchetype]> = [
  [/\begg\b/, 'creature'],
  [/molt leviathan|rainbow leviathan|crab|coronid/, 'lobster'],
  [/whale|grazer/, 'whale'],
  [/moth|scarab|mantis|vulcanid|fluxipede|relict|borer|browser|bulwark|aeonbear|pilgrim/, 'bug'],
  [/jelly|squid|bubble|bloom|etchmaw|halo|prism|blister|chlorophage/, 'jelly'],
  [/\bray\b|manta|skate|glintfin/, 'ray'],
  [/tempest-eel|wyrm|slug|leech|lurker|skein|snail|sylph/, 'eel'],
]

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
 * the generic scout teardrop for anything unknown. Creatures pick a body plan
 * from their name.
 */
export function archetypeForShip(
  kind: 'ship' | 'drone' | 'creature' | 'station',
  shipClass: string | undefined,
  category: string | undefined,
  scale: number,
  name = '',
): GlyphArchetype {
  if (kind === 'creature') return CREATURE_BODIES.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? 'creature'
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
    case 'bug':
      // Beetle seen from above: round head ahead of an oval shell.
      ctx.ellipse(-size * 0.15, 0, size * 0.85, size * 0.55, 0, 0, Math.PI * 2)
      ctx.moveTo(size * 1.1, 0)
      ctx.arc(size * 0.85, 0, size * 0.25, 0, Math.PI * 2)
      break
    case 'lobster':
      // Carapace and fanned tail, with two crusher claws held out front.
      ctx.moveTo(size * 0.6, 0)
      ctx.quadraticCurveTo(size * 0.55, size * 0.32, size * 0.1, size * 0.32)
      ctx.lineTo(-size * 0.85, size * 0.14)
      ctx.lineTo(-size * 1.15, size * 0.38)
      ctx.lineTo(-size * 1.05, 0)
      ctx.lineTo(-size * 1.15, -size * 0.38)
      ctx.lineTo(-size * 0.85, -size * 0.14)
      ctx.lineTo(size * 0.1, -size * 0.32)
      ctx.quadraticCurveTo(size * 0.55, -size * 0.32, size * 0.6, 0)
      ctx.moveTo(size * 1.3, size * 0.5)
      ctx.ellipse(size * 1.0, size * 0.5, size * 0.3, size * 0.17, 0, 0, Math.PI * 2)
      ctx.moveTo(size * 1.3, -size * 0.5)
      ctx.ellipse(size * 1.0, -size * 0.5, size * 0.3, size * 0.17, 0, 0, Math.PI * 2)
      break
    case 'whale':
      // Blunt head tapering to a notched fluke, with two flippers.
      ctx.moveTo(size * 1.15, 0)
      ctx.bezierCurveTo(size * 1.15, size * 0.45, size * 0.2, size * 0.5, -size * 0.7, size * 0.14)
      ctx.lineTo(-size * 1.1, size * 0.55)
      ctx.lineTo(-size * 0.95, 0)
      ctx.lineTo(-size * 1.1, -size * 0.55)
      ctx.lineTo(-size * 0.7, -size * 0.14)
      ctx.bezierCurveTo(size * 0.2, -size * 0.5, size * 1.15, -size * 0.45, size * 1.15, 0)
      ctx.moveTo(size * 0.35, size * 0.38)
      ctx.lineTo(-size * 0.05, size * 0.8)
      ctx.lineTo(-size * 0.05, size * 0.38)
      ctx.moveTo(size * 0.35, -size * 0.38)
      ctx.lineTo(-size * 0.05, -size * 0.8)
      ctx.lineTo(-size * 0.05, -size * 0.38)
      break
    case 'jelly': {
      // Bell leading, scalloped rim behind it; tentacles are struck on after.
      ctx.arc(size * 0.3, 0, size * 0.7, -Math.PI / 2, Math.PI / 2)
      const lobes = 4
      for (let l = 0; l < lobes; l++) {
        const y0 = size * 0.7 - (l * size * 1.4) / lobes
        const y1 = y0 - (size * 1.4) / lobes
        ctx.quadraticCurveTo(size * 0.05, (y0 + y1) / 2, size * 0.3, y1)
      }
      break
    }
    case 'ray':
      // Manta: horned head, broad swept wings; the whip tail is struck on after.
      ctx.moveTo(size * 0.95, size * 0.2)
      ctx.quadraticCurveTo(size * 0.45, size * 0.3, -size * 0.1, size * 1.1)
      ctx.quadraticCurveTo(-size * 0.2, size * 0.4, -size * 0.65, size * 0.12)
      ctx.lineTo(-size * 0.65, -size * 0.12)
      ctx.quadraticCurveTo(-size * 0.2, -size * 0.4, -size * 0.1, -size * 1.1)
      ctx.quadraticCurveTo(size * 0.45, -size * 0.3, size * 0.95, -size * 0.2)
      ctx.lineTo(size * 0.7, 0)
      break
    case 'eel': {
      // S-curved ribbon, thick at the head and tapering to a point.
      const steps = 12
      const at = (i: number) => {
        const x = 0.95 - (i / steps) * 2.3
        return { x: x * size, y: Math.sin(x * 2.6) * size * 0.22, w: size * (0.34 - (i / steps) * 0.3) }
      }
      for (let i = 0; i <= steps; i++) {
        const p = at(i)
        if (i === 0) ctx.moveTo(p.x, p.y + p.w)
        else ctx.lineTo(p.x, p.y + p.w)
      }
      for (let i = steps; i >= 0; i--) {
        const p = at(i)
        ctx.lineTo(p.x, p.y - p.w)
      }
      break
    }
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
    case 'station': {
      // Regular hexagonal keep. Unlike every other glyph this one is symmetric
      // about both axes and is drawn unrotated: a station has no bow, no engines
      // and no facing — it is bolted to the middle of the arena and the fight
      // comes to it. The docking ring and gun blisters are struck on afterwards.
      for (let v = 0; v < 6; v++) {
        const a = (v / 6) * Math.PI * 2
        const px = Math.cos(a) * size
        const py = Math.sin(a) * size
        if (v === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      break
    }
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
    case 'bug':
      // Wing-case seam, three pairs of legs and a pair of feelers.
      ctx.beginPath()
      ctx.moveTo(size * 0.55, 0)
      ctx.lineTo(-size * 1.0, 0)
      for (const lx of [0.35, -0.15, -0.65]) {
        ctx.moveTo(size * lx, size * 0.45)
        ctx.lineTo(size * (lx - 0.2), size * 0.9)
        ctx.moveTo(size * lx, -size * 0.45)
        ctx.lineTo(size * (lx - 0.2), -size * 0.9)
      }
      ctx.moveTo(size * 1.05, size * 0.12)
      ctx.lineTo(size * 1.45, size * 0.4)
      ctx.moveTo(size * 1.05, -size * 0.12)
      ctx.lineTo(size * 1.45, -size * 0.4)
      ctx.stroke()
      break
    case 'lobster':
      // Claw arms, long sweeping antennae and tail segments.
      ctx.beginPath()
      ctx.moveTo(size * 0.45, size * 0.2)
      ctx.lineTo(size * 0.75, size * 0.5)
      ctx.moveTo(size * 0.45, -size * 0.2)
      ctx.lineTo(size * 0.75, -size * 0.5)
      ctx.moveTo(size * 0.6, size * 0.06)
      ctx.quadraticCurveTo(size * 1.3, size * 0.15, size * 1.6, size * 0.9)
      ctx.moveTo(size * 0.6, -size * 0.06)
      ctx.quadraticCurveTo(size * 1.3, -size * 0.15, size * 1.6, -size * 0.9)
      for (const sx of [-0.15, -0.4, -0.65]) {
        ctx.moveTo(size * sx, size * 0.27)
        ctx.lineTo(size * sx, -size * 0.27)
      }
      ctx.stroke()
      break
    case 'whale':
      // Eyes.
      ctx.fillStyle = 'rgba(232,244,248,0.7)'
      ctx.beginPath()
      ctx.arc(size * 0.75, size * 0.25, size * 0.07, 0, Math.PI * 2)
      ctx.arc(size * 0.75, -size * 0.25, size * 0.07, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'jelly':
      // Trailing tentacles.
      ctx.beginPath()
      for (const ty of [-0.5, -0.17, 0.17, 0.5]) {
        ctx.moveTo(size * 0.2, size * ty)
        ctx.bezierCurveTo(-size * 0.3, size * (ty + 0.2), -size * 0.7, size * (ty - 0.2), -size * 1.2, size * ty)
      }
      ctx.stroke()
      break
    case 'ray':
      // Whip tail.
      ctx.beginPath()
      ctx.moveTo(-size * 0.65, 0)
      ctx.lineTo(-size * 1.5, 0)
      ctx.stroke()
      break
    case 'station': {
      // Docking ring on radial spars, and gun blisters that bear on every
      // approach — this is a fortress, and it does not have to turn to shoot you.
      const ring = size * 1.4
      ctx.beginPath()
      ctx.arc(0, 0, ring, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      for (let s = 0; s < 6; s++) {
        const a = ((s + 0.5) / 6) * Math.PI * 2
        ctx.moveTo(Math.cos(a) * size * 0.72, Math.sin(a) * size * 0.72)
        ctx.lineTo(Math.cos(a) * ring, Math.sin(a) * ring)
      }
      ctx.stroke()
      ctx.fillStyle = 'rgba(232,244,248,0.5)'
      for (let g = 0; g < 6; g++) {
        const a = (g / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(Math.cos(a) * ring, Math.sin(a) * ring, size * 0.16, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    default:
      break
  }
}
