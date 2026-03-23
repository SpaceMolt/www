import { useRef, useState, useCallback } from 'react'
import { useGame } from './GameProvider'
import type { PlannedRoute } from './panels/GalaxyPanel'

export interface AutoTravelProgress {
  currentJumpIndex: number    // 0-based, which jump we're on (-1 = undocking)
  totalJumps: number
  phase: 'undocking' | 'jumping' | 'arrived' | 'aborted'
  jumpStartTime: number       // Date.now() when current jump started
  jumpElapsedMs: number       // updated by caller via tick
  estimatedSecsPerJump: number // refined from actual timing
  totalElapsedMs: number
  completedJumps: number
  currentFuel: number
  route: PlannedRoute
  abortReason: string | null
}

export interface UseAutoTravelReturn {
  isActive: boolean
  progress: AutoTravelProgress | null
  start: (route: PlannedRoute, options: { shipSpeed: number; isDocked: boolean }) => void
  requestAbort: () => void
  dismissAbort: () => void
}

export function useAutoTravel(): UseAutoTravelReturn {
  const { sendCommand } = useGame()
  const [progress, setProgress] = useState<AutoTravelProgress | null>(null)

  // Refs for the async loop to read current values
  const abortRequestedRef = useRef(false)
  const activeRef = useRef(false)

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
