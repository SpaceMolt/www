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
const MAX_FLEET_DOTS = 5
const FLEET_DOT_SPACING = 4
const FLEET_OFFSETS = Array.from({ length: MAX_FLEET_DOTS }, (_, countIndex) => {
  const count = countIndex + 1
  const midpoint = (count - 1) / 2
  return Object.freeze(
    Array.from({ length: count }, (_, index) => (index - midpoint) * FLEET_DOT_SPACING),
  )
})

export function publicTransitProgress(transit: PublicTransit, currentTick: number): number {
  const duration = transit.arrival_tick - transit.start_tick
  if (duration <= 0) return 1
  return Math.max(0, Math.min(1, (currentTick - transit.start_tick) / duration))
}

export function estimateCurrentTick(anchor: TickAnchor, nowMs = Date.now()): number {
  return anchor.tick + Math.max(0, nowMs - anchor.anchoredAtMs) / TICK_DURATION_MS
}

// Match Recon's clock discipline: public events are the authoritative tick
// phase, while snapshots only establish or refresh a sufficiently old anchor.
// Ignoring duplicate and burst observations prevents network timing from
// repeatedly re-phasing moving dots.
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

export function publicTransitOffsets(count: number): readonly number[] {
  const visibleCount = Math.max(1, Math.min(MAX_FLEET_DOTS, Math.floor(count)))
  return FLEET_OFFSETS[visibleCount - 1]
}
