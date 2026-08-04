import { describe, it, expect } from 'bun:test'
import { estimateTick, MAX_ESTIMATED_TICKS } from './tickEstimate'

const RATE = 10_000

/**
 * The pre-fix behaviour: free-run forever off the last anchor, one tick per
 * nominal tick_rate. Kept here as the thing the regression tests measure
 * against, not as production code.
 */
const naiveEstimate = (anchorTick: number, anchorTimeMs: number, nowMs: number) =>
  anchorTick + Math.floor((nowMs - anchorTimeMs) / RATE)

describe('estimateTick', () => {
  it('tracks the server anchor tick-for-tick inside the extrapolation window', () => {
    const anchor = 1_000
    const t0 = 1_700_000_000_000
    for (let n = 0; n < MAX_ESTIMATED_TICKS; n++) {
      const estimate = estimateTick(anchor, t0, t0 + n * RATE + 1, RATE)
      expect(estimate.tick).toBe(anchor + n)
      expect(estimate.stale).toBe(false)
    }
  })

  it('never runs unboundedly past the last server anchor', () => {
    const anchor = 1_000
    const t0 = 1_700_000_000_000
    // An idle console gets no correction for a full day.
    const aDay = 24 * 60 * 60 * 1000
    for (let elapsed = 0; elapsed <= aDay; elapsed += 60_000) {
      const estimate = estimateTick(anchor, t0, t0 + elapsed, RATE)
      expect(estimate.tick).toBeLessThanOrEqual(anchor + MAX_ESTIMATED_TICKS)
    }
  })

  it('stays within a tick of the real server counter across a long idle session', () => {
    // Production cadence is ~10.16s per tick, not the nominal 10.000s, because
    // the server counts processed ticks rather than wall-clock elapsed.
    const REAL_TICK_MS = 10_160
    const anchor = 1_000
    const t0 = 1_700_000_000_000
    const aDay = 24 * 60 * 60 * 1000

    const serverTickAfter = (elapsed: number) => anchor + Math.floor(elapsed / REAL_TICK_MS)

    // The pre-fix estimate drifts more than a hundred ticks ahead in a day.
    expect(naiveEstimate(anchor, t0, t0 + aDay) - serverTickAfter(aDay)).toBeGreaterThan(100)

    // The anchored estimate never claims a tick the server has not reached by
    // more than the bounded extrapolation window.
    for (let elapsed = 0; elapsed <= aDay; elapsed += 30_000) {
      const { tick } = estimateTick(anchor, t0, t0 + elapsed, RATE)
      const ahead = tick - serverTickAfter(elapsed)
      expect(ahead).toBeLessThanOrEqual(MAX_ESTIMATED_TICKS)
    }
  })

  it('freezes and reports stale once the anchor is too old', () => {
    const anchor = 500
    const t0 = 0
    const past = estimateTick(anchor, t0, t0 + MAX_ESTIMATED_TICKS * RATE, RATE)
    expect(past.stale).toBe(true)
    expect(past.tick).toBe(anchor + MAX_ESTIMATED_TICKS)

    const wayPast = estimateTick(anchor, t0, t0 + 5000 * RATE, RATE)
    expect(wayPast.stale).toBe(true)
    expect(wayPast.tick).toBe(anchor + MAX_ESTIMATED_TICKS)
  })

  it('snaps back to the server number when a fresh anchor arrives', () => {
    const stale = estimateTick(1_000, 0, 5000 * RATE, RATE)
    expect(stale.tick).toBe(1_000 + MAX_ESTIMATED_TICKS)

    // Server says the real tick is lower than the frozen estimate: the anchor
    // wins, even though that moves the badge backwards.
    const resynced = estimateTick(1_012, 5000 * RATE, 5000 * RATE, RATE)
    expect(resynced.tick).toBe(1_012)
    expect(resynced.stale).toBe(false)
  })

  it('reports progress inside the current tick', () => {
    const t0 = 1_000_000
    expect(estimateTick(7, t0, t0, RATE).progress).toBe(0)
    expect(estimateTick(7, t0, t0 + RATE / 2, RATE).progress).toBeCloseTo(0.5, 6)
    expect(estimateTick(7, t0, t0 + RATE * 3.25, RATE).progress).toBeCloseTo(0.25, 6)
    for (let elapsed = 0; elapsed < RATE * 5; elapsed += 137) {
      const { progress } = estimateTick(7, t0, t0 + elapsed, RATE)
      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThan(1)
    }
  })

  it('never rewinds when the local clock jumps backwards', () => {
    const t0 = 1_000_000
    const estimate = estimateTick(42, t0, t0 - 60_000, RATE)
    expect(estimate.tick).toBe(42)
    expect(estimate.progress).toBe(0)
    expect(estimate.stale).toBe(false)
  })

  it('is idle until the server supplies an anchor', () => {
    expect(estimateTick(0, 0, 999_999, RATE)).toEqual({ tick: 0, progress: 0, stale: false })
  })

  it('does not divide by a missing tick rate', () => {
    const estimate = estimateTick(88, 0, 999_999, 0)
    expect(estimate.tick).toBe(88)
    expect(Number.isFinite(estimate.progress)).toBe(true)
  })
})
