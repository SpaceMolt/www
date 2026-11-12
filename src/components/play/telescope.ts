import { bearingTo } from './pathfinder'
import type { Point } from './panels/systemMapMath'

/**
 * Telescope sightings, read the way a player's own agent reads them. A sighting is a bearing, a
 * temperature and a brightness: no name and no distance. The client matches it to the map with
 * what the pilot knows (map positions, star classes seen or in faction intel) and textbook
 * astronomy. It holds no server table.
 */
export const TELESCOPES = ['stellar_telescope', 'seam_glass_telescope']

export interface Sighting { bearing: number; temperature: number; brightness: number }
/** The sightings from one position on the galaxy map. */
export interface Observation extends Point { sightings: Sighting[] }
/** Sun classes by system id, for the systems the pilot knows. */
export type StarClasses = Record<string, string[]>
interface MapStar extends Point { id: string; name: string }

const isSighting = (s: unknown): s is Sighting =>
  ['bearing', 'temperature', 'brightness'].every((key) => typeof (s as Record<string, unknown> | null)?.[key] === 'number')
/** get_location carries star_sightings, but the lib has no type for the field yet. */
export const parseSightings = (location: unknown): Sighting[] => {
  const raw = (location as { star_sightings?: unknown } | null)?.star_sightings
  return Array.isArray(raw) ? raw.filter(isSighting) : []
}

/** Red, orange, yellow, white, blue: the color of a star at this temperature. */
export const starColor = (temperature: number) =>
  temperature < 3700 ? '#ff6b5a' : temperature < 5200 ? '#ffa64d' : temperature < 6000 ? '#ffe066' : temperature < 10000 ? '#f4f6ff' : '#8fb8ff'

// Harvard spectral classes, in kelvin. Other classes (remnants, exotics) get no temperature check.
const CLASS_RANGE: Record<string, [number, number]> = {
  O: [30000, 60000], B: [10000, 30000], A: [7500, 10000], F: [6000, 7500], G: [5200, 6000], K: [3700, 5200], M: [2400, 3700],
}
const classRange = (starClass: string) => CLASS_RANGE[/^([OBAFGKM])\d/.exec(starClass)?.[1] ?? '']

/** How coarse the telescope reads, from the readings: a value that is always a multiple of `coarse` has that step. */
const stepOf = (values: number[], coarse: number, fine: number) => (values.every((v) => v % coarse === 0) ? coarse : fine)

const canBe = (starClass: string, temperature: number, slack: number) => {
  const range = classRange(starClass)
  // ponytail: 10% slack on the textbook range, because a game star need not sit inside it.
  return !range || (temperature >= range[0] * 0.9 - slack && temperature <= range[1] * 1.1 + slack)
}

/**
 * The known systems each sighting can be. A system is a candidate when it lies on
 * the bearing and none of its known suns rules the temperature out. An empty list is a star that
 * is not on the map.
 */
export function matchSightings<S extends MapStar>({ x, y, sightings }: Observation, systems: readonly S[], classes: StarClasses = {}): S[][] {
  const bearingSlack = stepOf(sightings.map((s) => s.bearing), 5, 1) / 2
  const tempSlack = stepOf(sightings.map((s) => s.temperature), 1000, 100) / 2
  const away = systems
    .filter((sys) => sys.x !== x || sys.y !== y)
    .map((sys) => ({ sys, bearing: bearingTo({ x, y }, sys) }))
  return sightings.map((s) => away
    .filter(({ sys, bearing }) => {
      const off = Math.abs(bearing - s.bearing)
      const suns = classes[sys.id]
      return Math.min(off, 360 - off) <= bearingSlack + 1e-9 && (!suns?.length || suns.some((c) => canBe(c, s.temperature, tempSlack)))
    })
    .map(({ sys }) => sys))
}

/** Line strength from 0 (faintest in the list) to 1 (brightest). */
function strengths(sightings: Sighting[]): number[] {
  const values = sightings.map((s) => s.brightness)
  const [low, high] = [Math.min(...values), Math.max(...values)]
  return values.map((v) => (high > low ? (v - low) / (high - low) : 1))
}

/** A sighting ready to draw: where it ends, and what it can be. */
export interface StarRay<S extends MapStar = MapStar> extends Sighting {
  from: Point
  color: string
  strength: number
  /** The one system this star can be. */
  match?: S
  candidates: S[]
  pinned: boolean
}

export const starRays = <S extends MapStar>(observation: Observation, systems: readonly S[], classes: StarClasses, pinned: boolean): StarRay<S>[] => {
  const matches = matchSightings(observation, systems, classes)
  const strength = strengths(observation.sightings)
  return observation.sightings.map((s, i) => ({
    ...s, from: { x: observation.x, y: observation.y }, color: starColor(s.temperature), strength: strength[i],
    match: matches[i].length === 1 ? matches[i][0] : undefined, candidates: matches[i], pinned,
  }))
}

export const rayLabel = (ray: StarRay) =>
  `${ray.temperature} K · ${ray.match ? ray.match.name.toUpperCase() : ray.candidates.length ? `${ray.candidates.length} CANDIDATES` : 'UNKNOWN STAR'}`

export interface TelescopeControl {
  on: boolean
  onToggle: () => void
  /** Live rays first, then pinned rays. */
  rays: StarRay[]
  /** True when the live rays are from a position that is not pinned yet. */
  canPin: boolean
  pins: number
  onPin: () => void
  onClearPins: () => void
}
