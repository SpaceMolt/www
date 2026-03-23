'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, RefreshCw, WifiOff, LogIn, MonitorSmartphone } from 'lucide-react'
import { SignInButton } from '@clerk/nextjs'
import { GameProvider, useGame } from './GameProvider'
import type { ModuleCatalogEntry } from './types'
import { PlayerSelector } from './PlayerSelector'
import { HUD } from './HUD'
import { useGameAuth } from '@/lib/useGameAuth'
import { GameApi } from '@/lib/gameApi'
import styles from './PlayClient.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface LinkedPlayer {
  id: string
  username: string
}

/**
 * PlayClientInner manages the game lifecycle after a player is selected.
 * Phases: connecting → authenticating → playing
 *
 * Authentication uses short-lived tokens from the gameserver's ws-token
 * endpoint, obtained via Clerk JWT. No passwords are stored or transmitted.
 */
function PlayClientInner({ playerId, authHeaders, onSwitchPlayer }: {
  playerId: string
  authHeaders: () => Promise<Record<string, string>>
  onSwitchPlayer: () => void
}) {
  const { state, dispatch, wsSend, sendCommand, setApi, api, connect, disconnect, sessionReplaced } = useGame()
  const [phase, setPhase] = useState<'connecting' | 'authenticating' | 'playing'>('connecting')
  const hasConnected = useRef(false)
  const authAttempted = useRef(false)

  // Connect WS on mount
  const connectRef = useRef(connect)
  connectRef.current = connect
  useEffect(() => {
    connectRef.current()
  }, [])

  // Add play-page class to body
  useEffect(() => {
    document.body.classList.add('play-page')
    return () => { document.body.classList.remove('play-page') }
  }, [])

  // Fetch ws-token helper
  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/player/${playerId}/ws-token`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.token || null
    } catch {
      return null
    }
  }, [authHeaders, playerId])

  // Authenticate both HTTP v2 (for commands) and WebSocket (for notifications)
  const authenticateWithToken = useCallback(async () => {
    try {
      // Token A: authenticate HTTP v2 session
      const tokenA = await fetchToken()
      if (!tokenA) return

      const api = new GameApi()
      await api.createSession()
      await api.loginToken(tokenA)
      setApi(api)

      // Token B: authenticate WebSocket for notifications
      const tokenB = await fetchToken()
      if (tokenB) {
        wsSend({ type: 'login_token', payload: { token: tokenB } })
      }
    } catch {
      // Auth error — will retry on next reconnect
    }
  }, [fetchToken, setApi, wsSend])

  // Phase transitions based on WS state
  useEffect(() => {
    if (state.connected && !hasConnected.current) {
      hasConnected.current = true
    }

    // Authenticated — move to playing
    if (state.authenticated) {
      if (phase !== 'playing') {
        sendCommand('get_status')
        sendCommand('get_system')
        sendCommand('get_poi')
      }
      setPhase('playing')
      authAttempted.current = false
      return
    }

    // Connected + welcome received + not yet authenticated — request token
    if (state.connected && state.welcome && !state.authenticated && !authAttempted.current) {
      authAttempted.current = true
      setPhase('authenticating')
      authenticateWithToken()
      return
    }

    // Lost auth while playing (e.g. server-side logout) — reset for re-auth
    if (phase === 'playing' && !state.authenticated) {
      authAttempted.current = false
      setPhase('connecting')
    }

    // Reconnection: WS came back, need fresh token
    if (!state.connected && hasConnected.current) {
      authAttempted.current = false
    }
  }, [state.connected, state.authenticated, state.welcome, sendCommand, authenticateWithToken, phase])

  // Fetch and cache the full module catalog on first auth
  const moduleCatalogFetched = useRef(false)
  useEffect(() => {
    if (!state.authenticated || !api || moduleCatalogFetched.current) return
    moduleCatalogFetched.current = true

    async function fetchAllModules() {
      const modules: Record<string, ModuleCatalogEntry> = {}
      let page = 1
      let totalPages = 1

      while (page <= totalPages) {
        try {
          const result = await api!.command('catalog', {
            type: 'items',
            category: 'module',
            page,
            page_size: 50,
          }) as Record<string, unknown>

          const items = (result.items || []) as Array<Record<string, unknown>>
          for (const item of items) {
            // Module items have a 'type' field that's one of weapon/defense/mining/utility
            const modType = item.type as string | undefined
            if (modType && ['weapon', 'defense', 'mining', 'utility'].includes(modType)) {
              modules[item.id as string] = item as unknown as ModuleCatalogEntry
            }
          }

          totalPages = (result.total_pages as number) || 1
          page++
        } catch {
          break
        }
      }

      dispatch({ type: 'SET_MODULE_CATALOG', payload: modules })
    }

    fetchAllModules()
  }, [state.authenticated, api, dispatch])

  // Reconnect overlay
  const showReconnecting = !state.connected && hasConnected.current && phase === 'playing' && !sessionReplaced

  // Session replaced — another tab/client connected as this player
  if (sessionReplaced) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <MonitorSmartphone size={32} />
          <div className={styles.loadingTitle}>Session Replaced</div>
          <div className={styles.loadingText}>Another session connected as this player.</div>
          <button className={styles.signInBtn} onClick={() => connect()}>
            Reconnect Here
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'connecting' || phase === 'authenticating' || (!state.connected && !hasConnected.current)) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <Loader2 size={32} className={styles.spinner} />
          <div className={styles.loadingTitle}>SpaceMolt</div>
          <div className={styles.loadingText}>
            {phase === 'authenticating' ? 'Authenticating...' : 'Connecting to game server...'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <HUD />
      {showReconnecting && (
        <div className={styles.reconnectOverlay}>
          <div className={styles.reconnectCard}>
            <WifiOff size={24} className={styles.reconnectIcon} />
            <div className={styles.reconnectTitle}>Connection Lost</div>
            <div className={styles.reconnectText}>Reconnecting automatically...</div>
            <RefreshCw size={20} className={styles.spinner} />
          </div>
        </div>
      )}
    </>
  )
}

export function PlayClient() {
  const { user, isLoaded, authHeaders } = useGameAuth()
  const searchParams = useSearchParams()
  const [players, setPlayers] = useState<LinkedPlayer[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [loadingPlayers, setLoadingPlayers] = useState(true)

  const handleSwitchPlayer = useCallback(() => {
    setSelectedPlayerId(null)
  }, [])

  // Add play-page class even while loading
  useEffect(() => {
    document.body.classList.add('play-page')
    return () => { document.body.classList.remove('play-page') }
  }, [])

  // Fetch linked players from game server
  useEffect(() => {
    if (!isLoaded || !user) return
    let cancelled = false

    async function fetchPlayers() {
      try {
        const headers = await authHeaders()
        const res = await fetch(`${GAME_SERVER}/api/registration-code`, { headers })
        if (res.ok && !cancelled) {
          const data = await res.json()
          const linked: LinkedPlayer[] = data.players || []
          setPlayers(linked)

          // Auto-select from query param or if only one player
          const queryPlayer = searchParams.get('player')
          if (queryPlayer && linked.some(p => p.id === queryPlayer)) {
            setSelectedPlayerId(queryPlayer)
          } else if (linked.length === 1) {
            setSelectedPlayerId(linked[0].id)
          }
        }
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setLoadingPlayers(false)
      }
    }

    fetchPlayers()
    return () => { cancelled = true }
  }, [user, isLoaded, authHeaders, searchParams])

  // Not loaded yet
  if (!isLoaded) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <Loader2 size={32} className={styles.spinner} />
          <div className={styles.loadingTitle}>SpaceMolt</div>
          <div className={styles.loadingText}>Loading...</div>
        </div>
      </div>
    )
  }

  // Not signed in — prompt Clerk sign-in
  if (!user) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingTitle}>SpaceMolt</div>
          <div className={styles.loadingText}>Sign in to play</div>
          <SignInButton mode="modal" forceRedirectUrl="/play">
            <button className={styles.signInBtn}>
              <LogIn size={16} />
              Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    )
  }

  // Player not selected yet — show selector
  if (!selectedPlayerId) {
    return (
      <PlayerSelector
        players={players}
        onSelect={setSelectedPlayerId}
        loading={loadingPlayers}
        authHeaders={authHeaders}
      />
    )
  }

  // Player selected — launch game
  return (
    <GameProvider onSwitchPlayer={handleSwitchPlayer}>
      <PlayClientInner playerId={selectedPlayerId} authHeaders={authHeaders} onSwitchPlayer={handleSwitchPlayer} />
    </GameProvider>
  )
}
