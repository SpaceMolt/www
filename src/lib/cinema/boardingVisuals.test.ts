import { expect, test } from 'bun:test'
import { Vector3 } from 'three'
import { boardingVisual } from './boardingVisuals'
import type { CinemaCue } from './types'

const cue: CinemaCue = { id: 'board', kind: 'boarding', time: 2, duration: 1.8, tick: 45,
  from: 'a:0', to: 'b:0', operationId: 'operation', boardingPhase: 'breach', intensity: .5 }
const phases = ['approach', 'breach', 'assault', 'withdraw', 'plunder'] as const
const from = new Vector3(-100, 7, 30), to = new Vector3(80, 18, -20)
const empty = { structuralLines: [], lines: [], glows: [], rings: [], projectiles: [] }

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
      expect(frame.lines.length).toBeLessThanOrEqual(4)
      expect(frame.structuralLines.length).toBeLessThanOrEqual(4)
      expect(frame.glows.length).toBeLessThanOrEqual(3)
      expect(frame.rings.length).toBe(0)
      expect(frame.projectiles).toHaveLength(0)
      for (const line of [...frame.structuralLines, ...frame.lines]) {
        expect([...line.from.toArray(), ...line.to.toArray(), line.width].every(Number.isFinite)).toBe(true)
        expect(line.width).toBeGreaterThanOrEqual(0)
        expect(line.from.distanceTo(line.to)).toBeLessThanOrEqual(1600)
        expect(line.from.distanceTo(to)).toBeLessThanOrEqual(from.distanceTo(to) + 40)
        expect(line.to.distanceTo(to)).toBeLessThanOrEqual(from.distanceTo(to) + 40)
      }
      for (const light of [...frame.glows, ...frame.rings]) {
        expect([...light.position.toArray(), light.radius, light.opacity].every(Number.isFinite)).toBe(true)
        expect(light.radius).toBeLessThanOrEqual(64)
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
    expect(late.structuralLines[0].from.distanceTo(late.structuralLines[0].to)).toBeLessThan(early.structuralLines[0].from.distanceTo(early.structuralLines[0].to))
    expect(late.structuralLines[0].to).toEqual(early.structuralLines[0].to)
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
  expect(ordinary.lines).toHaveLength(4)
  expect(ordinary.structuralLines).toHaveLength(4)
  expect(reduced.lines).toHaveLength(0)
  expect(reduced.structuralLines).toHaveLength(4)
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
  expect(frame.structuralLines).toHaveLength(4)
  expect(frame.glows).toHaveLength(2)
  expect(frame.projectiles).toHaveLength(0)
  expect(frame.glows[1].radius).toBeGreaterThan(12)
})

test('confirmed boarding bridges a safe berth with paired dull surface rails and clamps', () => {
  const source = new Vector3(), target = new Vector3(180, 0, 0)
  for (const boardingPhase of ['breach', 'assault'] as const) {
    const frame = boardingVisual({ ...cue, boardingPhase }, .9, source, target, 80, 120, true)
    expect(frame.structuralLines).toHaveLength(4)
    const [left, right, sourceClamp, targetClamp] = frame.structuralLines
    expect(left.color).toBe(0x71808a)
    expect(right.color).toBe(0x71808a)
    expect(left.from.x).toBeCloseTo(24)
    expect(left.to.x).toBeCloseTo(135)
    expect(right.from.x).toBeCloseTo(left.from.x)
    expect(right.to.x).toBeCloseTo(left.to.x)
    expect(left.from.distanceTo(right.from)).toBeGreaterThan(1)
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

test('a capital-to-small-hull breach extends first and produces a visible flash only at contact', () => {
  const source = new Vector3(), target = new Vector3(303, 0, 0)
  const sample = (progress: number) => boardingVisual(cue, progress * cue.duration, source, target, 362, 16.2)
  const early = sample(.1), extending = sample(.3), attached = sample(.46), flash = sample(.54)
  expect(early.structuralLines[0].to.x).toBeLessThan(extending.structuralLines[0].to.x)
  expect(extending.structuralLines[0].to.x).toBeLessThan(attached.structuralLines[0].to.x)
  expect(attached.structuralLines[0].to.x).toBeCloseTo(303 - 16.2 * .42)
  expect(early.glows.every(glow => glow.position.x < attached.structuralLines[0].to.x)).toBe(true)
  expect(extending.glows.every(glow => glow.position.x < attached.structuralLines[0].to.x)).toBe(true)
  expect(flash.glows[0].position.x).toBeCloseTo(attached.structuralLines[0].to.x)
  expect(flash.glows[0].radius).toBeGreaterThan(12)
  expect(flash.glows[0].radius).toBeLessThanOrEqual(16.2)
  expect(flash.glows[0].opacity).toBeGreaterThan(.8)
  expect(flash.lines.length).toBeGreaterThan(0)
  expect(sample(.68).glows.at(-1)!.position.x).toBeLessThan(sample(.85).glows.at(-1)!.position.x)
  expect(sample(.68).glows.at(-1)!.position.x).toBeGreaterThan(362 * .3)
  expect(sample(.85).glows.at(-1)!.position.x).toBeLessThan(attached.structuralLines[0].to.x)
  expect(sample(1)).toEqual(empty)
})

test('assault visibly pulses at the tiny target while transfer remains qualitative and seekable', () => {
  const source = new Vector3(), target = new Vector3(303, 0, 0)
  const event = { ...cue, boardingPhase: 'assault' as const }
  const bright = boardingVisual(event, .5 * cue.duration, source, target, 362, 16.2)
  const dim = boardingVisual(event, cue.duration / 3, source, target, 362, 16.2)
  expect(bright.glows[0].radius).toBeGreaterThan(12)
  expect(bright.glows[0].opacity).toBeGreaterThan(dim.glows[0].opacity * 2)
  expect(bright.glows[0].position.x).toBeCloseTo(303 - 16.2 * .42)
  expect(bright.projectiles).toHaveLength(0)
  expect(boardingVisual(event, .5 * cue.duration, source, target, 362, 16.2)).toEqual(bright)
})

test('a distant historical boarding record never flashes or connects at the target', () => {
  for (const boardingPhase of ['breach', 'assault'] as const) {
    const frame = boardingVisual({ ...cue, boardingPhase }, cue.duration * .54,
      new Vector3(), new Vector3(600, 0, 0), 362, 16.2)
    expect(frame).toEqual(empty)
  }
})


test('capital boarding structure stays thin and separate from luminous contact arcs', () => {
  const frame = boardingVisual(cue, cue.duration * .54, new Vector3(), new Vector3(303, 0, 0), 362, 16.2)
  expect(frame.structuralLines).toHaveLength(4)
  expect(frame.lines).toHaveLength(4)
  for (const rail of frame.structuralLines) {
    expect(rail.color).toBe(0x71808a)
    expect(rail.width).toBeLessThan(.21)
  }
  expect(frame.structuralLines[0].from.distanceTo(frame.structuralLines[1].from)).toBeLessThan(1.1)
  expect(frame.structuralLines[2].from.distanceTo(frame.structuralLines[2].to)).toBeLessThan(2.3)
  expect(frame.glows[0].radius).toBeGreaterThan(12)
})

test('contact arcs stay thin and entirely inside thirty percent of the smaller hull span', () => {
  const frame = boardingVisual(cue, cue.duration * .54, new Vector3(), new Vector3(303, 0, 0), 362, 16.2)
  expect(frame.lines).toHaveLength(4)
  for (const arc of frame.lines) expect(arc.width).toBeLessThan(.08)
  const points = frame.lines.flatMap(arc => [arc.from, arc.to])
  for (const a of points) for (const b of points) expect(a.distanceTo(b)).toBeLessThanOrEqual(16.2 * .3 + 1e-6)
  expect(frame.glows[0].radius).toBeGreaterThan(12)
})

test('boarding hardware spans actual hull sockets instead of fractions of center separation', () => {
  const source = new Vector3(), target = new Vector3(150, 0, 0)
  const sockets = { from: new Vector3(140, 0, 0), to: new Vector3(142, 0, 0) }
  const frame = boardingVisual(cue, cue.duration * .6, source, target, 362, 16.2, false, sockets)
  expect(frame.structuralLines).toHaveLength(4)
  expect(frame.structuralLines[0].from.x).toBeCloseTo(140)
  expect(frame.structuralLines[0].to.x).toBeCloseTo(142)
  expect(frame.structuralLines[0].from.distanceTo(frame.structuralLines[0].to)).toBeLessThanOrEqual(2.01)
  const distant = boardingVisual(cue, cue.duration * .6, source, target, 362, 16.2, false,
    { from: new Vector3(30, 0, 0), to: new Vector3(142, 0, 0) })
  expect(distant.structuralLines).toHaveLength(0)
})

test('surface sockets use their own connection axis and never mutate caller positions', () => {
  const sockets = { from: new Vector3(3, 7, 2), to: new Vector3(3, 9, 2) }
  const original = { from: sockets.from.clone(), to: sockets.to.clone() }
  const frame = boardingVisual(cue, cue.duration * .6, new Vector3(), new Vector3(100, 0, 0), 362, 16.2, false, sockets)
  const [left, right] = frame.structuralLines
  expect(left.from.clone().add(right.from).multiplyScalar(.5)).toEqual(sockets.from)
  expect(left.to.clone().add(right.to).multiplyScalar(.5)).toEqual(sockets.to)
  expect(left.to.y - left.from.y).toBeCloseTo(2)
  expect(sockets).toEqual(original)
  left.from.set(999, 999, 999)
  expect(sockets).toEqual(original)
})

test('invalid or separated surface sockets suppress every contact effect', () => {
  for (const phase of ['breach', 'assault', 'withdraw', 'plunder'] as const) {
    for (const point of [new Vector3(NaN, 0, 0), new Vector3(Infinity, 0, 0), new Vector3(20, 0, 0)]) {
      expect(boardingVisual({ ...cue, boardingPhase: phase }, cue.duration * .54,
        new Vector3(), new Vector3(30, 0, 0), 362, 16.2, false,
        { from: new Vector3(), to: point })).toEqual(empty)
    }
  }
})
