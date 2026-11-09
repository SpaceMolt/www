'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { AlertTriangle, Compass, Keyboard, X } from 'lucide-react'
import { useAccountStore, useLocationState, useShip } from '@/lib/spacemolt'
import { usePlayUi } from './PlayProvider'
import { TopBar } from './TopBar'
import { ToastContainer } from './ToastContainer'
import { TravelProgress } from './TravelProgress'
import { ALL_PANELS, PanelNav } from './PanelNav'
import { LeftSidebar, type SidebarTab } from './LeftSidebar'
import { RightPane } from './RightPane'
import { ActionBanner } from './ActionBanner'
import { buildRouteViaWaypoints, GalaxyPanel, type GalaxyPanelHandle, type MapSystemData, type PlannedRoute } from './panels/GalaxyPanel'
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
import { AchievementsPanel } from './panels/AchievementsPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { FacilitiesPanel } from './panels/FacilitiesPanel'
import { SalvagePanel } from './panels/SalvagePanel'
import { useAutoTravel, type AutoTravelProgress } from './useAutoTravel'
import { findRoute, jumpEstimateMs } from './routeWalk'
import { LoopRunnerContext, useLoopRunner } from './loop/useLoopRunner'
import { LoopBanner, LoopPanel } from './loop/LoopPanel'
import { ACTION_SHORTCUTS, shortcutKey } from './shortcuts'
import { errorMessage } from './shared'
import { usePlay } from './PlayProvider'
import styles from './HUD.module.css'

const PANELS: Record<string, React.ComponentType> = {
  combat: CombatPanel,
  trading: TradingPanel,
  storage: StoragePanel,
  ship: ShipPanel,
  shipyard: ShipyardPanel,
  crafting: CraftingPanel,
  skills: SkillsPanel,
  achievements: AchievementsPanel,
  facilities: FacilitiesPanel,
  faction: FactionPanel,
  missions: MissionsPanel,
  salvage: SalvagePanel,
  info: InfoPanel,
  settings: SettingsPanel,
  autopilot: LoopPanel,
}

/** Keys 1-9 switch to the first nine left-hand tabs. */
const PANEL_SHORTCUTS = ALL_PANELS.filter((p) => !p.right).slice(0, 9)

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.abortModalOverlay} onClick={onClose}>
      <div className={styles.helpModal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className={styles.helpTitle}><Keyboard size={14} /> Keyboard shortcuts</div>
        <dl className={styles.helpList}>
          {ACTION_SHORTCUTS.map(({ key, label }) => (
            <div key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></div>
          ))}
          {PANEL_SHORTCUTS.map(({ id, label }, i) => (
            <div key={id}><dt><kbd>{i + 1}</kbd></dt><dd>{label} tab</dd></div>
          ))}
        </dl>
        <button className={styles.abortModalOk} onClick={onClose} type="button">Close</button>
      </div>
    </div>
  )
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

  // Station travel progress
  const stationTravelElapsed = progress.stationTravelStart ? (now - progress.stationTravelStart) / 1000 : 0
  const stationTravelTotal = progress.stationTravelSecs ?? 1
  const stationTravelProgress = phase === 'traveling_to_station' ? Math.min(1, stationTravelElapsed / stationTravelTotal) : 0

  // ETA calculation — include station travel time if applicable
  const remainingJumps = totalJumps - completedJumps - (phase === 'jumping' ? jumpProgress : 0)
  const jumpEtaSecs = Math.max(0, Math.round(remainingJumps * estimatedSecsPerJump))
  const stationEtaSecs = phase === 'traveling_to_station'
    ? Math.max(0, Math.round(stationTravelTotal - stationTravelElapsed))
    : 0
  const etaSecs = jumpEtaSecs + stationEtaSecs
  const etaMins = Math.floor(etaSecs / 60)
  const etaRemSecs = etaSecs % 60

  return (
    <div className={styles.autoTravelBanner}>
      <div className={styles.atbTop}>
        <div className={styles.atbPhase}>
          {phase === 'traveling_to_station' ? `TRAVELING TO ${progress.stationName?.toUpperCase() || 'STATION'}`
            : `JUMPING ${completedJumps + 1} / ${totalJumps}`}
        </div>
        <div className={styles.atbCountdown}>
          {etaMins > 0 ? `${etaMins}m ` : ''}{etaRemSecs}s
        </div>
        <div className={styles.atbFuel}>
          FUEL {currentFuel}{progress.refuelStops.length > 0 && ` · REFUELED x${progress.refuelStops.length}`}
        </div>
        <button className={styles.atbAbort} onClick={onAbort}>
          EMERGENCY ABORT
        </button>
      </div>
      {/* Progress bar — segmented for jumps, single bar for station travel */}
      {phase === 'traveling_to_station' ? (
        <div className={styles.atbProgressBar}>
          <div className={styles.atbSegment}>
            <div
              className={styles.atbSegmentFill}
              style={{ width: `${stationTravelProgress * 100}%` }}
            />
          </div>
        </div>
      ) : (
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
      )}
      <div className={styles.atbRoute}>
        {route.route[0].name} → {route.route[route.route.length - 1].name}
      </div>
    </div>
  )
}

export function HUD() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const ship = useShip()
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const pendingTrades = usePlayUi((s) => s.pendingTrades)
  const inCombat = usePlayUi((s) => s.inCombat)
  const hasBattleReplay = usePlayUi((s) => Boolean(s.lastBattleId))
  const [activePanel, setActivePanel] = useState('galaxy')
  const galaxyRef = useRef<GalaxyPanelHandle>(null)
  const [exploreSystem, setExploreSystem] = useState<MapSystemData | null>(null)
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null)
  const autoTravel = useAutoTravel()
  const loop = useLoopRunner()
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('current')
  const [highlightedSystems, setHighlightedSystems] = useState<Set<string> | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const pilotBusy = autoTravel.isActive || loop.isActive

  const handleBeginTravel = useCallback(() => {
    if (!plannedRoute || !ship || loop.isActive) return
    autoTravel.start(plannedRoute, { shipSpeed: ship.speed ?? 1 })
    setPlannedRoute(null) // clear the planned route, auto-travel takes over
  }, [plannedRoute, ship, autoTravel, loop.isActive])

  // When auto-travel completes a jump, switch to system tab
  const completedJumps = autoTravel.progress?.completedJumps ?? 0
  const travelPhase = autoTravel.progress?.phase
  useEffect(() => {
    if (travelPhase === 'jumping' && completedJumps > 0) {
      setSidebarTab('current')
    }
  }, [completedJumps, travelPhase])

  // Panel switching and help. Ship actions (d/m/f/r) live in LeftSidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = shortcutKey(e)
      if (key === null) return
      if (key === 'escape') { setHelpOpen(false); setNavOpen(false); return }
      if (key === '?') { setHelpOpen((v) => !v); return }
      if (document.querySelector('[role="dialog"]')) return // help or another dialog is open
      if (key === 'n') { setNavOpen((v) => !v); return }
      const panel = PANEL_SHORTCUTS[Number(key) - 1]
      if (panel) setActivePanel(panel.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSystemSelect = useCallback((system: MapSystemData) => {
    setExploreSystem(system)
  }, [])

  // An edited route keeps the player's via-points (map BFS legs). With none
  // left, ask the server again so known wormholes are back in the route.
  const handleRouteEdit = useCallback((route: PlannedRoute | null) => {
    if (!route || route.viaWaypoints?.length) { setPlannedRoute(route); return }
    findRoute(store.account, route.targetSystem)
      .then((serverRoute) => setPlannedRoute(serverRoute ?? route))
      .catch((err) => uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) }))
  }, [store, uiStore])

  const handleRemoveViaWaypoint = useCallback((waypointId: string) => {
    if (!plannedRoute) return
    const via = (plannedRoute.viaWaypoints ?? []).filter((id) => id !== waypointId)
    const systems = galaxyRef.current?.getSystems() ?? []
    const route = via.length
      ? buildRouteViaWaypoints(systems, plannedRoute.route[0].system_id, plannedRoute.targetSystem, via, plannedRoute.fuelPerJump, plannedRoute.fuelAvailable)
      : { ...plannedRoute, viaWaypoints: undefined }
    if (route) handleRouteEdit(route)
  }, [plannedRoute, handleRouteEdit])

  const ActivePanelComponent = PANELS[activePanel]

  const badges: Record<string, number> = {}
  if (pendingTrades.length > 0) badges.trading = pendingTrades.length
  if (inCombat) badges.combat = 1
  if (loop.isActive) badges.autopilot = 1

  const galaxy = (
    <GalaxyPanel ref={galaxyRef} onSystemSelect={handleSystemSelect} plannedRoute={plannedRoute} onPlannedRouteChange={handleRouteEdit} autoTravelProgress={autoTravel.progress} highlightedSystems={highlightedSystems} />
  )

  // One pilot at a time: no loop starts while auto-travel runs.
  const loopContext = autoTravel.isActive ? { ...loop, start: () => {} } : loop

  return (
    <LoopRunnerContext.Provider value={loopContext}>
      <div className={styles.hud}>
        {/* Top Bar */}
        <TopBar onShowShortcuts={() => setHelpOpen(true)} />

        {/* Tab Bar; on phones the Nav button opens the left sidebar as a drawer */}
        <div className={styles.navRow}>
          <button className={styles.navButton} onClick={() => setNavOpen(true)} type="button" aria-label="Open navigation and ship actions">
            <Compass size={16} />
            <span>Nav</span>
          </button>
          <PanelNav
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            badges={badges}
            isDocked={isDocked}
            inCombat={inCombat}
            hasBattleReplay={hasBattleReplay}
          />
        </div>

        {/* Main Content: Left Sidebar + Panel + Right Pane */}
        <div className={styles.main}>
          <LeftSidebar galaxyRef={galaxyRef} exploreSystem={exploreSystem} onExploreSystemChange={setExploreSystem} plannedRoute={plannedRoute} onPlannedRouteChange={setPlannedRoute} activeTab={sidebarTab} onTabChange={setSidebarTab} autoTravelActive={pilotBusy} onHighlightedSystemsChange={setHighlightedSystems} mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />
          <div className={styles.panel}>
            <ActionBanner autoTravelActive={autoTravel.isActive} />
            {!autoTravel.isActive && <TravelProgress />}
            {plannedRoute && !autoTravel.isActive && (
              <div className={styles.routeBanner}>
                <div className={styles.routeBannerContent}>
                  <div className={styles.routeBannerInfo}>
                    <span className={styles.routeBannerLabel}>Route Planned</span>
                    <span className={styles.routeBannerStats}>
                      {plannedRoute.totalJumps} jump{plannedRoute.totalJumps !== 1 ? 's' : ''} · {plannedRoute.estimatedFuel} fuel
                      {ship && (() => {
                        const totalSecs = (jumpEstimateMs(ship.speed ?? 1) / 1000) * plannedRoute.totalJumps
                        const mins = Math.floor(totalSecs / 60)
                        const secs = totalSecs % 60
                        return ` · ${mins > 0 ? `${mins}m ` : ''}${secs}s`
                      })()}
                      {plannedRoute.route.some((r) => r.via_wormhole) && ' · via wormhole'}
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
                                aria-label={`Remove waypoint ${wp?.name || wpId}`}
                              >
                                <X size={10} />
                              </button>
                            </span>
                          )
                        })}
                      </span>
                    )}
                    {plannedRoute.estimatedFuel > plannedRoute.fuelAvailable && (
                      <span className={styles.routeBannerCaution}>
                        <AlertTriangle size={11} /> Needs {plannedRoute.estimatedFuel - plannedRoute.fuelAvailable} more fuel. Autopilot refuels at stations on the way, or burns fuel cells.
                      </span>
                    )}
                  </div>
                  <div className={styles.routeBannerActions}>
                    <button className={styles.routeBannerBegin} onClick={handleBeginTravel} disabled={loop.isActive} title={loop.isActive ? 'Stop the running loop first' : undefined}>
                      Begin Travel
                    </button>
                    <button className={styles.routeBannerCancel} onClick={() => setPlannedRoute(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            {autoTravel.isActive && autoTravel.progress && (
              <AutoTravelBanner progress={autoTravel.progress} onAbort={autoTravel.requestAbort} />
            )}
            <div className={styles.panelContent}>
              {ActivePanelComponent ? <ActivePanelComponent /> : galaxy}
            </div>
            <LoopBanner />
          </div>
          <RightPane />
        </div>

        {/* Inside .hud so the drawer stacks above the backdrop */}
        {navOpen && <div className={styles.navBackdrop} onClick={() => setNavOpen(false)} />}
      </div>

      {/* Action Toasts (position: fixed, outside grid) */}
      <ToastContainer />

      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}

      {autoTravel.progress && autoTravel.progress.phase === 'aborted' && (
        <div className={styles.abortModalOverlay}>
          <div className={styles.abortModal}>
            <AlertTriangle size={36} className={styles.abortModalIcon} />
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
              {autoTravel.progress.totalJumps} jumps completed in {Math.round(autoTravel.progress.totalElapsedMs / 1000)}s
              {autoTravel.progress.stationName && ` · Arrived at ${autoTravel.progress.stationName}`}
              {autoTravel.progress.refuelStops.length > 0 && ` · Refueled at ${autoTravel.progress.refuelStops.join(', ')}`}
              {' · '}Fuel remaining: {autoTravel.progress.currentFuel}
            </div>
            <button className={styles.abortModalOk} onClick={autoTravel.dismissAbort}>
              OK
            </button>
          </div>
        </div>
      )}
    </LoopRunnerContext.Provider>
  )
}
