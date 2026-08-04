'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAccountStore, useConnectionPhase, useCurrentTick } from '@/lib/spacemolt'
import { Timer } from 'lucide-react'
import { estimateTick } from './tickEstimate'
import styles from './TickCooldown.module.css'

export function TickCooldown() {
  const store = useAccountStore()
  const currentTick = useCurrentTick()
  const { phase } = useConnectionPhase()
  const authenticated = phase === 'ready'
  const [progress, setProgress] = useState(0)
  const [displayTick, setDisplayTick] = useState(0)
  const [stale, setStale] = useState(false)
  const [flash, setFlash] = useState(false)
  // The anchor: a tick number the server reported, and when we observed it.
  // These two are only ever written together — an anchor with a refreshed
  // timestamp but a stale number would silently corrupt the estimate.
  const lastTickTimeRef = useRef(Date.now())
  const lastTickNumRef = useRef(0)
  const rafRef = useRef<number>(0)

  const welcome = store.account.welcome
  const tickRateMs = (welcome?.tick_rate || 10) * 1000

  // Anchor on the welcome payload. The lib hands us a fresh payload object per
  // connection, so this also re-anchors after a reconnect, where the server's
  // authoritative current_tick is the best correction we get.
  const welcomeRef = useRef<typeof welcome>(null)
  useEffect(() => {
    if (!welcome || welcome === welcomeRef.current) return
    welcomeRef.current = welcome
    if (welcome.current_tick <= 0) return
    lastTickNumRef.current = welcome.current_tick
    // Estimate when the current tick started using server_time
    if (welcome.server_time > 0) {
      const serverNowMs = welcome.server_time * 1000
      const tickElapsedMs = serverNowMs % tickRateMs
      lastTickTimeRef.current = Date.now() - tickElapsedMs
    } else {
      lastTickTimeRef.current = Date.now()
    }
    setDisplayTick(welcome.current_tick)
    setStale(false)
  }, [welcome, tickRateMs])

  // Sync from confirmed server tick (action_result, pushes, etc.). Every
  // tick-bearing frame is a free resync, so this is the main correction path.
  useEffect(() => {
    if (currentTick > 0 && currentTick !== lastTickNumRef.current) {
      lastTickNumRef.current = currentTick
      lastTickTimeRef.current = Date.now()
      setDisplayTick(currentTick)
      setStale(false)
      setFlash(true)
      setProgress(0)
    }
  }, [currentTick])

  // Clear flash after animation
  useEffect(() => {
    if (!flash) return
    const timeout = setTimeout(() => setFlash(false), 700)
    return () => clearTimeout(timeout)
  }, [flash])

  // Animate between anchors. The estimate is deliberately bounded: the server
  // counts processed ticks, not wall-clock elapsed, so free-running off a
  // nominal tick rate drifts ahead of the real counter (dc#276432). Past the
  // window the number freezes and is rendered as approximate rather than
  // confidently wrong. There is no per-tick server push and this badge is
  // cosmetic, so it must never poll the gameserver to stay fresh.
  const displayTickRef = useRef(0)
  displayTickRef.current = displayTick
  const staleRef = useRef(false)
  staleRef.current = stale
  const animate = useCallback(() => {
    const estimate = estimateTick(
      lastTickNumRef.current,
      lastTickTimeRef.current,
      Date.now(),
      tickRateMs,
    )
    setProgress(estimate.progress)
    if (lastTickNumRef.current > 0) {
      if (estimate.tick !== displayTickRef.current) setDisplayTick(estimate.tick)
      if (estimate.stale !== staleRef.current) setStale(estimate.stale)
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [tickRateMs])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animate])

  if (!authenticated) return null

  // Waiting for first tick data
  if (displayTick === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.indicator}>
          <div className={styles.tickBadge}>
            <Timer size={10} className={styles.tickIcon} />
            <span className={styles.tickNum}>--</span>
          </div>
        </div>
        <div className={styles.track}>
          <div className={styles.fillWaiting} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.indicator}>
        <div
          className={`${styles.tickBadge} ${flash ? styles.tickBadgeFlash : ''} ${stale ? styles.tickBadgeStale : ''}`}
          title={
            stale
              ? 'Approximate — no fresh tick from the server yet. Take an action to resync.'
              : undefined
          }
          aria-label={
            stale ? `Approximate tick ${displayTick}, awaiting server` : `Tick ${displayTick}`
          }
        >
          <Timer size={10} className={styles.tickIcon} />
          <span className={styles.tickNum}>
            {stale ? '~' : ''}
            {displayTick}
          </span>
        </div>
      </div>
      <div className={styles.track}>
        {stale ? (
          <div className={styles.fillWaiting} />
        ) : (
          <div
            className={`${styles.fill} ${flash ? styles.fillFlash : ''}`}
            style={{ width: `${progress * 100}%` }}
          />
        )}
        {flash && <div className={styles.burst} />}
      </div>
    </div>
  )
}
