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

test('new targets, gaps, and strategic masters start new takes', () => {
  for (const next of [sequence('next', 3, 'a', 'c'), sequence('next', 4)]) {
    const takes = buildCameraTakes([sequence('first', 0), next], [])
    expect(takes.get('first')).not.toBe(takes.get('next'))
  }
  const takes = buildCameraTakes([sequence('first', 0), sequence('second', 3)],
    [{ start: 2.8, end: 3.2, kind: 'reveal', role: 'geography', battlefield: true, intensity: .5 }])
  expect(takes.get('first')).not.toBe(takes.get('second'))
})

test('reciprocal exchanges share a take', () => {
 const takes=buildCameraTakes([sequence('first',0),sequence('second',3,'b','a')],[])
 expect(takes.get('first')).toBe(takes.get('second'))
})
