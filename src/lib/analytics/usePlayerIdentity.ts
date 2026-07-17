'use client'

import { useEffect } from 'react'
import { identifyPlayer, resetIdentity } from './posthog'

/**
 * Ties the current session's events to a player for as long as that player is
 * selected, and unties them on switch or disconnect.
 *
 * Pass the opaque game player id and nothing else — never a character username,
 * an email, or a Clerk id. Because persistence is 'memory', this identity lives
 * only for the tab's lifetime; it does not follow anyone across visits.
 */
export function usePlayerIdentity(playerId: string | undefined): void {
  useEffect(() => {
    if (!playerId) return
    identifyPlayer(playerId)
    return () => resetIdentity()
  }, [playerId])
}
