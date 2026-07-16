export interface PublicTransit {
  from_system: string
  to_system: string
  start_tick: number
  arrival_tick: number
  count: number
}

export interface DisplayedPublicTransit extends PublicTransit {
  displayStartedAtMs: number
}

export interface PublicTransitPresentation {
  displayed: DisplayedPublicTransit[]
  retiredKeys: Map<string, number>
  latestSnapshotTick: number
}

const TICK_DURATION_MS = 10_000
const TRANSIT_FADE_IN_MS = 1_000
const TRANSIT_FADE_OUT_MS = 1_500
const RETIRED_TRANSIT_TTL_MS = 120_000
const MAX_TRANSIT_DURATION_TICKS = 3_600
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
  return [
    transit.from_system,
    transit.to_system,
    transit.start_tick,
    transit.arrival_tick,
  ].join('\u0000')
}

function displayedPublicTransitDurationMs(transit: DisplayedPublicTransit): number {
  return Math.max(0, transit.arrival_tick - transit.start_tick) * TICK_DURATION_MS
}

/**
 * Progresses a transit on a local presentation timeline. A newly discovered
 * trip therefore departs from its origin instead of popping into the middle
 * of the route when a polling response happens to arrive late.
 */
export function displayedPublicTransitProgress(
  transit: DisplayedPublicTransit,
  nowMs = Date.now(),
): number {
  const durationMs = displayedPublicTransitDurationMs(transit)
  if (durationMs <= 0) return 1
  return Math.max(0, Math.min(1, (nowMs - transit.displayStartedAtMs) / durationMs))
}

export function displayedPublicTransitOpacity(
  transit: DisplayedPublicTransit,
  nowMs = Date.now(),
): number {
  const elapsedMs = Math.max(0, nowMs - transit.displayStartedAtMs)
  const remainingMs = Math.max(0, displayedPublicTransitDurationMs(transit) - elapsedMs)
  return Math.max(
    0,
    Math.min(1, elapsedMs / TRANSIT_FADE_IN_MS, remainingMs / TRANSIT_FADE_OUT_MS),
  )
}

/**
 * Reconciles polling snapshots with the map's local animation lifecycle.
 * Missing trips remain visible until their local arrival, while completed
 * keys remain briefly retired so delayed snapshots cannot restart them.
 */
export function reconcilePublicTransitPresentation(
  previous: PublicTransitPresentation,
  snapshot: PublicTransit[],
  nowMs = Date.now(),
  snapshotTick?: number,
): PublicTransitPresentation {
  const retiredKeys = new Map(
    [...previous.retiredKeys].filter(([, expiresAtMs]) => expiresAtMs > nowMs),
  )
  const latestSnapshotTick = Number.isFinite(snapshotTick) && snapshotTick! > 0
    ? Math.max(previous.latestSnapshotTick, snapshotTick!)
    : previous.latestSnapshotTick
  const isStaleSnapshot = Number.isFinite(snapshotTick)
    && snapshotTick! > 0
    && snapshotTick! < previous.latestSnapshotTick
  const snapshotByKey = new Map<string, PublicTransit>()
  if (!isStaleSnapshot) {
    for (const transit of snapshot) {
      const duration = transit.arrival_tick - transit.start_tick
      if (
        !Number.isFinite(transit.start_tick)
        || !Number.isFinite(transit.arrival_tick)
        || !Number.isFinite(transit.count)
        || duration <= 0
        || duration > MAX_TRANSIT_DURATION_TICKS
        || transit.count <= 0
      ) continue

      const key = publicTransitKey(transit)
      const existing = snapshotByKey.get(key)
      snapshotByKey.set(key, {
        ...transit,
        count: Math.floor(transit.count) + (existing?.count ?? 0),
      })
    }
  }

  const displayed: DisplayedPublicTransit[] = []
  const activeCountByKey = new Map<string, number>()

  for (const transit of previous.displayed) {
    const key = publicTransitKey(transit)
    if (displayedPublicTransitProgress(transit, nowMs) >= 1) {
      retiredKeys.set(key, nowMs + RETIRED_TRANSIT_TTL_MS)
      continue
    }
    displayed.push(transit)
    activeCountByKey.set(key, (activeCountByKey.get(key) ?? 0) + transit.count)
  }

  for (const [key, transit] of snapshotByKey) {
    if (retiredKeys.has(key)) continue
    const additionalCount = transit.count - (activeCountByKey.get(key) ?? 0)
    if (additionalCount <= 0) continue
    displayed.push({ ...transit, count: additionalCount, displayStartedAtMs: nowMs })
  }

  return {
    displayed,
    retiredKeys,
    latestSnapshotTick,
  }
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
