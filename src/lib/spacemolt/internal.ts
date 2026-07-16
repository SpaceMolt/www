'use client'

/** Shared subscribe-to-one-store-key plumbing for the spacemolt hooks. */
import { useCallback, useSyncExternalStore } from 'react'
import type { AccountStore, StoreKey } from './accountStore'

export function useStoreKey<T>(store: AccountStore, key: StoreKey, getSnapshot: () => T): T {
  const subscribe = useCallback((callback: () => void) => store.subscribe(key, callback), [store, key])
  // biome-ignore lint/correctness/useExhaustiveDependencies: getSnapshot identity is caller-owned
  const snapshot = useCallback(getSnapshot, [store, key])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
