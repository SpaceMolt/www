import { expect, test } from 'bun:test'
import { buildProgressPct } from './commissionProgress'

test('progress comes from the build window, not a fixed tick scale', () => {
  // 200-tick build, 100 ticks in: half done, even though 100 ticks remain.
  expect(buildProgressPct({ build_start_tick: 1000, build_complete_tick: 1200, ticks_remaining: 100 }, 1100)).toBe(50)
})

test('a stale current tick falls back to the server ticks_remaining', () => {
  expect(buildProgressPct({ build_start_tick: 1000, build_complete_tick: 1200, ticks_remaining: 50 }, 0)).toBe(75)
})

test('progress is clamped to 0..100', () => {
  expect(buildProgressPct({ build_start_tick: 1000, build_complete_tick: 1200 }, 5000)).toBe(100)
  expect(buildProgressPct({ build_start_tick: 1000, build_complete_tick: 1200, ticks_remaining: 300 }, 900)).toBe(0)
})

test('a missing build window shows no progress', () => {
  expect(buildProgressPct({ ticks_remaining: 10 }, 1100)).toBe(0)
})
