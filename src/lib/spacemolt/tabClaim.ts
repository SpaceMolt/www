'use client'

/**
 * One browser tab per character. The gameserver keeps one connection per
 * character and closes the older one with 4001 session_replaced, so two tabs
 * on the same character kick each other. A Web Lock named after the character
 * lets a tab see that another tab already plays it, and ask before taking over.
 * Different characters use different locks and play side by side.
 */
import { useCallback, useEffect, useState } from 'react'

export type TabClaim = 'pending' | 'held' | 'elsewhere'

const LOCK_PREFIX = 'spacemolt-play:'

export const tabLockName = (playerId: string) => LOCK_PREFIX + playerId

/**
 * Requests the character's lock. Without steal, a lock held by another tab
 * reports 'elsewhere'. With steal, the other tab's lock is revoked and that
 * tab reports 'elsewhere'. Returns a release function.
 */
export function claimTab(
  locks: LockManager | undefined,
  playerId: string,
  steal: boolean,
  onClaim: (claim: TabClaim) => void,
): () => void {
  // No Web Locks (old browser): play as before; the server still resolves conflicts.
  if (!locks) {
    onClaim('held')
    return () => {}
  }
  let active = true
  let release = () => {}
  const held = new Promise<void>((resolve) => { release = resolve })
  locks
    .request(tabLockName(playerId), steal ? { steal: true } : { ifAvailable: true }, (lock) => {
      if (!active) return
      if (!lock) {
        onClaim('elsewhere')
        return
      }
      onClaim('held')
      return held
    })
    // Rejects with AbortError when another tab steals the lock.
    .catch(() => { if (active) onClaim('elsewhere') })
  return () => {
    active = false
    release()
  }
}

/** Characters this browser plays in other tabs. */
export async function charactersOpenElsewhere(): Promise<Set<string>> {
  if (typeof navigator === 'undefined' || !navigator.locks) return new Set()
  const { held = [] } = await navigator.locks.query()
  return new Set(held.flatMap((l) => (l.name?.startsWith(LOCK_PREFIX) ? [l.name.slice(LOCK_PREFIX.length)] : [])))
}

export function useTabClaim(playerId: string): { claim: TabClaim; takeOver: () => void } {
  const [claim, setClaim] = useState<TabClaim>('pending')
  const [takeovers, setTakeovers] = useState(0)

  useEffect(() => {
    setClaim('pending')
    let release = () => {}
    // Deferred so StrictMode's throwaway mount never requests the lock and
    // makes the surviving mount see its own lock as "another tab".
    const timer = setTimeout(() => {
      release = claimTab(navigator.locks, playerId, takeovers > 0, setClaim)
    }, 0)
    return () => {
      clearTimeout(timer)
      release()
    }
  }, [playerId, takeovers])

  const takeOver = useCallback(() => setTakeovers((n) => n + 1), [])
  return { claim, takeOver }
}
