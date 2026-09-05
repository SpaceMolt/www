// Shared motion model for ships in flight on the public galaxy map and the recon
// map. Both maps draw a ship from the same three server facts: the tick it left,
// the tick it lands, and (for a pathfinder drift) the leg it is flying. What
// they need locally is a good estimate of the server's tick right now, which
// is what TickClock provides.

/** Engine tick rate: a fixed 10s. */
export const TICK_MS = 10_000

/**
 * Observations older than this stop anchoring the clock. A server restart
 * changes the tick phase, and a bounded window lets the clock re-lock on the
 * new phase instead of trusting a sample from before the restart forever.
 */
const SAMPLE_WINDOW_MS = 5 * 60_000

/**
 * A drawn clock this far from the estimate snaps instead of slewing. That only
 * happens after the tab was hidden for minutes or the server restarted, where
 * a smooth catch-up would take longer than the wait already did.
 */
const SNAP_TICKS = 30

/**
 * Estimates the server's fractional tick from tick numbers seen on responses
 * and feed events.
 *
 * Every observation is late: a tick is stamped when it begins, and the report
 * reaches us some time after — network latency, a cached poll response, or a
 * quiet feed that emitted nothing for most of the tick. None is ever early. So
 * the earliest observation per tick bounds when that tick began, and the
 * earliest across recent ticks is the best estimate of the phase. Taking the
 * minimum means a stale cached poll can never pull the clock backwards, which
 * is what used to make every ship on the map shift on each refresh.
 *
 * `now()` is what the maps draw from. It follows the estimate but moves at
 * between 0x and 2x real time, so a corrected estimate slides a ship into
 * place instead of teleporting it.
 */
export class TickClock {
  private earliestMsByTick = new Map<number, number>()
  private shownTick: number | null = null
  private shownAtMs = 0

  /** Records that the server reported `tick` current at wall-clock `nowMs`. */
  observe(tick: number, nowMs = Date.now()): void {
    if (!Number.isFinite(tick) || tick <= 0) return
    const earliest = this.earliestMsByTick.get(tick)
    if (earliest === undefined || nowMs < earliest) this.earliestMsByTick.set(tick, nowMs)
    for (const [seenTick, seenMs] of this.earliestMsByTick) {
      if (nowMs - seenMs > SAMPLE_WINDOW_MS) this.earliestMsByTick.delete(seenTick)
    }
  }

  /** Best estimate of the server's fractional tick at `nowMs`; null before any observation. */
  estimate(nowMs = Date.now()): number | null {
    let epochMs = Infinity
    for (const [tick, ms] of this.earliestMsByTick) {
      epochMs = Math.min(epochMs, ms - tick * TICK_MS)
    }
    if (epochMs === Infinity) return null
    return (nowMs - epochMs) / TICK_MS
  }

  /** The tick to draw at `nowMs`: the estimate, approached smoothly. */
  now(nowMs = Date.now()): number | null {
    const target = this.estimate(nowMs)
    if (target === null) return null
    if (this.shownTick === null || Math.abs(target - this.shownTick) > SNAP_TICKS) {
      this.shownTick = target
      this.shownAtMs = nowMs
      return target
    }
    const step = Math.max(0, nowMs - this.shownAtMs) / TICK_MS
    const error = target - (this.shownTick + step)
    // Close the gap over about one tick of wall-clock, never running backwards
    // or faster than double speed.
    const advance = Math.min(2 * step, Math.max(0, step + error * Math.min(1, step)))
    this.shownTick += advance
    this.shownAtMs = nowMs
    return this.shownTick
  }
}

/** One leg of a pathfinder drift, as both map APIs serve it. */
export interface DriftLeg {
  origin_x: number
  origin_y: number
  bearing: number
  speed: number
}

export interface WorldPoint {
  x: number
  y: number
}

/**
 * How far along a flight is at `tickNow`, 0..1. Clamped at both ends: a flight
 * whose arrival tick has passed but which the next poll has not yet cleared
 * would otherwise overshoot its destination. An `arrivalTick` of 0 means the
 * flight never lands on its own (a drift into the void) and reads as 0.
 */
export function transitProgress(startTick: number, arrivalTick: number, tickNow: number): number {
  const span = arrivalTick - startTick
  if (arrivalTick <= 0 || !Number.isFinite(span) || span <= 0) return 0
  return Math.min(1, Math.max(0, (tickNow - startTick) / span))
}

/** True once the flight has landed at `tickNow`. A void drift never has. */
export function transitArrived(arrivalTick: number, tickNow: number): boolean {
  return arrivalTick > 0 && tickNow >= arrivalTick
}

/**
 * Where a drifting ship is at `tickNow`, mirroring the server's own formula:
 * the leg origin plus speed × ticks elapsed along the bearing (0 = +X, 90 = +Y).
 * The position stops at the arrival tick when the drift has a destination.
 */
export function driftPosition(
  leg: DriftLeg,
  startTick: number,
  arrivalTick: number,
  tickNow: number,
): WorldPoint {
  let elapsed = Math.max(0, tickNow - startTick)
  if (arrivalTick > 0) elapsed = Math.min(elapsed, Math.max(0, arrivalTick - startTick))
  const rad = (leg.bearing * Math.PI) / 180
  return {
    x: leg.origin_x + Math.cos(rad) * leg.speed * elapsed,
    y: leg.origin_y + Math.sin(rad) * leg.speed * elapsed,
  }
}

/** Unit direction of a drift leg in world space. */
export function driftDirection(leg: DriftLeg): WorldPoint {
  const rad = (leg.bearing * Math.PI) / 180
  return { x: Math.cos(rad), y: Math.sin(rad) }
}
