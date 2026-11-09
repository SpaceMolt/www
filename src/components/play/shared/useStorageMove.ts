'use client'

import { useCallback } from 'react'
import type { Commands, MutationResult } from '@spacemolt/lib'
import { useCommandMutation } from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { keepFailed, sendInBatches, summarize, type ItemQty, type ItemResult, type Selection } from './itemSelection'

type BulkCall = (c: Commands, items: ItemQty[]) => Promise<MutationResult<unknown>>

/** The per-item results of a bulk storage or jettison response, if it has them. */
const resultsOf = (details: unknown): ItemResult[] | undefined =>
  (details as { results?: ItemResult[] } | undefined)?.results

/**
 * Run one bulk items[] storage call (split at 100 items), toast the outcome, refresh every storage view,
 * and return the selection to keep: the rows that failed.
 */
export function useStorageMove() {
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  return useCallback(
    async (verb: string, items: ItemQty[], call: BulkCall, where = ''): Promise<Selection> => {
      const results = await sendInBatches(items, async (batch) =>
        resultsOf((await mutate((c) => call(c, batch), { label: verb.toLowerCase() })).delta.details),
      )
      const { ok, text } = summarize(verb, results, where)
      uiStore.dispatch({ type: ok ? 'event' : 'toast', kind: ok ? 'success' : 'danger', text })
      uiStore.dispatch({ type: 'storage_changed' })
      return keepFailed(results)
    },
    [mutate, uiStore],
  )
}
