import { describe, it, expect } from 'bun:test'
import { alongBearing, bearingArg, bearingTo, dropOut, reverseBearing, trackTrail } from './pathfinder'

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

describe('trackTrail', () => {
  const here = { player: 'me', origin: 'sol', originPoint: { x: 1, y: 2 }, systemId: '' }
  const drift = (x: number, bearing: number) => ({ x, y: 0, bearing })

  it('starts at the launch system, bends on a new bearing, and ends at the drop-out system', () => {
    const launched = trackTrail(null, null, drift(10, 0), here, 5)
    expect(launched).toEqual({ player: 'me', from: 'sol', to: '', points: [{ x: 1, y: 2 }], seen: 5 })
    expect(trackTrail(launched, drift(10, 0), drift(20, 0), here, 6)).toBe(launched)
    const bent = trackTrail(launched, drift(20, 0), drift(30, 90), here, 7)
    expect(bent?.points).toEqual([{ x: 1, y: 2 }, { x: 30, y: 0 }])
    const landed = trackTrail(bent, drift(30, 90), null, { ...here, systemId: 'krynn' }, 8)
    expect(landed).toEqual({ ...bent!, to: 'krynn' })
  })

  it('carries on with the saved flight after a reload mid-drift', () => {
    const saved = { player: 'me', from: 'sol', to: '', points: [{ x: 1, y: 2 }], seen: 1 }
    expect(trackTrail(saved, null, drift(50, 0), { ...here, origin: '', originPoint: undefined }, 9)?.points).toEqual([{ x: 1, y: 2 }])
    expect(trackTrail(null, null, drift(50, 0), { ...here, origin: '', originPoint: undefined }, 9)?.points).toEqual([{ x: 50, y: 0 }])
  })
})
