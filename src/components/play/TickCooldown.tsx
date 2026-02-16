'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGame } from './GameProvider'
import { Timer } from 'lucide-react'
import styles from './TickCooldown.module.css'

export function TickCooldown() {
  const { state } = useGame()
  const [progress, setProgress] = useState(0)
  const [flash, setFlash] = useState(false)
  const lastTickTimeRef = useRef(Date.now())
  const lastTickNumRef = useRef(state.currentTick)
  const rafRef = useRef<number>(0)

  const tickRateMs = (state.welcome?.tick_rate || 10) * 1000

  // Detect new tick arrival
  useEffect(() => {
    if (state.currentTick > 0 && state.currentTick !== lastTickNumRef.current) {
      lastTickNumRef.current = state.currentTick
      lastTickTimeRef.current = Date.now()
      setFlash(true)
      setProgress(0)
    }
  }, [state.currentTick])

  // Clear flash after animation
  useEffect(() => {
    if (!flash) return
    const timeout = setTimeout(() => setFlash(false), 700)
    return () => clearTimeout(timeout)
  }, [flash])

  // Smooth animation between ticks
  const animate = useCallback(() => {
    const elapsed = Date.now() - lastTickTimeRef.current
    const pct = Math.min(elapsed / tickRateMs, 1)
    setProgress(pct)
    rafRef.current = requestAnimationFrame(animate)
  }, [tickRateMs])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animate])

  if (!state.authenticated || state.currentTick === 0) return null

  return (
    <div className={styles.container}>
      <div className={styles.indicator}>
        <div className={`${styles.tickBadge} ${flash ? styles.tickBadgeFlash : ''}`}>
          <Timer size={10} className={styles.tickIcon} />
          <span className={styles.tickNum}>{state.currentTick}</span>
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
