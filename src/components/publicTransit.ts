import {
  TICK_MS,
  driftDirection,
  driftPosition,
  transitArrived,
  transitProgress,
  type DriftLeg,
  type WorldPoint,
} from '@/lib/transitMotion'

export interface PublicTransit {
  from_system: string
  /** Empty for a pathfinder drift with no system on its heading. */
  to_system: string
  start_tick: number
  /** 0 when the flight never lands on its own (a drift into the void). */
  arrival_tick: number
  count: number
  /** Present for a pathfinder drift; the ship flies this leg, not the from→to line. */
  pathfinder?: DriftLeg
}

export interface DisplayedPublicTransit extends PublicTransit {
  key: string
  /** When this flight first appeared on the map; anchors the fade-in. */
  shownSinceMs: number
  /** When a fresh snapshot stopped listing it; anchors the fade-out. Null while listed. */
  missingSinceMs: number | null
}

export interface PublicTransitPresentation {
  displayed: DisplayedPublicTransit[]
  latestSnapshotTick: number
}

const TRANSIT_FADE_IN_MS = 1_000
const TRANSIT_FADE_OUT_MS = 1_500
const MAX_TRANSIT_DURATION_TICKS = 3_600
/**
 * How close, in galactic units, a redirected drift's origin must be to where an
 * earlier leg had the ship at that tick to count as the same ship steering.
 * The server derives one from the other with the same formula, so this only
 * absorbs floating-point noise.
 */
const DRIFT_CONTINUATION_EPSILON = 0.5
export interface TransitFormationPoint {
  forward: number
  side: number
}

export interface TransitFormation {
  totalCount: number
  visibleCount: number
  overflowCount: number
  columns: number
  rows: number
  rankCounts: number[]
}

export const FLEET_DOT_SPACING = 7
// Normal fleets top out around 25 ships. This ceiling still shows unusually
// large synchronized movements in full while bounding malformed API input.
export const MAX_TRANSIT_FORMATION_DOTS = 1_024

interface TransitFormationLayout {
  columns: number
  rows: number
  rankCounts: number[]
}

const transitFormationLayouts = new Map<number, TransitFormationLayout>()

function publicTransitKey(transit: PublicTransit): string {
  const leg = transit.pathfinder
  return [
    transit.from_system,
    transit.to_system,
    transit.start_tick,
    transit.arrival_tick,
    leg ? [leg.origin_x, leg.origin_y, leg.bearing, leg.speed].join(',') : '',
  ].join('\u0000')
}

export interface PublicTransitPose extends WorldPoint {
  /** Unit direction of travel in world space. */
  dirX: number
  dirY: number
}

/**
 * Where a flight is at the server tick `tickNow`, in world coordinates. A
 * lane jump interpolates between its systems; a pathfinder drift flies its
 * leg. Null when a lane jump's endpoints are unknown.
 */
export function publicTransitPose(
  transit: PublicTransit,
  tickNow: number,
  systemPosition: (systemId: string) => WorldPoint | undefined,
): PublicTransitPose | null {
  if (transit.pathfinder) {
    const at = driftPosition(transit.pathfinder, transit.start_tick, transit.arrival_tick, tickNow)
    const dir = driftDirection(transit.pathfinder)
    return { x: at.x, y: at.y, dirX: dir.x, dirY: dir.y }
  }
  const from = systemPosition(transit.from_system)
  const to = systemPosition(transit.to_system)
  if (!from || !to) return null
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return null
  const progress = transitProgress(transit.start_tick, transit.arrival_tick, tickNow)
  return {
    x: from.x + dx * progress,
    y: from.y + dy * progress,
    dirX: dx / length,
    dirY: dy / length,
  }
}

/**
 * Opacity of a displayed flight: fades in when first seen, fades out just
 * before landing, and fades out where it is when a snapshot drops it early
 * (the pilot cloaked, logged off, or died).
 */
export function displayedPublicTransitOpacity(
  transit: DisplayedPublicTransit,
  nowMs: number,
  tickNow: number,
): number {
  let opacity = Math.min(1, Math.max(0, nowMs - transit.shownSinceMs) / TRANSIT_FADE_IN_MS)
  if (transit.arrival_tick > 0) {
    const remainingMs = (transit.arrival_tick - tickNow) * TICK_MS
    opacity = Math.min(opacity, Math.max(0, remainingMs / TRANSIT_FADE_OUT_MS))
  }
  if (transit.missingSinceMs !== null) {
    const goneMs = Math.max(0, nowMs - transit.missingSinceMs)
    opacity = Math.min(opacity, Math.max(0, 1 - goneMs / TRANSIT_FADE_OUT_MS))
  }
  return opacity
}

function validPublicTransit(transit: PublicTransit): boolean {
  if (
    !Number.isFinite(transit.start_tick)
    || !Number.isFinite(transit.arrival_tick)
    || !Number.isFinite(transit.count)
    || transit.count <= 0
  ) return false
  if (transit.arrival_tick === 0) return transit.pathfinder !== undefined
  const duration = transit.arrival_tick - transit.start_tick
  return duration > 0 && duration <= MAX_TRANSIT_DURATION_TICKS
}

/**
 * True when `next` is the same drifting ship as `previous` after a mid-flight
 * redirect: the new leg starts exactly where the old leg had the ship at the
 * new leg's start tick.
 */
function continuesDrift(previous: DisplayedPublicTransit, next: PublicTransit): boolean {
  if (!previous.pathfinder || !next.pathfinder) return false
  if (next.start_tick < previous.start_tick) return false
  const at = driftPosition(previous.pathfinder, previous.start_tick, previous.arrival_tick, next.start_tick)
  return Math.hypot(at.x - next.pathfinder.origin_x, at.y - next.pathfinder.origin_y) <= DRIFT_CONTINUATION_EPSILON
}

/**
 * Reconciles a polled snapshot with what the map is showing. Flights are
 * positioned from the server tick, so a flight first seen mid-route fades in
 * where it really is, a flight the snapshot drops fades out where it is, and
 * a drift that was redirected keeps its dot and simply turns. Responses older
 * than one already applied are ignored.
 */
export function reconcilePublicTransitPresentation(
  previous: PublicTransitPresentation,
  snapshot: PublicTransit[],
  nowMs: number,
  tickNow: number,
  snapshotTick?: number,
): PublicTransitPresentation {
  const hasTick = Number.isFinite(snapshotTick) && snapshotTick! > 0
  if (hasTick && snapshotTick! < previous.latestSnapshotTick) return previous
  const latestSnapshotTick = hasTick
    ? Math.max(previous.latestSnapshotTick, snapshotTick!)
    : previous.latestSnapshotTick

  const listed = new Map<string, PublicTransit>()
  for (const transit of snapshot) {
    if (!validPublicTransit(transit)) continue
    if (transitArrived(transit.arrival_tick, tickNow)) continue
    const key = publicTransitKey(transit)
    const existing = listed.get(key)
    listed.set(key, { ...transit, count: Math.floor(transit.count) + (existing?.count ?? 0) })
  }

  const displayed: DisplayedPublicTransit[] = []
  for (const transit of previous.displayed) {
    if (transitArrived(transit.arrival_tick, tickNow)) continue
    if (transit.missingSinceMs !== null && nowMs - transit.missingSinceMs >= TRANSIT_FADE_OUT_MS) continue
    const fresh = listed.get(transit.key)
    if (fresh) {
      listed.delete(transit.key)
      displayed.push({ ...transit, count: fresh.count, missingSinceMs: null })
      continue
    }
    displayed.push({ ...transit, missingSinceMs: transit.missingSinceMs ?? nowMs })
  }

  for (const [key, transit] of listed) {
    const steered = displayed.findIndex(
      (shown) => shown.missingSinceMs !== null && continuesDrift(shown, transit),
    )
    if (steered >= 0) {
      displayed[steered] = { ...transit, key, shownSinceMs: displayed[steered].shownSinceMs, missingSinceMs: null }
      continue
    }
    displayed.push({ ...transit, key, shownSinceMs: nowMs, missingSinceMs: null })
  }

  return { displayed, latestSnapshotTick }
}

export function publicTransitFormation(count: number): TransitFormation {
  const totalCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1
  const visibleCount = Math.min(totalCount, MAX_TRANSIT_FORMATION_DOTS)
  let layout = transitFormationLayouts.get(visibleCount)
  if (!layout) {
    layout = buildTransitFormationLayout(visibleCount)
    transitFormationLayouts.set(visibleCount, layout)
  }

  return {
    totalCount,
    visibleCount,
    overflowCount: totalCount - visibleCount,
    ...layout,
  }
}

function buildTransitFormationLayout(visibleCount: number): TransitFormationLayout {
  const rows = Math.ceil(Math.sqrt(visibleCount))
  const capacity = rows * rows
  const rankCounts = Array.from({ length: rows }, (_, rank) =>
    Math.floor((visibleCount * (rank * 2 + 1)) / capacity),
  )

  // Every formation has one leader at its point. Distribute the remaining
  // ships by largest fractional share to preserve the triangular silhouette
  // between the perfect-square 1/3/5/... arrowheads.
  rankCounts[0] = 1
  let remaining = visibleCount - rankCounts.reduce((sum, rankCount) => sum + rankCount, 0)
  const ranksByRemainder = rankCounts
    .map((_, rank) => ({
      rank,
      remainder: (visibleCount * (rank * 2 + 1)) / capacity
        - Math.floor((visibleCount * (rank * 2 + 1)) / capacity),
    }))
    .sort((a, b) => b.remainder - a.remainder || b.rank - a.rank)

  while (remaining > 0) {
    for (const { rank } of ranksByRemainder) {
      if (remaining === 0) break
      if (rankCounts[rank] >= rank * 2 + 1) continue
      rankCounts[rank]++
      remaining--
    }
  }
  const columns = Math.max(...rankCounts)

  return { columns, rows, rankCounts }
}

export function forEachPublicTransitFormationPoint(
  formation: TransitFormation,
  visit: (point: TransitFormationPoint) => void,
): void {
  for (let rank = 0; rank < formation.rows; rank++) {
    const rankCount = formation.rankCounts[rank]
    for (let column = 0; column < rankCount; column++) {
      visit({
        forward: ((formation.rows - 1) / 2 - rank) * FLEET_DOT_SPACING,
        side: (column - (rankCount - 1) / 2) * FLEET_DOT_SPACING,
      })
    }
  }
}
