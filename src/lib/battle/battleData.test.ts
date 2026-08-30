import { describe, expect, it } from 'bun:test'
import {
  applyBattleLoadResult,
  battleTailStart,
  failBattleLoad,
  fetchBattleData,
  initialBattleLoaderState,
  mergeBattleEntries,
  needsFullReconciliation,
  shouldPollBattle,
  FINALIZE_TIMEOUT_MS,
  RECONCILE_DELAY_MS,
} from './battleData'
import type { BattleLogEntry, BattleSummary } from './types'

const entry = (tick: number, ended = false): BattleLogEntry => ({
  battle_id: 'battle-a', system_id: 'sol', tick, snapshots: [],
  ...(ended ? { battle_ended: { outcome: 'stalemate', winning_side: -1, duration: 2, total_damage: 0, ships_destroyed: 0, participants: [] } } : {}),
})
const summary = (status: 'active' | 'completed', endedAt?: string): BattleSummary => ({
  battle_id: 'battle-a', system_id: 'sol', system_name: 'Sol', status,
  start_tick: 100, duration_ticks: 2, participant_count: 2, sides: [], total_damage: 0, ships_destroyed: 0,
  ended_at: endedAt,
})
const result = (entries: BattleLogEntry[], status: 'active' | 'completed' = 'active', full = false) => ({
  entries, status, summary: null, summaryError: null, full,
})

describe('battle loader lifecycle', () => {
  it('keeps polling an active battle whose initial log is empty', () => {
    const state = applyBattleLoadResult(initialBattleLoaderState(), result([]), 100)
    expect(state.phase).toBe('live')
    expect(shouldPollBattle(state)).toBe(true)
    expect(battleTailStart(state.entries)).toBe(0)
  })

  it('does not confuse completed status with a persisted final tick', () => {
    const state = applyBattleLoadResult(initialBattleLoaderState(), result([entry(100)], 'completed'), 100)
    expect(state.phase).toBe('finalizing')
    expect(shouldPollBattle(state)).toBe(true)
  })

  it('overlaps the live tail and merges late, duplicate and updated ticks in order', () => {
    const old = [entry(100), entry(102)]
    const merged = mergeBattleEntries(old, [entry(101), entry(102, true)], 'battle-a')
    expect(merged.map(e => e.tick)).toEqual([100, 101, 102])
    expect(merged[2].battle_ended).toBeDefined()
    expect(old[1].battle_ended).toBeUndefined()
    expect(battleTailStart(merged)).toBeLessThan(102)
    expect(mergeBattleEntries(old, [{ ...entry(103), battle_id: 'other' }], 'battle-a')).toEqual(old)
  })

  it('waits for late writes then performs a full final reconciliation', () => {
    let state = applyBattleLoadResult(initialBattleLoaderState(), result([entry(102, true)], 'completed'), 100)
    expect(state.phase).toBe('finalizing')
    expect(needsFullReconciliation(state, 100 + RECONCILE_DELAY_MS - 1)).toBe(false)
    expect(needsFullReconciliation(state, 100 + RECONCILE_DELAY_MS)).toBe(true)
    state = applyBattleLoadResult(state, result([entry(100), entry(101), entry(102, true)], 'completed', true), 100 + RECONCILE_DELAY_MS)
    expect(state.phase).toBe('complete')
    expect(state.entries.map(e => e.tick)).toEqual([100, 101, 102])
    expect(shouldPollBattle(state)).toBe(false)
  })

  it('opens already-settled archived logs without an artificial finalization delay', () => {
    const state = applyBattleLoadResult(initialBattleLoaderState(), {
      ...result([entry(102, true)], 'completed', true), summary: summary('completed', new Date(0).toISOString()),
    }, RECONCILE_DELAY_MS + 100)
    expect(state.phase).toBe('complete')
  })

  it('never completes from an old completed summary without the terminal log row', () => {
    const state = applyBattleLoadResult(initialBattleLoaderState(), {
      ...result([entry(100)], 'completed', true), summary: summary('completed', new Date(0).toISOString()),
    }, RECONCILE_DELAY_MS + 100)
    expect(state.phase).toBe('finalizing')
  })

  it('bounds finalization when final logs never arrive', () => {
    let state = applyBattleLoadResult(initialBattleLoaderState(), result([], 'completed'), 100)
    state = applyBattleLoadResult(state, result([], 'completed'), 100 + FINALIZE_TIMEOUT_MS)
    expect(state.phase).toBe('unavailable')
    expect(shouldPollBattle(state)).toBe(false)
    expect(state.error).toBeTruthy()
  })

  it('preserves data and exposes transient failures instead of silently swallowing them', () => {
    const state = applyBattleLoadResult(initialBattleLoaderState(), result([entry(100)]), 100)
    const failed = failBattleLoad(state, new Error('HTTP 503'), 200)
    expect(failed.entries).toEqual(state.entries)
    expect(failed.updatedAt).toBe(100)
    expect(failed.phase).toBe('live')
    expect(failed.error).toBe('HTTP 503')
    expect(applyBattleLoadResult(failed, result([entry(101)]), 300).error).toBeNull()
  })
})

describe('battle loader requests', () => {
  it('skips steady live summary polls but refreshes the summary when a terminal row arrives', async () => {
    let summaries = 0
    let ended = false
    const fetcher = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/summary')) {
        summaries++
        return Response.json(summary(ended ? 'completed' : 'active'))
      }
      return Response.json({ battle_id: 'battle-a', status: ended ? 'completed' : 'active', entries: [entry(102, ended)], has_more: false })
    }) as typeof fetch
    await fetchBattleData('battle-a', 100, new AbortController().signal, fetcher, '', false)
    expect(summaries).toBe(0)
    ended = true
    const data = await fetchBattleData('battle-a', 100, new AbortController().signal, fetcher, '', false)
    expect(summaries).toBe(1)
    expect(data.summary?.status).toBe('completed')
  })

  it('fetches every catch-up page even when the server already reports completed', async () => {
    const urls: string[] = []
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      urls.push(url)
      expect(init?.cache).toBe('no-store')
      expect(init?.signal).toBeDefined()
      if (url.includes('/summary')) return Response.json(summary('completed'))
      const second = url.includes('tick_start=102')
      return Response.json({ battle_id: 'battle-a', status: 'completed', entries: second ? [entry(102, true)] : [entry(100), entry(101)], has_more: !second })
    }) as typeof fetch
    const data = await fetchBattleData('battle-a', 0, new AbortController().signal, fetcher, '')
    expect(data.entries.map(e => e.tick)).toEqual([100, 101, 102])
    expect(urls.filter(url => url.includes('/log'))).toHaveLength(2)
    expect(data.full).toBe(true)
  })

  it('accepts null entries and temporary summary 404 without a negative cursor', async () => {
    const fetcher = (async (input: RequestInfo | URL) => String(input).includes('/summary')
      ? new Response('', { status: 404 })
      : Response.json({ battle_id: 'battle-a', status: 'active', entries: null, has_more: false })) as typeof fetch
    const data = await fetchBattleData('battle-a', 0, new AbortController().signal, fetcher, '')
    expect(data.entries).toEqual([])
    expect(data.summary).toBeNull()
    expect(data.summaryError).toBeNull()
  })

  it('rejects another battle payload and error-shaped HTTP 200 responses', async () => {
    for (const payload of [{ battle_id: 'other', entries: [] }, { error: 'Battle logs not available (no database)' }]) {
      const fetcher = (async (input: RequestInfo | URL) => String(input).includes('/summary')
        ? new Response('', { status: 404 }) : Response.json(payload)) as typeof fetch
      await expect(fetchBattleData('battle-a', 0, new AbortController().signal, fetcher, '')).rejects.toThrow()
    }
  })

  it('does not return stale data after an abort even if fetch ignores the signal', async () => {
    const controller = new AbortController()
    let finish: (response: Response) => void = () => {}
    const fetcher = (async (input: RequestInfo | URL) => String(input).includes('/summary')
      ? new Response('', { status: 404 }) : new Promise<Response>(resolve => { finish = resolve })) as typeof fetch
    const pending = fetchBattleData('battle-a', 0, controller.signal, fetcher, '')
    controller.abort()
    finish(Response.json({ battle_id: 'battle-a', status: 'active', entries: [entry(100)], has_more: false }))
    await expect(pending).rejects.toThrow()
  })

  it('rejects a non-advancing page instead of looping forever', async () => {
    const fetcher = (async (input: RequestInfo | URL) => String(input).includes('/summary')
      ? new Response('', { status: 404 })
      : Response.json({ battle_id: 'battle-a', status: 'active', entries: [entry(100)], has_more: true })) as typeof fetch
    await expect(fetchBattleData('battle-a', 101, new AbortController().signal, fetcher, '')).rejects.toThrow('advance')
  })
})
