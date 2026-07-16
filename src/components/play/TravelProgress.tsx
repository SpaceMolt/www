'use client'

import { useCurrentTick, useLocationState } from '@/lib/spacemolt'
import { Navigation, Zap } from 'lucide-react'
import styles from './TravelProgress.module.css'

export function TravelProgress() {
  const location = useLocationState()
  const currentTick = useCurrentTick()

  if (!location?.in_transit) return null

  const travelType = location.transit_type || 'travel'
  const isJump = travelType === 'jump'
  const destination =
    (isJump ? location.transit_dest_system_name : location.transit_dest_poi_name) ||
    location.transit_dest_poi_name ||
    location.transit_dest_system_name ||
    'Unknown'

  const arrivalTick = location.transit_arrival_tick
  const elapsed = location.transit_ticks_elapsed ?? 0
  const eta = arrivalTick !== undefined ? Math.max(0, arrivalTick - currentTick) : null
  const totalTicks = eta !== null ? elapsed + eta : null
  const progress =
    totalTicks && totalTicks > 0 ? Math.max(0, Math.min(100, (elapsed / totalTicks) * 100)) : 0

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
              <span className={styles.etaValue}>
                {eta * 10 >= 60
                  ? `${Math.floor((eta * 10) / 60)}m ${(eta * 10) % 60}s`
                  : `${eta * 10}s`}
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
