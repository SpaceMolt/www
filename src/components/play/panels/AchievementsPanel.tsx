'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Trophy, RefreshCw } from 'lucide-react'
import { usePlayer } from '@/lib/spacemolt'
import { Panel, Loading, shared } from '../shared'
import {
  fetchPlayerAchievements,
  rarityLabel,
  hasEmblem,
  emblemSrc,
  type PublicAchievementsResponse,
  type PublicAchievementEntry,
} from '@/lib/publicAchievements'
import styles from './AchievementsPanel.module.css'

type FilterMode = 'all' | 'earned' | 'locked'

export function AchievementsPanel() {
  const player = usePlayer()
  const username = player?.username
  const [data, setData] = useState<PublicAchievementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // Fetch on mount, whenever the logged-in player changes, and on manual reload.
  // A cancellation flag prevents a stale in-flight response (e.g. after the
  // player changes) from overwriting fresher state.
  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    if (!username) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPlayerAchievements(username)
      .then((res) => {
        if (cancelled) return
        setData(res ?? null)
        setError(!res)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [username, reloadKey])

  const visible = useMemo(() => {
    if (!data) return []
    return data.achievements.filter((a) => {
      if (filter === 'earned') return a.earned
      if (filter === 'locked') return !a.earned
      return true
    })
  }, [data, filter])

  const refreshButton = (
    <button className={shared.refreshBtn} onClick={reload} title="Refresh achievements" type="button">
      <RefreshCw size={14} />
    </button>
  )

  return (
    <Panel title="Achievements" icon={<Trophy size={16} />} headerRight={refreshButton}>
      {loading && !data ? (
        <Loading message="Loading achievements..." />
      ) : error || !data ? (
        <div className={shared.emptyState}>Could not load achievements.</div>
      ) : (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryStat}>
              <span className={styles.summaryNum}>{data.summary.earned}</span>
              <span className={styles.summaryDenom}>/ {data.summary.total}</span>
              <span className={styles.summaryLabel}>Unlocked</span>
            </div>
            <div className={styles.summaryStat}>
              <span className={styles.summaryNum}>{data.summary.points}</span>
              <span className={styles.summaryLabel}>Points</span>
            </div>
            <div className={styles.completion}>
              <div className={styles.completionBar}>
                <div
                  className={styles.completionFill}
                  style={{
                    width: `${data.summary.total > 0 ? Math.round((data.summary.earned / data.summary.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className={shared.tabs} role="group" aria-label="Filter achievements">
            {(['all', 'earned', 'locked'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                className={filter === mode ? shared.tabActive : shared.tab}
                aria-pressed={filter === mode}
                onClick={() => setFilter(mode)}
                type="button"
              >
                {mode === 'all' ? 'All' : mode === 'earned' ? 'Earned' : 'Locked'}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className={shared.emptyState}>No achievements in this view.</div>
          ) : (
            <ul className={styles.list}>
              {visible.map((a) => (
                <AchievementTile key={a.id} a={a} />
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  )
}

function AchievementTile({ a }: { a: PublicAchievementEntry }) {
  const secretLocked = a.hidden && !a.earned
  const glyph = (a.emblem || a.name).charAt(0).toUpperCase()
  const cls = [styles.tile, a.earned ? styles.earned : styles.locked, secretLocked ? styles.secret : '']
    .filter(Boolean)
    .join(' ')
  const statusText = a.earned ? 'Earned' : secretLocked ? 'Secret, locked' : 'Locked'

  return (
    <li className={cls}>
      <div className={styles.tEmblem} aria-hidden>
        {a.earned && hasEmblem(a.id) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.tEmblemImg} src={emblemSrc(a.id)} alt="" />
        ) : a.earned ? (
          glyph
        ) : a.hidden ? (
          '?'
        ) : (
          '🔒'
        )}
      </div>
      <div className={styles.tBody}>
        <p className={styles.tName}>{secretLocked ? 'Secret achievement' : a.name}</p>
        <p className={styles.tCategory}>{a.category}</p>
        <p className={styles.tRarity}>{rarityLabel(a.rarity_pct, 'pilots')}</p>
      </div>
      <div className={styles.tMeta}>
        <span className={styles.tPoints}>{a.points}</span>
        <span className={styles.srOnly}>{statusText}</span>
        {a.earned && <span className={styles.tCheck} aria-hidden>✓</span>}
      </div>
    </li>
  )
}
