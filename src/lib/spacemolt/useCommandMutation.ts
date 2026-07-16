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

// Generic so each call site keeps the specific `TDetails` of the command it
// invokes (e.g. `c.spacemolt.jump(...)` -> `MutationResult<JumpResponse>`) —
// a non-generic signature here would erase every mutation's response to
// `Record<string, unknown>` and defeat typed `delta.details` access.
export type RunMutation = <TDetails = Record<string, unknown>>(
  run: (commands: Commands) => Promise<MutationResult<TDetails>>,
  options?: MutationOptions,
) => Promise<MutationResult<TDetails>>

/**
 * Returns a runner that executes one typed mutation through the account's
 * command facade, tracking it in the store's pendingAction slice:
 *
 *   const mutate = useCommandMutation()
 *   await mutate((c) => c.spacemolt.jump({ id }), { label: 'jump', estimatedMs })
 */
export function useCommandMutation(): RunMutation {
  const store = useAccountStore()
  return useCallback(
    async <TDetails,>(
      run: (commands: Commands) => Promise<MutationResult<TDetails>>,
      { label = 'action', estimatedMs }: MutationOptions = {},
    ) => {
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
