import type { SavedRoute } from '@/components/intel/useIntelData'
import { formatSecs, type Point } from './panels/systemMapMath'

/**
 * Pathfinder Drive math. The numbers mirror the gameserver (internal/game/engine.go:
 * pathfinderSpeed, pathfinderLandingMargin). A bearing is in degrees:
 * 0 points along +X and 90 along +Y, the same axes both maps draw.
 */
export const PATHFINDER_DRIVE = 'pathfinder_drive'
/** GU per tick. */
export const PATHFINDER_SPEED = 10
/** A drift drops out at the first system that the heading passes within this many GU. */
export const PATHFINDER_MARGIN = 100

interface PlotSystem extends Point { id: string; name: string }

const RAD = Math.PI / 180
export const bearingTo = (from: Point, to: Point) => (Math.atan2(to.y - from.y, to.x - from.x) / RAD + 360) % 360
export const reverseBearing = (bearing: number) => (bearing + 180) % 360
/** The bearing as the jump command takes it: one decimal, in [0, 360). */
export const bearingArg = (bearing: number) => ((Math.round(bearing * 10) / 10) % 360).toFixed(1)
export const alongBearing = (from: Point, bearing: number, distance: number): Point =>
  ({ x: from.x + Math.cos(bearing * RAD) * distance, y: from.y + Math.sin(bearing * RAD) * distance })

/**
 * Where a drift on this bearing drops out, among the systems the pilot knows: the nearest system
 * ahead whose closest approach is inside the landing margin. Null when the heading meets none.
 * The server does the same cast over every system, so an uncharted system can catch the ship first.
 */
export function dropOut<S extends PlotSystem>(systems: S[], from: Point, bearing: number, excludeId = ''): { system: S; distance: number; ticks: number } | null {
  const [dx, dy] = [Math.cos(bearing * RAD), Math.sin(bearing * RAD)]
  return systems.reduce<{ system: S; distance: number; ticks: number } | null>((best, system) => {
    const [rx, ry] = [system.x - from.x, system.y - from.y]
    const distance = rx * dx + ry * dy
    const isOnCourse = system.id !== excludeId && distance > 0 && Math.abs(rx * dy - ry * dx) <= PATHFINDER_MARGIN
    return isOnCourse && distance < (best?.distance ?? Infinity)
      ? { system, distance, ticks: Math.max(1, Math.ceil(distance / PATHFINDER_SPEED)) }
      : best
  }, null)
}

/** Touch has no hover: the first tap aims the plot line, a second tap on the same spot launches. */
export const isSameAim = (a: Point | null, b: Point) => a !== null && Math.hypot(a.x - b.x, a.y - b.y) < 30

/** The drive as the maps and the drift banner use it. Absent when the ship has no drive fitted. */
export interface DriveControl {
  plotting: boolean
  onToggle: () => void
  onLaunch: (bearing: number) => void
}

/** The chip beside the plot line: the bearing, then the predicted drop-out. */
export const plotLabel = (bearing: number, hit: ReturnType<typeof dropOut>, tickSecs: number) =>
  `${bearingArg(bearing)}° · ${hit ? `${hit.system.name.toUpperCase()} · ${hit.ticks} ticks · ${formatSecs(hit.ticks * tickSecs)}` : 'OPEN SPACE'}`

type Drift = Point & { bearing: number }

/**
 * The own drift for the galaxy map trail, kept in the store the recon map uses: leg origins,
 * then the drop-out system as `to`. The location sends no waypoints, so a report on a new
 * bearing starts a new leg where it is. An empty origin means a reload mid-drift.
 * ponytail: a report is up to one tick late, so a bend can be up to 10 GU off.
 */
export function trackTrail(
  trail: SavedRoute | null,
  last: Drift | null,
  drift: Drift | null,
  here: { player: string; origin: string; originPoint?: Point; systemId: string },
  now: number,
): SavedRoute | null {
  if (drift) {
    const at = { x: drift.x, y: drift.y }
    if (last && trail) return drift.bearing === last.bearing ? trail : { ...trail, points: [...trail.points, at], seen: now }
    if (!here.origin && trail && !trail.to && isOnLeg(trail.points[trail.points.length - 1], drift)) return trail
    return { player: here.player, from: here.origin, to: '', points: [here.originPoint ?? at], seen: now }
  }
  if (!trail || !here.systemId) return trail
  if (trail.to) return trail.to === here.systemId ? trail : null
  return last ? { ...trail, to: here.systemId } : trail
}

/** A saved leg origin is this drift's own when the ship is on the ray from it, within two ticks of drift. */
function isOnLeg(from: Point, drift: Drift) {
  const [dx, dy] = [Math.cos(drift.bearing * RAD), Math.sin(drift.bearing * RAD)]
  const [rx, ry] = [drift.x - from.x, drift.y - from.y]
  return rx * dx + ry * dy >= 0 && Math.abs(rx * dy - ry * dx) <= 2 * PATHFINDER_SPEED
}
