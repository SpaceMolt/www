'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Trophy, RefreshCw } from 'lucide-react'
import { usePlayer, useCommandQuery } from '@/lib/spacemolt'
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

// The two sources agree on everything the tile draws except rarity and emblem,
// which only the public endpoint carries.
type AchievementTileEntry = Pick<
  PublicAchievementEntry,
  'id' | 'name' | 'category' | 'points' | 'hidden' | 'earned'
> & { rarity_pct?: number; emblem?: string }

export function AchievementsPanel() {
  const player = usePlayer()
  const username = player?.username
  const [data, setData] = useState<PublicAchievementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // Fetch on mount, whenever the logged-in player changes, and on manual reload.
  // A cancellation flag prevents a stale in-flight response (e.g. after the
  // player changes) from overwriting fresher state.
  useEffect(() => {
    let cancelled = false
    setData(null)
    if (!username) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPlayerAchievements(username)
      .then((res) => {
        if (cancelled) return
        setData(res ?? null)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [username, reloadKey])

  // A pilot who has set their profile hidden gets a 404 from the public
  // endpoint even for their own name, so fall back to the authenticated
  // command. It carries no rarity, which is why the tiles drop that line.
  const own = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_achievements()).structuredContent,
    [username],
    { enabled: !loading && !data },
  )

  const view = data ?? own.data ?? null
  const pending = !data && (loading || own.loading)

  const visible = useMemo(() => {
    if (!view) return []
    return view.achievements.filter((a) => {
      if (filter === 'earned') return a.earned
      if (filter === 'locked') return !a.earned
      return true
    })
  }, [view, filter])

  const refreshButton = (
    <button className={shared.refreshBtn} onClick={reload} title="Refresh achievements" type="button">
      <RefreshCw size={14} />
    </button>
  )

  return (
    <Panel title="Achievements" icon={<Trophy size={16} />} headerRight={refreshButton}>
      {pending ? (
        <Loading message="Loading achievements..." />
      ) : !view ? (
        <div className={shared.emptyState}>Could not load achievements.</div>
      ) : (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryStat}>
              <span className={styles.summaryNum}>{view.summary.earned}</span>
              <span className={styles.summaryDenom}>/ {view.summary.total}</span>
              <span className={styles.summaryLabel}>Unlocked</span>
            </div>
            <div className={styles.summaryStat}>
              <span className={styles.summaryNum}>{view.summary.points}</span>
              <span className={styles.summaryLabel}>Points</span>
            </div>
            <div className={styles.completion}>
              <div className={styles.completionBar}>
                <div
                  className={styles.completionFill}
                  style={{
                    width: `${view.summary.total > 0 ? Math.round((view.summary.earned / view.summary.total) * 100) : 0}%`,
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

function AchievementTile({ a }: { a: AchievementTileEntry }) {
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
        {a.rarity_pct !== undefined && (
          <p className={styles.tRarity}>{rarityLabel(a.rarity_pct, 'pilots')}</p>
        )}
      </div>
      <div className={styles.tMeta}>
        <span className={styles.tPoints}>{a.points}</span>
        <span className={styles.srOnly}>{statusText}</span>
        {a.earned && <span className={styles.tCheck} aria-hidden>✓</span>}
      </div>
    </li>
  )
}
