/**
 * Server-anchored tick estimation for the /play tick badge (dc#276432).
 *
 * The gameserver's tick counter counts ticks it has actually *processed* — it
 * is not a wall-clock derivative. Restarts and slow ticks permanently lose
 * ground against a naive `elapsed / tick_rate` extrapolation, so measured
 * against production a nominal 10s tick really lands around 10.05-10.16s. A
 * free-running clock estimate therefore gains roughly 1% and, because there is
 * no per-tick server push (see `lib/spacemolt/accountStore.ts`), an idle
 * console never gets corrected: the old badge drifted ~120 ticks ahead per idle
 * day and two players comparing tick numbers disagreed with each other and with
 * the server.
 *
 * The fix is to treat every tick-bearing server frame as an anchor and only let
 * the estimate run a bounded distance past it. Past that bound the number
 * freezes and is reported stale so the UI can mark it approximate — showing a
 * visibly stale number beats showing a confidently wrong one.
 */

/**
 * How many ticks the display may extrapolate past a server anchor before it
 * freezes. At the observed ~1.6% worst-case cadence error, 30 ticks (5 minutes
 * at the default 10s rate) accumulates under half a tick of error, so the
 * displayed number is never wrong by a whole tick.
 */
export const MAX_ESTIMATED_TICKS = 30

export interface TickEstimate {
  /** Tick to display. Never more than `MAX_ESTIMATED_TICKS` past the anchor. */
  tick: number
  /** Fraction (0..1) through the current tick, for the progress bar. */
  progress: number
  /** True once the anchor is too old to extrapolate from; `tick` is frozen. */
  stale: boolean
}

const IDLE: TickEstimate = { tick: 0, progress: 0, stale: false }

/**
 * Estimate the current tick from the last server-supplied anchor.
 *
 * @param anchorTick   Tick number the server last reported (0 = none yet).
 * @param anchorTimeMs Local `Date.now()` when that anchor was observed.
 * @param nowMs        Current local `Date.now()`.
 * @param tickRateMs   Nominal tick length in ms, from `welcome.tick_rate`.
 */
export function estimateTick(
  anchorTick: number,
  anchorTimeMs: number,
  nowMs: number,
  tickRateMs: number,
): TickEstimate {
  if (!Number.isFinite(anchorTick) || anchorTick <= 0) return IDLE
  if (!Number.isFinite(tickRateMs) || tickRateMs <= 0) {
    return { tick: anchorTick, progress: 0, stale: false }
  }

  // Clamp: a backwards local clock adjustment must never rewind the badge.
  const elapsedMs = Math.max(0, nowMs - anchorTimeMs)
  const ticksElapsed = Math.floor(elapsedMs / tickRateMs)

  if (ticksElapsed >= MAX_ESTIMATED_TICKS) {
    return { tick: anchorTick + MAX_ESTIMATED_TICKS, progress: 0, stale: true }
  }

  return {
    tick: anchorTick + ticksElapsed,
    progress: (elapsedMs - ticksElapsed * tickRateMs) / tickRateMs,
    stale: false,
  }
}
