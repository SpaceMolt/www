import { describe, expect, test } from 'bun:test'
import {
  estimateCurrentTick,
  forEachPublicTransitFormationPoint,
  MAX_TRANSIT_FORMATION_DOTS,
  observeSnapshotTick,
  observeServerTick,
  publicTransitFormation,
  publicTransitProgress,
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

describe('publicTransitFormation', () => {
  test('lays legitimate fleet sizes out in centered rows and columns', () => {
    const single = publicTransitFormation(1)
    const singlePoints: Array<{ forward: number; side: number }> = []
    forEachPublicTransitFormationPoint(single, (point) => singlePoints.push(point))
    expect(singlePoints).toEqual([{ forward: 0, side: 0 }])

    const four = publicTransitFormation(4)
    const fourPoints: Array<{ forward: number; side: number }> = []
    forEachPublicTransitFormationPoint(four, (point) => fourPoints.push(point))
    expect(fourPoints).toEqual([
      { forward: -3.5, side: -3.5 },
      { forward: 3.5, side: -3.5 },
      { forward: -3.5, side: 3.5 },
      { forward: 3.5, side: 3.5 },
    ])

    const largeFleet = publicTransitFormation(100)
    expect(largeFleet).toEqual({
      totalCount: 100,
      visibleCount: 100,
      overflowCount: 0,
      columns: 10,
      rows: 10,
    })
  })

  test('centers a partial final row', () => {
    const points: Array<{ forward: number; side: number }> = []
    forEachPublicTransitFormationPoint(publicTransitFormation(5), (point) => points.push(point))
    expect(points).toEqual([
      { forward: -7, side: -3.5 },
      { forward: 0, side: -3.5 },
      { forward: 7, side: -3.5 },
      { forward: -3.5, side: 3.5 },
      { forward: 3.5, side: 3.5 },
    ])
  })

  test('bounds malformed counts while preserving the exact overflow', () => {
    const formation = publicTransitFormation(1_000_000_000)
    expect(formation).toEqual({
      totalCount: 1_000_000_000,
      visibleCount: MAX_TRANSIT_FORMATION_DOTS,
      overflowCount: 1_000_000_000 - MAX_TRANSIT_FORMATION_DOTS,
      columns: 32,
      rows: 32,
    })
  })
})
