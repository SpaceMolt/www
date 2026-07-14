'use client'

import { useCallback, useEffect, useState } from 'react'
import { useVisiblePoll } from '@/lib/useVisiblePoll'
import { subscribeToEvents } from '@/lib/sharedEventSource'

export interface ServerStats {
  version: string
  online_players: number
  total_players: number
  total_systems: number
  tick: number
  forum_threads: number
  forum_replies: number
}

/** The numeric fields the chrome formats; anything missing them is not stats. */
function isServerStats(data: unknown): data is ServerStats {
  if (typeof data !== 'object' || data === null) return false
  const s = data as Record<string, unknown>
  return typeof s.tick === 'number' && typeof s.online_players === 'number'
}

/**
 * Server stats for the console chrome: one slow /api/stats poll shared by the
 * topbar telemetry and the live pane, with the tick kept fresh from the SSE
 * feed (every event carries the current tick, so that costs no extra requests).
 */
export function useServerStats() {
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [online, setOnline] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'}/api/stats`)
      // A rate-limited /api/stats answers 429 with a JSON *error* body, so
      // response.json() resolves happily and the error object used to be stored
      // as if it were stats. `stats` then read as present while every field was
      // missing, and the topbar's `stats ? stats.tick.toLocaleString() : '-'`
      // threw on undefined — a guard that only ever checked the object, never
      // its contents. Reject anything that is not actually a stats payload and
      // keep the last good one on screen.
      if (!response.ok) {
        setOnline(false)
        return
      }
      const data: unknown = await response.json()
      if (!isServerStats(data)) {
        setOnline(false)
        return
      }
      setStats(data)
      setOnline(true)
    } catch {
      setOnline(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useVisiblePoll(refresh, 30000)

  useEffect(() => {
    return subscribeToEvents((raw) => {
      try {
        const parsed = JSON.parse(raw) as { tick?: number }
        setOnline(true)
        if (typeof parsed.tick === 'number' && parsed.tick > 0) {
          setStats((prev) => (prev ? { ...prev, tick: parsed.tick! } : prev))
        }
      } catch {
        // ignore parse errors
      }
    })
  }, [])

  return { stats, online }
}
