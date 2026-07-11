'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from '@/i18n'
import { useVisiblePoll } from '@/lib/useVisiblePoll'
import { subscribeToEvents } from '@/lib/sharedEventSource'

interface Stats {
  version: string
  online_players: number
  total_players: number
  total_systems: number
  tick: number
  forum_threads: number
  forum_replies: number
}

function animateCounter(
  element: HTMLElement,
  targetValue: number,
  duration = 1500
) {
  const startTime = performance.now()

  function update(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeProgress = 1 - Math.pow(1 - progress, 3)
    const currentValue = Math.floor(targetValue * easeProgress)
    element.textContent = currentValue.toLocaleString()
    if (progress < 1) {
      requestAnimationFrame(update)
    } else {
      element.textContent = targetValue.toLocaleString()
    }
  }

  requestAnimationFrame(update)
}

export function StatsBar() {
  const { t } = useTranslation()
  const [serverOnline, setServerOnline] = useState(false)
  const hasAnimated = useRef(false)
  const versionRef = useRef<HTMLSpanElement>(null)
  const onlineRef = useRef<HTMLSpanElement>(null)
  const playersRef = useRef<HTMLSpanElement>(null)
  const systemsRef = useRef<HTMLSpanElement>(null)
  const tickRef = useRef<HTMLSpanElement>(null)
  const postsRef = useRef<HTMLSpanElement>(null)

  const updateStats = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'}/api/stats`)
      const data: Stats = await response.json()
      setServerOnline(true)

      if (versionRef.current) {
        versionRef.current.textContent =
          data.version && data.version !== '0.0.0' ? data.version : '-'
      }

      const forumPosts = (data.forum_threads || 0) + (data.forum_replies || 0)

      if (!hasAnimated.current) {
        hasAnimated.current = true
        if (onlineRef.current) animateCounter(onlineRef.current, data.online_players || 0, 800)
        if (playersRef.current) animateCounter(playersRef.current, data.total_players || 0, 1500)
        if (systemsRef.current) animateCounter(systemsRef.current, data.total_systems || 0, 1200)
        if (tickRef.current) animateCounter(tickRef.current, data.tick || 0, 2000)
        if (postsRef.current) animateCounter(postsRef.current, forumPosts, 1000)
      } else {
        if (onlineRef.current) onlineRef.current.textContent = String(data.online_players || 0)
        if (playersRef.current) playersRef.current.textContent = String(data.total_players || 0)
        if (systemsRef.current) systemsRef.current.textContent = String(data.total_systems || 0)
        if (tickRef.current) tickRef.current.textContent = String(data.tick || 0)
        if (postsRef.current) postsRef.current.textContent = String(forumPosts)
      }
    } catch {
      setServerOnline(false)
    }
  }, [])

  // Initial snapshot, then a slow refresh that pauses while the tab is hidden.
  useEffect(() => {
    updateStats()
  }, [updateStats])

  useVisiblePoll(updateStats, 30000)

  // Keep the tick counter live between refreshes from the shared SSE feed —
  // every event carries the current tick, so this costs no extra requests.
  useEffect(() => {
    return subscribeToEvents((raw) => {
      try {
        const parsed = JSON.parse(raw) as { tick?: number }
        setServerOnline(true)
        if (hasAnimated.current && typeof parsed.tick === 'number' && parsed.tick > 0 && tickRef.current) {
          tickRef.current.textContent = String(parsed.tick)
        }
      } catch {
        // ignore parse errors
      }
    })
  }, [])

  const dotClass = serverOnline ? 'server-status-dot online' : 'server-status-dot offline'
  const textClass = serverOnline ? 'server-status-text online' : 'server-status-text offline'

  return (
    <div className="stats-bar">
      <div className="server-status">
        <span className={dotClass} />
        <span className={textClass}>
          {serverOnline ? t('statsBar.online') : t('statsBar.connecting')}
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{t('statsBar.version')}</span>
        <span className="stat-value" ref={versionRef}>-</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{t('statsBar.onlineCount')}</span>
        <span className="stat-value online" ref={onlineRef}>-</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{t('statsBar.players')}</span>
        <span className="stat-value" ref={playersRef}>-</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{t('statsBar.systems')}</span>
        <span className="stat-value" ref={systemsRef}>-</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{t('statsBar.tick')}</span>
        <span className="stat-value" ref={tickRef}>-</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">{t('statsBar.posts')}</span>
        <span className="stat-value" ref={postsRef}>-</span>
      </div>
    </div>
  )
}
