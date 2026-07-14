'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { accentFor, empireLabel } from '@/lib/publicAchievements'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface LeaderEntry {
  name: string
  empire?: string
  tag?: string
  earned: number
  points: number
}

interface AchievementLeaderboard {
  generated_at: string
  players: LeaderEntry[] | null
  factions: LeaderEntry[] | null
}

export function AchievementsBoard() {
  const [data, setData] = useState<AchievementLeaderboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sub, setSub] = useState<'players' | 'factions'>('players')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard/achievements`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData(await res.json())
        setError(false)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const entries = (sub === 'players' ? data?.players : data?.factions) ?? []

  return (
    <>
      <div className={styles.categories}>
        {(['players', 'factions'] as const).map((s) => (
          <button
            key={s}
            className={`${styles.catBtn} ${sub === s ? styles.catBtnActive : ''}`}
            onClick={() => setSub(s)}
          >
            {s === 'players' ? 'Pilots' : 'Factions'}
          </button>
        ))}
      </div>

      {loading && <div className={styles.loading}>Loading…</div>}
      {error && <div className={styles.error}>Couldn’t load the achievement leaderboard.</div>}

      {!loading && !error && entries.length === 0 && (
        <div className={styles.empty}>No ranked {sub === 'players' ? 'pilots' : 'factions'} yet.</div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colRank}>#</th>
                <th className={styles.colName}>{sub === 'players' ? 'Pilot' : 'Faction'}</th>
                <th className={styles.colEmpire}>{sub === 'players' ? 'Empire' : 'Tag'}</th>
                <th className={styles.colValue}>Unlocked</th>
                <th className={styles.colValue}>Points</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const rank = i + 1
                // Profile roots carry the achievements summary plus a deep
                // link into the full cabinet.
                const href =
                  sub === 'players'
                    ? `/player/${encodeURIComponent(e.name)}`
                    : `/faction/${encodeURIComponent(e.tag || e.name)}`
                return (
                  <tr key={`${rank}-${e.name}`} className={rank <= 3 ? styles[`rank${rank}`] : undefined}>
                    <td className={styles.cellRank}>{rank}</td>
                    <td className={styles.cellName}>
                      <Link href={href} className={styles.cellName} style={{ textDecoration: 'none', color: 'inherit' }}>
                        {e.name}
                      </Link>
                    </td>
                    <td className={styles.cellEmpire}>
                      {sub === 'players' ? (
                        <>
                          <span className={styles.empireDot} style={{ background: accentFor(e.empire) }} />
                          {empireLabel(e.empire)}
                        </>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--chrome-silver)' }}>
                          [{e.tag}]
                        </span>
                      )}
                    </td>
                    <td className={styles.cellValue}>{e.earned.toLocaleString('en-US')}</td>
                    <td className={styles.cellValue} style={{ color: 'var(--plasma-cyan)', fontWeight: 700 }}>
                      {e.points.toLocaleString('en-US')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
