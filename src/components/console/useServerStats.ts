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
      const data: ServerStats = await response.json()
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
