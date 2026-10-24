import { describe, expect, it } from 'bun:test'
import { groupPrizesBySystem } from './useIntelData'
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
