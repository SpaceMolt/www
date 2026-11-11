import { describe, expect, test } from 'bun:test'
import { addedModules, assignSources, keptFlags, moduleTotalChanges, withoutMissing } from './loadoutPlan'

describe('keptFlags / addedModules', () => {
  test('matches fitted modules by type in plan order', () => {
    expect(keptFlags(['laser', 'laser', 'shield'], ['laser', 'miner'])).toEqual([true, false, false])
    expect(addedModules(['laser', 'laser', 'shield'], ['laser', 'miner'])).toEqual(['laser', 'shield'])
  })
})

describe('assignSources', () => {
  const holdings = {
    cargo: { laser: 1 },
    storage: { laser: 1, shield: 1 },
    faction: { shield: 1 },
    asks: { shield: [{ price: 100, qty: 1 }, { price: 150, qty: 5 }] },
  }

  test('takes cargo, then storage, then faction, then the cheapest ask', () => {
    expect(assignSources(['laser', 'laser', 'shield', 'shield', 'shield', 'shield'], holdings, 1000)).toEqual([
      { typeId: 'laser', source: 'cargo' },
      { typeId: 'laser', source: 'storage' },
      { typeId: 'shield', source: 'storage' },
      { typeId: 'shield', source: 'faction' },
      { typeId: 'shield', source: 'market', price: 100 },
      { typeId: 'shield', source: 'market', price: 150 },
    ])
  })

  test('stops buying when credits run out, and marks modules nobody has', () => {
    expect(assignSources(['laser', 'laser', 'laser', 'cannon'], { ...holdings, asks: {} }, 0).map((s) => s.source)).toEqual(['cargo', 'storage', null, null])
    expect(assignSources(['shield', 'shield', 'shield'], { cargo: {}, storage: {}, faction: {}, asks: holdings.asks }, 120).map((s) => s.source)).toEqual(['market', null, null])
  })

  test('does not change the holdings it was given', () => {
    assignSources(['laser', 'shield', 'shield', 'shield'], holdings, 1000)
    expect(holdings.cargo.laser).toBe(1)
    expect(holdings.asks.shield[0].qty).toBe(1)
  })
})

describe('withoutMissing', () => {
  test('drops one planned addition per missing module and keeps fitted ones', () => {
    const plan = ['laser', 'cannon', 'cannon', 'shield']
    const sourced = [
      { typeId: 'cannon', source: 'cargo' as const },
      { typeId: 'cannon', source: null },
      { typeId: 'shield', source: null },
    ]
    expect(withoutMissing(plan, ['laser'], sourced)).toEqual(['laser', 'cannon'])
  })
})

test('moduleTotalChanges lists only the module totals the plan changes', () => {
  const modules: Record<string, { mining_power?: number; scanner_power?: number }> = {
    laser: { mining_power: 5 },
    scanner: { scanner_power: 3 },
  }
  expect(moduleTotalChanges(['laser', 'scanner'], ['laser', 'laser', 'scanner'], (id: string) => modules[id])).toEqual([
    { label: 'Mining power', before: 5, after: 10 },
  ])
})
