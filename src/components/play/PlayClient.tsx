'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, RefreshCw, WifiOff, LogIn } from 'lucide-react'
import { SignInButton } from '@clerk/nextjs'
import { GameProvider, useGame } from './GameProvider'
import { PlayerSelector } from './PlayerSelector'
import { HUD } from './HUD'
import { useGameAuth } from '@/lib/useGameAuth'
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
  const { state, send, sendCommand, connect, disconnect } = useGame()
  const [phase, setPhase] = useState<'connecting' | 'authenticating' | 'playing'>('connecting')
  const hasConnected = useRef(false)
  const authAttempted = useRef(false)

  // Connect on mount
  useEffect(() => {
    connect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Add play-page class to body
  useEffect(() => {
    document.body.classList.add('play-page')
    return () => { document.body.classList.remove('play-page') }
  }, [])

  // Fetch a ws-token and send login_token over the WebSocket
  const authenticateWithToken = useCallback(async () => {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/player/${playerId}/ws-token`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) {
        console.error('[PlayClient] Failed to get ws-token:', res.status)
        return
      }
      const data = await res.json()
      send({ type: 'login_token', payload: { token: data.token } })
    } catch (err) {
      console.error('[PlayClient] Token auth error:', err)
    }
  }, [authHeaders, playerId, send])

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

  // Reconnect overlay
  const showReconnecting = !state.connected && hasConnected.current && phase === 'playing'

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

  const handleSwitchPlayer = useCallback(() => {
    setSelectedPlayerId(null)
  }, [])

  // Player selected — launch game
  return (
    <GameProvider onSwitchPlayer={handleSwitchPlayer}>
      <PlayClientInner playerId={selectedPlayerId} authHeaders={authHeaders} onSwitchPlayer={handleSwitchPlayer} />
    </GameProvider>
  )
}
