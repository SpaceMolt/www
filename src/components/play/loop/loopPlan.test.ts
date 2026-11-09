import { describe, expect, it } from 'bun:test'
import { advance, errorOutcome, loadKnownPois, loadPlans, mineSellPreset, rememberPois, savePlans, type LoopPlan } from './loopPlan'

const plan = (repeat: number): LoopPlan => ({ name: 'p', repeat, steps: [{ kind: 'mine' }, { kind: 'sell_all' }] })

describe('advance', () => {
  it('moves through steps, then wraps to the next pass', () => {
    expect(advance({ stepIndex: 0, loop: 1 }, plan(2))).toEqual({ stepIndex: 1, loop: 1 })
    expect(advance({ stepIndex: 1, loop: 1 }, plan(2))).toEqual({ stepIndex: 0, loop: 2 })
  })

  it('ends after the last pass, and never ends when repeat is 0', () => {
    expect(advance({ stepIndex: 1, loop: 2 }, plan(2))).toBeNull()
    expect(advance({ stepIndex: 1, loop: 500 }, plan(0))).toEqual({ stepIndex: 0, loop: 501 })
  })
})

describe('errorOutcome', () => {
  const mine = { kind: 'mine' } as const

  it('moves on when the hold is full', () => {
    expect(errorOutcome(mine, { code: 'cargo_full' }).halt).toBe(false)
  })

  it('aborts on combat, incapacitation, and fleet codes', () => {
    for (const code of ['in_battle', 'in_combat', 'ship_incapacitated', 'in_fleet']) {
      expect(errorOutcome({ kind: 'sell_all' }, { code }).halt).toBe(true)
    }
  })

  it('skips an empty deposit only when there is ore to sell', () => {
    expect(errorOutcome(mine, { code: 'depleted', cargoUsed: 12 }).halt).toBe(false)
    expect(errorOutcome(mine, { code: 'no_resources', cargoUsed: 0 }).halt).toBe(true)
  })

  it('treats a full tank or hull as done, and unknown errors as a halt', () => {
    expect(errorOutcome({ kind: 'refuel' }, { code: 'fuel_full' }).halt).toBe(false)
    expect(errorOutcome({ kind: 'repair' }, { code: 'hull_full' }).halt).toBe(false)
    expect(errorOutcome({ kind: 'goto', poiId: 'x', label: 'X' }, { code: 'unknown_system', message: 'nope' })).toEqual({ halt: true, reason: 'nope' })
  })
})

describe('mineSellPreset', () => {
  it('goes to the deposit first so it starts from either end', () => {
    const preset = mineSellPreset({ minePoi: { id: 'belt', name: 'Belt' }, station: { id: 'base', name: 'Base' } })
    expect(preset.steps.map((s) => s.kind)).toEqual(['goto', 'mine', 'goto', 'sell_all', 'refuel'])
    expect(preset.repeat).toBe(0)
  })
})

describe('remembered POIs', () => {
  it('keeps POIs across systems and updates a POI seen again', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    rememberPois('p1', [{ id: 'main_belt', name: 'Main Belt', systemId: 'sol', systemName: 'Sol' }], storage)
    rememberPois('p1', [{ id: 'ac_ring', name: 'Ring', systemId: 'alpha_centauri', systemName: 'Alpha Centauri' }], storage)
    rememberPois('p1', [{ id: 'main_belt', name: 'Main Belt (rich)', systemId: 'sol', systemName: 'Sol' }], storage)
    expect(loadKnownPois('p1', storage).map((p) => p.name)).toEqual(['Ring', 'Main Belt (rich)'])
    expect(loadKnownPois('p2', storage)).toEqual([])
  })
})

describe('plan storage', () => {
  it('round-trips plans and drops malformed entries', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    savePlans('p1', [plan(3)], storage)
    expect(loadPlans('p1', storage)).toEqual([plan(3)])
    expect(loadPlans('p2', storage)).toEqual([])
    store.set('spacemolt.play.loopPlans.p1', JSON.stringify([{ bogus: true }, { ...plan(2), steps: [{ kind: 'warp' }] }, plan(1)]))
    expect(loadPlans('p1', storage)).toEqual([plan(1)])
    store.set('spacemolt.play.loopPlans.p1', '{not json')
    expect(loadPlans('p1', storage)).toEqual([])
  })
})
