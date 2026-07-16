export interface PublicTransit {
  from_system: string
  to_system: string
  start_tick: number
  arrival_tick: number
  count: number
}

export interface TickAnchor {
  tick: number
  anchoredAtMs: number
}

const TICK_DURATION_MS = 10_000
const TICK_OBSERVE_MIN_INTERVAL_MS = 2_000
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

export function publicTransitProgress(transit: PublicTransit, currentTick: number): number {
  const duration = transit.arrival_tick - transit.start_tick
  if (duration <= 0) return 1
  return Math.max(0, Math.min(1, (currentTick - transit.start_tick) / duration))
}

export function estimateCurrentTick(anchor: TickAnchor, nowMs = Date.now()): number {
  return anchor.tick + Math.max(0, nowMs - anchor.anchoredAtMs) / TICK_DURATION_MS
}

// Real-time public events are the authoritative tick-phase signal. Ignoring
// duplicate and burst observations prevents network timing from repeatedly
// re-phasing moving dots.
export function observeServerTick(
  anchor: TickAnchor | null,
  tick: number,
  nowMs = Date.now(),
): TickAnchor | null {
  if (!Number.isFinite(tick) || tick <= 0) return anchor
  if (anchor && tick <= anchor.tick) return anchor
  if (anchor && nowMs - anchor.anchoredAtMs < TICK_OBSERVE_MIN_INTERVAL_MS) return anchor
  return { tick, anchoredAtMs: nowMs }
}

// Activity snapshots arrive on their own polling cadence, so their response
// time is not a reliable tick boundary. The public map uses one only to
// bootstrap the clock, then preserves the phase learned from real-time events.
export function observeSnapshotTick(
  anchor: TickAnchor | null,
  tick: number,
  nowMs = Date.now(),
): TickAnchor | null {
  if (anchor) return anchor
  if (!Number.isFinite(tick) || tick <= 0) return anchor
  return { tick, anchoredAtMs: nowMs }
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
