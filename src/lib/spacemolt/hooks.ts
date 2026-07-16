'use client'

/**
 * React subscriptions over the AccountStore. Each hook subscribes to exactly
 * one store key, so a component re-renders only when the slice it reads
 * actually changes (per-section object identity comes from the lib's
 * StateCache).
 */
import type { GameState, StateSection } from '@spacemolt/lib'
import { useAccountStore } from './AccountProvider'
import type { ConnectionPhase, PendingAction } from './accountStore'
import { useStoreKey } from './internal'

export function useSection<S extends StateSection>(section: S): GameState[S] {
  const store = useAccountStore()
  return useStoreKey(store, section, () => store.getSection(section))
}

export const usePlayer = () => useSection('player')
export const useShip = () => useSection('ship')
export const useModules = () => useSection('modules')
export const useCargo = () => useSection('cargo')
export const useLocationState = () => useSection('location')
export const useMissions = () => useSection('missions')
export const useQueue = () => useSection('queue')
export const useSkills = () => useSection('skills')

export function useConnectionPhase(): { phase: ConnectionPhase; detail: string | null } {
  const store = useAccountStore()
  const phase = useStoreKey(store, 'phase', () => store.getPhase())
  const detail = useStoreKey(store, 'phase', () => store.getPhaseDetail())
  return { phase, detail }
}

/** Highest game tick observed on this connection (no per-tick push exists). */
export function useCurrentTick(): number {
  const store = useAccountStore()
  return useStoreKey(store, 'tick', () => store.getCurrentTick())
}

export function usePendingAction(): PendingAction | null {
  const store = useAccountStore()
  return useStoreKey(store, 'pending', () => store.getPendingAction())
}
