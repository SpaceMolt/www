import { describe, expect, test } from 'bun:test'
import {
  estimateCurrentTick,
  observeSnapshotTick,
  observeServerTick,
  publicTransitProgress,
  publicTransitOffsets,
  type PublicTransit,
} from './publicTransit'

const transit: PublicTransit = {
  from_system: 'alpha',
  to_system: 'beta',
  start_tick: 100,
  arrival_tick: 110,
  count: 1,
}

describe('publicTransitProgress', () => {
  test('clamps progress before, during, and after a jump', () => {
    expect(publicTransitProgress(transit, 95)).toBe(0)
    expect(publicTransitProgress(transit, 105)).toBe(0.5)
    expect(publicTransitProgress(transit, 115)).toBe(1)
  })

  test('treats invalid durations as complete', () => {
    expect(publicTransitProgress({ ...transit, arrival_tick: 100 }, 100)).toBe(1)
  })
})

describe('estimateCurrentTick', () => {
  test('advances the server tick anchor using the ten-second tick rate', () => {
    expect(estimateCurrentTick({ tick: 200, anchoredAtMs: 1_000 }, 16_000)).toBe(201.5)
  })

  test('uses fresh SSE ticks as phase anchors without moving backward', () => {
    const initial = observeServerTick(null, 200, 1_000)
    expect(initial).toEqual({ tick: 200, anchoredAtMs: 1_000 })
    expect(observeServerTick(initial, 199, 12_000)).toBe(initial)
    expect(observeServerTick(initial, 201, 12_000)).toEqual({
      tick: 201,
      anchoredAtMs: 12_000,
    })
  })

  test('ignores burst events so network timing cannot constantly re-phase the clock', () => {
    const initial = { tick: 200, anchoredAtMs: 1_000 }
    expect(observeServerTick(initial, 201, 2_000)).toBe(initial)
  })

  test('keeps snapshot refreshes from re-phasing an event-driven clock', () => {
    const bootstrap = observeSnapshotTick(null, 200, 1_000)
    expect(bootstrap).toEqual({ tick: 200, anchoredAtMs: 1_000 })
    expect(estimateCurrentTick(bootstrap!, 16_000)).toBe(201.5)

    const afterPoll = observeSnapshotTick(bootstrap, 202, 16_000)
    expect(afterPoll).toBe(bootstrap)
    expect(estimateCurrentTick(afterPoll!, 16_000)).toBe(201.5)

    const eventAnchor = observeServerTick(afterPoll, 203, 21_000)
    expect(eventAnchor).toEqual({ tick: 203, anchoredAtMs: 21_000 })
    expect(observeSnapshotTick(eventAnchor, 204, 31_000)).toBe(eventAnchor)
  })
})

describe('publicTransitOffsets', () => {
  test('fans fleets symmetrically and caps visual density', () => {
    expect(publicTransitOffsets(1)).toEqual([0])
    expect(publicTransitOffsets(4)).toEqual([-6, -2, 2, 6])
    expect(publicTransitOffsets(100)).toEqual([-8, -4, 0, 4, 8])
  })
})
