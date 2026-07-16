'use client'

/**
 * Panel-local query state around a lib command: run it, expose
 * data/loading/error, and re-run when a chosen state section changes or a
 * chosen notification arrives. Replaces the old reducer's SET_*_DATA slices —
 * fetched view data belongs to the panel that fetches it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account, StateSection } from '@spacemolt/lib'
import { useAccountStore } from './AccountProvider'

export interface CommandQueryOptions {
  /** Skip running while false (e.g. panel hidden, not docked). */
  enabled?: boolean
  /** Re-run after any of these state sections change. */
  refreshOnSections?: StateSection[]
  /** Re-run after any of these push notifications arrive. */
  refreshOnEvents?: string[]
}

export interface CommandQueryResult<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  refetch: () => void
}

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export function useCommandQuery<T>(
  run: (account: Account) => Promise<T>,
  deps: readonly unknown[],
  { enabled = true, refreshOnSections = [], refreshOnEvents = [] }: CommandQueryOptions = {},
): CommandQueryResult<T> {
  const store = useAccountStore()
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)
  // The latest run wins; earlier in-flight responses are dropped.
  const runSeq = useRef(0)

  const refetch = useCallback(() => setGeneration((g) => g + 1), [])

  // biome-ignore format: dependency list intentionally spreads caller deps
  useEffect(() => {
    if (!enabled) return
    const seq = ++runSeq.current
    setLoading(true)
    run(store.account).then(
      (result) => {
        if (runSeq.current !== seq) return
        setData(result)
        setError(null)
        setLoading(false)
      },
      (err) => {
        if (runSeq.current !== seq) return
        setError(message(err))
        setLoading(false)
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, enabled, generation, ...deps])

  useEffect(() => {
    if (!enabled) return
    const unsubscribers = [
      ...refreshOnSections.map((section) => store.subscribe(section, refetch)),
      ...refreshOnEvents.map((event) => store.account.on(event, refetch)),
    ]
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, enabled, refetch, refreshOnSections.join(','), refreshOnEvents.join(',')])

  return { data, loading, error, refetch }
}
