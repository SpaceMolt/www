'use client'

import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react'
import { useGame } from './GameProvider'
import type { CatalogItem } from '../ItemDetail'

interface ItemCatalogContextValue {
  getItem: (id: string) => CatalogItem | undefined
  fetchItem: (id: string) => Promise<CatalogItem | undefined>
  isLoading: (id: string) => boolean
}

const ItemCatalogContext = createContext<ItemCatalogContextValue | null>(null)

export function useItemCatalog() {
  const ctx = useContext(ItemCatalogContext)
  if (!ctx) throw new Error('useItemCatalog must be used within ItemCatalogProvider')
  return ctx
}

export function ItemCatalogProvider({ children }: { children: ReactNode }) {
  const { api } = useGame()
  const cache = useRef<Map<string, CatalogItem>>(new Map())
  const inflight = useRef<Map<string, Promise<CatalogItem | undefined>>>(new Map())
  const loading = useRef<Set<string>>(new Set())

  const fetchItem = useCallback(async (id: string): Promise<CatalogItem | undefined> => {
    const cached = cache.current.get(id)
    if (cached) return cached

    // Deduplicate in-flight requests
    const existing = inflight.current.get(id)
    if (existing) return existing

    if (!api) return undefined

    loading.current.add(id)
    const promise = api.command('catalog', { type: 'items', id }).then((result) => {
      const r = result as Record<string, unknown>
      const items = (r.items || []) as Array<Record<string, unknown>>
      if (items.length > 0) {
        const item = items[0] as unknown as CatalogItem
        cache.current.set(id, item)
        return item
      }
      return undefined
    }).catch(() => undefined).finally(() => {
      loading.current.delete(id)
      inflight.current.delete(id)
    })

    inflight.current.set(id, promise)
    return promise
  }, [api])

  const getItem = useCallback((id: string): CatalogItem | undefined => {
    return cache.current.get(id)
  }, [])

  const isLoading = useCallback((id: string): boolean => {
    return loading.current.has(id)
  }, [])

  return (
    <ItemCatalogContext.Provider value={{ getItem, fetchItem, isLoading }}>
      {children}
    </ItemCatalogContext.Provider>
  )
}
