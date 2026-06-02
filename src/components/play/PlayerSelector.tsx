'use client'

import { useEffect, useState, useMemo } from 'react'
import { Loader2, Users, Coins, Wifi, WifiOff, Search, Plus, ArrowLeft, AlertCircle } from 'lucide-react'
import styles from './PlayerSelector.module.css'

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#FFD700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

const EMPIRES = [
  { id: 'solarian', name: 'Solarian Confederacy', tagline: 'Balanced, +5% all stats', color: '#FFD700' },
  { id: 'voidborn', name: 'Voidborn Collective', tagline: 'Shield specialists', color: '#9b59b6' },
  { id: 'crimson', name: 'Crimson Pact', tagline: 'Weapon specialists', color: '#e63946' },
  { id: 'nebula', name: 'Nebula Trade Federation', tagline: 'Cargo/trade focus', color: '#00d4ff' },
  { id: 'outerrim', name: 'Outer Rim Explorers', tagline: 'Speed/exploration', color: '#2dd4bf' },
]

interface LinkedPlayer {
  id: string
  username: string
}

interface PlayerInfo {
  empire?: string
  credits?: number
  online?: boolean
  ship?: { class_id: string }
}

interface PlayerSelectorProps {
  players: LinkedPlayer[]
  onSelect: (playerId: string) => void
  loading: boolean
  authHeaders: () => Promise<Record<string, string>>
  registrationCode: string
  onPlayerCreated: (playerId: string) => void
}

export function PlayerSelector({ players, onSelect, loading, authHeaders, registrationCode, onPlayerCreated }: PlayerSelectorProps) {
  const [playerInfo, setPlayerInfo] = useState<Record<string, PlayerInfo>>({})
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [username, setUsername] = useState('')
  const [selectedEmpire, setSelectedEmpire] = useState('')
  const [createError, setCreateError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

  // Fetch player details sequentially to avoid bursting the shared per-IP
  // rate limit (publicAPI bucket) that MCP connections also use.
  useEffect(() => {
    if (players.length === 0) return
    let cancelled = false

    async function fetchSequentially() {
      const headers = await authHeaders()
      for (const p of players) {
        if (cancelled) break
        try {
          const res = await fetch(`${GAME_SERVER}/api/player/${p.id}`, { headers })
          if (res.ok && !cancelled) {
            const info = await res.json()
            setPlayerInfo(prev => ({ ...prev, [p.id]: info }))
          }
        } catch {
          // Non-critical
        }
      }
    }

    fetchSequentially()
    return () => { cancelled = true }
  }, [players, authHeaders, GAME_SERVER])

  // New players (no characters yet) land directly on the creation form rather
  // than an intermediate empty state — this is the onboarding funnel target.
  useEffect(() => {
    if (!loading && players.length === 0) setCreating(true)
  }, [loading, players.length])

  const filtered = useMemo(() => {
    if (!search) return players
    const q = search.toLowerCase()
    return players.filter(p => {
      const info = playerInfo[p.id]
      return p.username.toLowerCase().includes(q) ||
        (info?.empire && info.empire.toLowerCase().includes(q))
    })
  }, [players, playerInfo, search])

  async function handleCreate() {
    const trimmed = username.trim()
    if (trimmed.length < 3 || trimmed.length > 24) {
      setCreateError('Username must be 3-24 characters')
      return
    }
    if (!selectedEmpire) {
      setCreateError('Select an empire')
      return
    }

    setSubmitting(true)
    setCreateError('')

    try {
      // 1. Create a session
      const sessionRes = await fetch(`${GAME_SERVER}/api/v1/session`, { method: 'POST' })
      if (!sessionRes.ok) throw new Error('Failed to create session')
      const sessionData = await sessionRes.json()
      const sessionId = sessionData.session_id

      // 2. Register the player
      const headers = await authHeaders()
      const regRes = await fetch(`${GAME_SERVER}/api/v1/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
          ...headers,
        },
        body: JSON.stringify({
          username: trimmed,
          empire: selectedEmpire,
          registration_code: registrationCode,
        }),
      })

      if (!regRes.ok) {
        const err = await regRes.json().catch(() => null)
        throw new Error(err?.error || `Registration failed (${regRes.status})`)
      }

      const regData = await regRes.json()
      const playerId = regData.player_id || regData.id

      // Reset form and notify parent
      setCreating(false)
      setUsername('')
      setSelectedEmpire('')
      onPlayerCreated(playerId)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Loader2 size={32} className={styles.spinner} />
          <div className={styles.title}>SpaceMolt</div>
          <div className={styles.subtitle}>Loading your players...</div>
        </div>
      </div>
    )
  }

  // Creation form view
  if (creating) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.title}>SpaceMolt</div>
          <div className={styles.subtitle}>Create a new player</div>
        </div>
        <div className={styles.createForm}>
          <input
            className={styles.usernameInput}
            type="text"
            placeholder="Username (3-24 characters)"
            value={username}
            onChange={e => { setUsername(e.target.value); setCreateError('') }}
            maxLength={24}
            autoFocus
            disabled={submitting}
          />
          <div className={styles.empireLabel}>Choose your empire</div>
          <div className={styles.empireGrid}>
            {EMPIRES.map(emp => (
              <button
                key={emp.id}
                className={`${styles.empireCard} ${selectedEmpire === emp.id ? styles.empireCardSelected : ''}`}
                onClick={() => { setSelectedEmpire(emp.id); setCreateError('') }}
                disabled={submitting}
                style={{ '--empire-color': emp.color } as React.CSSProperties}
              >
                <div className={styles.empireName}>{emp.name}</div>
                <div className={styles.empireTagline}>{emp.tagline}</div>
              </button>
            ))}
          </div>
          {createError && (
            <div className={styles.errorMsg}>
              <AlertCircle size={12} />
              {createError}
            </div>
          )}
          <div className={styles.formActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => { setCreating(false); setCreateError('') }}
              disabled={submitting}
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={submitting || !username.trim() || !selectedEmpire}
            >
              {submitting ? <Loader2 size={14} className={styles.spinner} /> : <Plus size={14} />}
              {submitting ? 'Creating...' : 'Create Player'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (players.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Users size={32} className={styles.icon} />
          <div className={styles.title}>No Players Found</div>
          <div className={styles.subtitle}>
            Create a player to get started.
          </div>
          <button className={styles.newPlayerBtn} onClick={() => setCreating(true)}>
            <Plus size={14} />
            New Player
          </button>
        </div>
      </div>
    )
  }

  // Player list view
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>SpaceMolt</div>
        <div className={styles.subtitle}>Select a player to launch</div>
      </div>
      {players.length > 5 && (
        <div className={styles.searchRow}>
          <Search size={14} style={{ color: 'var(--chrome-silver)', flexShrink: 0 }} />
          <input
            className={styles.searchInput}
            placeholder="Filter players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <span className={styles.playerCount}>
            {filtered.length}/{players.length}
          </span>
        </div>
      )}
      <div className={styles.playerList}>
        {filtered.map(p => {
          const info = playerInfo[p.id]
          const empireColor = EMPIRE_COLORS[info?.empire || ''] || 'var(--chrome-silver)'
          return (
            <button
              key={p.id}
              className={styles.playerCard}
              onClick={() => onSelect(p.id)}
              disabled={loading}
              style={{ '--empire-color': empireColor } as React.CSSProperties}
            >
              <div className={styles.playerName} style={{ color: empireColor }}>
                {p.username}
              </div>
              {info && (
                <div className={styles.playerMeta}>
                  {info.online
                    ? <Wifi size={9} className={styles.onlineDot} />
                    : <WifiOff size={9} className={styles.offlineDot} />}
                  {info.empire && <span className={styles.empire}>{info.empire}</span>}
                  {info.credits !== undefined && (
                    <span className={styles.credits}>
                      <Coins size={9} />
                      {info.credits.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
        <button className={styles.newPlayerCard} onClick={() => setCreating(true)}>
          <Plus size={14} />
          <span>New Player</span>
        </button>
      </div>
    </div>
  )
}
