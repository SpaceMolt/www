import { describe, expect, test } from 'bun:test'
import {
  TICK_MS,
  TickClock,
  driftPosition,
  transitArrived,
  transitProgress,
} from './transitMotion'

describe('TickClock', () => {
  test('locks onto the earliest observation of each tick and ignores later, stale ones', () => {
    const clock = new TickClock()
    // Tick 100 begins at t=0 but the first report of it lands 6s late.
    clock.observe(100, 6_000)
    expect(clock.estimate(6_000)).toBeCloseTo(100)
    // A feed event reports tick 101 promptly at t=10.2s: the phase corrects.
    clock.observe(101, 10_200)
    expect(clock.estimate(10_200)).toBeCloseTo(101)
    expect(clock.estimate(15_200)).toBeCloseTo(101.5)
    // A cached poll response repeats tick 100 at t=20s; it never moves the clock back.
    clock.observe(100, 20_000)
    expect(clock.estimate(20_200)).toBeCloseTo(102)
  })

  test('has no estimate before the first observation', () => {
    const clock = new TickClock()
    expect(clock.estimate(1_000)).toBeNull()
    expect(clock.now(1_000)).toBeNull()
  })

  test('slews the drawn tick toward a corrected estimate instead of jumping', () => {
    const clock = new TickClock()
    clock.observe(100, 8_000) // late by 8s
    expect(clock.now(8_000)).toBeCloseTo(100)
    clock.observe(101, 10_000) // prompt: the estimate jumps ahead by 0.8 tick
    const drawn = clock.now(10_016)
    expect(drawn).toBeGreaterThan(100)
    expect(drawn).toBeLessThan(100.5)
    expect(clock.estimate(10_016)).toBeCloseTo(101.0016)

    // The drawn clock never runs backwards and never faster than double speed.
    let previous = drawn!
    for (let ms = 10_032; ms <= 70_000; ms += 16) {
      const next = clock.now(ms)!
      expect(next).toBeGreaterThanOrEqual(previous)
      expect(next - previous).toBeLessThanOrEqual((2 * 16) / TICK_MS + 1e-9)
      previous = next
    }
    // ...and converges on the estimate.
    expect(previous).toBeCloseTo(clock.estimate(70_000)!, 2)
  })

  test('snaps after a long gap rather than catching up for minutes', () => {
    const clock = new TickClock()
    clock.observe(100, 0)
    clock.now(0)
    clock.observe(200, 1_000_000)
    expect(clock.now(1_000_000)).toBeCloseTo(200)
  })

  test('re-locks on a new phase once observations from before a restart age out', () => {
    const clock = new TickClock()
    clock.observe(100, 0)
    // After a restart tick 200 begins 5s later in the cycle than the old phase implied.
    clock.observe(200, 1_005_000)
    expect(clock.estimate(1_005_000)).toBeCloseTo(200)
  })
})

describe('transit progress', () => {
  test('clamps to the flight and never completes a void drift', () => {
    expect(transitProgress(100, 110, 95)).toBe(0)
    expect(transitProgress(100, 110, 102.5)).toBe(0.25)
    expect(transitProgress(100, 110, 130)).toBe(1)
    expect(transitProgress(100, 0, 500)).toBe(0)
    expect(transitArrived(110, 109.9)).toBe(false)
    expect(transitArrived(110, 110)).toBe(true)
    expect(transitArrived(0, 1e9)).toBe(false)
  })
})

describe('driftPosition', () => {
  const leg = { origin_x: 100, origin_y: -50, bearing: 90, speed: 10 }

  test('moves along the bearing at speed per tick from the leg origin', () => {
    expect(driftPosition(leg, 200, 0, 200)).toEqual({ x: 100, y: -50 })
    const later = driftPosition(leg, 200, 0, 212.5)
    expect(later.x).toBeCloseTo(100)
    expect(later.y).toBeCloseTo(75)
  })

  test('stops at the destination once the arrival tick has passed', () => {
    const landed = driftPosition(leg, 200, 210, 260)
    expect(landed.y).toBeCloseTo(50)
  })
})
