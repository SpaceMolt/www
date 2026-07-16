/**
 * Non-React store wrapping one @spacemolt/lib Account for the /play client.
 *
 * Adapts the lib's push-driven surface to the useSyncExternalStore contract:
 * per-key subscriber sets, snapshot getters whose references change exactly
 * when the underlying data changes (StateCache assigns a fresh object per
 * section on every seed/delta), and a connection phase machine derived from
 * the Account lifecycle hooks.
 */
import {
  Account,
  CLOSE_CODE,
  type ConnectionClosedError,
  type GameState,
  type StateSection,
} from '@spacemolt/lib'

export type ConnectionPhase =
  | 'connecting'
  | 'authenticating'
  | 'ready'
  | 'reconnecting'
  | 'session_replaced'
  | 'disconnected'
  | 'error'

export type StoreKey = StateSection | 'phase' | 'market' | 'observation' | 'tick' | 'pending'

export interface PendingAction {
  command: string
  startedAt: number
  estimatedMs?: number
}

export interface AccountStore {
  account: Account
  subscribe: (key: StoreKey, callback: () => void) => () => void
  getSection: <S extends StateSection>(section: S) => GameState[S]
  getPhase: () => ConnectionPhase
  /** Human-readable detail for the error/disconnected phases. */
  getPhaseDetail: () => string | null
  setPhase: (phase: ConnectionPhase, detail?: string) => void
  fail: (err: unknown) => void
  getCurrentTick: () => number
  getMarketVersion: () => number
  getObservationVersion: () => number
  getPendingAction: () => PendingAction | null
  setPendingAction: (action: PendingAction) => void
  clearPendingAction: () => void
  /** Unwire all Account listeners and close the connection. */
  dispose: () => void
}

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export function createAccountStore(account: Account): AccountStore {
  const listeners = new Map<StoreKey, Set<() => void>>()
  let phase: ConnectionPhase = 'connecting'
  let phaseDetail: string | null = null
  let marketVersion = 0
  let observationVersion = 0
  let lastTick = account.currentTick
  let pendingAction: PendingAction | null = null

  const notify = (key: StoreKey) => {
    const set = listeners.get(key)
    if (!set) return
    for (const callback of [...set]) callback()
  }

  const setPhase = (next: ConnectionPhase, detail?: string) => {
    if (phase === next && (detail ?? null) === phaseDetail) return
    phase = next
    phaseDetail = detail ?? null
    notify('phase')
  }

  // There is no per-tick server push; the connection's tick clock advances
  // whenever a tick-bearing frame arrives (account.currentTick). Correlated
  // action_result frames surface through onStateChange, pushes through onAny.
  const checkTick = () => {
    if (account.currentTick !== lastTick) {
      lastTick = account.currentTick
      notify('tick')
    }
  }

  const unsubscribers = [
    account.onStateChange((changed) => {
      for (const section of changed) notify(section)
      checkTick()
    }),
    account.onReconnecting(() => setPhase('reconnecting')),
    account.onReconnected(() => setPhase('ready')),
    account.onDisconnected((err: ConnectionClosedError) =>
      setPhase(err.code === CLOSE_CODE.SESSION_REPLACED ? 'session_replaced' : 'disconnected', err.message),
    ),
    account.on('market_update', () => {
      marketVersion++
      notify('market')
    }),
    account.on('observation_update', () => {
      observationVersion++
      notify('observation')
    }),
    account.onAny(checkTick),
  ]

  return {
    account,
    subscribe: (key, callback) => {
      const set = listeners.get(key) ?? new Set()
      set.add(callback)
      listeners.set(key, set)
      return () => {
        set.delete(callback)
      }
    },
    getSection: (section) => account.state[section],
    getPhase: () => phase,
    getPhaseDetail: () => phaseDetail,
    setPhase,
    fail: (err) => setPhase('error', message(err)),
    getCurrentTick: () => account.currentTick,
    getMarketVersion: () => marketVersion,
    getObservationVersion: () => observationVersion,
    getPendingAction: () => pendingAction,
    setPendingAction: (action) => {
      pendingAction = action
      notify('pending')
    },
    clearPendingAction: () => {
      if (!pendingAction) return
      pendingAction = null
      notify('pending')
    },
    dispose: () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      account.close()
    },
  }
}
