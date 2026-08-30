import { normalizeEntries, type BattleLogEntry, type BattleLogResponse, type BattleSummary } from './types'

export const RECONCILE_DELAY_MS = 35_000
export const FINALIZE_TIMEOUT_MS = 60_000
const REQUEST_TIMEOUT_MS = 15_000
const TAIL_OVERLAP_TICKS = 12

export type BattleLoadPhase = 'loading' | 'live' | 'finalizing' | 'complete' | 'unavailable'

export interface BattleLoaderState {
  summary: BattleSummary | null
  entries: BattleLogEntry[]
  phase: BattleLoadPhase
  loading: boolean
  refreshing: boolean
  error: string | null
  updatedAt: number | null
  finalizingSince: number | null
  terminalSeenAt: number | null
}

export interface BattleLoadResult {
  entries: BattleLogEntry[]
  status?: 'active' | 'completed'
  summary: BattleSummary | null
  summaryError: string | null
  full: boolean
}

export function initialBattleLoaderState(): BattleLoaderState {
  return {
    summary: null, entries: [], phase: 'loading', loading: true, refreshing: false,
    error: null, updatedAt: null, finalizingSince: null, terminalSeenAt: null,
  }
}

/** Persisted rows are immutable; overlap must not replay or duplicate old ticks. */
export function mergeBattleEntries(previous: BattleLogEntry[], incoming: BattleLogEntry[], battleId: string): BattleLogEntry[] {
  const byTick = new Map(previous.map(entry => [entry.tick, entry]))
  let changed = false
  for (const entry of incoming) {
    if (entry.battle_id !== battleId || !Number.isSafeInteger(entry.tick) || entry.tick < 0) continue
    const existing = byTick.get(entry.tick)
    if (existing && (existing.battle_ended || !entry.battle_ended)) continue
    const copy = { ...entry, ...(entry.battle_ended ? { battle_ended: { ...entry.battle_ended } } : {}) }
    normalizeEntries([copy])
    byTick.set(entry.tick, copy)
    changed = true
  }
  return changed ? [...byTick.values()].sort((a, b) => a.tick - b.tick) : previous
}

export function battleTailStart(entries: BattleLogEntry[]): number {
  return entries.length ? Math.max(0, entries[entries.length - 1].tick - TAIL_OVERLAP_TICKS) : 0
}

export function shouldPollBattle(state: BattleLoaderState): boolean {
  return state.phase !== 'complete' && state.phase !== 'unavailable'
}

export function needsFullReconciliation(state: BattleLoaderState, now: number): boolean {
  return state.terminalSeenAt !== null && now - state.terminalSeenAt >= RECONCILE_DELAY_MS
}

export function applyBattleLoadResult(state: BattleLoaderState, result: BattleLoadResult, now: number): BattleLoaderState {
  const battleId = result.summary?.battle_id ?? result.entries[0]?.battle_id ?? state.entries[0]?.battle_id ?? ''
  const entries = mergeBattleEntries(state.entries, result.entries, battleId)
  const summary = result.summary ?? state.summary
  const terminal = entries.some(entry => entry.battle_ended)
  const terminalSeenAt = terminal ? (state.terminalSeenAt ?? now) : null
  const active = !terminal && (result.status === 'active' || result.summary?.status === 'active')
  const finalizingSince = active ? null : (state.finalizingSince ?? now)
  // The terminal row may commit before older tick writes. Give those writes
  // their server-side timeout, then reconcile from the beginning once more.
  const endedAt = summary?.ended_at ? Date.parse(summary.ended_at) : NaN
  const settled = terminal && (
    (terminalSeenAt !== null && now - terminalSeenAt >= RECONCILE_DELAY_MS) ||
    (Number.isFinite(endedAt) && now - endedAt >= RECONCILE_DELAY_MS)
  )
  const complete = settled && result.full
  const expired = !complete && finalizingSince !== null && now - finalizingSince >= FINALIZE_TIMEOUT_MS
  return {
    summary, entries, phase: complete ? 'complete' : active ? 'live' : expired ? 'unavailable' : 'finalizing',
    loading: false, refreshing: false, updatedAt: now,
    error: expired ? 'Final replay data is not available yet. Retry to check again.' : result.summaryError,
    finalizingSince, terminalSeenAt,
  }
}

export function failBattleLoad(state: BattleLoaderState, error: unknown, now: number): BattleLoaderState {
  const finalizingSince = state.phase === 'live' ? null : (state.finalizingSince ?? now)
  const expired = finalizingSince !== null && now - finalizingSince >= FINALIZE_TIMEOUT_MS
  return {
    ...state, loading: false, refreshing: false, finalizingSince,
    phase: expired ? 'unavailable' : state.phase === 'live' ? 'live' : 'finalizing',
    error: error instanceof Error ? error.message : 'Failed to load battle data',
  }
}

/** Fetch one complete range, including every catch-up page even after combat ends. */
export async function fetchBattleData(
  battleId: string,
  tickStart: number,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  apiBase = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com',
  refreshSummary = true,
): Promise<BattleLoadResult> {
  signal.throwIfAborted()
  const id = encodeURIComponent(battleId)
  const request = async (url: string) => {
    signal.throwIfAborted()
    const response = await fetcher(url, {
      cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    })
    signal.throwIfAborted()
    return response
  }
  const readSummary = async (): Promise<{ summary: BattleSummary | null; summaryError: string | null }> => {
    try {
      const response = await request(`${apiBase}/api/battle/summary?battle_id=${id}`)
      // The active battle is removed before its final row has persisted.
      if (response.status === 404) return { summary: null, summaryError: null }
      if (!response.ok) throw new Error(`Battle summary: HTTP ${response.status}`)
      const summary = await response.json() as BattleSummary
      if (summary.battle_id !== battleId) throw new Error('Battle summary response did not match the requested battle')
      return { summary, summaryError: null }
    } catch (error) {
      return { summary: null, summaryError: error instanceof Error ? error.message : 'Failed to load battle summary' }
    }
  }
  let summaryPromise = refreshSummary ? readSummary() : null

  let cursor = Math.max(0, tickStart)
  let entries: BattleLogEntry[] = []
  let status: BattleLogResponse['status']
  while (true) {
    const response = await request(`${apiBase}/api/battle/log?battle_id=${id}&tick_start=${cursor}&limit=200`)
    if (!response.ok) throw new Error(`Battle log: HTTP ${response.status}`)
    const data = await response.json() as BattleLogResponse & { error?: string }
    signal.throwIfAborted()
    if (data.error) throw new Error(data.error)
    if (data.battle_id !== battleId) throw new Error('Battle log response did not match the requested battle')
    if (data.entries != null && !Array.isArray(data.entries)) throw new Error('Invalid battle log entries')
    const page = data.entries ?? []
    if (page.some(entry => entry.battle_id !== battleId || !Number.isSafeInteger(entry.tick) || entry.tick < 0)) {
      throw new Error('Invalid battle log tick')
    }
    entries = mergeBattleEntries(entries, page, battleId)
    status = data.status ?? status
    if (!data.has_more || page.length === 0) break
    const nextCursor = Math.max(...page.map(entry => entry.tick)) + 1
    if (nextCursor <= cursor) throw new Error('Battle log pagination did not advance')
    cursor = nextCursor
  }
  // Steady live tails need only the log. Refresh header totals/outcome as soon
  // as that response contains the terminal frame, without another poll delay.
  if (!summaryPromise && entries.some(entry => entry.battle_ended)) summaryPromise = readSummary()
  const summary = summaryPromise ? await summaryPromise : { summary: null, summaryError: null }
  signal.throwIfAborted()
  return { entries, status, ...summary, full: tickStart <= 0 }
}
