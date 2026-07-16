'use client'

/**
 * Live presence watch for the current POI while undocked — replaces the old
 * 10s get_nearby poll. The lib bridges observation updates into
 * location.nearby_players; this hook exposes the raw view for panels that
 * want arrival/departure detail. Pirates/NPCs are not in the feed (players
 * only) and still refresh via deltas or account.refresh().
 */
import { useEffect } from 'react'
import type { ObservationView } from '@spacemolt/lib'
import { useAccountStore } from './AccountProvider'
import { useLocationState } from './hooks'
import { useStoreKey } from './internal'

export function useObservation(): ObservationView | null {
  const store = useAccountStore()
  const location = useLocationState()
  const undockedAtPoi = Boolean(location?.poi_id && !location?.docked_at)

  useEffect(() => {
    if (!undockedAtPoi) return
    store.account.subscribeObservation().catch(() => {
      // Best-effort: nearby_players still refreshes via mutation deltas.
    })
  }, [store, undockedAtPoi, location?.poi_id])

  return useStoreKey(store, 'observation', () => store.account.observation())
}
