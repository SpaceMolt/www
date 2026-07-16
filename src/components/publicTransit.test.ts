import { describe, expect, test } from 'bun:test'
import {
  displayedPublicTransitOpacity,
  displayedPublicTransitProgress,
  forEachPublicTransitFormationPoint,
  MAX_TRANSIT_FORMATION_DOTS,
  publicTransitFormation,
  reconcilePublicTransitPresentation,
  type PublicTransit,
  type PublicTransitPresentation,
} from './publicTransit'

const transit: PublicTransit = {
  from_system: 'alpha',
  to_system: 'beta',
  start_tick: 100,
  arrival_tick: 110,
  count: 1,
}

describe('public transit presentation lifecycle', () => {
  const emptyPresentation: PublicTransitPresentation = {
    displayed: [],
    retiredKeys: new Map(),
    latestSnapshotTick: 0,
  }

  test('starts newly observed traffic at its origin and preserves that local timeline', () => {
    const first = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000)
    expect(first.displayed).toHaveLength(1)
    expect(displayedPublicTransitProgress(first.displayed[0], 1_000)).toBe(0)
    expect(displayedPublicTransitProgress(first.displayed[0], 26_000)).toBe(0.25)

    const refreshed = reconcilePublicTransitPresentation(first, [transit], 16_000)
    expect(refreshed.displayed[0].displayStartedAtMs).toBe(1_000)
    expect(displayedPublicTransitProgress(refreshed.displayed[0], 26_000)).toBe(0.25)
  })

  test('keeps missing traffic moving until local arrival instead of popping out', () => {
    const first = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000)
    const missing = reconcilePublicTransitPresentation(first, [], 16_000)
    expect(missing.displayed).toHaveLength(1)
    expect(displayedPublicTransitProgress(missing.displayed[0], 26_000)).toBe(0.25)

    const arrived = reconcilePublicTransitPresentation(missing, [], 101_000)
    expect(arrived.displayed).toHaveLength(0)
  })

  test('does not restart a completed trip while a stale snapshot still contains it', () => {
    const shortTransit = { ...transit, arrival_tick: 101 }
    const first = reconcilePublicTransitPresentation(emptyPresentation, [shortTransit], 1_000)
    const stale = reconcilePublicTransitPresentation(first, [shortTransit], 11_000)
    expect(stale.displayed).toHaveLength(0)
    expect(stale.retiredKeys.size).toBe(1)

    const repeatedStale = reconcilePublicTransitPresentation(stale, [shortTransit], 16_000)
    expect(repeatedStale.displayed).toHaveLength(0)

    const omitted = reconcilePublicTransitPresentation(repeatedStale, [], 20_000)
    const reappeared = reconcilePublicTransitPresentation(omitted, [shortTransit], 25_000)
    expect(reappeared.displayed).toHaveLength(0)
  })

  test('ignores older responses and starts added ships as a new departure cohort', () => {
    const first = reconcilePublicTransitPresentation(
      emptyPresentation,
      [{ ...transit, count: 25 }],
      1_000,
      200,
    )
    const refreshed = reconcilePublicTransitPresentation(
      first,
      [{ ...transit, count: 26 }],
      16_000,
      201,
    )
    expect(refreshed.displayed.map(({ count }) => count)).toEqual([25, 1])
    expect(refreshed.displayed[0].displayStartedAtMs).toBe(1_000)
    expect(displayedPublicTransitProgress(refreshed.displayed[1], 16_000)).toBe(0)

    const repeated = reconcilePublicTransitPresentation(
      refreshed,
      [{ ...transit, count: 26 }],
      17_000,
      202,
    )
    expect(repeated.displayed.map(({ count }) => count)).toEqual([25, 1])

    const reduced = reconcilePublicTransitPresentation(
      repeated,
      [{ ...transit, count: 10 }],
      18_000,
      203,
    )
    expect(reduced.displayed.map(({ count }) => count)).toEqual([25, 1])

    const staleOtherTransit = { ...transit, start_tick: 200, arrival_tick: 205 }
    const stale = reconcilePublicTransitPresentation(reduced, [staleOtherTransit], 19_000, 199)
    expect(stale.displayed).toHaveLength(2)
    expect(stale.latestSnapshotTick).toBe(203)
  })

  test('rejects malformed or non-positive transit durations', () => {
    const malformed = [
      { ...transit, start_tick: Number.NaN },
      { ...transit, arrival_tick: Number.POSITIVE_INFINITY },
      { ...transit, arrival_tick: transit.start_tick },
      { ...transit, arrival_tick: transit.start_tick - 1 },
    ]
    expect(
      reconcilePublicTransitPresentation(emptyPresentation, malformed, 1_000).displayed,
    ).toHaveLength(0)
  })

  test('fades traffic in at departure and out at arrival', () => {
    const first = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000)
    const displayed = first.displayed[0]
    expect(displayedPublicTransitOpacity(displayed, 1_000)).toBe(0)
    expect(displayedPublicTransitOpacity(displayed, 2_000)).toBe(1)
    expect(displayedPublicTransitOpacity(displayed, 100_500)).toBeCloseTo(1 / 3)
  })
})

describe('publicTransitFormation', () => {
  test('lays legitimate fleet sizes out in forward-pointing arrowheads', () => {
    const single = publicTransitFormation(1)
    const singlePoints: Array<{ forward: number; side: number }> = []
    forEachPublicTransitFormationPoint(single, (point) => singlePoints.push(point))
    expect(singlePoints).toEqual([{ forward: 0, side: 0 }])

    const four = publicTransitFormation(4)
    const fourPoints: Array<{ forward: number; side: number }> = []
    forEachPublicTransitFormationPoint(four, (point) => fourPoints.push(point))
    expect(fourPoints).toEqual([
      { forward: 3.5, side: 0 },
      { forward: -3.5, side: -7 },
      { forward: -3.5, side: 0 },
      { forward: -3.5, side: 7 },
    ])

    const standardFleet = publicTransitFormation(25)
    expect(standardFleet).toEqual({
      totalCount: 25,
      visibleCount: 25,
      overflowCount: 0,
      columns: 9,
      rows: 5,
      rankCounts: [1, 3, 5, 7, 9],
    })
  })

  test('centers incomplete ranks while preserving a pointed nose', () => {
    const points: Array<{ forward: number; side: number }> = []
    forEachPublicTransitFormationPoint(publicTransitFormation(5), (point) => points.push(point))
    expect(points).toEqual([
      { forward: 7, side: 0 },
      { forward: 0, side: 0 },
      { forward: -7, side: -7 },
      { forward: -7, side: 0 },
      { forward: -7, side: 7 },
    ])
  })

  test('keeps every normal fleet centered with a unique forward nose', () => {
    for (let count = 1; count <= 25; count++) {
      const points: Array<{ forward: number; side: number }> = []
      forEachPublicTransitFormationPoint(publicTransitFormation(count), (point) => {
        points.push(point)
      })

      expect(points).toHaveLength(count)
      expect(new Set(points.map(({ forward, side }) => `${forward}:${side}`)).size).toBe(count)
      const nose = Math.max(...points.map(({ forward }) => forward))
      expect(points.filter(({ forward }) => forward === nose)).toEqual([{ forward: nose, side: 0 }])
      for (const { forward, side } of points) {
        expect(points).toContainEqual({ forward, side: side === 0 ? 0 : -side })
      }
    }
  })

  test('bounds malformed counts while preserving the exact overflow', () => {
    const formation = publicTransitFormation(1_000_000_000)
    expect(formation).toEqual({
      totalCount: 1_000_000_000,
      visibleCount: MAX_TRANSIT_FORMATION_DOTS,
      overflowCount: 1_000_000_000 - MAX_TRANSIT_FORMATION_DOTS,
      columns: 63,
      rows: 32,
      rankCounts: Array.from({ length: 32 }, (_, rank) => rank * 2 + 1),
    })
  })
})
