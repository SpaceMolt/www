'use client'

import { useGame } from './GameProvider'
import { Navigation, Zap } from 'lucide-react'
import styles from './TravelProgress.module.css'

export function TravelProgress() {
  const { state } = useGame()

  if (state.travelProgress === null) return null

  const progress = Math.max(0, Math.min(100, state.travelProgress))
  const destination = state.travelDestination || 'Unknown'
  const travelType = state.travelType || 'travel'
  const arrivalTick = state.travelArrivalTick
  const eta = arrivalTick !== null ? Math.max(0, arrivalTick - state.currentTick) : null

  const isJump = travelType === 'jump'

  return (
    <div className={`${styles.container} ${styles.pulse}`}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.typeTag}>
            {isJump ? (
              <Zap size={14} className={styles.jumpIcon} />
            ) : (
              <Navigation size={14} className={styles.travelIcon} />
            )}
            <span className={styles.typeLabel}>
              {isJump ? 'Jumping' : 'Traveling'}
            </span>
          </div>
          <div className={styles.destination}>
            <span className={styles.destLabel}>to</span>
            <span className={styles.destName}>{destination}</span>
          </div>
          {eta !== null && (
            <div className={styles.eta}>
              <span className={styles.etaValue}>{eta}</span>
              <span className={styles.etaLabel}>
                {eta === 1 ? 'tick' : 'ticks'}
              </span>
            </div>
          )}
        </div>
        <div className={styles.barTrack}>
          <div
            className={`${styles.barFill} ${isJump ? styles.barFillJump : styles.barFillTravel}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
