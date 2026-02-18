'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const POLL_INTERVAL = 10_000

interface BattleSide {
  side_id: number
  faction_id?: string
  participants: string[]
}

interface BattleSummary {
  battle_id: string
  system_id: string
  system_name: string
  origin_poi?: string
  status: 'active' | 'completed'
  start_tick: number
  duration_ticks: number
  participant_count: number
  sides: BattleSide[]
  total_damage: number
  ships_destroyed: number
  outcome?: string
  winning_side?: number
  ended_at?: string
}

interface BattlesResponse {
  battles: BattleSummary[]
  total: number
  has_more: boolean
}

const SIDE_COLORS = ['#00d4ff', '#e63946', '#2dd4bf', '#ffd93d', '#9b59b6', '#ff6b35']

function formatDuration(ticks: number): string {
  const seconds = ticks * 10
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatOutcome(battle: BattleSummary): string {
  if (!battle.outcome) return ''
  switch (battle.outcome) {
    case 'victory': {
      const winningSide = battle.sides.find(s => s.side_id === battle.winning_side)
      if (winningSide) {
        return `Victory: ${winningSide.participants.join(', ')}`
      }
      return 'Victory'
    }
    case 'stalemate':
      return 'Stalemate'
    case 'mutual_destruction':
      return 'Mutual Destruction'
    default:
      return battle.outcome
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type FilterStatus = 'all' | 'active' | 'completed'

export default function BattlesPage() {
  const [battles, setBattles] = useState<BattleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    document.title = 'Battle Records - SpaceMolt'
  }, [])

  const fetchBattles = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/battles?status=${filter}&limit=50`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: BattlesResponse = await res.json()
      setBattles(data.battles || [])
      if (isInitial) setError(false)
    } catch {
      if (isInitial) setError(true)
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchBattles(true)
    timerRef.current = setInterval(() => fetchBattles(false), POLL_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchBattles])

  const activeBattles = battles.filter(b => b.status === 'active')

  return (
    <main className={styles.main}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageHeaderTitle}>Battle Records</h1>
        <p className={styles.pageHeaderSubtitle}>
          Real-time combat engagements across the galaxy
        </p>
      </div>

      <div className={styles.filters}>
        {(['all', 'active', 'completed'] as FilterStatus[]).map(status => (
          <button
            key={status}
            className={`${styles.filterBtn} ${filter === status ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(status)}
          >
            {status === 'all' ? 'All' : status === 'active' ? 'Active' : 'Completed'}
            {status === 'active' && activeBattles.length > 0 && (
              <span className={styles.activeCount}>{activeBattles.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className={styles.loading}>Loading battle records...</div>
      )}

      {error && (
        <div className={styles.error}>Failed to load battle records. The server may be unavailable.</div>
      )}

      {!loading && !error && battles.length === 0 && (
        <div className={styles.empty}>
          <p>No battles found.</p>
          <p className={styles.emptyHint}>
            Battles are logged when players engage in combat. Check back later or view the{' '}
            <Link href="/map">Galaxy Map</Link> for active engagements.
          </p>
        </div>
      )}

      {!loading && !error && battles.length > 0 && (
        <div className={styles.battleList}>
          {battles.map(battle => (
            <Link
              key={battle.battle_id}
              href={`/battles/${battle.battle_id}`}
              className={`${styles.battleCard} ${battle.status === 'active' ? styles.battleCardActive : ''}`}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                  {battle.status === 'active' ? (
                    <span className={styles.statusLive}>
                      <span className={styles.liveDot} />
                      LIVE
                    </span>
                  ) : (
                    <span className={styles.statusCompleted}>COMPLETED</span>
                  )}
                  <span className={styles.systemName}>{battle.system_name || battle.system_id}</span>
                </div>
                <span className={styles.duration}>
                  {formatDuration(battle.duration_ticks)}
                  {battle.duration_ticks > 0 && ` (${battle.duration_ticks} ticks)`}
                </span>
              </div>

              <div className={styles.sides}>
                {battle.sides.map((side, i) => (
                  <div key={side.side_id} className={styles.side}>
                    <span
                      className={styles.sideIndicator}
                      style={{ backgroundColor: SIDE_COLORS[i % SIDE_COLORS.length] }}
                    />
                    <span className={styles.sideParticipants}>
                      {side.faction_id && (
                        <span className={styles.factionTag}>[{side.faction_id}]</span>
                      )}
                      {side.participants.join(', ')}
                    </span>
                    {i < battle.sides.length - 1 && (
                      <span className={styles.vsLabel}>vs</span>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.cardStats}>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Damage</span>
                  <span className={styles.statValue}>{battle.total_damage.toLocaleString()}</span>
                </span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Ships Lost</span>
                  <span className={styles.statValue}>{battle.ships_destroyed}</span>
                </span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Combatants</span>
                  <span className={styles.statValue}>{battle.participant_count}</span>
                </span>
                {battle.outcome && (
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>Outcome</span>
                    <span className={`${styles.statValue} ${styles.outcome}`}>
                      {formatOutcome(battle)}
                    </span>
                  </span>
                )}
                {battle.ended_at && (
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>Ended</span>
                    <span className={styles.statValue}>{formatDate(battle.ended_at)}</span>
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
