'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useVisiblePoll } from '@/lib/useVisiblePoll'
import {
  applyBattleLoadResult, battleTailStart, failBattleLoad, fetchBattleData,
  initialBattleLoaderState, needsFullReconciliation, shouldPollBattle,
  type BattleLoaderState, type BattleLoadPhase,
} from './battleData'
import type { BattleLogEntry, BattleSummary } from './types'

const LIVE_POLL_MS = 5_000
const STALE_AFTER_MS = 20_000

export type { BattleLoadPhase } from './battleData'

export interface BattleData {
  summary: BattleSummary | null
  entries: BattleLogEntry[]
  /** Replay liveness, not authority to issue commands as a participant. */
  isLive: boolean
  loading: boolean
  error: string | null
  phase: BattleLoadPhase
  freshness: 'fresh' | 'stale'
  updatedAt: number | null
  refreshing: boolean
  retry: () => void
}

export interface BattleDataOptions {
  enabled?: boolean
}

/** One cancellable replay source shared by the full and embedded viewers. */
export function useBattleData(battleId: string, { enabled = true }: BattleDataOptions = {}): BattleData {
  const [record, setRecord] = useState(() => ({ battleId, data: initialBattleLoaderState() }))
  const latest = useRef(record)
  const controls = useRef<{ poll: () => void; retry: () => void } | null>(null)

  useEffect(() => {
    let state = latest.current.battleId === battleId ? latest.current.data : initialBattleLoaderState()
    let disposed = false
    let request: AbortController | null = null
    const publish = (data: BattleLoaderState) => {
      if (disposed) return
      state = data
      latest.current = { battleId, data }
      setRecord(latest.current)
    }

    const run = async (full = false) => {
      if (disposed || !battleId || !enabled || request || (!full && !shouldPollBattle(state))) return
      const controller = new AbortController()
      request = controller
      publish({ ...state, refreshing: true })
      try {
        const start = full || needsFullReconciliation(state, Date.now()) ? 0 : battleTailStart(state.entries)
        const refreshSummary = full || !state.summary || state.phase === 'finalizing'
        const result = await fetchBattleData(battleId, start, controller.signal, undefined, undefined, refreshSummary)
        if (disposed || controller.signal.aborted) return
        publish(applyBattleLoadResult(state, result, Date.now()))
      } catch (error) {
        if (!disposed && !controller.signal.aborted) publish(failBattleLoad(state, error, Date.now()))
      } finally {
        // A failed log request must not leave its parallel summary request
        // running into the next poll.
        controller.abort()
        if (request === controller) request = null
      }
    }

    const activeControls = {
      poll: () => { void run() },
      retry: () => {
        if (request || disposed || !enabled) return
        publish({ ...state, phase: state.phase === 'live' ? 'live' : 'loading', loading: state.entries.length === 0,
          finalizingSince: null, terminalSeenAt: null, error: null })
        void run(true)
      },
    }
    controls.current = activeControls
    publish({ ...state, refreshing: false, ...(battleId ? {} : { loading: false, phase: 'unavailable' as const }) })
    if (battleId && enabled) void run(state.entries.length === 0)

    return () => {
      disposed = true
      request?.abort()
      if (controls.current === activeControls) controls.current = null
    }
  }, [battleId, enabled])

  useVisiblePoll(() => controls.current?.poll(), LIVE_POLL_MS)
  const retry = useCallback(() => controls.current?.retry(), [])
  // Never expose the previous account/battle's data during an ID-change render.
  const state = record.battleId === battleId ? record.data : initialBattleLoaderState()
  const stale = state.error !== null || state.updatedAt === null ||
    (state.phase !== 'complete' && Date.now() - state.updatedAt > STALE_AFTER_MS)
  return {
    summary: state.summary, entries: state.entries, isLive: state.phase === 'live',
    loading: state.loading, error: state.error, phase: state.phase,
    freshness: stale ? 'stale' : 'fresh', updatedAt: state.updatedAt,
    refreshing: state.refreshing, retry,
  }
}
