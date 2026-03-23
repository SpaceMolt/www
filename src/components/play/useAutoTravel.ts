import { useRef, useState, useCallback } from 'react'
import { useGame } from './GameProvider'
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
  const { sendCommand, state } = useGame()
  const [progress, setProgress] = useState<AutoTravelProgress | null>(null)

  // Refs for the async loop to read current values
  const abortRequestedRef = useRef(false)
  const activeRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const start = useCallback((route: PlannedRoute, options: { shipSpeed: number; isDocked: boolean }) => {
    if (activeRef.current) return
    activeRef.current = true
    abortRequestedRef.current = false

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
          const result = await sendCommand('undock')
          if (result.error) {
            abort(`Failed to undock: ${result.message || 'unknown error'}`)
            return
          }
        } catch {
          abort('Failed to undock')
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
          const result = await sendCommand('jump', { target_system: targetSystemId })

          if (!result) {
            abort('Jump failed — no response from server')
            return
          }

          // Check for errors — sendCommand returns { error: true, code, message } on failure
          if (result.error || result.code) {
            const msg = (result.message as string) || (result.error as string) || 'Unknown error'
            abort(`Jump failed: ${msg}`)
            return
          }

          // Check if pulled into combat
          if (result.in_combat) {
            abort('Pulled into combat — jump sequence aborted')
            return
          }

          // Record timing
          const jumpMs = Date.now() - jumpStart
          jumpTimes.push(jumpMs)

          // Update fuel from response if available
          const shipData = result.ship as Record<string, unknown> | undefined
          if (shipData && typeof shipData.fuel === 'number') {
            currentFuel = shipData.fuel
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

      // Step 3: Travel to station if destination system has one
      if (!abortRequestedRef.current) {
        try {
          const sysResult = await sendCommand('get_system') as Record<string, unknown>
          const sysInfo = sysResult?.system as { pois?: Array<{ id: string; name: string; base_id?: string; base_name?: string; position?: { x?: number; y?: number } }> } | undefined
          const currentPoi = sysResult?.poi as { id?: string; position?: { x?: number; y?: number } } | undefined
          const stationPoi = sysInfo?.pois?.find(p => p.base_id && p.id !== currentPoi?.id)

          if (stationPoi && currentPoi?.position && stationPoi.position) {
            // Calculate travel time from POI distance and ship speed
            const dx = (stationPoi.position.x ?? 0) - (currentPoi.position.x ?? 0)
            const dy = (stationPoi.position.y ?? 0) - (currentPoi.position.y ?? 0)
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
              await sendCommand('travel', { target_poi: stationPoi.id })

              // Wait for in-system travel to complete by watching game state.
              // travelProgress: null → non-null (traveling) → null (arrived)
              let travelStarted = false
              const maxWaitMs = (travelSecs + 10) * 1000 // predicted time + 10s buffer

              while (Date.now() - travelStartMs < maxWaitMs) {
                await new Promise(r => setTimeout(r, 500))
                if (abortRequestedRef.current) { abort('Emergency abort'); return }

                const tp = stateRef.current.travelProgress
                if (tp !== null) travelStarted = true
                if (travelStarted && tp === null) break
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
  }, [sendCommand])

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
