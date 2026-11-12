import { describe, it, expect } from 'bun:test'
import { alongBearing, bearingArg, bearingTo, dropOut, reverseBearing } from './pathfinder'

const origin = { x: 0, y: 0 }
const system = (id: string, x: number, y: number) => ({ id, name: id, x, y })

describe('bearing', () => {
  it('measures 0 along +X and 90 along +Y, in [0, 360)', () => {
    expect(bearingTo(origin, { x: 5, y: 0 })).toBeCloseTo(0)
    expect(bearingTo(origin, { x: 0, y: 5 })).toBeCloseTo(90)
    expect(bearingTo(origin, { x: 5, y: -5 })).toBeCloseTo(315)
  })

  it('reverses and formats for the jump command', () => {
    expect(reverseBearing(270)).toBe(90)
    expect(bearingArg(359.97)).toBe('0.0')
    expect(bearingArg(45.26)).toBe('45.3')
  })

  it('round-trips with alongBearing', () => {
    expect(bearingTo(origin, alongBearing(origin, 123, 400))).toBeCloseTo(123)
  })
})

describe('dropOut', () => {
  const systems = [system('far', 1000, 50), system('near', 400, -90), system('wide', 200, 150), system('behind', -300, 0), system('home', 0, 0)]

  it('takes the nearest system ahead inside the landing margin', () => {
    expect(dropOut(systems, origin, 0, 'home')).toMatchObject({ system: { id: 'near' }, distance: 400, ticks: 40 })
  })

  it('finds nothing on a heading into the void', () => {
    expect(dropOut(systems, origin, 90, 'home')).toBeNull()
  })

  it('lets a replot from open space land on the launch system', () => {
    expect(dropOut(systems, { x: 500, y: 0 }, 180)?.system.id).toBe('near')
    expect(dropOut([system('home', 0, 0)], { x: 500, y: 0 }, 180)?.system.id).toBe('home')
  })
})
