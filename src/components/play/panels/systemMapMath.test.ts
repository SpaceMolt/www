import { expect, test } from 'bun:test'
import { edgePoint, formatSecs, stepToward } from './systemMapMath'

const center = { x: 100, y: 100 }

test('a point inside the view has no edge marker', () => {
  expect(edgePoint({ x: 150, y: 60 }, center, 80, 80)).toBeNull()
})

test('a point outside the view lands on the edge toward it', () => {
  expect(edgePoint({ x: 500, y: 100 }, center, 80, 60)).toEqual({ x: 180, y: 100 })
  expect(edgePoint({ x: 100, y: -500 }, center, 80, 60)).toEqual({ x: 100, y: 40 })
  const corner = edgePoint({ x: 300, y: 300 }, center, 80, 60)!
  expect(corner.y).toBeCloseTo(160)
  expect(corner.x).toBeCloseTo(160)
})

test('equal steps reach the destination exactly on time', () => {
  let pos = { x: 0, y: 0 }
  for (let left = 1000; left > 0; left -= 100) pos = stepToward(pos, { x: 10, y: 0 }, 100, left)
  expect(pos.x).toBeCloseTo(10)
})

test('the ship moves at a steady rate and holds at the destination when late', () => {
  expect(stepToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 100, 1000).x).toBeCloseTo(1)
  expect(stepToward({ x: 4, y: 0 }, { x: 10, y: 0 }, 100, -50)).toEqual({ x: 10, y: 0 })
})

test('formatSecs', () => {
  expect(formatSecs(50)).toBe('50s')
  expect(formatSecs(130)).toBe('2m 10s')
})
