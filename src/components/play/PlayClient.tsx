'use client'

import { useEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, RefreshCw, WifiOff, LogIn, MonitorSmartphone, Users } from 'lucide-react'
import { SignInButton } from '@clerk/nextjs'
import { mintWsToken } from '@spacemolt/lib'
import { AccountProvider, useAccountStore, useConnectionPhase } from '@/lib/spacemolt'
import { PlayProvider } from './PlayProvider'
import { PlayerSelector } from './PlayerSelector'
import { findPlayer } from '@/lib/matchesPlayer'
import { HUD } from './HUD'
import { useGameAuth } from '@/lib/useGameAuth'
import { useTabClaim } from '@/lib/spacemolt/tabClaim'
import styles from './PlayClient.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface LinkedPlayer {
  id: string
  username: string
}

/**
 * PlayClientInner renders the game once a player is connected. Connection,
 * authentication (fresh single-use ws-token per (re)connect), and reconnect
 * are owned by AccountProvider; this component just maps the connection phase
 * to screens.
 */
function PlayClientInner() {
  const store = useAccountStore()
  const { phase, detail } = useConnectionPhase()
  const wasReady = useRef(false)
  if (phase === 'ready') wasReady.current = true

  // Add play-page class to body
  useEffect(() => {
    document.body.classList.add('play-page')
    return () => { document.body.classList.remove('play-page') }
  }, [])

  const reconnectHere = useCallback(() => {
    store.setPhase('connecting')
    store.account
      .reconnectOnce()
      .then(() => store.setPhase('ready'))
      .catch((err) => store.fail(err))
  }, [store])

  // Session replaced — another tab/client connected as this player
  if (phase === 'session_replaced') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <MonitorSmartphone size={32} />
          <div className={styles.loadingTitle}>Session Replaced</div>
          <div className={styles.loadingText}>
            Another browser, device, or agent connected as this player.
          </div>
          <button className={styles.signInBtn} onClick={reconnectHere}>
            Reconnect Here
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <WifiOff size={32} />
          <div className={styles.loadingTitle}>Connection Failed</div>
          <div className={styles.loadingText}>{detail || 'Could not reach the game server.'}</div>
          <button className={styles.signInBtn} onClick={reconnectHere}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Initial connect/auth — nothing to show behind the loader yet
  if (!wasReady.current) {
    return <LoadingScreen text={phase === 'authenticating' ? 'Authenticating...' : 'Connecting to game server...'} />
  }

  // Ready before (HUD has state to show); overlay while the lib reconnects
  const showReconnecting = phase === 'reconnecting' || phase === 'disconnected'
  return (
    <>
      <HUD />
      {showReconnecting && (
        <div className={styles.reconnectOverlay}>
          <div className={styles.reconnectCard}>
            <WifiOff size={24} className={styles.reconnectIcon} />
            <div className={styles.reconnectTitle}>Connection Lost</div>
            <div className={styles.reconnectText}>
              {phase === 'disconnected' ? 'Connection lost.' : 'Reconnecting automatically...'}
            </div>
            {phase === 'disconnected' ? (
              <button className={styles.signInBtn} onClick={reconnectHere}>
                <RefreshCw size={16} />
                Reconnect
              </button>
            ) : (
              <RefreshCw size={20} className={styles.spinner} />
            )}
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Connects only while this tab holds the character's tab lock. If another tab
 * of this browser plays the character, ask before taking over instead of
 * kicking it to a "Session Replaced" screen.
 */
function TabGate({ playerId, onSwitchPlayer, children }: { playerId: string; onSwitchPlayer: () => void; children: ReactNode }) {
  const { claim, takeOver } = useTabClaim(playerId)
  if (claim === 'held') return <>{children}</>
  if (claim === 'pending') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <Loader2 size={32} className={styles.spinner} />
          <div className={styles.loadingTitle}>SpaceMolt</div>
        </div>
      </div>
    )
  }
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingContent}>
        <MonitorSmartphone size={32} />
        <div className={styles.loadingTitle}>Open in Another Tab</div>
        <div className={styles.loadingText}>This player is connected in another tab of this browser.</div>
        <button className={styles.signInBtn} onClick={takeOver}>
          Play Here
        </button>
        <button className={styles.signInBtn} onClick={onSwitchPlayer}>
          <Users size={16} />
          Switch Player
        </button>
      </div>
    </div>
  )
}

const LAST_PLAYER_KEY = 'spacemolt.play.lastPlayer'

function LoadingScreen({ text }: { text: string }) {
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingContent}>
        <Loader2 size={32} className={styles.spinner} />
        <div className={styles.loadingTitle}>SpaceMolt</div>
        <div className={styles.loadingText}>{text}</div>
      </div>
    </div>
  )
}

/** System accounts like `[Pirate Fleet]` are bracketed; they are not playable characters. */
function playable(players: LinkedPlayer[] | undefined): LinkedPlayer[] {
  return (players ?? []).filter(p => !/^\[.*\]$/.test(p.username))
}

export function PlayClient() {
  const { user, isLoaded, authHeaders } = useGameAuth()
  const searchParams = useSearchParams()
  const [players, setPlayers] = useState<LinkedPlayer[]>([])
  const [registrationCode, setRegistrationCode] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [loadingPlayers, setLoadingPlayers] = useState(true)

  // Remember the pick per browser so a reload returns to the same player.
  const selectPlayer = useCallback((playerId: string | null) => {
    try {
      if (playerId) localStorage.setItem(LAST_PLAYER_KEY, playerId)
      else localStorage.removeItem(LAST_PLAYER_KEY)
    } catch { /* storage blocked */ }
    setSelectedPlayerId(playerId)
  }, [])

  const handleSwitchPlayer = useCallback(() => selectPlayer(null), [selectPlayer])

  const handlePlayerCreated = useCallback(async (playerId: string) => {
    // Re-fetch player list then auto-select the new player
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/registration-code`, { headers })
      if (res.ok) {
        const data = await res.json()
        setPlayers(playable(data.players))
        if (data.registration_code) setRegistrationCode(data.registration_code)
      }
    } catch {
      // Non-critical — we still select the player
    }
    selectPlayer(playerId)
  }, [authHeaders, selectPlayer])

  // A fresh single-use ws-token per (re)connect; short-lived Clerk JWTs (or
  // the dev-mode header) are resolved per request by the headers factory.
  const mintToken = useCallback(() => {
    if (!selectedPlayerId) return Promise.reject(new Error('no player selected'))
    return mintWsToken({ httpBaseUrl: GAME_SERVER, playerId: selectedPlayerId, headers: authHeaders })
  }, [selectedPlayerId, authHeaders])

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
          const linked = playable(data.players)
          setPlayers(linked)
          if (data.registration_code) setRegistrationCode(data.registration_code)

          // Auto-select from query param, the last pick, or if only one player
          const queryPlayer = searchParams.get('player')
          let lastPlayer: string | null = null
          try { lastPlayer = localStorage.getItem(LAST_PLAYER_KEY) } catch { /* storage blocked */ }
          const linkedPlayer = queryPlayer && findPlayer(linked, queryPlayer)
          if (linkedPlayer) {
            setSelectedPlayerId(linkedPlayer.id)
          } else if (lastPlayer && linked.some(p => p.id === lastPlayer)) {
            setSelectedPlayerId(lastPlayer)
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
    return <LoadingScreen text="Loading..." />
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
        onSelect={selectPlayer}
        loading={loadingPlayers}
        authHeaders={authHeaders}
        registrationCode={registrationCode}
        onPlayerCreated={handlePlayerCreated}
      />
    )
  }

  // Player selected — launch game
  return (
    <TabGate key={selectedPlayerId} playerId={selectedPlayerId} onSwitchPlayer={handleSwitchPlayer}>
      <AccountProvider
        playerId={selectedPlayerId}
        mintToken={mintToken}
        gameserverUrl={GAME_SERVER}
        fallback={<LoadingScreen text="Connecting to game server..." />}
      >
        <PlayProvider onSwitchPlayer={handleSwitchPlayer} players={players} onSelectPlayer={selectPlayer}>
          <PlayClientInner />
        </PlayProvider>
      </AccountProvider>
    </TabGate>
  )
}
