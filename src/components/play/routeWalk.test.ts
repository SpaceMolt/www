import { describe, expect, it } from 'bun:test'
import type { RouteStep } from '@spacemolt/lib'
import type { AccountStore, RunMutation } from '@/lib/spacemolt'
import { chargedAU, jumpEstimateMs, jumpTarget, reachAU, travelEstimateMs, travelSpeed, walkRoute } from './routeWalk'

const route: RouteStep[] = [
  { system_id: 'a', name: 'A', jumps: 0 },
  { system_id: 'b', name: 'B', jumps: 1 },
  { system_id: 'z', name: 'Z', jumps: 2, via_wormhole: true, entrance_poi: 'b_wormhole' },
]

/** Fake account + runner that records each mutation as "action:id". */
function fake({ fuel, stationInSystem }: { fuel: number; stationInSystem: string }) {
  const calls: string[] = []
  const state = { fuel, system: 'a', poi: 'a_belt' }
  const account = {
    get ship() { return { fuel: state.fuel } },
    get location() { return { poi_id: state.poi } },
    commands: {
      spacemolt: {
        get_system: async () => ({
          structuredContent: { system: { pois: state.system === stationInSystem ? [{ id: `${state.system}_base`, name: 'Base', has_base: true }] : [] } },
        }),
      },
    },
  } as unknown as AccountStore['account']
  const spacemolt = {
    jump: async ({ id }: { id: string }) => { calls.push(`jump:${id}`); state.fuel -= 2; state.system = id === 'b_wormhole' ? 'z' : id },
    travel: async ({ id }: { id: string }) => { calls.push(`travel:${id}`); state.poi = id },
    refuel: async () => { calls.push('refuel'); state.fuel = 10 },
  }
  const run = ((fn: (c: unknown) => Promise<unknown>) => fn({ spacemolt })) as unknown as RunMutation
  return { account, run, calls }
}

describe('jumpTarget', () => {
  it('jumps to the entrance POI for a wormhole hop', () => {
    expect(jumpTarget(route[1])).toBe('b')
    expect(jumpTarget(route[2])).toBe('b_wormhole')
  })
})

describe('walkRoute', () => {
  const opts = { fuelPerJump: 2, shipSpeed: 1, stopReason: () => null }

  it('takes the wormhole hop through its entrance POI', async () => {
    const { account, run, calls } = fake({ fuel: 10, stationInSystem: 'none' })
    expect(await walkRoute(account, run, route, opts)).toBeNull()
    expect(calls).toEqual(['jump:b', 'jump:b_wormhole'])
  })

  it('stops at a station to refuel when the tank cannot cover the route', async () => {
    const { account, run, calls } = fake({ fuel: 3, stationInSystem: 'a' })
    const stops: string[] = []
    expect(await walkRoute(account, run, route, { ...opts, onRefuel: (w) => stops.push(w) })).toBeNull()
    expect(calls).toEqual(['travel:a_base', 'refuel', 'jump:b', 'jump:b_wormhole'])
    expect(stops).toEqual(['Base'])
  })

  it('burns fuel cells only when the next jump is out of reach, and reports a dry tank', async () => {
    const { account, run, calls } = fake({ fuel: 1, stationInSystem: 'none' })
    expect(await walkRoute(account, run, route, opts)).toBeNull()
    expect(calls[0]).toBe('refuel')

    const dry = fake({ fuel: 1, stationInSystem: 'none' })
    const failingRun = ((fn: (c: unknown) => Promise<unknown>) => fn({
      spacemolt: { refuel: async () => { throw new Error('No fuel cells in cargo') } },
    })) as unknown as RunMutation
    expect(await walkRoute(dry.account, failingRun, route, opts)).toContain('Out of fuel at A')
  })

  it('stops between jumps when asked', async () => {
    const { account, run, calls } = fake({ fuel: 10, stationInSystem: 'none' })
    let jumps = 0
    const reason = await walkRoute(account, run, route, { ...opts, stopReason: () => (jumps > 0 ? 'Emergency abort' : null), onJumpDone: () => { jumps++ } })
    expect(reason).toBe('Emergency abort')
    expect(calls).toEqual(['jump:b'])
  })
})

describe('travel estimates', () => {
  it('times a jump as the server does: 7 − speed, cut to whole ticks, at least one', () => {
    expect(jumpEstimateMs(1)).toBe(60_000)
    expect(jumpEstimateMs(2.5)).toBe(40_000)
    expect(jumpEstimateMs(9)).toBe(10_000)
  })

  it('uses the ship speed after crew efficiency', () => {
    expect(travelSpeed({ speed: 4, operational_speed: 3 })).toBe(3)
    expect(travelSpeed({ speed: 4 })).toBe(4)
    expect(travelSpeed(null)).toBe(1)
  })
})

it('a long in-system trip is charged sqrt(4 x AU), as the server does', () => {
  expect([2, 4, 16, 100].map(chargedAU)).toEqual([2, 4, 8, 20])
  expect([2, 4, 8, 20].map(reachAU)).toEqual([2, 4, 16, 100])
  expect(travelEstimateMs({ x: 0, y: 0 }, { x: 100, y: 0 }, 2)).toBe(100_000)
  expect(travelEstimateMs({ x: 0, y: 0 }, { x: 0.01, y: 0 }, 2)).toBe(10_000)
})
