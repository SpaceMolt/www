import { expect, test } from 'bun:test'
import { Vector3 } from 'three'
import { boardingVisual } from './boardingVisuals'
import type { CinemaCue } from './types'

const cue: CinemaCue = { id: 'board', kind: 'boarding', time: 2, duration: 1.8, tick: 45,
  from: 'a:0', to: 'b:0', operationId: 'operation', boardingPhase: 'breach', intensity: .5 }
const phases = ['approach', 'breach', 'assault', 'withdraw', 'plunder'] as const
const from = new Vector3(-100, 7, 30), to = new Vector3(260, 18, -20)
const empty = { lines: [], glows: [], rings: [], projectiles: [] }

test('boarding stays inside its lifetime and rejects invalid sampling inputs', () => {
  for (const phase of phases) for (const duration of [.001, .2, 1.8, 60]) {
    const event = { ...cue, duration, boardingPhase: phase }
    for (const age of [-1, duration, duration + .001, NaN, Infinity])
      expect(boardingVisual(event, age, from, to, 80, 120)).toEqual(empty)
  }
  for (const duration of [0, -1, NaN, Infinity])
    expect(boardingVisual({ ...cue, duration }, 0, from, to, 80, 120)).toEqual(empty)
  expect(boardingVisual({ ...cue, kind: 'weapon' }, .5, from, to, 80, 120)).toEqual(empty)
  expect(boardingVisual(cue, .5, new Vector3(NaN, 0, 0), to, 80, 120)).toEqual(empty)
})

test('all boarding phases remain finite, local and bounded for dense playback', () => {
  for (const phase of phases) for (const reduced of [false, true])
    for (const size of [0, 16, 400, 100000, NaN]) for (const age of [0, .001, .4, 1, 1.79999]) {
      const frame = boardingVisual({ ...cue, boardingPhase: phase }, age, from, to, size, size, reduced)
      expect(frame.lines.length).toBeLessThanOrEqual(7)
      expect(frame.glows.length).toBeLessThanOrEqual(2)
      expect(frame.rings.length).toBe(0)
      expect(frame.projectiles).toHaveLength(0)
      for (const line of frame.lines) {
        expect([...line.from.toArray(), ...line.to.toArray(), line.width].every(Number.isFinite)).toBe(true)
        expect(line.width).toBeGreaterThanOrEqual(0)
        expect(line.from.distanceTo(line.to)).toBeLessThanOrEqual(1600)
        expect(line.from.distanceTo(to)).toBeLessThanOrEqual(from.distanceTo(to) + 40)
        expect(line.to.distanceTo(to)).toBeLessThanOrEqual(from.distanceTo(to) + 40)
      }
      for (const light of [...frame.glows, ...frame.rings]) {
        expect([...light.position.toArray(), light.radius, light.opacity].every(Number.isFinite)).toBe(true)
        expect(light.radius).toBeLessThanOrEqual(60)
        expect(light.opacity).toBeGreaterThanOrEqual(0)
        expect(light.opacity).toBeLessThanOrEqual(1)
      }
    }
})

test('closing cannot show a latch or a launched boarding party', () => {
  const frame = boardingVisual({ ...cue, boardingPhase: 'approach' }, .9, from, to, 80, 120)
  expect(frame.lines).toHaveLength(0)
  expect(frame.glows).toHaveLength(0)
  expect(frame.rings).toHaveLength(0)
  expect(frame.projectiles).toHaveLength(0)
})

test('ended operations extinguish contact without implying returning survivors', () => {
  for (const boardingEvent of ['boarding_force_defeated', 'target_destroyed', 'closing_stalled', 'withdrawn', 'plundered']) {
    const event = { ...cue, boardingPhase: 'withdraw' as const, boardingEnded: true, boardingEvent }
    const early = boardingVisual(event, .1, from, to, 80, 120)
    const late = boardingVisual(event, 1.7, from, to, 80, 120)
    expect(early.lines).toHaveLength(0)
    expect(early.projectiles).toHaveLength(0)
    expect(late.glows[0].position).toEqual(early.glows[0].position)
    expect(late.glows[0].opacity).toBeLessThan(early.glows[0].opacity)
  }
})

test('releasing contact retracts locally and never sends a projectile between ships', () => {
  for (const phase of ['withdraw', 'plunder'] as const) {
    const early = boardingVisual({ ...cue, boardingPhase: phase }, .1, from, to, 80, 120)
    const late = boardingVisual({ ...cue, boardingPhase: phase }, 1.7, from, to, 80, 120)
    expect(late.lines[0].from.distanceTo(late.lines[0].to)).toBeLessThan(early.lines[0].from.distanceTo(early.lines[0].to))
    expect(late.lines[0].to).toEqual(early.lines[0].to)
    expect(early.projectiles).toHaveLength(0)
    expect(late.projectiles).toHaveLength(0)
  }
})

test('boarding seeks are deterministic, input-independent and reduced motion suppresses sparks', () => {
  const source = from.clone(), target = to.clone(), event = { ...cue }
  for (const phase of phases) {
    event.boardingPhase = phase
    const first = boardingVisual(event, .9, source, target, 80, 120)
    boardingVisual(event, 1.7, source, target, 80, 120)
    boardingVisual(event, .1, source, target, 80, 120)
    expect(boardingVisual(event, .9, source, target, 80, 120)).toEqual(first)
    expect(source).toEqual(from)
    expect(target).toEqual(to)
    const reduced = boardingVisual(event, .9, source, target, 80, 120, true)
    expect(reduced.lines.length).toBeLessThanOrEqual(first.lines.length)
    for (let index = 0; index < reduced.glows.length; index++) expect(reduced.glows[index].opacity).toBeLessThanOrEqual(first.glows[index].opacity)
  }
  const ordinary = boardingVisual(cue, .9, source, target, 80, 120)
  const reduced = boardingVisual(cue, .9, source, target, 80, 120, true)
  expect(ordinary.lines).toHaveLength(7)
  expect(reduced.lines).toHaveLength(4)
  ordinary.lines[0].to.set(999, 999, 999)
  expect(target).toEqual(to)
  expect(event).toEqual({ ...cue, boardingPhase: 'plunder' })
  for (const point of [new Vector3(), new Vector3(0, 20, 0)]) {
    const frame = boardingVisual(cue, .5, new Vector3(), point, 80, 120)
    expect(frame.lines.flatMap(line => [...line.from.toArray(), ...line.to.toArray()]).every(Number.isFinite)).toBe(true)
  }
})

test('confirmed terminal plunder retains a local release effect without returning crew', () => {
  const frame = boardingVisual({ ...cue, boardingPhase: 'plunder', boardingEnded: true }, .9, from, to, 80, 120)
  expect(frame.lines).toHaveLength(4)
  expect(frame.glows).toHaveLength(2)
  expect(frame.projectiles).toHaveLength(0)
  expect(frame.glows[1].radius).toBeGreaterThan(12)
})

test('confirmed boarding bridges a safe berth with paired dull surface rails and clamps', () => {
  const source = new Vector3(), target = new Vector3(180, 0, 0)
  for (const boardingPhase of ['breach', 'assault'] as const) {
    const frame = boardingVisual({ ...cue, boardingPhase }, .9, source, target, 80, 120, true)
    expect(frame.lines).toHaveLength(4)
    const [left, right, sourceClamp, targetClamp] = frame.lines
    expect(left.color).toBe(0x87949b)
    expect(right.color).toBe(0x87949b)
    expect(left.from.x).toBeCloseTo(24)
    expect(left.to.x).toBeCloseTo(135)
    expect(right.from.x).toBeCloseTo(left.from.x)
    expect(right.to.x).toBeCloseTo(left.to.x)
    expect(left.from.distanceTo(right.from)).toBeGreaterThan(5)
    expect(sourceClamp.from.x).toBeCloseTo(left.from.x)
    expect(targetClamp.from.x).toBeCloseTo(left.to.x)
    expect(frame.projectiles).toHaveLength(0)
  }
})

test('a lone latch record cannot create a long-range umbilical before the boarder closes', () => {
  const source = new Vector3(), target = new Vector3(2000, 0, 0)
  for (const boardingPhase of ['breach', 'assault', 'withdraw', 'plunder'] as const) {
    const frame = boardingVisual({ ...cue, boardingPhase }, .9, source, target, 80, 120, true)
    expect(frame.lines).toHaveLength(0)
    expect(frame.projectiles).toHaveLength(0)
  }
})
