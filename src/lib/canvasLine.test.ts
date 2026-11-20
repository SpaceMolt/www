import { expect, test } from 'bun:test'
import { clipToView } from './canvasLine'

// dc#434442: a dashed line 100,000 GU long at high zoom made the canvas draw millions of dashes.
test('a line is cut to the part on screen, with the dash offset it skipped', () => {
  const seg = clipToView({ x: -1e7, y: 50 }, { x: 1e7, y: 50 }, 100, 100, 0)!
  expect(seg.from).toEqual({ x: 0, y: 50 })
  expect(seg.to).toEqual({ x: 100, y: 50 })
  expect(seg.dashOffset).toBe(1e7)
})

test('a line inside the view stays as it is, a line off screen is dropped', () => {
  expect(clipToView({ x: 10, y: 10 }, { x: 20, y: 30 }, 100, 100, 0)).toEqual({ from: { x: 10, y: 10 }, to: { x: 20, y: 30 }, dashOffset: 0 })
  expect(clipToView({ x: -50, y: -10 }, { x: 200, y: -10 }, 100, 100, 0)).toBeNull()
  expect(clipToView({ x: 150, y: -50 }, { x: 250, y: 50 }, 100, 100, 0)).toBeNull()
  expect(clipToView({ x: NaN, y: 0 }, { x: 50, y: 50 }, 100, 100, 0)).toBeNull()
})
