import { afterEach, describe, expect, it } from 'bun:test'
import { fetchBattleSummary } from './serverSummary'
import type { BattleSummary } from './types'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const activeSummary: BattleSummary = {
  battle_id: 'battle-a',
  system_id: 'sol',
  system_name: 'Sol',
  status: 'active',
  start_tick: 100,
  duration_ticks: 0,
  participant_count: 2,
  sides: [],
  total_damage: 0,
  ships_destroyed: 0,
}

describe('server battle summary', () => {
  it('does not persistently cache a summary that may still be active', async () => {
    let requestInit: RequestInit | undefined
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init
      return Response.json(activeSummary)
    }) as typeof fetch

    expect(await fetchBattleSummary('battle-a')).toEqual(activeSummary)
    expect(requestInit?.cache).toBe('no-store')
    expect(requestInit).not.toHaveProperty('next.revalidate')
  })
})
