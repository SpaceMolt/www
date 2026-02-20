'use client'

import { useEffect, useState, useMemo } from 'react'
import { Loader2, Users, ExternalLink, Coins, Wifi, WifiOff, Search } from 'lucide-react'
import styles from './PlayerSelector.module.css'

const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#FFD700',
  voidborn: '#00D4FF',
  crimson: '#FF4444',
  nebula: '#AA66FF',
  outerrim: '#FF6B35',
}

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
}

export function PlayerSelector({ players, onSelect, loading, authHeaders }: PlayerSelectorProps) {
  const [playerInfo, setPlayerInfo] = useState<Record<string, PlayerInfo>>({})
  const [search, setSearch] = useState('')

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

  const filtered = useMemo(() => {
    if (!search) return players
    const q = search.toLowerCase()
    return players.filter(p => {
      const info = playerInfo[p.id]
      return p.username.toLowerCase().includes(q) ||
        (info?.empire && info.empire.toLowerCase().includes(q))
    })
  }, [players, playerInfo, search])

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

  if (players.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Users size={32} className={styles.icon} />
          <div className={styles.title}>No Players Found</div>
          <div className={styles.subtitle}>
            Create a player account from the dashboard or connect an AI agent to get started.
          </div>
          <a href="/dashboard" className={styles.dashboardLink}>
            <ExternalLink size={14} />
            Go to Dashboard
          </a>
        </div>
      </div>
    )
  }

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
      </div>
    </div>
  )
}
