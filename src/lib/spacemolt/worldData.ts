'use client'

/**
 * Module-level MapCache/CatalogCache shared across the /play client — bulk
 * world data is player-independent, so it survives player switches and
 * reconnects. GalaxyPanel's raw /api/map fetch and the catalog views route
 * through here.
 */
import { useEffect, useState } from 'react'
import { CatalogCache, MapCache } from '@spacemolt/lib'

const GAMESERVER_URL = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

let mapPromise: Promise<MapCache> | null = null
let catalogPromise: Promise<CatalogCache> | null = null

export function loadMap(): Promise<MapCache> {
  mapPromise ??= MapCache.load(GAMESERVER_URL).catch((err) => {
    mapPromise = null // allow retry after a failed load
    throw err
  })
  return mapPromise
}

export function loadCatalog(): Promise<CatalogCache> {
  catalogPromise ??= CatalogCache.load(GAMESERVER_URL).catch((err) => {
    catalogPromise = null
    throw err
  })
  return catalogPromise
}

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
