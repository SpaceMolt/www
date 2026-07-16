/**
 * React bindings over @spacemolt/lib for the /play client.
 *
 * Layering:
 * - accountStore: non-React store adapting one Account to useSyncExternalStore
 * - AccountProvider: owns the Account lifecycle (connect/auth/dispose)
 * - hooks: per-section state subscriptions (usePlayer, useShip, ...)
 * - useCommandQuery/useCommandMutation: panel-local fetches + tick-queued actions
 * - uiStore + wireNotifications: UI-local state fed by server pushes
 * - useMarket/useObservation/useSystemPoi/worldData: live views + bulk data
 */
export { createAccountStore } from './accountStore'
export type { AccountStore, ConnectionPhase, PendingAction, StoreKey } from './accountStore'
export { AccountProvider, useAccountStore, wsUrlFromHttpBase } from './AccountProvider'
export {
  useCargo,
  useConnectionPhase,
  useCurrentTick,
  useLocationState,
  useMissions,
  useModules,
  usePendingAction,
  usePlayer,
  useQueue,
  useSection,
  useShip,
  useSkills,
} from './hooks'
export { useCommandQuery } from './useCommandQuery'
export type { CommandQueryOptions, CommandQueryResult } from './useCommandQuery'
export { useCommandMutation } from './useCommandMutation'
export type { MutationOptions, RunMutation } from './useCommandMutation'
export { createUiStore, initialUiState, uiReducer, useUiSlice } from './uiStore'
export type { BattleView, ChatMessage, CraftJob, EventLogEntry, Toast, TradeOffer, UiAction, UiState, UiStore } from './uiStore'
export { seedFromLogin, wireNotifications } from './wireNotifications'
export { useMarket } from './useMarket'
export { useObservation } from './useObservation'
export { usePoi, useSystem } from './useSystemPoi'
export { loadCatalog, loadMap, useCatalog, useMap } from './worldData'
