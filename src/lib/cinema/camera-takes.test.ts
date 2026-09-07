import { expect, test } from 'bun:test'
import { buildCameraTakes } from './camera-takes'
import type { CinemaSequence } from './types'

const sequence = (id: string, start: number, attacker = 'a', defender = 'b'): CinemaSequence =>
  ({ id, start, end: start + 3, attacker, defender, kind: 'confrontation', actionTime: start + 1, impactTime: start + 2 })

test('consecutive exchanges share a stable take window independent of input order', () => {
  const a = sequence('first', 0), b = sequence('second', 3), c = sequence('third', 6)
  const takes = buildCameraTakes([c, a, b], [])
  expect(takes.get(a.id)).toEqual({ id: a.id, start: 0, end: 9 })
  expect(takes.get(b.id)).toBe(takes.get(a.id))
  expect(takes.get(c.id)).toBe(takes.get(a.id))
})

test('reciprocal fire, new targets, gaps, and strategic masters start new takes', () => {
  for (const next of [sequence('next', 3, 'b', 'a'), sequence('next', 3, 'a', 'c'), sequence('next', 4)]) {
    const takes = buildCameraTakes([sequence('first', 0), next], [])
    expect(takes.get('first')).not.toBe(takes.get('next'))
  }
  const takes = buildCameraTakes([sequence('first', 0), sequence('second', 3)],
    [{ start: 2.8, end: 3.2, kind: 'reveal', role: 'geography', battlefield: true, intensity: .5 }])
  expect(takes.get('first')).not.toBe(takes.get('second'))
})

test('a shared take preserves camera progress across consecutive exchanges', async () => {
  const { sampleStoryCamera } = await import('./camera')
  const { Vector3 } = await import('three')
  const first = sequence('first', 0), second = sequence('second', 3)
  const takes = buildCameraTakes([first, second], [])
  const subject = { id: 'a', position: new Vector3(0, 0, 0), size: 80 }
  const target = { id: 'b', position: new Vector3(600, 0, 0), size: 100 }
  const frameAt = (story: CinemaSequence, time: number) => {
    const take = takes.get(story.id)!
    return sampleStoryCamera({ shot: { start: story.start, end: story.end, sequenceId: story.id,
      kind: 'tracking', role: 'fire', intensity: .5 }, sequence: { ...story, start: take.start, end: take.end },
      time, aspect: 16 / 9, subject, target, axisFrom: subject.position, axisTo: target.position })
  }
  const before = frameAt(first, 2.999), after = frameAt(second, 3.001)
  expect(before.position.distanceTo(after.position)).toBeLessThan(1)
  expect(before.target.distanceTo(after.target)).toBeLessThan(1)
})
