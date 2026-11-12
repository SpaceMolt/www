import { expect, test } from 'bun:test'
import { edgePoint, formatAU, formatSecs, spread, stepToward } from './systemMapMath'
import { starRadiusAU } from './systemMapBodies'

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

test('distances keep two digits below 1 AU', () => {
  expect([0.0154, 0.83, 5.23, 9.96, 83.3].map(formatAU)).toEqual(['0.015', '0.83', '5.2', '10', '83'])
})

test('a supergiant is AU wide, a dwarf is not, a compact star has no disc', () => {
  expect(starRadiusAU('M2Ib')).toBeCloseTo(2.325)
  expect(starRadiusAU('G2V')).toBeCloseTo(0.00465)
  expect(starRadiusAU('BH')).toBe(0)
})

test('bodies too close on screen move apart on their bearing; the first keeps its place', () => {
  expect(spread([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 100, y: 0 }], 20)).toEqual([{ x: 0, y: 0 }, { x: 12, y: 16 }, { x: 100, y: 0 }])
  expect(spread([{ x: 5, y: 5 }, { x: 5, y: 5 }], 20)[1]).toEqual({ x: 5, y: 25 })
})
