'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccountStore, useCurrentTick, useLocationState, usePendingAction, useSystem } from '@/lib/spacemolt'
import { Navigation, Zap } from 'lucide-react'
import { fractionalTick, tickStartingNow, transitClock } from './tickEstimate'
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

/**
 * Time left and share done for the current trip. The server sends no tick with the transit state,
 * so the clock runs from the last tick anchor, one second at a time.
 */
export function useTransitClock() {
  const store = useAccountStore()
  const location = useLocationState()
  const pending = usePendingAction()
  const anchorTick = useCurrentTick()
  const inTransit = !!location?.in_transit
  // Re-render each second during a trip; each render reads the clock.
  const [, redraw] = useState(0)
  useEffect(() => {
    if (!inTransit) return
    const timer = setInterval(() => redraw((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [inTransit])

  const tickSecs = store.account.welcome?.tick_rate || 10
  const arrivalTick = location?.transit_arrival_tick
  // ponytail: the trip starts when this client first sees it, so a reload mid-trip restarts the bar. The ETA stays right.
  const start = useRef({ key: '', tick: 0, anchorTick: 0, shift: 0 })
  const key = inTransit ? `${location?.transit_type}@${arrivalTick}` : ''
  const estimate = fractionalTick(anchorTick, store.getTickObservedAt(), Date.now(), tickSecs * 1000)
  if (start.current.key !== key) {
    // A trip this client began starts on a tick, which places the anchor inside its tick.
    const began = pending?.command === 'travel' || pending?.command === 'jump'
    const tick = began ? tickStartingNow(estimate) : estimate - (location?.transit_ticks_elapsed ?? 0)
    start.current = { key, tick, anchorTick, shift: began ? tick - estimate : 0 }
  }
  // The shift holds until the server sends a newer anchor.
  const nowTick = estimate + (start.current.anchorTick === anchorTick ? start.current.shift : 0)
  return transitClock(inTransit ? arrivalTick : undefined, start.current.tick, nowTick, tickSecs)
}

export function TravelProgress() {
  const location = useLocationState()
  const pending = usePendingAction()
  const { etaSecs, percent: progress } = useTransitClock()
  const systemData = useSystem().data
  const pois = systemData && 'system' in systemData ? systemData.system.pois : undefined

  if (!location?.in_transit) return null

  const isJump = location.transit_type === 'jump'
  const destination = transitDestination(location, pending?.target, pois)

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
          {etaSecs !== null && (
            <div className={styles.eta}>
              <span className={styles.etaValue}>
                {etaSecs >= 60 ? `${Math.floor(etaSecs / 60)}m ${etaSecs % 60}s` : `${etaSecs}s`}
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
