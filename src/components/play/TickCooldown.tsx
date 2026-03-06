'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGame } from './GameProvider'
import { Timer } from 'lucide-react'
import styles from './TickCooldown.module.css'

export function TickCooldown() {
  const { state } = useGame()
  const [progress, setProgress] = useState(0)
  const [displayTick, setDisplayTick] = useState(0)
  const [flash, setFlash] = useState(false)
  const lastTickTimeRef = useRef(Date.now())
  const lastTickNumRef = useRef(0)
  const rafRef = useRef<number>(0)

  const tickRateMs = (state.welcome?.tick_rate || 10) * 1000

  // Bootstrap tick from welcome message
  useEffect(() => {
    if (state.welcome && state.welcome.current_tick > 0 && lastTickNumRef.current === 0) {
      lastTickNumRef.current = state.welcome.current_tick
      // Estimate when the current tick started using server_time
      if (state.welcome.server_time > 0) {
        const serverNowMs = state.welcome.server_time * 1000
        const tickElapsedMs = serverNowMs % tickRateMs
        lastTickTimeRef.current = Date.now() - tickElapsedMs
      } else {
        lastTickTimeRef.current = Date.now()
      }
      setDisplayTick(state.welcome.current_tick)
    }
  }, [state.welcome, tickRateMs])

  // Sync from confirmed server tick (action_result, etc.)
  useEffect(() => {
    if (state.currentTick > 0 && state.currentTick !== lastTickNumRef.current) {
      lastTickNumRef.current = state.currentTick
      lastTickTimeRef.current = Date.now()
      setDisplayTick(state.currentTick)
      setFlash(true)
      setProgress(0)
    }
  }, [state.currentTick])

  // Reset timer baseline on status poll (player object changes)
  const playerRef = useRef(state.player)
  useEffect(() => {
    if (state.player && state.player !== playerRef.current) {
      playerRef.current = state.player
      // If the timer has drifted far (more than 3 ticks without server confirmation),
      // reset the baseline to keep the animation fresh
      const elapsed = Date.now() - lastTickTimeRef.current
      if (elapsed > tickRateMs * 3) {
        lastTickTimeRef.current = Date.now()
      }
    }
  }, [state.player, tickRateMs])

  // Clear flash after animation
  useEffect(() => {
    if (!flash) return
    const timeout = setTimeout(() => setFlash(false), 700)
    return () => clearTimeout(timeout)
  }, [flash])

  // Smooth animation - auto-cycles between ticks (never gets stuck)
  const displayTickRef = useRef(0)
  displayTickRef.current = displayTick
  const animate = useCallback(() => {
    const elapsed = Date.now() - lastTickTimeRef.current
    const ticksElapsed = Math.floor(elapsed / tickRateMs)
    const withinTick = elapsed - ticksElapsed * tickRateMs
    const pct = withinTick / tickRateMs
    setProgress(pct)

    // Auto-estimate displayed tick number
    if (lastTickNumRef.current > 0) {
      const estimated = lastTickNumRef.current + ticksElapsed
      if (estimated !== displayTickRef.current) {
        setDisplayTick(estimated)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [tickRateMs])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animate])

  if (!state.authenticated) return null

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
        <div className={`${styles.tickBadge} ${flash ? styles.tickBadgeFlash : ''}`}>
          <Timer size={10} className={styles.tickIcon} />
          <span className={styles.tickNum}>{displayTick}</span>
        </div>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${flash ? styles.fillFlash : ''}`}
          style={{ width: `${progress * 100}%` }}
        />
        {flash && <div className={styles.burst} />}
      </div>
    </div>
  )
}
