'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useGame } from './GameProvider'
import { TopBar } from './TopBar'
import { ToastContainer } from './ToastContainer'
import { TravelProgress } from './TravelProgress'
import { PanelNav } from './PanelNav'
import { LeftSidebar, type SidebarTab } from './LeftSidebar'
import { RightPane } from './RightPane'
import { TickCooldown } from './TickCooldown'
import { ActionBanner } from './ActionBanner'
import { GalaxyPanel, type GalaxyPanelHandle, type MapSystemData, type PlannedRoute } from './panels/GalaxyPanel'
import { CombatPanel } from './panels/CombatPanel'
import { TradingPanel } from './panels/TradingPanel'
import { StoragePanel } from './panels/StoragePanel'
import { ShipPanel } from './panels/ShipPanel'
import { ShipyardPanel } from './panels/ShipyardPanel'
import { CraftingPanel } from './panels/CraftingPanel'
import { FactionPanel } from './panels/FactionPanel'
import { MissionsPanel } from './panels/MissionsPanel'
import { InfoPanel } from './panels/InfoPanel'
import { SkillsPanel } from './panels/SkillsPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { useAutoTravel, type AutoTravelProgress } from './useAutoTravel'
import styles from './HUD.module.css'

const PANELS: Record<string, React.ComponentType> = {
  combat: CombatPanel,
  trading: TradingPanel,
  storage: StoragePanel,
  ship: ShipPanel,
  shipyard: ShipyardPanel,
  crafting: CraftingPanel,
  skills: SkillsPanel,
  faction: FactionPanel,
  missions: MissionsPanel,
  info: InfoPanel,
  settings: SettingsPanel,
}

function AutoTravelBanner({ progress, onAbort }: { progress: AutoTravelProgress; onAbort: () => void }) {
  const [now, setNow] = useState(Date.now())

  // Tick every 100ms for smooth countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(interval)
  }, [])

  const { totalJumps, completedJumps, estimatedSecsPerJump, phase, jumpStartTime, currentFuel, route } = progress
  const jumpElapsed = (now - jumpStartTime) / 1000
  const jumpProgress = phase === 'jumping' ? Math.min(1, jumpElapsed / estimatedSecsPerJump) : 0

  // ETA calculation
  const remainingJumps = totalJumps - completedJumps - (phase === 'jumping' ? jumpProgress : 0)
  const etaSecs = Math.max(0, Math.round(remainingJumps * estimatedSecsPerJump))
  const etaMins = Math.floor(etaSecs / 60)
  const etaRemSecs = etaSecs % 60

  return (
    <div className={styles.autoTravelBanner}>
      <div className={styles.atbTop}>
        <div className={styles.atbPhase}>
          {phase === 'undocking' ? 'UNDOCKING' : `JUMPING ${completedJumps + 1} / ${totalJumps}`}
        </div>
        <div className={styles.atbCountdown}>
          {etaMins > 0 ? `${etaMins}m ` : ''}{etaRemSecs}s
        </div>
        <div className={styles.atbFuel}>
          FUEL {currentFuel}
        </div>
        <button className={styles.atbAbort} onClick={onAbort}>
          EMERGENCY ABORT
        </button>
      </div>
      {/* Segmented progress bar */}
      <div className={styles.atbProgressBar}>
        {Array.from({ length: totalJumps }, (_, i) => {
          let fill = 0
          if (i < completedJumps) fill = 1
          else if (i === completedJumps && phase === 'jumping') fill = jumpProgress
          return (
            <div key={i} className={styles.atbSegment}>
              <div
                className={`${styles.atbSegmentFill} ${fill >= 1 ? styles.atbSegmentComplete : ''}`}
                style={{ width: `${fill * 100}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className={styles.atbRoute}>
        {route.route[0].name} → {route.route[route.route.length - 1].name}
      </div>
    </div>
  )
}

export function HUD() {
  const { state } = useGame()
  const [activePanel, setActivePanel] = useState('galaxy')
  const galaxyRef = useRef<GalaxyPanelHandle>(null)
  const [exploreSystem, setExploreSystem] = useState<MapSystemData | null>(null)
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null)
  const autoTravel = useAutoTravel()
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('current')

  const handleBeginTravel = useCallback(() => {
    if (!plannedRoute || !state.ship) return
    autoTravel.start(plannedRoute, {
      shipSpeed: state.ship.speed ?? 1,
      isDocked: state.isDocked,
    })
    setPlannedRoute(null) // clear the planned route, auto-travel takes over
  }, [plannedRoute, state.ship, state.isDocked, autoTravel])

  // When auto-travel completes a jump, switch to system tab
  const completedJumps = autoTravel.progress?.completedJumps ?? 0
  const travelPhase = autoTravel.progress?.phase
  useEffect(() => {
    if (travelPhase === 'jumping' && completedJumps > 0) {
      setSidebarTab('current')
    }
  }, [completedJumps, travelPhase])

  const handleSystemSelect = useCallback((system: MapSystemData) => {
    setExploreSystem(system)
  }, [])

  const handleRemoveViaWaypoint = useCallback((waypointId: string) => {
    if (!plannedRoute) return
    const systems = galaxyRef.current?.getSystems()
    if (!systems) return
    const newVia = (plannedRoute.viaWaypoints || []).filter((id) => id !== waypointId)
    const startId = plannedRoute.route[0].system_id
    const endId = plannedRoute.targetSystem
    // Re-import buildRouteViaWaypoints isn't available here, so do inline BFS chain
    // Actually, we need to call the utility. Let's expose it via the ref.
    // Simpler: reconstruct via the same logic
    const adj = new Map<string, string[]>()
    for (const sys of systems) adj.set(sys.id, [...sys.connections])
    function bfs(from: string, to: string): string[] | null {
      if (from === to) return [from]
      const queue = [from]
      const visited = new Set([from])
      const parent = new Map<string, string>()
      while (queue.length > 0) {
        const cur = queue.shift()!
        if (cur === to) {
          const path: string[] = []
          let n: string | undefined = to
          while (n && n !== from) { path.unshift(n); n = parent.get(n) }
          path.unshift(from)
          return path
        }
        for (const nb of adj.get(cur) || []) {
          if (!visited.has(nb)) { visited.add(nb); parent.set(nb, cur); queue.push(nb) }
        }
      }
      return null
    }
    const stops = [startId, ...newVia, endId]
    const fullPath: string[] = []
    for (let i = 0; i < stops.length - 1; i++) {
      const leg = bfs(stops[i], stops[i + 1])
      if (!leg) return
      if (i === 0) fullPath.push(...leg)
      else fullPath.push(...leg.slice(1))
    }
    const sysMap = new Map(systems.map((s) => [s.id, s]))
    setPlannedRoute({
      route: fullPath.map((id, i) => ({ system_id: id, name: sysMap.get(id)?.name || id, jumps: i })),
      totalJumps: fullPath.length - 1,
      targetSystem: endId,
      fuelPerJump: plannedRoute.fuelPerJump,
      estimatedFuel: plannedRoute.fuelPerJump * (fullPath.length - 1),
      fuelAvailable: plannedRoute.fuelAvailable,
      viaWaypoints: newVia.length ? newVia : undefined,
    })
  }, [plannedRoute])

  const ActivePanelComponent = PANELS[activePanel]

  const badges: Record<string, number> = {}
  if (state.pendingTrades.length > 0) badges.trading = state.pendingTrades.length
  if (state.inCombat) badges.combat = 1

  return (
    <>
      <div className={styles.hud}>
        {/* Top Bar */}
        <TopBar />

        {/* Tick Cooldown Bar */}
        <TickCooldown />

        {/* Tab Bar */}
        <PanelNav
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          badges={badges}
          isDocked={state.isDocked}
          inCombat={state.inCombat}
        />

        {/* Main Content: Left Sidebar + Panel + Right Pane */}
        <div className={styles.main}>
          <LeftSidebar galaxyRef={galaxyRef} exploreSystem={exploreSystem} onExploreSystemChange={setExploreSystem} plannedRoute={plannedRoute} onPlannedRouteChange={setPlannedRoute} activeTab={sidebarTab} onTabChange={setSidebarTab} autoTravelActive={autoTravel.isActive} />
          <div className={styles.panel}>
            <ActionBanner autoTravelActive={autoTravel.isActive} />
            <TravelProgress />
            {plannedRoute && !autoTravel.isActive && (
              <div className={styles.routeBanner}>
                <div className={styles.routeBannerContent}>
                  <div className={styles.routeBannerInfo}>
                    <span className={styles.routeBannerLabel}>Route Planned</span>
                    <span className={styles.routeBannerStats}>
                      {plannedRoute.totalJumps} jump{plannedRoute.totalJumps !== 1 ? 's' : ''} · {plannedRoute.estimatedFuel} fuel
                      {state.ship && (() => {
                        const secsPerJump = Math.max(10, 70 - 10 * (state.ship.speed ?? 1))
                        const totalSecs = secsPerJump * plannedRoute.totalJumps
                        const mins = Math.floor(totalSecs / 60)
                        const secs = totalSecs % 60
                        return ` · ${mins > 0 ? `${mins}m ` : ''}${secs}s`
                      })()}
                    </span>
                    {plannedRoute.viaWaypoints && plannedRoute.viaWaypoints.length > 0 && (
                      <span className={styles.routeBannerVia}>
                        via{' '}
                        {plannedRoute.viaWaypoints.map((wpId) => {
                          const wp = plannedRoute.route.find((r) => r.system_id === wpId)
                          return (
                            <span key={wpId} className={styles.viaWaypointChip}>
                              {wp?.name || wpId}
                              <button
                                className={styles.viaWaypointRemove}
                                onClick={() => handleRemoveViaWaypoint(wpId)}
                                title="Remove waypoint"
                              >
                                ×
                              </button>
                            </span>
                          )
                        })}
                      </span>
                    )}
                    {plannedRoute.estimatedFuel >= plannedRoute.fuelAvailable && (
                      <span className={styles.routeBannerWarning}>
                        ⚠ Insufficient fuel ({plannedRoute.fuelAvailable} available)
                      </span>
                    )}
                    {plannedRoute.estimatedFuel >= plannedRoute.fuelAvailable * 0.8 && plannedRoute.estimatedFuel < plannedRoute.fuelAvailable && (
                      <span className={styles.routeBannerCaution}>
                        ⚠ Low fuel margin ({plannedRoute.fuelAvailable - plannedRoute.estimatedFuel} remaining)
                      </span>
                    )}
                  </div>
                  <div className={styles.routeBannerActions}>
                    <button className={styles.routeBannerBegin} onClick={handleBeginTravel}>
                      Begin Travel
                    </button>
                    <button className={styles.routeBannerCancel} onClick={() => setPlannedRoute(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            {autoTravel.progress && (autoTravel.progress.phase === 'undocking' || autoTravel.progress.phase === 'jumping') && (
              <AutoTravelBanner progress={autoTravel.progress} onAbort={autoTravel.requestAbort} />
            )}
            <div className={styles.panelContent}>
              {activePanel === 'galaxy' ? (
                <GalaxyPanel ref={galaxyRef} onSystemSelect={handleSystemSelect} plannedRoute={plannedRoute} onPlannedRouteChange={setPlannedRoute} autoTravelProgress={autoTravel.progress} />
              ) : ActivePanelComponent ? (
                <ActivePanelComponent />
              ) : (
                <GalaxyPanel ref={galaxyRef} onSystemSelect={handleSystemSelect} plannedRoute={plannedRoute} onPlannedRouteChange={setPlannedRoute} autoTravelProgress={autoTravel.progress} />
              )}
            </div>
          </div>
          <RightPane />
        </div>
      </div>

      {/* Action Toasts (position: fixed, outside grid) */}
      <ToastContainer />

      {autoTravel.progress && autoTravel.progress.phase === 'aborted' && (
        <div className={styles.abortModalOverlay}>
          <div className={styles.abortModal}>
            <div className={styles.abortModalIcon}>⚠</div>
            <div className={styles.abortModalTitle}>JUMP SEQUENCE ABORTED</div>
            <div className={styles.abortModalReason}>{autoTravel.progress.abortReason}</div>
            <div className={styles.abortModalDetail}>
              Completed {autoTravel.progress.completedJumps} of {autoTravel.progress.totalJumps} jumps · Fuel remaining: {autoTravel.progress.currentFuel}
            </div>
            <button className={styles.abortModalOk} onClick={autoTravel.dismissAbort}>
              OK
            </button>
          </div>
        </div>
      )}

      {autoTravel.progress && autoTravel.progress.phase === 'arrived' && (
        <div className={styles.abortModalOverlay}>
          <div className={styles.arrivedModal}>
            <div className={styles.arrivedModalTitle}>DESTINATION REACHED</div>
            <div className={styles.arrivedModalDetail}>
              {autoTravel.progress.totalJumps} jumps completed in {Math.round(autoTravel.progress.totalElapsedMs / 1000)}s · Fuel remaining: {autoTravel.progress.currentFuel}
            </div>
            <button className={styles.abortModalOk} onClick={autoTravel.dismissAbort}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  )
}
