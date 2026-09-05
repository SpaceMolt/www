import { describe, expect, test } from 'bun:test'
import {
  displayedPublicTransitOpacity,
  forEachPublicTransitFormationPoint,
  MAX_TRANSIT_FORMATION_DOTS,
  publicTransitFormation,
  publicTransitPose,
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

const systems = new Map([
  ['alpha', { x: 0, y: 0 }],
  ['beta', { x: 1000, y: 0 }],
])
const systemPosition = (id: string) => systems.get(id)

describe('public transit presentation lifecycle', () => {
  const emptyPresentation: PublicTransitPresentation = {
    displayed: [],
    latestSnapshotTick: 0,
  }

  test('places a flight from the server tick, so one first seen mid-route appears where it is', () => {
    const first = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000, 105)
    expect(first.displayed).toHaveLength(1)
    expect(publicTransitPose(first.displayed[0], 105, systemPosition)).toEqual({
      x: 500,
      y: 0,
      dirX: 1,
      dirY: 0,
    })
    expect(publicTransitPose(first.displayed[0], 107.5, systemPosition)?.x).toBe(750)
  })

  test('drops a flight that has already landed instead of replaying it from its origin', () => {
    const late = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000, 112)
    expect(late.displayed).toHaveLength(0)

    const first = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000, 105)
    const landed = reconcilePublicTransitPresentation(first, [transit], 16_000, 110)
    expect(landed.displayed).toHaveLength(0)
  })

  test('keeps a flight the snapshot dropped early and fades it out where it is', () => {
    const first = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000, 102)
    const missing = reconcilePublicTransitPresentation(first, [], 16_000, 103.5)
    expect(missing.displayed).toHaveLength(1)
    expect(missing.displayed[0].missingSinceMs).toBe(16_000)
    expect(displayedPublicTransitOpacity(missing.displayed[0], 16_000, 103.5)).toBe(1)
    expect(displayedPublicTransitOpacity(missing.displayed[0], 16_750, 103.575)).toBeCloseTo(0.5)
    expect(displayedPublicTransitOpacity(missing.displayed[0], 17_500, 103.65)).toBe(0)

    const gone = reconcilePublicTransitPresentation(missing, [], 31_000, 105)
    expect(gone.displayed).toHaveLength(0)
  })

  test('relisting a dropped flight cancels its fade-out', () => {
    const first = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000, 102)
    const missing = reconcilePublicTransitPresentation(first, [], 2_000, 102.1)
    const back = reconcilePublicTransitPresentation(missing, [transit], 3_000, 102.2)
    expect(back.displayed).toHaveLength(1)
    expect(back.displayed[0].missingSinceMs).toBeNull()
    expect(back.displayed[0].shownSinceMs).toBe(1_000)
  })

  test('ignores a response older than one already applied', () => {
    const first = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000, 102, 102)
    const stale = reconcilePublicTransitPresentation(first, [], 16_000, 103.5, 101)
    expect(stale).toBe(first)
    expect(stale.displayed[0].missingSinceMs).toBeNull()
  })

  test('updates a cohort\'s count in place rather than spawning a second formation', () => {
    const first = reconcilePublicTransitPresentation(
      emptyPresentation,
      [{ ...transit, count: 25 }],
      1_000,
      102,
      200,
    )
    const refreshed = reconcilePublicTransitPresentation(
      first,
      [{ ...transit, count: 26 }],
      16_000,
      103.5,
      201,
    )
    expect(refreshed.displayed.map(({ count }) => count)).toEqual([26])
    expect(refreshed.displayed[0].shownSinceMs).toBe(1_000)
  })

  test('rejects malformed or non-positive transit durations', () => {
    const malformed = [
      { ...transit, start_tick: Number.NaN },
      { ...transit, arrival_tick: Number.POSITIVE_INFINITY },
      { ...transit, arrival_tick: transit.start_tick },
      { ...transit, arrival_tick: transit.start_tick - 1 },
      // Only a pathfinder drift may never arrive.
      { ...transit, arrival_tick: 0 },
    ]
    expect(
      reconcilePublicTransitPresentation(emptyPresentation, malformed, 1_000, 50).displayed,
    ).toHaveLength(0)
  })

  test('fades traffic in when first shown and out just before it lands', () => {
    const first = reconcilePublicTransitPresentation(emptyPresentation, [transit], 1_000, 105)
    const displayed = first.displayed[0]
    expect(displayedPublicTransitOpacity(displayed, 1_000, 105)).toBe(0)
    expect(displayedPublicTransitOpacity(displayed, 2_000, 105.1)).toBe(1)
    expect(displayedPublicTransitOpacity(displayed, 50_000, 109.95)).toBeCloseTo(1 / 3)
  })

  describe('pathfinder drifts', () => {
    const drift: PublicTransit = {
      from_system: 'alpha',
      to_system: '',
      start_tick: 100,
      arrival_tick: 0,
      count: 1,
      pathfinder: { origin_x: 0, origin_y: 0, bearing: 0, speed: 10 },
    }

    test('flies the leg from its origin instead of a line between systems', () => {
      const first = reconcilePublicTransitPresentation(emptyPresentation, [drift], 1_000, 130)
      expect(first.displayed).toHaveLength(1)
      const pose = publicTransitPose(first.displayed[0], 130, systemPosition)
      expect(pose?.x).toBeCloseTo(300)
      expect(pose?.y).toBeCloseTo(0)
      expect(pose?.dirX).toBeCloseTo(1)
      // A void drift never lands and never fades on arrival.
      expect(displayedPublicTransitOpacity(first.displayed[0], 900_000, 5_000)).toBe(1)
    })

    test('a mid-flight redirect turns the same dot rather than replacing it', () => {
      const first = reconcilePublicTransitPresentation(emptyPresentation, [drift], 1_000, 105)
      // At tick 120 the ship is at (200, 0) and turns to bearing 90 toward beta.
      const redirected: PublicTransit = {
        from_system: 'alpha',
        to_system: 'beta',
        start_tick: 120,
        arrival_tick: 170,
        count: 1,
        pathfinder: { origin_x: 200, origin_y: 0, bearing: 90, speed: 10 },
      }
      const steered = reconcilePublicTransitPresentation(first, [redirected], 16_000, 121)
      expect(steered.displayed).toHaveLength(1)
      expect(steered.displayed[0].shownSinceMs).toBe(1_000)
      expect(steered.displayed[0].missingSinceMs).toBeNull()
      const pose = publicTransitPose(steered.displayed[0], 121, systemPosition)
      expect(pose?.x).toBeCloseTo(200)
      expect(pose?.y).toBeCloseTo(10)
      expect(pose?.dirY).toBeCloseTo(1)
    })

    test('a new drift from elsewhere is a new dot', () => {
      const first = reconcilePublicTransitPresentation(emptyPresentation, [drift], 1_000, 105)
      const other: PublicTransit = {
        ...drift,
        start_tick: 120,
        pathfinder: { origin_x: 500, origin_y: 500, bearing: 45, speed: 10 },
      }
      const both = reconcilePublicTransitPresentation(first, [drift, other], 16_000, 121)
      expect(both.displayed).toHaveLength(2)
      expect(both.displayed[1].shownSinceMs).toBe(16_000)
    })
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
