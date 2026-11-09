'use client'

/**
 * Module-level MapCache/CatalogCache/station directory shared across the /play client — bulk
 * world data is player-independent, so it survives player switches and
 * reconnects. GalaxyPanel's raw /api/map fetch and the catalog views route
 * through here.
 */
import { useEffect, useState } from 'react'
import { CatalogCache, MapCache, fetchStations } from '@spacemolt/lib'

const GAMESERVER_URL = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

/** Memoizes one load; a failed load clears the cache so the next call retries. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null
  return () =>
    (promise ??= load().catch((err) => {
      promise = null
      throw err
    }))
}

export const loadMap = once(() => MapCache.load(GAMESERVER_URL))
export const loadCatalog = once(() => CatalogCache.load(GAMESERVER_URL))
export const loadStations = once(async () => (await fetchStations(GAMESERVER_URL)).stations)

function useLoaded<T>(load: () => Promise<T>): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    load().then(
      (value) => {
        if (!cancelled) setData(value)
      },
      (err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { data, error }
}

export const useMap = () => useLoaded(loadMap)
export const useCatalog = () => useLoaded(loadCatalog)
export const useStations = () => useLoaded(loadStations)
