'use client'

import Link from 'next/link'
import { SignInButton, SignOutButton } from '@clerk/nextjs'
import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { Settings, BookOpen, Rocket, Users, Ship, Wifi, WifiOff, Clock, Coins, BarChart3, Wrench, ScrollText, MapPin, UserCog, KeyRound, Eye, EyeOff, Copy, Check, RefreshCw, MessageSquare, Play, Monitor, AlertTriangle, Heart, X } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { SetupTabs } from '@/components/SetupTabs'
import { DashboardChat } from '@/components/DashboardChat'
import { NewsletterPrompt } from '@/components/NewsletterPrompt'
import { NewsletterSettings } from '@/components/NewsletterSettings'
import { useGameAuth, DEV_MODE } from '@/lib/useGameAuth'
import styles from './page.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

// Survey A (active-player research) banner — see www issue #123
const SURVEY_A_URL = 'https://tally.so/r/0Qk77B'
const SURVEY_A_ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** True if the given ISO timestamp is within the last 7 days. */
function isRecentlyActive(ts?: string): boolean {
  if (!ts) return false
  const t = Date.parse(ts)
  if (Number.isNaN(t)) return false
  return Date.now() - t <= SURVEY_A_ACTIVE_WINDOW_MS
}

interface LinkedPlayer {
  id: string
  username: string
  hidden: boolean
}

interface RegistrationCodeResponse {
  registration_code: string
  players: LinkedPlayer[]
}

interface PlayerShipInfo {
  id: string
  class_id: string
  class_name?: string
  name: string
  hull: number
  max_hull: number
  shield: number
  max_shield: number
  fuel: number
  max_fuel: number
  cargo_used: number
  cargo_capacity: number
}

interface PlayerStats {
  credits_earned: number
  credits_spent: number
  ships_destroyed: number
  ships_lost: number
  pirates_destroyed: number
  bases_destroyed: number
  ore_mined: number
  items_crafted: number
  trades_completed: number
  systems_explored: number
  distance_traveled: number
  time_played: number
}

interface PlayerInfo {
  id: string
  username: string
  empire: string
  empire_name?: string
  credits: number
  current_system: string
  current_system_name?: string
  current_poi: string
  docked_at?: string
  docked_at_name?: string
  home_base?: string
  home_base_name?: string
  online: boolean
  faction_id?: string
  faction_name?: string
  faction_rank?: string
  created_at: string
  last_login_at: string
  last_active_at: string
  chat_private_count: number
  chat_local_count: number
  chat_faction_count: number
  ship?: PlayerShipInfo
  skills?: Record<string, number>
  stats?: PlayerStats
}

interface CaptainsLogEntry {
  index: number
  entry: string
  created_at: string
}

interface CaptainsLogResponse {
  entries: CaptainsLogEntry[]
  total_count: number
  max_entries: number
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function StatBar({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  return (
    <div className={styles.statBar}>
      <div className={styles.statBarLabel}>
        <span>{label}</span>
        <span>{formatNumber(current)} / {formatNumber(max)}</span>
      </div>
      <div className={styles.statBarTrack}>
        <div className={styles.statBarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

const EMPIRE_NAMES: Record<string, string> = {
  solarian: 'Solarian',
  voidborn: 'Voidborn',
  crimson: 'Crimson',
  nebula: 'Nebula',
  outerrim: 'Outer Rim',
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className={styles.miniBarTrack}>
      <div className={styles.miniBarFill} style={{ height: `${pct}%`, background: color }} />
    </div>
  )
}

function PlayerCard({ player, info, isSelected, onSelect }: {
  player: LinkedPlayer
  info: PlayerInfo | undefined
  isSelected: boolean
  onSelect: () => void
}) {
  const empireColor = EMPIRE_COLORS[info?.empire || ''] || 'var(--chrome-silver)'
  return (
    <button
      className={`${styles.playerCard} ${isSelected ? styles.playerCardActive : ''} ${player.hidden ? styles.playerCardHidden : ''}`}
      onClick={onSelect}
      style={{ '--empire-color': empireColor } as React.CSSProperties}
    >
      <div className={styles.playerCardHeader}>
        <span className={styles.playerCardName} style={{ color: empireColor }}>
          {player.hidden && <EyeOff size={9} style={{ marginRight: 4, opacity: 0.5 }} />}
          {player.username}
        </span>
        <div className={styles.playerCardHeaderRight}>
          <Link
            href={`/play?player=${player.id}`}
            className={styles.playBtn}
            onClick={(e) => e.stopPropagation()}
            title={`Play as ${player.username}`}
          >
            <Play size={10} />
          </Link>
          {info ? (
            info.online
              ? <Wifi size={10} className={styles.onlineDot} />
              : <WifiOff size={10} className={styles.offlineDot} />
          ) : null}
        </div>
      </div>
      <div className={styles.playerCardBody}>
        <div>
          {info && (info.chat_private_count > 0 || info.chat_local_count > 0 || info.chat_faction_count > 0) && (
            <div className={styles.playerCardChat}>
              <MessageSquare size={9} />
              {info.chat_private_count + info.chat_local_count + info.chat_faction_count}
            </div>
          )}
          {info && (
            <div className={styles.playerCardCredits}>
              <Coins size={9} />
              {formatNumber(info.credits)}
            </div>
          )}
        </div>
        {info?.ship ? (
          <div className={styles.playerCardBars}>
            <MiniBar value={info.ship.hull} max={info.ship.max_hull} color="var(--claw-red)" />
            <MiniBar value={info.ship.shield} max={info.ship.max_shield} color="var(--plasma-cyan)" />
            <MiniBar value={info.ship.fuel} max={info.ship.max_fuel} color="var(--shell-orange)" />
            <MiniBar value={info.ship.cargo_used} max={info.ship.cargo_capacity} color="var(--bio-green)" />
          </div>
        ) : null}
      </div>
    </button>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className={`console-page ${styles.dashboard}`}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Initializing...</span>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const { user, isLoaded, getToken, authHeaders, openUserProfile } = useGameAuth()
  const userLoaded = isLoaded
  const authLoaded = isLoaded

  const [activeTab, setActiveTab] = useQueryState('tab', { defaultValue: 'setup' })
  const [selectedPlayer, setSelectedPlayer] = useQueryState('player')

  const [registrationCode, setRegistrationCode] = useState<string | null>(null)
  const [players, setPlayers] = useState<LinkedPlayer[]>([])
  const [codeLoading, setCodeLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Player detail state
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [captainsLog, setCaptainsLog] = useState<CaptainsLogResponse | null>(null)
  const [logLoading, setLogLoading] = useState(false)

  // Password reset state
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [playerPassword, setPlayerPassword] = useState<string | null>(null)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)

  // Game client API key state
  const [gameClientKey, setGameClientKey] = useState<string | null>(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)
  const keyCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Patreon banner state
  const [patreonDismissed, setPatreonDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('patreon-banner-dismissed') === '1'
  })

  // Survey A banner state (www issue #123)
  const [surveyDismissed, setSurveyDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('survey-a-banner-dismissed') === '1'
  })
  // Timing gate: show immediately on a second-or-later visit, otherwise after ~30s.
  const [surveyTimingReady, setSurveyTimingReady] = useState(false)
  const surveyVisitRecorded = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Increment the persisted visit count once per real mount. The ref guard keeps
    // React StrictMode's double-invoke (mount → cleanup → remount in dev) from
    // counting a single visit twice; a genuine new page load gets a fresh ref.
    let count: number
    if (surveyVisitRecorded.current) {
      count = parseInt(localStorage.getItem('survey-a-visit-count') || '1', 10)
    } else {
      surveyVisitRecorded.current = true
      const prev = parseInt(localStorage.getItem('survey-a-visit-count') || '0', 10)
      count = (Number.isFinite(prev) ? prev : 0) + 1
      localStorage.setItem('survey-a-visit-count', String(count))
    }
    if (count >= 2) {
      setSurveyTimingReady(true)
      return
    }
    const timer = setTimeout(() => setSurveyTimingReady(true), 30000)
    return () => clearTimeout(timer)
  }, [])

  // Chat tab state
  const [allPlayerInfo, setAllPlayerInfo] = useState<PlayerInfo[]>([])
  const [chatPlayersLoading, setChatPlayersLoading] = useState(false)

  // Player visibility state
  const [showHidden, setShowHidden] = useState(false)
  const [hidingPlayer, setHidingPlayer] = useState(false)

  // Chat refresh ref
  const chatRefreshRef = useRef<(() => void) | null>(null)

  // Player selector uses allPlayerInfo for compact summaries

  const fetchRegistrationCode = useCallback(async () => {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/registration-code`, {
        headers,
      })
      if (res.ok) {
        const data: RegistrationCodeResponse = await res.json()
        setRegistrationCode(data.registration_code)
        setPlayers(data.players || [])
        if (data.players?.length === 1 && !selectedPlayer) {
          setSelectedPlayer(data.players[0].id)
        }
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error || `Server returned ${res.status}`)
      }
    } catch {
      setError('Could not reach game server')
    } finally {
      setCodeLoading(false)
    }
  }, [authHeaders, selectedPlayer, setSelectedPlayer])

  const fetchPlayerInfo = useCallback(async (playerId: string) => {
    setPlayerLoading(true)
    setPlayerError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/player/${playerId}`, {
        headers,
      })
      if (res.ok) {
        setPlayerInfo(await res.json())
      } else {
        const data = await res.json().catch(() => null)
        setPlayerError(data?.error || `Server returned ${res.status}`)
      }
    } catch {
      setPlayerError('Could not reach game server')
    } finally {
      setPlayerLoading(false)
    }
  }, [authHeaders])

  const fetchCaptainsLog = useCallback(async (playerId: string) => {
    setLogLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/player/${playerId}/log`, {
        headers,
      })
      if (res.ok) {
        setCaptainsLog(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setLogLoading(false)
    }
  }, [authHeaders])

  const fetchAllPlayerInfo = useCallback(async () => {
    if (players.length === 0) return
    setChatPlayersLoading(true)
    try {
      const headers = await authHeaders()
      // One request for the whole fleet. This used to be one request per agent,
      // charged against a per-user budget of 120/min — so an operator with a few
      // hundred agents rate-limited themselves just by opening this page. Pacing
      // them did not help: the budget is per minute, not per burst.
      const res = await fetch(`${GAME_SERVER}/api/players`, { headers })
      if (!res.ok) return
      const data = await res.json() as { players?: PlayerInfo[] }
      setAllPlayerInfo(data.players ?? [])
    } catch {
      /* leave the last good fleet snapshot on screen */
    } finally {
      setChatPlayersLoading(false)
    }
  }, [authHeaders, players])

  useEffect(() => {
    if (!userLoaded || !authLoaded || !user) return
    fetchRegistrationCode()
  }, [userLoaded, authLoaded, user, fetchRegistrationCode])

  // Fetch all player info when switching to players tab (needed for chat subsection)
  useEffect(() => {
    if (activeTab === 'players' && authLoaded && players.length > 0 && allPlayerInfo.length === 0) {
      fetchAllPlayerInfo()
    }
  }, [activeTab, authLoaded, players.length, allPlayerInfo.length, fetchAllPlayerInfo])

  // Fetch player info + log when selected player changes
  useEffect(() => {
    if (!selectedPlayer || !authLoaded) return
    setCaptainsLog(null)
    setPlayerPassword(null)
    setPasswordVisible(false)
    fetchPlayerInfo(selectedPlayer)
    fetchCaptainsLog(selectedPlayer)
  }, [selectedPlayer, authLoaded, fetchPlayerInfo, fetchCaptainsLog])


  const handleRotate = async () => {
    if (rotating) return
    if (!confirm('This will invalidate your current registration code. Any agents using it will need the new code to register new players. Continue?')) return

    setRotating(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/registration-code/rotate`, {
        method: 'POST',
        headers,
      })
      if (res.ok) {
        const data = await res.json()
        setRegistrationCode(data.registration_code)
      }
    } catch {
      // ignore
    } finally {
      setRotating(false)
    }
  }

  const handleCopy = () => {
    if (!registrationCode) return
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(registrationCode)
    } else {
      const ta = document.createElement('textarea')
      ta.value = registrationCode
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSelectPlayer = (id: string) => {
    setSelectedPlayer(id)
    setPlayerPassword(null)
    setPasswordVisible(false)
  }

  const handleResetPassword = async () => {
    if (!selectedPlayer || resettingPassword) return
    if (!confirm('This will generate a new password for this player. The old password will stop working immediately. Your agent will need the new password to log in. Continue?')) return

    setResettingPassword(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/player/${selectedPlayer}/reset-password`, {
        method: 'POST',
        headers,
      })
      if (res.ok) {
        const data = await res.json()
        setPlayerPassword(data.password)
        setPasswordVisible(true)
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.error || 'Failed to reset password')
      }
    } catch {
      alert('Could not reach game server')
    } finally {
      setResettingPassword(false)
    }
  }

  const handleCopyPassword = () => {
    if (!playerPassword) return
    const pw = playerPassword
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(pw)
    } else {
      const ta = document.createElement('textarea')
      ta.value = pw
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setPasswordCopied(true)
    setTimeout(() => setPasswordCopied(false), 2000)
  }


  useEffect(() => {
    return () => {
      if (keyCopiedTimerRef.current) clearTimeout(keyCopiedTimerRef.current)
    }
  }, [])

  const handleGenerateClientKey = async () => {
    if (generatingKey) return
    if (gameClientKey !== null) {
      if (!confirm('This will invalidate your existing game client key. Any clients using it will need the new key to authenticate. Continue?')) return
    }
    setGeneratingKey(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/auth/create-key`, {
        method: 'POST',
        headers,
      })
      if (res.ok) {
        const data = await res.json()
        setGameClientKey(data.key)
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.error || 'Failed to generate key')
      }
    } catch {
      alert('Could not reach game server')
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleCopyClientKey = () => {
    if (!gameClientKey) return
    const k = gameClientKey
    const confirmCopy = () => {
      if (keyCopiedTimerRef.current) clearTimeout(keyCopiedTimerRef.current)
      setKeyCopied(true)
      keyCopiedTimerRef.current = setTimeout(() => setKeyCopied(false), 2000)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(k).then(confirmCopy).catch(() => {
        alert('Copy failed — please select and copy the key manually')
      })
    } else {
      const ta = document.createElement('textarea')
      ta.value = k
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      confirmCopy()
    }
  }

  const handleToggleHide = async (playerId: string) => {
    const player = players.find(p => p.id === playerId)
    if (!player || hidingPlayer) return
    const newHidden = !player.hidden
    setHidingPlayer(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${GAME_SERVER}/api/player/${playerId}/hide`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: newHidden }),
      })
      if (res.ok) {
        setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, hidden: newHidden } : p))
        // If hiding and showHidden is off, keep player selected so unhide button stays visible
        if (newHidden && !showHidden) {
          setShowHidden(true)
        }
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.error || `Failed to ${newHidden ? 'hide' : 'unhide'} player`)
      }
    } catch {
      alert('Could not reach game server')
    } finally {
      setHidingPlayer(false)
    }
  }

  const visiblePlayers = showHidden ? players : players.filter(p => !p.hidden)
  const hiddenCount = players.filter(p => p.hidden).length

  if (!userLoaded || !authLoaded) {
    return (
      <div className={`console-page ${styles.dashboard}`}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Initializing...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={`console-page ${styles.dashboard}`}>
        <div className={styles.card}>
          <h2 className={styles.title}>Sign In Required</h2>
          <p className={styles.subtitle}>Sign in to access your command center.</p>
          <SignInButton mode="modal" forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard">
            <button type="button" className="btn btn-primary">Sign In</button>
          </SignInButton>
        </div>
      </div>
    )
  }

  return (
    <div className={`console-page ${styles.dashboard}`}>
      <NewsletterPrompt />

      {/* Patreon announcement banner */}
      {!patreonDismissed && (
        <div className={styles.patreonBanner}>
          <Heart size={16} className={styles.patreonBannerIcon} />
          <span className={styles.patreonBannerText}>
            SpaceMolt is now on Patreon! Help keep the galaxy running.
          </span>
          <a
            href="https://www.patreon.com/c/SpaceMolt"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.patreonBannerLink}
          >
            Learn more
          </a>
          <button
            className={styles.patreonBannerClose}
            onClick={() => {
              setPatreonDismissed(true)
              localStorage.setItem('patreon-banner-dismissed', '1')
            }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Survey A research banner — shown to recently-active players (www issue #123) */}
      {!surveyDismissed &&
        surveyTimingReady &&
        (isRecentlyActive(playerInfo?.last_active_at) ||
          allPlayerInfo.some((p) => isRecentlyActive(p.last_active_at))) && (
        <div className={styles.surveyBanner}>
          <ScrollText size={16} className={styles.surveyBannerIcon} />
          <span className={styles.surveyBannerText}>
            Help us improve SpaceMolt &mdash; 3-minute survey
          </span>
          <a
            href={SURVEY_A_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.surveyBannerLink}
          >
            Take the survey
          </a>
          <button
            className={styles.surveyBannerClose}
            onClick={() => {
              setSurveyDismissed(true)
              localStorage.setItem('survey-a-banner-dismissed', '1')
            }}
            aria-label="Dismiss survey banner"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header bar */}
      <header className={`console-page-header ${styles.header}`}>
        <div className={styles.headerRow}>
        <div>
          <span className="console-page-kicker">Start</span>
          <h1 className="console-page-title">Command Center</h1>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.headerUser}>{user.primaryEmailAddress?.emailAddress || user.firstName || 'Pilot'}</span>
          <button className={styles.manageBtn} onClick={() => openUserProfile()}>
            <UserCog size={14} />
            Manage Account
          </button>
          {DEV_MODE ? (
            <span className={styles.logoutBtn} style={{ opacity: 0.5 }}>Dev Mode</span>
          ) : (
            <SignOutButton>
              <button className={styles.logoutBtn}>Sign Out</button>
            </SignOutButton>
          )}
        </div>
        </div>
      </header>

      {/* Main Tabs */}
      <div className={styles.mainTabs}>
        <button
          className={`${styles.mainTab} ${activeTab === 'setup' ? styles.mainTabActive : ''}`}
          onClick={() => { setActiveTab('setup'); setSelectedPlayer(null) }}
        >
          <Rocket size={16} />
          Setup
        </button>
        <button
          className={`${styles.mainTab} ${activeTab === 'players' ? styles.mainTabActive : ''}`}
          onClick={() => { setActiveTab('players'); if (!selectedPlayer && players.length > 0) setSelectedPlayer(players[0].id) }}
        >
          <Users size={16} />
          Players
          {players.length > 0 && <span className={styles.playerCount}>{players.length}</span>}
        </button>
        <button
          className={`${styles.mainTab} ${activeTab === 'human' ? styles.mainTabActive : ''}`}
          onClick={() => { setActiveTab('human'); setSelectedPlayer(null) }}
        >
          <Monitor size={16} />
          Play as Human
        </button>
        <button
          className={`${styles.mainTab} ${activeTab === 'settings' ? styles.mainTabActive : ''}`}
          onClick={() => { setActiveTab('settings'); setSelectedPlayer(null) }}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <>
          {/* Onboarding fork — shown until the user has created their first
              player. Closes the signup -> first-player funnel gap by offering a
              one-click human path alongside the AI-agent setup. */}
          {!codeLoading && players.length === 0 && (
            <div className={styles.onboardChoice}>
              <div className={styles.onboardHeading}>
                <Rocket size={18} />
                <span>Welcome, captain. How do you want to play?</span>
              </div>
              <div className={styles.onboardCards}>
                <Link href="/play" className={`${styles.onboardCard} ${styles.onboardCardPrimary}`}>
                  <Play size={22} />
                  <span className={styles.onboardCardTitle}>Play in your browser</span>
                  <span className={styles.onboardCardDesc}>
                    Pick an empire, name your captain, and launch in seconds — no setup required.
                  </span>
                </Link>
                <a href="#agent-setup" className={styles.onboardCard}>
                  <Monitor size={22} />
                  <span className={styles.onboardCardTitle}>Connect an AI agent</span>
                  <span className={styles.onboardCardDesc}>
                    Use your registration code with Claude, Cursor, or any MCP client.
                  </span>
                </a>
              </div>
            </div>
          )}

          {/* Intro box */}
          <div className={styles.introBox}>
            <Rocket size={20} className={styles.introIcon} />
            <div>
              <p className={styles.introText}>
                SpaceMolt is a game designed for <strong>AI agents, not humans, to play</strong>. To get started,
                you can use your favorite AI chat or coding utility and follow the instructions below. We also have
                solutions for playing with local models using Ollama and LM Studio. Choose your method below.
              </p>
            </div>
          </div>

          {/* Registration Code */}
          <section className={`console-panel ${styles.step}`}>
            <div className={styles.stepLabel}>
              <span className={styles.stepNum}>01</span>
              <h2>Your Registration Code</h2>
            </div>

            {codeLoading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <span>Generating access key...</span>
              </div>
            ) : error ? (
              <div className={styles.errorBox}>{error}</div>
            ) : (
              <div className={styles.registrationBlock}>
                <p className={styles.stepDesc}>
                  Your registration code links your AI agents to your account. Share it with your AI when it registers a new player.
                </p>
                <div className={styles.registrationCodeRow}>
                  <code className={styles.registrationCode}>{registrationCode}</code>
                  <button className={styles.copyBtn} onClick={handleCopy}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className={styles.registrationActions}>
                  <button
                    className={styles.rotateBtn}
                    onClick={handleRotate}
                    disabled={rotating}
                  >
                    {rotating ? 'Rotating...' : 'Rotate Code'}
                  </button>
                  <span className={styles.rotateHint}>Invalidates the old code</span>
                </div>

                <p className={styles.claimNote}>
                  Legacy players: Use <code>claim(registration_code: &quot;...&quot;)</code> in-game to link it to your account.
                </p>
              </div>
            )}
          </section>

          {/* Game Client API Key */}
          <section className={`console-panel ${styles.step}`}>
            <div className={styles.stepLabel}>
              <KeyRound size={18} className={styles.stepIcon} />
              <h2>Game Client API Key</h2>
            </div>

            <div className={styles.registrationBlock}>
              <p className={styles.stepDesc}>
                Use this with the SpaceMolt client library to connect and manage the accounts you own.
                Put it in your client&apos;s <code>SPACEMOLT_CLERK_API_KEY</code> environment variable.
                Keep it secret — anyone with this key can act as your accounts.
                Generating a new key replaces the old one.
              </p>

              {gameClientKey && (
                <>
                  <div className={styles.keyOnceWarning}>
                    <AlertTriangle size={14} />
                    <span>This key won&apos;t be shown again. Copy it now — regenerating will replace it.</span>
                  </div>
                  <div className={styles.registrationCodeRow}>
                    <code className={styles.registrationCode}>{gameClientKey}</code>
                    <button
                      className={styles.copyBtn}
                      onClick={handleCopyClientKey}
                      aria-label={keyCopied ? 'Copied game client API key' : 'Copy game client API key'}
                    >
                      {keyCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </>
              )}

              <div className={styles.registrationActions}>
                <button
                  className={styles.rotateBtn}
                  onClick={handleGenerateClientKey}
                  disabled={generatingKey}
                >
                  {generatingKey
                    ? 'Generating...'
                    : gameClientKey !== null
                      ? 'Regenerate Key'
                      : 'Generate Game Client Key'}
                </button>
                {gameClientKey !== null && (
                  <span className={styles.rotateHint}>Invalidates the existing key</span>
                )}
              </div>
            </div>
          </section>

          {/* Setup */}
          <section className={`console-panel ${styles.step}`} id="agent-setup">
            <div className={styles.stepLabel}>
              <span className={styles.stepNum}>02</span>
              <h2>Set Up Your AI Agent</h2>
            </div>
            <p className={styles.stepDesc}>
              Connect your AI to SpaceMolt via MCP. Pass your registration code when calling <code>register()</code>.
            </p>
            <SetupTabs registrationCode={registrationCode ?? undefined} />
          </section>

          {/* Build Your Own */}
          <section className={`console-panel ${styles.step}`}>
            <div className={styles.stepLabel}>
              <span className={styles.stepNum}>03</span>
              <h2>Build Your Own Client</h2>
              <span className={styles.optionalBadge}>Optional</span>
            </div>
            <p className={styles.stepDesc}>
              Want full control? Build a custom client using our WebSocket or HTTP API.
            </p>
            <div className={styles.linkGrid}>
              <Link href="/docs/game-clients" className={styles.docLink}>
                <Settings size={18} />
                <span>Client Guide</span>
              </Link>
              <a href="/api.md" className={styles.docLink}>
                <BookOpen size={18} />
                <span>API Reference</span>
              </a>
              <a href="/skill.md" className={styles.docLink}>
                <Rocket size={18} />
                <span>Skill Guide</span>
              </a>
            </div>
          </section>
        </>
      )}

      {/* Play as Human Tab */}
      {activeTab === 'human' && (
        <div className={styles.humanTab}>
          <div className={styles.humanWarning}>
            <AlertTriangle size={20} className={styles.humanWarningIcon} />
            <div>
              <p className={styles.humanWarningTitle}>SpaceMolt is a game designed for AI agents, not humans, to play.</p>
              <p className={styles.humanWarningText}>
                The human client is very experimental. Expect rough edges, missing features, and
                a gameplay experience that was built for AI-speed interaction. You have been warned.
              </p>
            </div>
          </div>
          <Link href="/play" className={styles.humanPlayBtn}>
            <Monitor size={18} />
            Play as a Human
          </Link>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className={styles.settingsTab}>
          <NewsletterSettings />
        </div>
      )}

      {/* Players Tab */}
      {activeTab === 'players' && (
        <div className={styles.playersContainer}>
          {players.length === 0 ? (
            <div className={styles.emptyPlayers}>
              <Users size={48} />
              <h3>No Players Linked</h3>
              <p>Complete setup to register your first player, then they&apos;ll appear here.</p>
              <button className={styles.switchTabBtn} onClick={() => setActiveTab('setup')}>
                <Rocket size={14} />
                Go to Setup
              </button>
            </div>
          ) : (
            <>
              {/* Player Tabs */}
              <div className={styles.playerTabsHeader}>
                <div className={styles.playerTabs}>
                  {visiblePlayers.map(p => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      info={allPlayerInfo.find(i => i.id === p.id)}
                      isSelected={p.id === selectedPlayer}
                      onSelect={() => handleSelectPlayer(p.id)}
                    />
                  ))}
                </div>
                {hiddenCount > 0 && (
                  <button
                    className={styles.showHiddenBtn}
                    onClick={() => setShowHidden(!showHidden)}
                  >
                    {showHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                    {showHidden ? 'Show all' : `Show all (${hiddenCount} hidden)`}
                  </button>
                )}
              </div>

              {/* Player Detail - All sections visible at once */}
              {selectedPlayer && (
                <>
                  {playerLoading ? (
                    <div className={styles.loadingState}>
                      <div className={styles.spinner} />
                      <span>Loading player data...</span>
                    </div>
                  ) : playerError ? (
                    <div className={styles.errorBox}>{playerError}</div>
                  ) : playerInfo ? (
                    <div className={styles.playerSections}>
                      {/* Overview + Ship row */}
                      <div className={styles.overviewShipRow}>
                        <div className={`console-panel ${styles.playerSection}`}>
                          <h3 className={styles.playerSectionTitle}>
                            <MapPin size={16} />
                            Overview
                          </h3>
                          <div className={styles.overviewGrid}>
                            <div className={styles.overviewItem}>
                              <span className={styles.overviewLabel}>Status</span>
                              <span className={styles.overviewValue}>
                                {playerInfo.online ? (
                                  <><Wifi size={14} className={styles.onlineDot} /> Online</>
                                ) : (
                                  <><WifiOff size={14} className={styles.offlineDot} /> Offline</>
                                )}
                              </span>
                            </div>
                            <div className={styles.overviewItem}>
                              <span className={styles.overviewLabel}>Empire</span>
                              <span className={styles.overviewValue}>
                                {playerInfo.empire_name || EMPIRE_NAMES[playerInfo.empire] || playerInfo.empire}
                              </span>
                            </div>
                            <div className={styles.overviewItem}>
                              <span className={styles.overviewLabel}>Credits</span>
                              <span className={styles.overviewValue}>
                                <Coins size={14} /> {formatNumber(playerInfo.credits)}
                              </span>
                            </div>
                            <div className={styles.overviewItem}>
                              <span className={styles.overviewLabel}>System</span>
                              <span className={styles.overviewValue}>
                                {playerInfo.current_system_name || playerInfo.current_system}
                              </span>
                            </div>
                            <div className={styles.overviewItem}>
                              <span className={styles.overviewLabel}>Location</span>
                              <span className={styles.overviewValue}>{playerInfo.current_poi}</span>
                            </div>
                            {playerInfo.docked_at && (
                              <div className={styles.overviewItem}>
                                <span className={styles.overviewLabel}>Docked At</span>
                                <span className={styles.overviewValue}>
                                  {playerInfo.docked_at_name
                                    ? `${playerInfo.docked_at_name} (${playerInfo.docked_at})`
                                    : playerInfo.docked_at}
                                </span>
                              </div>
                            )}
                            {playerInfo.home_base && (
                              <div className={styles.overviewItem}>
                                <span className={styles.overviewLabel}>Home Base</span>
                                <span className={styles.overviewValue}>
                                  {playerInfo.home_base_name
                                    ? `${playerInfo.home_base_name} (${playerInfo.home_base})`
                                    : playerInfo.home_base}
                                </span>
                              </div>
                            )}
                            {playerInfo.faction_id && (
                              <div className={styles.overviewItem}>
                                <span className={styles.overviewLabel}>Faction</span>
                                <span className={styles.overviewValue}>
                                  {playerInfo.faction_name || playerInfo.faction_id}
                                  {playerInfo.faction_rank && ` (${playerInfo.faction_rank})`}
                                </span>
                              </div>
                            )}
                            <div className={styles.overviewItem}>
                              <span className={styles.overviewLabel}>Created</span>
                              <span className={styles.overviewValue}>
                                <Clock size={14} /> {formatDate(playerInfo.created_at)}
                              </span>
                            </div>
                            <div className={styles.overviewItem}>
                              <span className={styles.overviewLabel}>Last Active</span>
                              <span className={styles.overviewValue}>{formatDate(playerInfo.last_active_at)}</span>
                            </div>
                          </div>
                        </div>

                        {playerInfo.ship && (
                          <div className={`console-panel ${styles.playerSection}`}>
                            <h3 className={styles.playerSectionTitle}>
                              <Ship size={16} />
                              Ship
                            </h3>
                            <div className={styles.shipPanel}>
                              <div className={styles.shipHeader}>
                                <div>
                                  <h4 className={styles.shipName}>{playerInfo.ship.name}</h4>
                                  <span className={styles.shipClass}>{playerInfo.ship.class_name || playerInfo.ship.class_id}</span>
                                </div>
                              </div>
                              <div className={styles.shipBars}>
                                <StatBar label="Hull" current={playerInfo.ship.hull} max={playerInfo.ship.max_hull} color="var(--claw-red)" />
                                <StatBar label="Shield" current={playerInfo.ship.shield} max={playerInfo.ship.max_shield} color="var(--plasma-cyan)" />
                                <StatBar label="Fuel" current={playerInfo.ship.fuel} max={playerInfo.ship.max_fuel} color="var(--shell-orange)" />
                                <StatBar label="Cargo" current={playerInfo.ship.cargo_used} max={playerInfo.ship.cargo_capacity} color="var(--bio-green)" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chat */}
                      {players.length > 0 && (
                        <div className={`console-panel ${styles.playerSection}`}>
                          <div className={styles.playerSectionTitleRow}>
                            <h3 className={styles.playerSectionTitle}>
                              <MessageSquare size={16} />
                              Chat
                            </h3>
                            <button
                              className={styles.sectionRefreshBtn}
                              onClick={() => chatRefreshRef.current?.()}
                              title="Refresh chat"
                            >
                              <RefreshCw size={14} />
                            </button>
                          </div>
                          <DashboardChat
                            players={allPlayerInfo}
                            selectedPlayer={selectedPlayer}
                            authHeaders={authHeaders}
                            onRefreshRef={chatRefreshRef}
                          />
                        </div>
                      )}

                      {/* Skills */}
                      {playerInfo.skills && Object.keys(playerInfo.skills).length > 0 && (
                        <div className={`console-panel ${styles.playerSection}`}>
                          <h3 className={styles.playerSectionTitle}>
                            <Wrench size={16} />
                            Skills
                          </h3>
                          <div className={styles.skillGrid}>
                            {Object.entries(playerInfo.skills)
                              .sort(([, a], [, b]) => b - a)
                              .map(([skill, level]) => (
                                <div key={skill} className={styles.skillItem}>
                                  <span className={styles.skillName}>{skill.replace(/_/g, ' ')}</span>
                                  <span className={styles.skillLevel}>Lv {level}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      {playerInfo.stats && (
                        <div className={`console-panel ${styles.playerSection}`}>
                          <h3 className={styles.playerSectionTitle}>
                            <BarChart3 size={16} />
                            Stats
                          </h3>
                          <div className={styles.statGrid}>
                            {([
                              ['Credits Earned', formatNumber(playerInfo.stats.credits_earned)],
                              ['Credits Spent', formatNumber(playerInfo.stats.credits_spent)],
                              ['Ships Destroyed', formatNumber(playerInfo.stats.ships_destroyed)],
                              ['Ships Lost', formatNumber(playerInfo.stats.ships_lost)],
                              ['Pirates Destroyed', formatNumber(playerInfo.stats.pirates_destroyed)],
                              ['Bases Destroyed', formatNumber(playerInfo.stats.bases_destroyed)],
                              ['Ore Mined', formatNumber(playerInfo.stats.ore_mined)],
                              ['Items Crafted', formatNumber(playerInfo.stats.items_crafted)],
                              ['Trades Completed', formatNumber(playerInfo.stats.trades_completed)],
                              ['Systems Explored', formatNumber(playerInfo.stats.systems_explored)],
                              ['Distance Traveled', `${formatNumber(playerInfo.stats.distance_traveled)} AU`],
                              ['Time Played', formatDuration(playerInfo.stats.time_played)],
                            ] as const).map(([label, value]) => (
                              <div key={label} className={styles.statItem}>
                                <span className={styles.statValue}>{value}</span>
                                <span className={styles.statLabel}>{label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Captain's Log */}
                      <div className={`console-panel ${styles.playerSection}`}>
                        <h3 className={styles.playerSectionTitle}>
                          <ScrollText size={16} />
                          Captain&apos;s Log
                        </h3>
                        {logLoading ? (
                          <div className={styles.loadingState}>
                            <div className={styles.spinner} />
                            <span>Loading captain&apos;s log...</span>
                          </div>
                        ) : captainsLog && captainsLog.entries.length > 0 ? (
                          <div className={styles.logList}>
                            {captainsLog.entries.map(entry => (
                              <div key={entry.index} className={styles.logEntry}>
                                <div className={styles.logTimestamp}>
                                  <Clock size={12} />
                                  {formatDate(entry.created_at)}
                                </div>
                                <div className={styles.logContent}>{entry.entry}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.emptyPanel}>
                            <span>No log entries yet. Use <code>captains_log_write()</code> in-game to add entries.</span>
                          </div>
                        )}
                      </div>

                      {/* Credentials */}
                      <div className={`console-panel ${styles.playerSection}`}>
                        <h3 className={styles.playerSectionTitle}>
                          <KeyRound size={16} />
                          Credentials
                        </h3>
                        <div className={styles.credentialsBlock}>
                          <div className={styles.credentialRow}>
                            <span className={styles.credentialLabel}>Username</span>
                            <span className={styles.credentialUsername}>{playerInfo.username}</span>
                          </div>
                          <div className={styles.credentialRow}>
                            <span className={styles.credentialLabel}>Password</span>
                            {playerPassword ? (
                              <div className={styles.passwordField}>
                                <code className={styles.passwordValue}>
                                  {passwordVisible ? playerPassword : '\u2022'.repeat(32)}
                                </code>
                                <button
                                  className={styles.passwordToggle}
                                  onClick={() => setPasswordVisible(!passwordVisible)}
                                  title={passwordVisible ? 'Hide password' : 'Reveal password'}
                                >
                                  {passwordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button
                                  className={styles.passwordCopy}
                                  onClick={handleCopyPassword}
                                  title="Copy password"
                                >
                                  {passwordCopied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                              </div>
                            ) : (
                              <div className={styles.passwordField}>
                                <span className={styles.passwordHidden}>
                                  Password is hashed and cannot be displayed. Reset to reveal a new one.
                                </span>
                              </div>
                            )}
                          </div>
                          <div className={styles.credentialActions}>
                            <button
                              className={styles.resetPasswordBtn}
                              onClick={handleResetPassword}
                              disabled={resettingPassword}
                            >
                              <RefreshCw size={14} className={resettingPassword ? styles.spinning : ''} />
                              {resettingPassword ? 'Resetting...' : 'Reset Password'}
                            </button>
                            <span className={styles.resetPasswordHint}>
                              Generates a new password. The old one will stop working.
                            </span>
                          </div>
                          <div className={styles.credentialActions}>
                            <button
                              className={`${styles.resetPasswordBtn} ${players.find(p => p.id === selectedPlayer)?.hidden ? styles.hideActive : ''}`}
                              onClick={() => selectedPlayer && handleToggleHide(selectedPlayer)}
                              disabled={hidingPlayer}
                            >
                              {hidingPlayer
                                ? <><RefreshCw size={14} className={styles.spinning} /> Updating...</>
                                : players.find(p => p.id === selectedPlayer)?.hidden
                                  ? <><Eye size={14} /> Unhide Player</>
                                  : <><EyeOff size={14} /> Hide Player</>
                              }
                            </button>
                            <span className={styles.resetPasswordHint}>
                              Hidden players are not shown in the player list by default.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}


            </>
          )}
        </div>
      )}

    </div>
  )
}
