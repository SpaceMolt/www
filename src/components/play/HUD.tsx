'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { AlertTriangle, CircleHelp, Compass, Globe, Keyboard, LockOpen, Orbit, X } from 'lucide-react'
import { useAccountStore, useLocationState, usePlayer, useShip } from '@/lib/spacemolt'
import { useStationServices } from './hooks/useGates'
import { usePlayUi } from './PlayProvider'
import { TopBar } from './TopBar'
import { ToastContainer } from './ToastContainer'
import { TravelProgress, useTransitClock } from './TravelProgress'
import { PanelNav, panelShortcuts } from './PanelNav'
import { LeftSidebar, type MapView, type NavActions, type SidebarTab } from './LeftSidebar'
import { RightPane } from './RightPane'
import { ActionBanner } from './ActionBanner'
import { buildRouteViaWaypoints, GalaxyPanel, type GalaxyPanelHandle, type MapSystemData, type PlannedRoute } from './panels/GalaxyPanel'
import { SystemMap } from './panels/SystemMap'
import mapStyles from './panels/SystemMap.module.css'
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
import { StationPanel } from './panels/StationPanel'
import { SalvagePanel } from './panels/SalvagePanel'
import { CrewPanel } from './panels/CrewPanel'
import { useAutoTravel, type AutoTravelProgress } from './useAutoTravel'
import { findRoute, jumpEstimateMs, travelSpeed } from './routeWalk'
import { LoopRunnerContext, useLoopRunner } from './loop/useLoopRunner'
import { LoopBanner, LoopPanel } from './loop/LoopPanel'
import { ACTION_SHORTCUTS, COMBAT_SHORTCUTS, shortcutKey } from './shortcuts'
import { ConfirmAction, errorMessage, Modal } from './shared'
import { usePlay } from './PlayProvider'
import { FeatureHelp } from './FeatureHelp'
import shared from './shared.module.css'
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
  station: StationPanel,
  faction: FactionPanel,
  missions: MissionsPanel,
  salvage: SalvagePanel,
  crew: CrewPanel,
  info: InfoPanel,
  settings: SettingsPanel,
  autopilot: LoopPanel,
}

function ShortcutHelp({ onClose, hiddenPanels }: { onClose: () => void; hiddenPanels: string[] }) {
  const [tab, setTab] = useState<'keys' | 'unlocks'>('keys')
  return (
    <Modal
      title="Help"
      icon={<CircleHelp size={14} />}
      onClose={onClose}
      actions={<button className={styles.abortModalOk} onClick={onClose} type="button">Close</button>}
    >
      <div className={shared.tabs} role="group" aria-label="Help topic">
        {([['keys', 'Shortcuts', Keyboard], ['unlocks', 'Hidden features', LockOpen]] as const).map(([id, label, Icon]) => (
          <button key={id} className={`${shared.tab} ${tab === id ? shared.tabActive : ''}`} aria-pressed={tab === id} onClick={() => setTab(id)} type="button">
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>
      {tab === 'unlocks' ? <FeatureHelp /> : (
        <dl className={styles.helpList}>
          {[...ACTION_SHORTCUTS, ...COMBAT_SHORTCUTS].map(({ key, label }) => (
            <div key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></div>
          ))}
          {panelShortcuts(hiddenPanels).map(({ id, label }, i) => (
            <div key={id}><dt><kbd>{i + 1}</kbd></dt><dd>{label} tab</dd></div>
          ))}
        </dl>
      )}
    </Modal>
  )
}

function AutoTravelBanner({ progress, onAbort }: { progress: AutoTravelProgress; onAbort: () => void }) {
  const liveFuel = useShip()?.fuel // progress.currentFuel only updates between jumps
  // The leg in flight runs on the server's arrival tick. The estimates only cover legs that have not started.
  const leg = useTransitClock()

  const { totalJumps, completedJumps, estimatedSecsPerJump, phase, currentFuel, route } = progress
  const legProgress = leg.percent / 100
  const jumpProgress = phase === 'jumping' ? legProgress : 0
  const stationTravelProgress = phase === 'traveling_to_station' ? legProgress : 0

  const jumpsNotStarted = Math.max(0, totalJumps - completedJumps - (phase === 'jumping' ? 1 : 0))
  const legEtaSecs = leg.etaSecs ?? (phase === 'jumping' ? estimatedSecsPerJump : progress.stationTravelSecs ?? 0)
  const etaSecs = Math.round(legEtaSecs + jumpsNotStarted * estimatedSecsPerJump)
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
          FUEL {liveFuel ?? currentFuel}{progress.refuelStops.length > 0 && ` · REFUELED x${progress.refuelStops.length}`}
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
  const towing = Boolean(usePlayer()?.towing_wreck_id)
  const services = useStationServices()
  // Shipyard and Crafting show at any station: commissions, listings and the job queue work without
  // the service, and their controls gate on it. Salvage stays in space (it lists wrecks there)
  // and while towing; docked, it needs a salvage yard.
  const hiddenPanels = useMemo(() => [
    ...(isDocked ? [] : ['shipyard', 'crafting']),
    ...(isDocked && !towing && !services.includes('salvage_yard') ? ['salvage'] : []),
  ], [services, isDocked, towing])
  const pendingTrades = usePlayUi((s) => s.pendingTrades)
  const inCombat = usePlayUi((s) => s.inCombat)
  const [activePanel, setActivePanel] = useState('galaxy')
  const galaxyRef = useRef<GalaxyPanelHandle>(null)
  const [exploreSystem, setExploreSystem] = useState<MapSystemData | null>(null)
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null)
  const [mapView, setMapView] = useState<MapView>('galaxy')
  const navRef = useRef<NavActions | null>(null)
  const autoTravel = useAutoTravel()
  const loop = useLoopRunner()
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('current')
  const [highlightedSystems, setHighlightedSystems] = useState<Set<string> | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // Begin Travel over a running loop: confirm, stop the loop, then travel once it has wound down.
  const [travelGate, setTravelGate] = useState<'confirm' | 'stopping' | null>(null)
  const pilotBusy = autoTravel.isActive || loop.isActive

  const handleBeginTravel = useCallback(() => {
    if (!plannedRoute || !ship) return
    if (loop.isActive) { setTravelGate('confirm'); return }
    autoTravel.start(plannedRoute, { shipSpeed: travelSpeed(ship) })
    setMapView('galaxy')
    setPlannedRoute(null) // clear the planned route, auto-travel takes over
  }, [plannedRoute, ship, autoTravel, loop.isActive])

  useEffect(() => {
    if (travelGate !== 'stopping' || loop.isActive) return
    setTravelGate(null)
    handleBeginTravel()
  }, [travelGate, loop.isActive, handleBeginTravel])

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
      if (key === 'escape') { setNavOpen(false); return } // Modal closes help on Escape
      if (key === '?') { setHelpOpen((v) => !v); return }
      if (document.querySelector('[role="dialog"]')) return // help or another dialog is open
      if (key === 'n') { setNavOpen((v) => !v); return }
      const panel = panelShortcuts(hiddenPanels)[Number(key) - 1]
      if (panel) setActivePanel(panel.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hiddenPanels])

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

  // Picking a system or a route in the sidebar is galaxy-map work.
  const exploreOnGalaxy = (system: MapSystemData | null) => { setExploreSystem(system); if (system) setMapView('galaxy') }
  const planOnGalaxy = (route: PlannedRoute | null) => { setPlannedRoute(route); if (route) setMapView('galaxy') }

  const maps = (
    <div className={mapStyles.mapStack}>
      {mapView === 'system'
        ? <SystemMap busy={pilotBusy} onTravel={(id) => navRef.current?.travel(id)} onJump={(id, name) => navRef.current?.jump(id, name)} />
        : galaxy}
      <div className={mapStyles.viewSwitch} role="group" aria-label="Map view">
        <button type="button" aria-pressed={mapView === 'galaxy'} onClick={() => setMapView('galaxy')}><Globe size={12} /> Galaxy</button>
        <button type="button" aria-pressed={mapView === 'system'} onClick={() => setMapView('system')}><Orbit size={12} /> System</button>
      </div>
    </div>
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
            hidden={hiddenPanels}
          />
        </div>

        {/* Main Content: Left Sidebar + Panel + Right Pane */}
        <div className={styles.main}>
          <LeftSidebar galaxyRef={galaxyRef} exploreSystem={exploreSystem} onExploreSystemChange={exploreOnGalaxy} plannedRoute={plannedRoute} onPlannedRouteChange={planOnGalaxy} navRef={navRef} onMapViewChange={setMapView} activeTab={sidebarTab} onTabChange={setSidebarTab} autoTravelActive={pilotBusy} onHighlightedSystemsChange={setHighlightedSystems} mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />
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
                        const totalSecs = (jumpEstimateMs(travelSpeed(ship)) / 1000) * plannedRoute.totalJumps
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
                  {travelGate === 'confirm' ? (
                    <ConfirmAction
                      message="This stops the running loop. Travel anyway?"
                      icon={<AlertTriangle size={14} />}
                      onConfirm={() => { loop.stop(); setTravelGate('stopping') }}
                      onCancel={() => setTravelGate(null)}
                      confirmLabel="Stop loop and travel"
                      cancelLabel="Keep loop"
                    />
                  ) : (
                    <div className={styles.routeBannerActions}>
                      <button className={styles.routeBannerBegin} onClick={handleBeginTravel} disabled={travelGate === 'stopping'}>
                        {travelGate === 'stopping' ? 'Stopping loop...' : 'Begin Travel'}
                      </button>
                      <button className={styles.routeBannerCancel} onClick={() => { setPlannedRoute(null); setTravelGate(null) }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {autoTravel.isActive && autoTravel.progress && (
              <AutoTravelBanner progress={autoTravel.progress} onAbort={autoTravel.requestAbort} />
            )}
            <div className={styles.panelContent}>
              {ActivePanelComponent ? <ActivePanelComponent /> : maps}
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

      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} hiddenPanels={hiddenPanels} />}

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
