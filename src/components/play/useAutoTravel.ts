import { useRef, useState, useCallback, useEffect } from 'react'
import { useAccountStore, useCommandMutation } from '@/lib/spacemolt'
import type { PlannedRoute } from './panels/GalaxyPanel'
import { jumpEstimateMs, walkRoute } from './routeWalk'

export interface AutoTravelProgress {
  currentJumpIndex: number    // 0-based, which jump we're on (-1 = not started)
  totalJumps: number
  phase: 'jumping' | 'traveling_to_station' | 'arrived' | 'aborted'
  jumpStartTime: number       // Date.now() when current jump started
  estimatedSecsPerJump: number // refined from actual timing
  totalElapsedMs: number
  completedJumps: number
  currentFuel: number
  route: PlannedRoute
  abortReason: string | null
  refuelStops: string[]       // stations (or "fuel cells") used mid-route
  stationName?: string        // name of station being traveled to (traveling_to_station phase)
  stationTravelSecs?: number  // predicted travel time in seconds
  stationTravelStart?: number // Date.now() when station travel began
}

export interface UseAutoTravelReturn {
  isActive: boolean
  progress: AutoTravelProgress | null
  start: (route: PlannedRoute, options: { shipSpeed: number }) => void
  requestAbort: () => void
  dismissAbort: () => void
}

export function useAutoTravel(): UseAutoTravelReturn {
  const store = useAccountStore()
  const run = useCommandMutation()
  const [progress, setProgress] = useState<AutoTravelProgress | null>(null)

  // Refs for the async loop to read current values
  const abortRequestedRef = useRef(false)
  const activeRef = useRef(false)
  // battle_started can land mid-jump/mid-travel while the mutation promise is
  // still outstanding (multi-tick actions) — there is no in_combat flag on
  // the jump/travel response itself, so track it via the push instead.
  const pulledIntoCombatRef = useRef(false)

  useEffect(() => {
    return store.account.on('battle_started', () => {
      pulledIntoCombatRef.current = true
    })
  }, [store])

  const start = useCallback((route: PlannedRoute, { shipSpeed }: { shipSpeed: number }) => {
    if (activeRef.current) return
    activeRef.current = true
    abortRequestedRef.current = false
    pulledIntoCombatRef.current = false

    const { account } = store
    const fuelNow = () => account.ship?.fuel ?? 0

    ;(async () => {
      const jumpTimes: number[] = []
      const startTime = Date.now()
      let jumpStart = startTime

      const update = (patch: Partial<AutoTravelProgress>) =>
        setProgress((prev) => prev && { ...prev, ...patch, currentFuel: fuelNow(), totalElapsedMs: Date.now() - startTime })
      const abort = (reason: string) => {
        update({ phase: 'aborted', abortReason: reason })
        activeRef.current = false
      }
      const avgSecsPerJump = () => jumpTimes.length === 0
        ? jumpEstimateMs(shipSpeed) / 1000
        : jumpTimes.reduce((a, b) => a + b, 0) / jumpTimes.length / 1000
      const stopReason = () => abortRequestedRef.current
        ? 'Emergency abort'
        : pulledIntoCombatRef.current ? 'Pulled into combat — jump sequence aborted' : null

      setProgress({
        currentJumpIndex: -1,
        totalJumps: route.totalJumps,
        phase: 'jumping',
        jumpStartTime: startTime,
        estimatedSecsPerJump: avgSecsPerJump(),
        totalElapsedMs: 0,
        completedJumps: 0,
        currentFuel: fuelNow(),
        route,
        abortReason: null,
        refuelStops: [],
      })

      // Yield to let React render the initial state before starting
      await new Promise((r) => setTimeout(r, 0))

      // The first jump undocks server-side, so no explicit undock step.
      const walkStop = await walkRoute(account, run, route.route, {
        fuelPerJump: route.fuelPerJump,
        shipSpeed,
        stopReason,
        onJumpStart: (i) => {
          jumpStart = Date.now()
          update({ currentJumpIndex: i, phase: 'jumping', jumpStartTime: jumpStart, estimatedSecsPerJump: avgSecsPerJump() })
        },
        onJumpDone: (i) => {
          jumpTimes.push(Date.now() - jumpStart)
          update({ completedJumps: i + 1, estimatedSecsPerJump: avgSecsPerJump() })
        },
        onRefuel: (where) => setProgress((prev) => prev && { ...prev, refuelStops: [...prev.refuelStops, where] }),
      })
      if (walkStop) { abort(walkStop); return }

      // Travel to the route's POI, or else a station in the destination system.
      try {
        const sysData = (await account.commands.spacemolt.get_system()).structuredContent
        const pois = sysData && 'system' in sysData ? sysData.system.pois : []
        const currentPoiId = account.location?.poi_id
        const target = route.targetPoi
          ? pois.find((p) => p.id === route.targetPoi)
          : pois.find((p) => p.has_base && p.id !== currentPoiId)
        const currentPoi = pois.find((p) => p.id === currentPoiId)

        if (target && target.id !== currentPoiId) {
          const dx = (target.position?.x ?? 0) - (currentPoi?.position?.x ?? 0)
          const dy = (target.position?.y ?? 0) - (currentPoi?.position?.y ?? 0)
          const travelSecs = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(0.1, shipSpeed))) * 10
          update({
            phase: 'traveling_to_station',
            completedJumps: route.totalJumps,
            stationName: target.base_name || target.name,
            stationTravelSecs: travelSecs,
            stationTravelStart: Date.now(),
          })
          // Two-phase contract — resolves once travel has arrived.
          await run((c) => c.spacemolt.travel({ id: target.id }), { label: 'travel', estimatedMs: travelSecs * 1000, target: target.base_name || target.name })
        }
      } catch {
        // Still in the right system; report arrival.
      }

      const finalStop = stopReason()
      if (finalStop) { abort(finalStop); return }

      update({ phase: 'arrived', completedJumps: route.totalJumps })
      activeRef.current = false
    })()
  }, [store, run])

  const requestAbort = useCallback(() => {
    abortRequestedRef.current = true
  }, [])

  const dismissAbort = useCallback(() => {
    setProgress(null)
    activeRef.current = false
    abortRequestedRef.current = false
  }, [])

  const isActive = progress !== null && progress.phase !== 'aborted' && progress.phase !== 'arrived'

  return { isActive, progress, start, requestAbort, dismissAbort }
}
