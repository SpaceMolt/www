import { describe, expect, it } from 'bun:test'
import { groupPrizesBySystem, loadRoutes, matchRoutes, rememberRoutes } from './useIntelData'
import type { IntelAgent, PrizeRecovery } from '@/lib/intelTypes'

const prize = (p: Partial<PrizeRecovery>) => ({ prize_id: 'p', status: 'in_transit', ...p }) as PrizeRecovery
const agent = (prizes: PrizeRecovery[]) => ({ prize_recoveries: prizes }) as IntelAgent

describe('groupPrizesBySystem', () => {
  it('uses system_id, falls back to transit_from_system_id, and skips prizes with neither', () => {
    const map = groupPrizesBySystem([
      agent([prize({ prize_id: 'a', system_id: 'sol' })]),
      agent([prize({ prize_id: 'b', transit_from_system_id: 'sol', transit_to_system_id: 'krynn' })]),
      agent([prize({ prize_id: 'c' })]),
      { } as IntelAgent,
    ])
    expect([...map.keys()]).toEqual(['sol'])
    expect(map.get('sol')?.map((p) => p.prize_id)).toEqual(['a', 'b'])
  })
})

describe('pathfinder route memory', () => {
  const pts = [{ x: 0, y: 0 }, { x: 5, y: 9 }]
  const flying = {
    id: 'p1',
    in_transit: { type: 'pathfinder', from: 'sol', to: 'krynn', start_tick: 0, arrival_tick: 0, waypoints: pts },
  } as unknown as IntelAgent
  const move = (at: number, to = 'krynn') =>
    ({ player_id: 'p1', username: 'u', from: 'sol', to, first_visit: false, at: new Date(at).toISOString() })

  it('replaces the entry per flight and drops expired ones', () => {
    const old = { player: 'p2', from: 'a', to: 'b', points: pts, seen: 0 }
    const first = rememberRoutes([old], [flying], 1000)
    expect(first.map((r) => r.player)).toEqual(['p2', 'p1'])
    const later = rememberRoutes(first, [flying], 25 * 60 * 60_000)
    expect(later).toHaveLength(1)
    expect(later[0].seen).toBe(25 * 60 * 60_000)
  })

  it('gives the route to the first matching jump after it was seen, and only that one', () => {
    const seen = 10 * 60_000
    const routes = rememberRoutes([], [flying], seen)
    const before = move(seen - 5 * 60_000)
    const arrival = move(seen + 20_000)
    const repeat = move(seen + 60 * 60_000)
    const other = move(seen + 30_000, 'haven')
    const matched = matchRoutes([before, arrival, other, repeat], routes)
    expect(matched.get(arrival)).toEqual(pts)
    expect(matched.has(before)).toBe(false)
    expect(matched.has(repeat)).toBe(false)
    expect(matched.has(other)).toBe(false)
  })
})

describe('loadRoutes', () => {
  it('drops corrupt entries and keeps good ones', () => {
    const good = { player: 'p1', from: 'sol', to: 'krynn', seen: 1, points: [{ x: 0, y: 1 }] }
    const stored = JSON.stringify([null, 7, { ...good, points: 'x' }, { ...good, seen: 'x' }, good])
    globalThis.localStorage = { getItem: () => stored } as unknown as Storage
    expect(loadRoutes()).toEqual([good])
  })
})
