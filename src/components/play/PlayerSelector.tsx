'use client'

import { useEffect, useState } from 'react'
import { Loader2, Users, ExternalLink, Coins, Wifi, WifiOff } from 'lucide-react'
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
  const [infoLoading, setInfoLoading] = useState(false)

  const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

  // Fetch player details for enriched cards
  useEffect(() => {
    if (players.length === 0) return
    let cancelled = false

    async function fetchAll() {
      setInfoLoading(true)
      const headers = await authHeaders()
      const results: Record<string, PlayerInfo> = {}
      await Promise.all(players.map(async (p) => {
        try {
          const res = await fetch(`${GAME_SERVER}/api/player/${p.id}`, { headers })
          if (res.ok && !cancelled) {
            results[p.id] = await res.json()
          }
        } catch {
          // Non-critical
        }
      }))
      if (!cancelled) {
        setPlayerInfo(results)
        setInfoLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [players, authHeaders, GAME_SERVER])

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
      <div className={styles.content}>
        <div className={styles.title}>SpaceMolt</div>
        <div className={styles.subtitle}>Select a player to launch</div>
        <div className={styles.playerList}>
          {players.map(p => {
            const info = playerInfo[p.id]
            const empireColor = EMPIRE_COLORS[info?.empire || ''] || 'var(--chrome-silver)'
            return (
              <button
                key={p.id}
                className={styles.playerCard}
                onClick={() => onSelect(p.id)}
                disabled={infoLoading}
                style={{ '--empire-color': empireColor } as React.CSSProperties}
              >
                <div className={styles.playerName} style={{ color: empireColor }}>
                  {p.username}
                </div>
                {info && (
                  <div className={styles.playerMeta}>
                    {info.online
                      ? <Wifi size={10} className={styles.onlineDot} />
                      : <WifiOff size={10} className={styles.offlineDot} />}
                    {info.empire && <span className={styles.empire}>{info.empire}</span>}
                    {info.credits !== undefined && (
                      <span className={styles.credits}>
                        <Coins size={10} />
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
    </div>
  )
}
