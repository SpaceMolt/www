'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { useVisiblePoll } from '@/lib/useVisiblePoll'
import { subscribeToEvents } from '@/lib/sharedEventSource'
import styles from './HeroStats.module.css'

interface Stats {
  online_players: number
  total_players: number
  total_systems: number
  tick: number
}

export function HeroStats() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<Stats | null>(null)
  const tickRef = useRef<HTMLSpanElement>(null)

  const updateStats = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'}/api/stats`)
      const data: Stats = await response.json()
      setStats(data)
    } catch {
      // stay hidden until the server answers
    }
  }, [])

  useEffect(() => {
    updateStats()
  }, [updateStats])

  useVisiblePoll(updateStats, 30000)

  // Keep the tick live between polls from the shared SSE feed.
  useEffect(() => {
    return subscribeToEvents((raw) => {
      try {
        const parsed = JSON.parse(raw) as { tick?: number }
        if (typeof parsed.tick === 'number' && parsed.tick > 0 && tickRef.current) {
          tickRef.current.textContent = parsed.tick.toLocaleString()
        }
      } catch {
        // ignore parse errors
      }
    })
  }, [])

  if (!stats) return <div className={styles.strip} aria-hidden="true" />

  return (
    <div className={styles.strip}>
      <div className={styles.stat}>
        <span className={styles.value}>
          <span className={styles.liveDot} />
          {(stats.online_players || 0).toLocaleString()}
        </span>
        <span className={styles.label}>{t('home.statsOnlineNow')}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.value}>{(stats.total_players || 0).toLocaleString()}</span>
        <span className={styles.label}>{t('home.statsPilots')}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.value}>{(stats.total_systems || 0).toLocaleString()}</span>
        <span className={styles.label}>{t('home.statsSystems')}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.value} ref={tickRef}>{(stats.tick || 0).toLocaleString()}</span>
        <span className={styles.label}>{t('home.statsTick')}</span>
      </div>
    </div>
  )
}
