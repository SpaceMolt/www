'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useVisiblePoll } from '@/lib/useVisiblePoll'
import {
  type BattleLogEntry,
  type BattleLogResponse,
  type BattleSummary,
  normalizeEntries,
} from './types'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const LIVE_POLL_MS = 5_000

export interface BattleData {
  summary: BattleSummary | null
  entries: BattleLogEntry[]
  /** True while the battle is still being fought on the server */
  isLive: boolean
  loading: boolean
  error: string | null
}

/**
 * Loads the full battle log (paginated) plus the battle summary, then — for
 * battles still in progress — tail-polls the log for new ticks so the viewer
 * can follow the fight live.
 */
export function useBattleData(battleId: string): BattleData {
  const [summary, setSummary] = useState<BattleSummary | null>(null)
  const [entries, setEntries] = useState<BattleLogEntry[]>([])
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lastTickRef = useRef<number>(-1)
  const pollingRef = useRef(false)

  useEffect(() => {
    if (!battleId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setEntries([])
      setSummary(null)
      lastTickRef.current = -1
      try {
        const summaryPromise = fetch(
          `${API_BASE}/api/battle/summary?battle_id=${encodeURIComponent(battleId)}`,
        )
          .then(res => (res.ok ? (res.json() as Promise<BattleSummary>) : null))
          .catch(() => null)

        let allEntries: BattleLogEntry[] = []
        let tickStart = 0
        let hasMore = true
        let logStatus: string | undefined

        while (hasMore) {
          const res = await fetch(
            `${API_BASE}/api/battle/log?battle_id=${encodeURIComponent(battleId)}&tick_start=${tickStart}&limit=200`,
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data: BattleLogResponse = await res.json()
          allEntries = allEntries.concat(data.entries || [])
          logStatus = data.status ?? logStatus
          hasMore = data.has_more
          if (data.entries && data.entries.length > 0) {
            tickStart = data.entries[data.entries.length - 1].tick + 1
          } else {
            hasMore = false
          }
        }

        if (cancelled) return

        normalizeEntries(allEntries)
        const summaryData = await summaryPromise
        if (cancelled) return

        const ended = allEntries.some(e => e.battle_ended)
        const live = !ended && (logStatus === 'active' || summaryData?.status === 'active')

        lastTickRef.current = allEntries.length > 0 ? allEntries[allEntries.length - 1].tick : -1
        setEntries(allEntries)
        setSummary(summaryData)
        setIsLive(live)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load battle data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [battleId])

  const pollTail = useCallback(async () => {
    if (!battleId || pollingRef.current || lastTickRef.current < 0) return
    pollingRef.current = true
    try {
      const res = await fetch(
        `${API_BASE}/api/battle/log?battle_id=${encodeURIComponent(battleId)}&tick_start=${lastTickRef.current + 1}&limit=200`,
        { cache: 'no-store' },
      )
      if (!res.ok) return
      const data: BattleLogResponse = await res.json()
      const fresh = data.entries || []
      if (fresh.length > 0) {
        normalizeEntries(fresh)
        lastTickRef.current = fresh[fresh.length - 1].tick
        setEntries(prev => prev.concat(fresh))
      }
      const ended = fresh.some(e => e.battle_ended) || data.status === 'completed'
      if (ended) {
        setIsLive(false)
        // Pick up the final outcome/winner for the header.
        fetch(`${API_BASE}/api/battle/summary?battle_id=${encodeURIComponent(battleId)}`, { cache: 'no-store' })
          .then(r => (r.ok ? (r.json() as Promise<BattleSummary>) : null))
          .then(s => { if (s) setSummary(s) })
          .catch(() => {})
      }
    } catch {
      // Transient poll failures are fine; the next interval retries.
    } finally {
      pollingRef.current = false
    }
  }, [battleId])

  useVisiblePoll(() => {
    if (isLive) pollTail()
  }, LIVE_POLL_MS)

  return { summary, entries, isLive, loading, error }
}
