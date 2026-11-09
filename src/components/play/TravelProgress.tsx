'use client'

import { useAccountStore, useCurrentTick, useLocationState, usePendingAction, useSystem } from '@/lib/spacemolt'
import { Navigation, Zap } from 'lucide-react'
import styles from './TravelProgress.module.css'

type TransitLocation = Pick<NonNullable<ReturnType<typeof useLocationState>>,
  'transit_type' | 'transit_dest_poi_id' | 'transit_dest_poi_name' | 'transit_dest_system_name'>

/**
 * Where the ship is headed. In-system travel leaves the server's transit_dest_*
 * fields empty, so fall back to the system's POI list, then to the name the
 * player picked when the action started.
 */
export function transitDestination(
  location: TransitLocation | undefined | null,
  pickedTarget?: string,
  pois: { id: string; name: string; base_name?: string }[] = [],
): string {
  const poi = pois.find((p) => p.id === location?.transit_dest_poi_id)
  const poiName = location?.transit_dest_poi_name || poi?.base_name || poi?.name
  const systemName = location?.transit_dest_system_name
  return (location?.transit_type === 'jump' ? systemName || poiName : poiName || systemName) || pickedTarget || 'destination'
}

export function TravelProgress() {
  const location = useLocationState()
  const currentTick = useCurrentTick()
  const pending = usePendingAction()
  const tickSecs = useAccountStore().account.welcome?.tick_rate || 10
  const systemData = useSystem().data
  const pois = systemData && 'system' in systemData ? systemData.system.pois : undefined

  if (!location?.in_transit) return null

  const isJump = location.transit_type === 'jump'
  const destination = transitDestination(location, pending?.target, pois)

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
                {eta * tickSecs >= 60
                  ? `${Math.floor((eta * tickSecs) / 60)}m ${(eta * tickSecs) % 60}s`
                  : `${eta * tickSecs}s`}
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
