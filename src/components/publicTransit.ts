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
}

export const FLEET_DOT_SPACING = 7
// Normal fleets top out around 25 ships. This ceiling still shows unusually
// large synchronized movements in full while bounding malformed API input.
export const MAX_TRANSIT_FORMATION_DOTS = 1_024

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
  const columns = Math.ceil(Math.sqrt(visibleCount))
  const rows = Math.ceil(visibleCount / columns)

  return {
    totalCount,
    visibleCount,
    overflowCount: totalCount - visibleCount,
    columns,
    rows,
  }
}

export function forEachPublicTransitFormationPoint(
  formation: TransitFormation,
  visit: (point: TransitFormationPoint) => void,
): void {
  for (let row = 0; row < formation.rows; row++) {
    const rowCount = Math.min(
      formation.columns,
      formation.visibleCount - row * formation.columns,
    )
    for (let column = 0; column < rowCount; column++) {
      visit({
        forward: (column - (rowCount - 1) / 2) * FLEET_DOT_SPACING,
        side: (row - (formation.rows - 1) / 2) * FLEET_DOT_SPACING,
      })
    }
  }
}
