'use client'

import { useCallback, useState } from 'react'
import { usePlay } from '../PlayProvider'
import { errorMessage } from './errorMessage'

/**
 * Runs one command at a time. `busy` names the running key; a failure becomes a danger toast.
 * `success` (text, or text from the result) goes to the event log, or a toast with `as: 'toast'`.
 * Resolves to the action's result, or undefined when it threw.
 */
export function useAction() {
  const { uiStore } = usePlay()
  const [busy, setBusy] = useState<string | null>(null)

  const run = useCallback(
    async <T,>(
      key: string,
      action: () => Promise<T>,
      success?: string | ((result: T) => string | undefined),
      as: 'event' | 'toast' = 'event',
    ) => {
      setBusy(key)
      try {
        const result = await action()
        const text = typeof success === 'function' ? success(result) : success
        if (text) uiStore.dispatch({ type: as, kind: 'success', text })
        return result
      } catch (err) {
        uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
        return undefined
      } finally {
        setBusy(null)
      }
    },
    [uiStore],
  )

  return { busy, run }
}
