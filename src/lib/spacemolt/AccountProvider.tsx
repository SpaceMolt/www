'use client'

/**
 * Owns the Account lifecycle for one selected player: construct, connect,
 * authenticate, dispose. A fresh single-use ws-token is minted per (re)connect
 * via the credentials provider, so StrictMode's throwaway first mount can
 * never burn the token the surviving mount needs, and reconnects re-auth
 * cleanly with short-lived browser Clerk JWTs.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Account } from '@spacemolt/lib'
import { instrumentCommands } from '@/lib/analytics/gameActions'
import { capture } from '@/lib/analytics/posthog'
import { createAccountStore, type AccountStore } from './accountStore'

const AccountContext = createContext<AccountStore | null>(null)

/** http(s) origin -> ws(s) /ws/v2 endpoint. */
export function wsUrlFromHttpBase(httpBase: string): string {
  return `${httpBase.replace(/\/$/, '').replace(/^http/, 'ws')}/ws/v2`
}

/**
 * Points `account.commands` at an instrumented view of itself, so every
 * player-initiated mutation emits one `game_action` no matter which call site
 * issued it (including the handful that bypass useCommandMutation).
 *
 * `commands` is a prototype getter that lazily builds and memoises the real
 * facade, so we read it once to force construction and then shadow it with an
 * own property. The library is left untouched.
 */
export function instrumentAccountCommands(account: Account): void {
  const real = account.commands
  const instrumented = instrumentCommands(real, (event) => capture('game_action', { ...event }))
  Object.defineProperty(account, 'commands', {
    configurable: true,
    get: () => instrumented,
  })
}

export interface AccountProviderProps {
  /** Player being connected; changing it tears down and reconnects. */
  playerId: string
  /**
   * Mints a fresh single-use ws-token (POST /api/player/{id}/ws-token).
   * Called once per connect and again on every reconnect — must be stable
   * (useCallback) or the connection is torn down and rebuilt on every render.
   */
  mintToken: () => Promise<string>
  /** Gameserver HTTP origin, e.g. https://game.spacemolt.com */
  gameserverUrl: string
  /** Rendered until the store exists (first effect run). */
  fallback?: ReactNode
  children: ReactNode
}

export function AccountProvider({ playerId, mintToken, gameserverUrl, fallback = null, children }: AccountProviderProps) {
  const [store, setStore] = useState<AccountStore | null>(null)

  useEffect(() => {
    let cancelled = false
    const account = new Account({
      url: wsUrlFromHttpBase(gameserverUrl),
      reconnect: true,
      credentials: async () => ({ kind: 'login_token', token: await mintToken() }),
    })
    instrumentAccountCommands(account)
    const nextStore = createAccountStore(account)
    setStore(nextStore)

    void (async () => {
      try {
        await account.connect()
        if (cancelled) return
        nextStore.setPhase('authenticating')
        await account.authenticate({ kind: 'login_token', token: await mintToken() })
        if (!cancelled) nextStore.setPhase('ready')
      } catch (err) {
        if (!cancelled) nextStore.fail(err)
      }
    })()

    return () => {
      cancelled = true
      nextStore.dispose()
      setStore(null)
    }
  }, [playerId, mintToken, gameserverUrl])

  if (!store) return <>{fallback}</>
  return <AccountContext.Provider value={store}>{children}</AccountContext.Provider>
}

export function useAccountStore(): AccountStore {
  const store = useContext(AccountContext)
  if (!store) throw new Error('useAccountStore must be used inside <AccountProvider>')
  return store
}
