'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Skull, Trophy, Zap } from 'lucide-react'
import styles from './page.module.css'
import { useTranslation } from '@/i18n'
import { useVisiblePoll } from '@/lib/useVisiblePoll'
import { CategoryIcon } from '@/components/battle/CategoryIcon'
import {
  BATTLE_CATEGORY_META,
  sideColor,
  type BattleCategory,
  type BattleSummary,
} from '@/lib/battle/types'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const POLL_INTERVAL = 10_000

interface BattlesResponse {
  battles: BattleSummary[]
  total: number
  has_more: boolean
}

type FilterStatus = 'all' | 'active' | 'completed'
type FilterCategory = 'all' | BattleCategory

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

const CATEGORY_FILTERS: { key: FilterCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'battles.filterTypeAll' },
  { key: 'pvp', labelKey: 'battles.filterTypePvp' },
  { key: 'pirate', labelKey: 'battles.filterTypePirate' },
  { key: 'police', labelKey: 'battles.filterTypePolice' },
  { key: 'wildlife', labelKey: 'battles.filterTypeWildlife' },
  { key: 'pve', labelKey: 'battles.filterTypePve' },
]

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

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function winnerNames(battle: BattleSummary): string[] {
  const side = (battle.sides ?? []).find(s => s.side_id === battle.winning_side)
  return side?.participants ?? []
}

export default function BattlesPage() {
  const { t } = useTranslation()
  const [battles, setBattles] = useState<BattleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [category, setCategory] = useState<FilterCategory>('all')

  useEffect(() => {
    document.title = 'Battle Records - SpaceMolt'
  }, [])

  const fetchBattles = useCallback(
    async (isInitial: boolean) => {
      if (isInitial) setLoading(true)
      try {
        const params = new URLSearchParams({ status: filter, limit: '50' })
        if (category !== 'all') params.set('category', category)
        const res = await fetch(`${API_BASE}/api/battles?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: BattlesResponse = await res.json()
        setBattles(data.battles || [])
        if (isInitial) setError(false)
      } catch {
        if (isInitial) setError(true)
      } finally {
        if (isInitial) setLoading(false)
      }
    },
    [filter, category],
  )

  useEffect(() => {
    fetchBattles(true)
  }, [fetchBattles])

  useVisiblePoll(() => fetchBattles(false), POLL_INTERVAL)

  // Servers that predate the category param return everything — filter here
  // too so the chips always mean what they say.
  const visible = useMemo(
    () => (category === 'all' ? battles : battles.filter(b => b.category === category)),
    [battles, category],
  )

  const activeBattles = battles.filter(b => b.status === 'active')

  return (
    <div className="console-page">
      <header className="console-page-header">
        <span className="console-page-kicker">Operations</span>
        <h1 className="console-page-title">{t('battles.pageTitle')}</h1>
        <p className="console-page-sub">{t('battles.pageSubtitle')}</p>
      </header>

      <h2 style={srOnly}>Filter Battles</h2>
      <div className={styles.filterBars}>
        <div className={styles.filters}>
          {(['all', 'active', 'completed'] as FilterStatus[]).map(status => (
            <button
              key={status}
              className={`${styles.filterBtn} ${filter === status ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(status)}
            >
              {status === 'all'
                ? t('battles.filterAll')
                : status === 'active'
                  ? t('battles.filterActive')
                  : t('battles.filterCompleted')}
              {status === 'active' && activeBattles.length > 0 && (
                <span className={styles.activeCount}>{activeBattles.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className={styles.filters}>
          {CATEGORY_FILTERS.map(c => (
            <button
              key={c.key}
              className={`${styles.filterBtn} ${styles.categoryBtn} ${category === c.key ? styles.filterBtnActive : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.key !== 'all' && (
                <span className={styles.filterGlyph}>
                  <CategoryIcon category={c.key} size={13} />
                </span>
              )}
              {t(c.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <h2 style={srOnly}>Battle Records</h2>

      {loading && <div className={styles.loading}>{t('battles.loading')}</div>}

      {error && <div className={styles.error}>{t('battles.error')}</div>}

      {!loading && !error && visible.length === 0 && (
        <div className={styles.empty}>
          <p>{t('battles.noBattles')}</p>
          <p className={styles.emptyHint}>{t('battles.noBattlesHint')}</p>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className={styles.battleGrid}>
          {visible.map(battle => {
            const catMeta = battle.category ? BATTLE_CATEGORY_META[battle.category] : undefined
            const winners = battle.outcome === 'victory' ? winnerNames(battle) : []
            return (
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
                        {t('battles.statusLive')}
                      </span>
                    ) : (
                      catMeta && battle.category && (
                        <span
                          className={styles.categoryBadge}
                          style={{ color: catMeta.color, borderColor: catMeta.color }}
                        >
                          <CategoryIcon category={battle.category} size={11} /> {t(catMeta.labelKey)}
                        </span>
                      )
                    )}
                    {battle.status === 'active' && catMeta && battle.category && (
                      <span
                        className={styles.categoryBadge}
                        style={{ color: catMeta.color, borderColor: catMeta.color }}
                      >
                        <CategoryIcon category={battle.category} size={11} /> {t(catMeta.labelKey)}
                      </span>
                    )}
                    <span className={styles.systemName}>{battle.system_name || battle.system_id}</span>
                  </div>
                  <span className={styles.cardWhen}>
                    {battle.ended_at ? timeAgo(battle.ended_at) : formatDuration(battle.duration_ticks)}
                  </span>
                </div>

                <div className={styles.sides}>
                  {(battle.sides ?? []).map((side, i, sides) => (
                    <div key={side.side_id} className={styles.side}>
                      <span
                        className={styles.sideIndicator}
                        style={{ backgroundColor: sideColor(i) }}
                      />
                      <span className={styles.sideParticipants}>
                        {(side.faction_tag || side.faction_id) && (
                          <span className={styles.factionTag}>[{side.faction_tag || side.faction_id}]</span>
                        )}
                        {side.participants?.length ? side.participants.join(', ') : '—'}
                      </span>
                      {i < sides.length - 1 && <span className={styles.vsLabel}>vs</span>}
                    </div>
                  ))}
                </div>

                <div className={styles.cardStats}>
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>{t('battles.duration')}</span>
                    <span className={styles.statValue}>{formatDuration(battle.duration_ticks)}</span>
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>{t('battles.damage')}</span>
                    <span className={styles.statValue}>{battle.total_damage.toLocaleString()}</span>
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>{t('battles.participants')}</span>
                    <span className={styles.statValue}>{battle.participant_count}</span>
                  </span>
                  {battle.top_damage && (
                    <span className={styles.stat}>
                      <span className={styles.statLabel}>{t('battles.topDamage')}</span>
                      <span className={styles.statValue}>
                        <Zap size={11} aria-hidden /> {battle.top_damage.username} ({battle.top_damage.damage.toLocaleString()})
                      </span>
                    </span>
                  )}
                </div>

                {(winners.length > 0 || (battle.destroyed_names?.length ?? 0) > 0 || battle.outcome === 'stalemate' || battle.outcome === 'mutual_destruction') && (
                  <div className={styles.cardOutcome}>
                    {winners.length > 0 && (
                      <span className={styles.winnerLine}>
                        <Trophy size={11} aria-hidden /> {t('battles.outcomeVictory')}: {winners.join(', ')}
                      </span>
                    )}
                    {battle.outcome === 'stalemate' && (
                      <span className={styles.neutralLine}>{t('battles.outcomeStalemate')}</span>
                    )}
                    {battle.outcome === 'mutual_destruction' && (
                      <span className={styles.destroyedLine}>{t('battles.outcomeMutualDestruction')}</span>
                    )}
                    {(battle.destroyed_names?.length ?? 0) > 0 && (
                      <span className={styles.destroyedLine}>
                        <Skull size={11} aria-hidden /> {battle.destroyed_names!.join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
