'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useUser, useAuth, SignInButton } from '@clerk/nextjs'
import { Loader2, RefreshCw, WifiOff, LogIn } from 'lucide-react'
import { GameProvider, useGame } from './GameProvider'
import { AuthScreen } from './AuthScreen'
import { HUD } from './HUD'
import styles from './PlayClient.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const LS_USERNAME = 'spacemolt_username'
const LS_PASSWORD = 'spacemolt_password'

function PlayClientInner({ registrationCode }: { registrationCode: string }) {
  const { state, sendCommand, connect } = useGame()
  const [phase, setPhase] = useState<'connecting' | 'auth' | 'playing'>('connecting')
  const autoLoginAttempted = useRef(false)
  const hasConnected = useRef(false)

  // Connect on mount
  useEffect(() => {
    connect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Add play-page class to body
  useEffect(() => {
    document.body.classList.add('play-page')
    return () => {
      document.body.classList.remove('play-page')
    }
  }, [])

  // Phase transitions based on state
  useEffect(() => {
    if (state.connected && !hasConnected.current) {
      hasConnected.current = true
    }

    if (state.authenticated && phase !== 'auth') {
      setPhase('playing')
      return
    }

    if (state.connected && state.welcome && !state.authenticated) {
      // Try auto-login from localStorage
      if (!autoLoginAttempted.current) {
        autoLoginAttempted.current = true
        const username = localStorage.getItem(LS_USERNAME)
        const password = localStorage.getItem(LS_PASSWORD)
        if (username && password) {
          sendCommand('login', { username, password })
          return
        }
      }
      setPhase('auth')
    }

    if (!state.connected && hasConnected.current) {
      // Lost connection - show reconnecting state
      autoLoginAttempted.current = false
    }
  }, [state.connected, state.authenticated, state.welcome, sendCommand])

  const handleRegistered = useCallback((username: string, password: string) => {
    localStorage.setItem(LS_USERNAME, username)
    localStorage.setItem(LS_PASSWORD, password)
  }, [])

  // Save username when login succeeds
  useEffect(() => {
    if (state.authenticated && state.player?.username) {
      localStorage.setItem(LS_USERNAME, state.player.username)
    }
  }, [state.authenticated, state.player?.username])

  const handleLoggedIn = useCallback(() => {
    setPhase('playing')
  }, [])

  // Reconnect overlay
  const showReconnecting = !state.connected && hasConnected.current && phase === 'playing'

  if (phase === 'connecting' || (!state.connected && !hasConnected.current)) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <Loader2 size={32} className={styles.spinner} />
          <div className={styles.loadingTitle}>SpaceMolt</div>
          <div className={styles.loadingText}>Connecting to game server...</div>
        </div>
      </div>
    )
  }

  if (phase === 'auth') {
    return (
      <AuthScreen
        registrationCode={registrationCode}
        onRegistered={handleRegistered}
        onLoggedIn={handleLoggedIn}
      />
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
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken, isLoaded: authLoaded } = useAuth()
  const [registrationCode, setRegistrationCode] = useState('')
  const [codeLoaded, setCodeLoaded] = useState(false)

  // Fetch registration code from game server using Clerk token
  useEffect(() => {
    if (!user || !authLoaded) return
    let cancelled = false

    async function fetchCode() {
      try {
        const token = await getToken()
        const res = await fetch(`${GAME_SERVER}/api/registration-code`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setRegistrationCode(data.registration_code || '')
        }
      } catch {
        // Non-critical - user can still play without pre-filled code
      } finally {
        if (!cancelled) setCodeLoaded(true)
      }
    }

    fetchCode()
    return () => { cancelled = true }
  }, [user, authLoaded, getToken])

  // Add play-page class even while loading/unauthenticated
  useEffect(() => {
    document.body.classList.add('play-page')
    return () => {
      document.body.classList.remove('play-page')
    }
  }, [])

  if (!userLoaded || !authLoaded) {
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

  if (!user) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingTitle}>SpaceMolt</div>
          <div className={styles.loadingText}>Sign in to play</div>
          <SignInButton mode="modal">
            <button className={styles.signInBtn}>
              <LogIn size={16} />
              Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    )
  }

  if (!codeLoaded) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <Loader2 size={32} className={styles.spinner} />
          <div className={styles.loadingTitle}>SpaceMolt</div>
          <div className={styles.loadingText}>Preparing session...</div>
        </div>
      </div>
    )
  }

  return (
    <GameProvider>
      <PlayClientInner registrationCode={registrationCode} />
    </GameProvider>
  )
}
