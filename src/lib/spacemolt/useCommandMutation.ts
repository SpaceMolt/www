'use client'

/**
 * Two-phase mutation wrapper: mutations queue server-side and resolve on the
 * executing tick's action_result (travel/jump can span many ticks). The
 * pendingAction slice drives the ActionBanner/TickCooldown UX while the
 * promise is outstanding.
 */
import { useCallback } from 'react'
import type { Commands, MutationResult } from '@spacemolt/lib'
import { useAccountStore } from './AccountProvider'

export interface MutationOptions {
  /** Label shown in the pending-action banner; defaults to the action name. */
  label?: string
  /** Progress-bar estimate for multi-tick actions (travel/jump). */
  estimatedMs?: number
}

export type RunMutation = (
  run: (commands: Commands) => Promise<MutationResult>,
  options?: MutationOptions,
) => Promise<MutationResult>

/**
 * Returns a runner that executes one typed mutation through the account's
 * command facade, tracking it in the store's pendingAction slice:
 *
 *   const mutate = useCommandMutation()
 *   await mutate((c) => c.spacemolt.jump({ id }), { label: 'jump', estimatedMs })
 */
export function useCommandMutation(): RunMutation {
  const store = useAccountStore()
  return useCallback<RunMutation>(
    async (run, { label = 'action', estimatedMs }: MutationOptions = {}) => {
      store.setPendingAction({ command: label, startedAt: Date.now(), estimatedMs })
      try {
        return await run(store.account.commands)
      } finally {
        store.clearPendingAction()
      }
    },
    [store],
  )
}
