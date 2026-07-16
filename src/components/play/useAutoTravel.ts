import { useRef, useState, useCallback, useEffect } from 'react'
import { useAccountStore } from '@/lib/spacemolt'
import type { PlannedRoute } from './panels/GalaxyPanel'

export interface AutoTravelProgress {
  currentJumpIndex: number    // 0-based, which jump we're on (-1 = undocking)
  totalJumps: number
  phase: 'undocking' | 'jumping' | 'traveling_to_station' | 'arrived' | 'aborted'
  jumpStartTime: number       // Date.now() when current jump started
  jumpElapsedMs: number       // updated by caller via tick
  estimatedSecsPerJump: number // refined from actual timing
  totalElapsedMs: number
  completedJumps: number
  currentFuel: number
  route: PlannedRoute
  abortReason: string | null
  stationName?: string        // name of station being traveled to (traveling_to_station phase)
  stationTravelSecs?: number  // predicted travel time in seconds
  stationTravelStart?: number // Date.now() when station travel began
}

export interface UseAutoTravelReturn {
  isActive: boolean
  progress: AutoTravelProgress | null
  start: (route: PlannedRoute, options: { shipSpeed: number; isDocked: boolean }) => void
  requestAbort: () => void
  dismissAbort: () => void
}

export function useAutoTravel(): UseAutoTravelReturn {
  const store = useAccountStore()
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

  const start = useCallback((route: PlannedRoute, options: { shipSpeed: number; isDocked: boolean }) => {
    if (activeRef.current) return
    activeRef.current = true
    abortRequestedRef.current = false
    pulledIntoCombatRef.current = false

    const { shipSpeed, isDocked } = options
    const baseSecsPerJump = Math.max(10, 70 - 10 * shipSpeed)

    // Run the async loop
    ;(async () => {
      const jumpTimes: number[] = []
      let currentFuel = route.fuelAvailable
      const startTime = Date.now()

      const abort = (reason: string) => {
        setProgress(prev => prev ? { ...prev, phase: 'aborted' as const, abortReason: reason } : null)
        activeRef.current = false
      }

      const getAvgSecsPerJump = () => {
        if (jumpTimes.length === 0) return baseSecsPerJump
        return (jumpTimes.reduce((a, b) => a + b, 0) / jumpTimes.length) / 1000
      }

      // Initialize progress
      setProgress({
        currentJumpIndex: -1,
        totalJumps: route.totalJumps,
        phase: isDocked ? 'undocking' : 'jumping',
        jumpStartTime: Date.now(),
        jumpElapsedMs: 0,
        estimatedSecsPerJump: baseSecsPerJump,
        totalElapsedMs: 0,
        completedJumps: 0,
        currentFuel,
        route,
        abortReason: null,
      })

      // Yield to let React render the initial state before starting
      await new Promise((r) => setTimeout(r, 0))

      // Step 1: Undock if needed
      if (isDocked) {
        try {
          await store.account.commands.spacemolt.undock()
        } catch (err) {
          abort(`Failed to undock: ${err instanceof Error ? err.message : 'unknown error'}`)
          return
        }

        if (abortRequestedRef.current) { abort('Emergency abort'); return }
      }

      // Step 2: Execute jumps
      for (let i = 1; i < route.route.length; i++) {
        if (abortRequestedRef.current) { abort('Emergency abort'); return }

        const targetSystemId = route.route[i].system_id
        const jumpIndex = i - 1
        const jumpStart = Date.now()

        setProgress(prev => prev ? {
          ...prev,
          currentJumpIndex: jumpIndex,
          phase: 'jumping' as const,
          jumpStartTime: jumpStart,
          jumpElapsedMs: 0,
          estimatedSecsPerJump: getAvgSecsPerJump(),
          totalElapsedMs: Date.now() - startTime,
        } : null)

        try {
          // Mutations are two-phase: this resolves only once the jump has
          // actually executed (which can be several ticks later), so no
          // separate poll for arrival is needed here.
          const result = await store.account.commands.spacemolt.jump({ id: targetSystemId })

          if (pulledIntoCombatRef.current) {
            abort('Pulled into combat — jump sequence aborted')
            return
          }

          // Record timing
          const jumpMs = Date.now() - jumpStart
          jumpTimes.push(jumpMs)

          // Update fuel from the delta if available
          const shipFuel = result.delta.ship?.fuel
          if (typeof shipFuel === 'number') {
            currentFuel = shipFuel
          } else {
            // Estimate fuel decrease
            currentFuel = Math.max(0, currentFuel - route.fuelPerJump)
          }

          // Check fuel for remaining jumps
          const remainingJumps = route.route.length - 1 - i
          if (remainingJumps > 0) {
            const fuelNeeded = remainingJumps * route.fuelPerJump
            if (currentFuel < fuelNeeded) {
              abort(`Insufficient fuel — ${currentFuel} remaining, need ${fuelNeeded} for ${remainingJumps} more jump${remainingJumps > 1 ? 's' : ''}`)
              return
            }
          }

          // Update progress
          setProgress(prev => prev ? {
            ...prev,
            completedJumps: i,
            currentFuel,
            estimatedSecsPerJump: getAvgSecsPerJump(),
            totalElapsedMs: Date.now() - startTime,
          } : null)

        } catch (err) {
          abort(`Jump failed: ${err instanceof Error ? err.message : 'connection error'}`)
          return
        }

        if (abortRequestedRef.current) { abort('Emergency abort'); return }
      }

      // Step 3: Travel to station if destination system has one.
      if (!abortRequestedRef.current) {
        try {
          const sysResult = await store.account.commands.spacemolt.get_system()
          const sysData = sysResult.structuredContent
          const sysInfo = sysData && 'system' in sysData ? sysData.system : undefined
          const currentPoi = sysData && 'poi' in sysData ? sysData.poi : undefined
          const stationPoi = sysInfo?.pois.find(p => p.has_base && p.id !== currentPoi?.id)

          if (stationPoi && currentPoi?.position && stationPoi.position) {
            // Calculate travel time from POI distance and ship speed
            const dx = stationPoi.position.x - currentPoi.position.x
            const dy = stationPoi.position.y - currentPoi.position.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const speed = Math.max(0.1, shipSpeed)
            const travelTicks = Math.max(1, Math.ceil(distance / speed))
            const travelSecs = travelTicks * 10
            const travelStartMs = Date.now()

            setProgress(prev => prev ? {
              ...prev,
              phase: 'traveling_to_station' as const,
              completedJumps: route.totalJumps,
              totalElapsedMs: Date.now() - startTime,
              currentFuel,
              stationName: stationPoi.base_name || stationPoi.name,
              stationTravelSecs: travelSecs,
              stationTravelStart: travelStartMs,
            } : null)

            try {
              // Same two-phase contract — resolves once travel has arrived.
              await store.account.commands.spacemolt.travel({ id: stationPoi.id })

              if (pulledIntoCombatRef.current) {
                abort('Pulled into combat — jump sequence aborted')
                return
              }
            } catch {
              // Travel command failed — still in the right system, proceed to arrived
            }
          }
        } catch {
          // get_system failed — skip station travel, proceed to arrived
        }
      }

      if (abortRequestedRef.current) { abort('Emergency abort'); return }

      // Arrived!
      setProgress(prev => prev ? {
        ...prev,
        phase: 'arrived' as const,
        completedJumps: route.totalJumps,
        totalElapsedMs: Date.now() - startTime,
        currentFuel,
      } : null)
      activeRef.current = false

    })()
  }, [store])

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
