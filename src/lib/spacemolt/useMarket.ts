'use client'

/**
 * Live order book for the docked station via the lib's market subscription.
 * The server silently unsubscribes on undock and the lib drops the dead cache
 * entry; this hook re-subscribes whenever docked_at changes.
 */
import { useEffect } from 'react'
import type { MarketBook } from '@spacemolt/lib'
import { useAccountStore } from './AccountProvider'
import { useLocationState } from './hooks'
import { useStoreKey } from './internal'

export function useMarket(): MarketBook | null {
  const store = useAccountStore()
  const location = useLocationState()
  const dockedAt = location?.docked_at ?? null

  useEffect(() => {
    if (!dockedAt) return
    let cancelled = false
    store.account.subscribeMarket().catch(() => {
      if (!cancelled) {
        // Subscription is an optimization over view_market; panels fall back
        // to their own query when the book is null.
      }
    })
    return () => {
      cancelled = true
    }
  }, [store, dockedAt])

  return useStoreKey(store, 'market', () => (dockedAt ? (store.account.market(dockedAt) ?? null) : null))
}
