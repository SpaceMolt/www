'use client'

import { useCallback, useState } from 'react'
import { usePlay } from '../../PlayProvider'
import { errorMessage } from '../../shared'

/**
 * Busy flag + toast wrapper shared by the Crew tabs. `run` resolves to the
 * action's result, or undefined when it threw (the error is toasted).
 */
export function useCrewAction() {
  const { uiStore } = usePlay()
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async <T,>(action: () => Promise<T>, success?: (result: T) => string | undefined) => {
      setBusy(true)
      try {
        const result = await action()
        const text = success?.(result)
        if (text) uiStore.dispatch({ type: 'event', kind: 'success', text })
        return result
      } catch (err) {
        uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [uiStore],
  )

  return { busy, run }
}
