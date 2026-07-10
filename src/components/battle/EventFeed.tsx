'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './BattleViewer.module.css'
import { useTranslation } from '@/i18n'
import type { BattleTimeline, BattleEventKind } from '@/lib/battle/timeline'

type FilterKey = 'all' | 'combat' | 'kills' | 'movement' | 'support'

const FILTERS: Record<FilterKey, BattleEventKind[] | null> = {
  all: null,
  combat: ['attack', 'miss', 'splash', 'burn', 'kill'],
  kills: ['kill', 'escape', 'end'],
  movement: ['zone', 'stance', 'flee', 'escape', 'join'],
  support: ['regen'],
}

interface Props {
  timeline: BattleTimeline
  tickIndex: number
  isPlaying: boolean
  onJump: (tickIndex: number, actorId?: string) => void
}

/**
 * Scrolling combat log up to the current playhead. Click a row to jump the
 * replay to that moment (and select the ship involved).
 */
export default function EventFeed({ timeline, tickIndex, isPlaying, onJump }: Props) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<FilterKey>('all')
  const listRef = useRef<HTMLDivElement>(null)
  const pinnedToEnd = useRef(true)

  const visible = useMemo(() => {
    const kinds = FILTERS[filter]
    const rows = timeline.events.filter(ev => ev.tickIndex <= tickIndex && (!kinds || kinds.includes(ev.kind)))
    // Cap the DOM for very long battles; keep the most recent.
    return rows.length > 400 ? rows.slice(rows.length - 400) : rows
  }, [timeline, tickIndex, filter])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (isPlaying && pinnedToEnd.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [visible, isPlaying])

  return (
    <aside className={styles.feed}>
      <div className={styles.feedHeader}>
        <span className={styles.feedTitle}>{t('battles.combatLog')}</span>
        <div className={styles.feedFilters}>
          {(Object.keys(FILTERS) as FilterKey[]).map(key => (
            <button
              key={key}
              className={`${styles.feedFilterBtn} ${filter === key ? styles.feedFilterOn : ''}`}
              onClick={() => setFilter(key)}
            >
              {t(`battles.feedFilter${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={listRef}
        className={styles.feedList}
        onScroll={() => {
          const el = listRef.current
          if (!el) return
          pinnedToEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
      >
        {visible.length === 0 && <div className={styles.feedEmpty}>{t('battles.noEvents')}</div>}
        {visible.map((ev, i) => (
          <button
            key={`${ev.tickIndex}-${i}`}
            className={`${styles.feedRow} ${ev.tickIndex === tickIndex ? styles.feedRowNow : ''}`}
            onClick={() => onJump(ev.tickIndex, ev.actorId)}
          >
            <span className={styles.feedTick}>{ev.tickIndex + 1}</span>
            <span className={styles.dot} style={{ background: ev.color }} />
            <span className={styles.feedText} style={ev.kind === 'kill' || ev.kind === 'end' ? { color: ev.color } : undefined}>
              {ev.text}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
