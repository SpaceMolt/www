import { describe, expect, it } from 'bun:test'
import { fleetMotionSpacing, sampleMotionProgress, sampleShipMotion, type ShipMotionOptions } from './motion'
import type { CinemaShip } from './types'

const ship = (over: Partial<CinemaShip> = {}): CinemaShip => ({ id: 'ship', playerId: 'pilot', name: 'Pilot',
  shipClass: 'vanguard', kind: 'player', sideId: 1, sideIndex: 0, start: 0, end: 90, fate: 'survived', health: [], ...over })
const options: ShipMotionOptions = { size: 36, angle: 0, lane: 0, sideCount: 1, spacing: 90, depth: 130, seed: 7187 }
const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

describe('cinema ship choreography', () => {
  it('travels substantially even when the record holds one zone, with a bow facing its travel', () => {
    const actor = ship({ motion: [{ time: 0, position: 1 }, { time: 90, position: 1 }] })
    const early = sampleShipMotion(actor, 5, options)
    const late = sampleShipMotion(actor, 35, options)
    expect(distance(early, late)).toBeGreaterThan(options.size * 1.5)
    const before = sampleShipMotion(actor, 20, options)
    const after = sampleShipMotion(actor, 20.01, options)
    const dot = (after.x - before.x) * Math.cos(before.yaw) - (after.z - before.z) * Math.sin(before.yaw)
    expect(dot).toBeGreaterThan(0)
    expect(before.thrust).toBeGreaterThan(0)
    expect(before.retroThrust).toBe(0)
  })

  it('reconstructs the same path on backward seeks and independent calls', () => {
    const actor = ship()
    const first = sampleShipMotion(actor, 27.3, options)
    for (const time of [80, 0, 55, 3, 27.3]) sampleShipMotion(actor, time, options)
    expect(sampleShipMotion(actor, 27.3, options)).toEqual(first)
    expect(sampleShipMotion(actor, 27.3, { ...options, seed: options.seed + 500 })).not.toEqual(first)
  })

  it('gives small craft stronger banking and faster travel relative to hull length', () => {
    const actor = ship()
    const small = { ...options, size: 20 }
    const large = { ...options, size: 260 }
    const smallDistance = distance(sampleShipMotion(actor, 10, small), sampleShipMotion(actor, 30, small)) / small.size
    const largeDistance = distance(sampleShipMotion(actor, 10, large), sampleShipMotion(actor, 30, large)) / large.size
    expect(smallDistance).toBeGreaterThan(largeDistance * 2)
    expect(Math.abs(sampleShipMotion(actor, 12, small).bank)).toBeGreaterThan(Math.abs(sampleShipMotion(actor, 12, large).bank) * 3)
  })

  it('smoothly interpolates recorded zone approach and holds historical records without motion frames', () => {
    const advancing = ship({ motion: [{ time: 0, position: 0 }, { time: 10, position: 0 }, { time: 20, position: 1 }, { time: 40, position: 1 }] })
    expect(sampleMotionProgress(advancing, -1)).toBe(0)
    expect(sampleMotionProgress(advancing, 10)).toBe(0)
    expect(sampleMotionProgress(advancing, 15)).toBeCloseTo(0.5)
    expect(sampleMotionProgress(advancing, 99)).toBe(1)
    expect(sampleMotionProgress(ship(), 10)).toBe(1)
    const outer = sampleShipMotion(ship({ motion: [{ time: 0, position: 0 }] }), 25, options)
    const inner = sampleShipMotion(ship({ motion: [{ time: 0, position: 1 }] }), 25, options)
    expect(Math.hypot(outer.x, outer.z) - Math.hypot(inner.x, inner.z)).toBeGreaterThan(60)
  })

  it('retains separated formation columns and rows through opposing zone changes', () => {
    const layout = { ...options, sideCount: 14 }
    for (let time = 0; time <= 100; time += 2) {
      const frame = Array.from({ length: 14 }, (_, lane) => sampleShipMotion(ship({
        motion: [{ time: 0, position: lane < 7 ? 0 : 1 }, { time: 100, position: lane < 7 ? 1 : 0 }],
      }), time, { ...layout, lane, seed: lane * 779 + 17 }))
      for (let a = 0; a < frame.length; a++) {
        for (let b = a + 1; b < frame.length; b++) expect(distance(frame[a], frame[b])).toBeGreaterThan(70)
      }
    }
  })

  it('keeps opposing formations on separated paths during the shared naval sweep', () => {
    for (let time = 0; time <= 180; time += 5) {
      const left = sampleShipMotion(ship(), time, { ...options, size: 250, angle: 0 })
      const right = sampleShipMotion(ship({ sideIndex: 1, sideId: 2 }), time, { ...options, size: 250, angle: Math.PI })
      expect(distance(left, right)).toBeGreaterThan(500)
    }
  })

  it('reserves full hull turning clearance for narrow capital ships instead of only beam width', () => {
    const fleet = [{ size: 260, beam: 0.24 }, { size: 260, beam: 0.24 }]
    const settings = { ...options, size: 260, sideCount: 2, depth: 380, spacing: fleetMotionSpacing(fleet) }
    for (let time = 0; time <= 100; time += 2) {
      const a = sampleShipMotion(ship(), time, { ...settings, lane: 0 })
      const b = sampleShipMotion(ship(), time, { ...settings, lane: 1 })
      expect(distance(a, b)).toBeGreaterThan(260 * 1.1)
    }
  })

  it('maintains turning clearance in mixed-size fleet columns', () => {
    const fleet = [{ size: 20, beam: 0.8 }, { size: 400, beam: 0.24 }, { size: 90, beam: 0.4 }, { size: 250, beam: 0.3 }]
    const settings = { ...options, sideCount: fleet.length, depth: 555, spacing: fleetMotionSpacing(fleet) }
    for (let time = 0; time <= 100; time += 5) {
      const actors = fleet.map((hull, lane) => sampleShipMotion(ship(), time, { ...settings, size: hull.size, lane, seed: lane * 119 + 31 }))
      for (let a = 0; a < actors.length; a++) for (let b = a + 1; b < actors.length; b++) {
        expect(distance(actors[a], actors[b])).toBeGreaterThan((fleet[a].size + fleet[b].size) * 0.55)
      }
    }
  })

  it('keeps moving capital ships clear of a stationary station throughout their sweep', () => {
    const settings = { ...options, size: 400, sideCount: 2, spacing: 520, depth: 555 }
    const station = sampleShipMotion(ship({ kind: 'station' }), 0, { ...settings, lane: 1 })
    for (let time = 0; time <= 180; time += 0.5) {
      const mobile = sampleShipMotion(ship(), time, { ...settings, lane: 0 })
      expect(distance(station, mobile)).toBeGreaterThan(440)
    }
  })

  it('closes the gap between fleets even with constant zones, creating parallax under a tracking camera', () => {
    const left = ship()
    const right = ship({ sideIndex: 1, sideId: 2 })
    const separation = (time: number) => distance(sampleShipMotion(left, time, { ...options, size: 260 }),
      sampleShipMotion(right, time, { ...options, size: 260, angle: Math.PI }))
    expect(separation(5) - separation(50)).toBeGreaterThan(200)
  })

  it('continues position and velocity through fate, cuts engines, and rolls disabled hulls', () => {
    for (const fate of ['knocked_out', 'destroyed', 'captured'] as const) {
      const actor = ship({ fate, end: 20 })
      const before = sampleShipMotion(actor, 19.999, options)
      const at = sampleShipMotion(actor, 20, options)
      const after = sampleShipMotion(actor, 20.001, options)
      expect(distance(before, at)).toBeLessThan(0.1)
      expect(distance(at, after)).toBeLessThan(0.1)
      expect(distance(before, at)).toBeCloseTo(distance(at, after), 4)
      expect(at.thrust).toBe(0)
      expect(at.retroThrust).toBe(0)
      expect(sampleShipMotion(actor, 25, options).retroThrust).toBe(0)
      expect(sampleShipMotion(actor, 25, options).thrust).toBe(0)
      if (fate !== 'captured') expect(Math.abs(sampleShipMotion(actor, 30, options).bank - at.bank)).toBeGreaterThan(0.3)
    }
  })

  it('accelerates departures continuously without extinguishing escape engines', () => {
    const actor = ship({ fate: 'escaped', end: 20 })
    const at = sampleShipMotion(actor, 20, options)
    const first = sampleShipMotion(actor, 20.001, options)
    const second = sampleShipMotion(actor, 21, options)
    const third = sampleShipMotion(actor, 22, options)
    expect(distance(at, first)).toBeLessThan(0.1)
    expect(distance(second, third)).toBeGreaterThan(distance(at, second) * 2)
    expect(third.thrust).toBeGreaterThan(1)
    for (const frame of [at, first, second, third]) expect(frame.retroThrust).toBe(0)
  })

  it('leaves stations fixed regardless of zone updates, time, or fate', () => {
    const station = ship({ kind: 'station', fate: 'destroyed', end: 10, motion: [{ time: 0, position: 0 }, { time: 8, position: 1 }] })
    const position = sampleShipMotion(station, 0, options)
    expect(position.thrust).toBe(0)
    expect(position.retroThrust).toBe(0)
    for (const time of [4, 10, 20, 90]) expect(sampleShipMotion(station, time, options)).toEqual(position)
  })

  it('backs out under an in-combat retreat while keeping its bow toward the engagement', () => {
    const actor = ship({ motion: [{ time: 0, position: 1, stance: 'defensive' }, { time: 10, position: 1, stance: 'defensive' }, { time: 20, position: 0, stance: 'defensive' }] })
    const before = sampleShipMotion(actor, 14.99, options)
    const frame = sampleShipMotion(actor, 15, options)
    const after = sampleShipMotion(actor, 15.01, options)
    const forward = { x: Math.cos(frame.yaw), z: -Math.sin(frame.yaw) }
    expect(forward.x * -frame.x + forward.z * -frame.z).toBeGreaterThan(Math.hypot(frame.x, frame.z) * .95)
    expect((after.x - before.x) * forward.x + (after.z - before.z) * forward.z).toBeLessThan(0)
    expect(frame.thrust).toBeLessThan(.4)
    expect(frame.retroThrust).toBeGreaterThan(.1)
    expect(frame.retroThrust).toBeLessThanOrEqual(1)
  })

  it('turns outward only after the recorded flee stance and restores combat facing when it ends', () => {
    const actor = ship({ motion: [{ time: 0, position: 1, stance: 'aggressive' }, { time: 10, position: 1, stance: 'flee' }, { time: 20, position: 0, stance: 'flee' }, { time: 30, position: 0, stance: 'aggressive' }] })
    for (const [time, outward] of [[9.9, false], [15, true], [35, false]] as const) {
      const frame = sampleShipMotion(actor, time, options)
      const dot = Math.cos(frame.yaw) * frame.x - Math.sin(frame.yaw) * frame.z
      expect(outward ? dot : -dot).toBeGreaterThan(Math.hypot(frame.x, frame.z) * .9)
      if (outward) { expect(frame.thrust).toBeGreaterThan(1); expect(frame.retroThrust).toBe(0) }
    }
    // A future flee frame must not rotate a currently fighting ship early.
    expect(sampleShipMotion(actor, 9.99, options).yaw).toBeCloseTo(sampleShipMotion(ship({ motion: [{ time: 0, position: 1 }] }), 9.99, options).yaw, 5)
  })

  it('spreads a 343-ship fleet across a balanced volume instead of a seven-column depth stack', () => {
    const layout = { ...options, sideCount: 343 }
    const frames = Array.from({ length: 343 }, (_, lane) => sampleShipMotion(ship(), 0, { ...layout, lane }))
    const span = (axis: 'x' | 'y' | 'z') => Math.max(...frames.map(frame => frame[axis])) - Math.min(...frames.map(frame => frame[axis]))
    expect(span('x') / span('z')).toBeLessThan(2)
    expect(span('z') / span('x')).toBeLessThan(2)
    expect(span('y')).toBeGreaterThan(options.spacing * 2)
  })
})
