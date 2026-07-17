'use client'

/**
 * Shared UI-local state for the /play client, layered over the account
 * bindings in src/lib/spacemolt. Owns exactly what is genuinely shared across
 * panels and not cached by the lib: the uiStore (event log, chat, trades,
 * battle view, toasts, craft jobs) fed by server pushes, login seeding, the
 * switch-player callback, and a slow visibility-aware full-state refresh for
 * out-of-band changes that arrive without a mutation delta.
 *
 * Everything else — player/ship/cargo/location state, queries, mutations,
 * market/observation subscriptions — panels take directly from the
 * src/lib/spacemolt hooks.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { usePlayerIdentity } from '@/lib/analytics/usePlayerIdentity'
import { useAccountStore, usePlayer } from '@/lib/spacemolt'
import { createUiStore, seedFromLogin, wireNotifications, useUiSlice, type UiState, type UiStore } from '@/lib/spacemolt'
import { useVisiblePoll } from '@/lib/useVisiblePoll'

const REFRESH_INTERVAL_MS = 30_000

interface PlayContextValue {
  uiStore: UiStore
  onSwitchPlayer?: () => void
}

const PlayContext = createContext<PlayContextValue | null>(null)

export function usePlay(): PlayContextValue {
  const ctx = useContext(PlayContext)
  if (!ctx) throw new Error('usePlay must be used within PlayProvider')
  return ctx
}

/** Subscribe to a slice of the shared UI-local state. */
export function usePlayUi<T>(select: (state: UiState) => T): T {
  const { uiStore } = usePlay()
  return useUiSlice(uiStore, select)
}

export function PlayProvider({ onSwitchPlayer, children }: { onSwitchPlayer?: () => void; children: ReactNode }) {
  const store = useAccountStore()
  const uiStore = useMemo(() => createUiStore(), [])
  const player = usePlayer()

  usePlayerIdentity(player?.id)

  useEffect(() => {
    seedFromLogin(uiStore, store.account.loginPayload)
    const unwire = wireNotifications(store.account, uiStore)
    return () => {
      unwire()
      uiStore.dispatch({ type: 'reset' })
    }
  }, [store, uiStore])

  // Deltas keep the cache live for the player's own actions; this catches
  // out-of-band changes (attacked while idle, background credit movement)
  // without the old 5s/10s polling.
  useVisiblePoll(() => {
    if (store.getPhase() === 'ready') void store.account.refresh().catch(() => {})
  }, REFRESH_INTERVAL_MS)

  const value = useMemo(() => ({ uiStore, onSwitchPlayer }), [uiStore, onSwitchPlayer])
  return <PlayContext.Provider value={value}>{children}</PlayContext.Provider>
}
