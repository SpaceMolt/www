'use client'

import { useCallback, useState } from 'react'
import { usePlay } from '../../PlayProvider'
import { errorMessage } from '../../shared'

/** Runs one faction command at a time: `busy` names the running key, failures become a toast. Resolves true on success. */
export function useRun() {
  const { uiStore } = usePlay()
  const [busy, setBusy] = useState<string | null>(null)
  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, success?: string) => {
      setBusy(key)
      try {
        await fn()
        if (success) uiStore.dispatch({ type: 'toast', kind: 'success', text: success })
        return true
      } catch (err) {
        uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
        return false
      } finally {
        setBusy(null)
      }
    },
    [uiStore],
  )
  return { busy, run }
}
