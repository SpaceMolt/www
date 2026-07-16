'use client'

import { useState, useCallback } from 'react'
import {
  Compass,
  MapPin,
  Globe,
  Anchor,
  ArrowRight,
  RefreshCw,
  Search,
  Navigation,
  Route,
  Radar,
} from 'lucide-react'
import { SpacemoltError } from '@spacemolt/lib'
import type { FindRouteResponse } from '@spacemolt/lib'
import {
  useAccountStore,
  useCommandMutation,
  useCurrentTick,
  useLocationState,
  useModules,
  useShip,
  useSystem,
} from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { ProgressBar } from '../ProgressBar'
import { Panel, shared } from '../shared'
import styles from './NavigationPanel.module.css'

function errorMessage(err: unknown): string {
  if (err instanceof SpacemoltError) return err.message
  if (err instanceof Error) return err.message
  return 'Action failed'
}

export function NavigationPanel() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const system = useSystem()
  const location = useLocationState()
  const ship = useShip()
  const modules = useModules()
  const currentTick = useCurrentTick()

  const [searchQuery, setSearchQuery] = useState('')
  const [routeQuery, setRouteQuery] = useState('')
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeResult, setRouteResult] = useState<FindRouteResponse | null>(null)

  const logEvent = useCallback(
    (text?: string) => {
      if (text) uiStore.dispatch({ type: 'event', kind: 'info', text })
    },
    [uiStore],
  )

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorMessage(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
      uiStore.dispatch({ type: 'event', kind: 'danger', text })
    },
    [uiStore],
  )

  const data = system.data
  const sys = data && 'system' in data ? data.system : undefined
  const currentPoi = data && 'poi' in data ? data.poi : undefined

  const handleTravel = useCallback(
    async (poiId: string) => {
      const targetPoi = sys?.pois.find((p) => p.id === poiId)
      let estimatedMs: number | undefined
      if (currentPoi && targetPoi) {
        const dx = targetPoi.position.x - currentPoi.position.x
        const dy = targetPoi.position.y - currentPoi.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const speed = Math.max(0.1, ship?.speed ?? 1)
        const travelTicks = Math.max(1, Math.ceil(distance / speed))
        estimatedMs = travelTicks * 10000
      }
      try {
        const result = await mutate((c) => c.spacemolt.travel({ id: poiId }), { label: 'travel', estimatedMs })
        logEvent(result.delta.details?.message || `Traveling to ${targetPoi?.name || 'destination'}...`)
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, sys, currentPoi, ship?.speed, logEvent, reportError],
  )

  const handleJump = useCallback(
    async (systemId: string) => {
      const speed = ship?.speed ?? 1
      const estimatedMs = Math.max(10, 70 - 10 * speed) * 1000
      try {
        const result = await mutate((c) => c.spacemolt.jump({ id: systemId }), { label: 'jump', estimatedMs })
        const details = result.delta.details
        const destName = details && 'system' in details ? details.system : undefined
        logEvent(destName ? `Arrived in ${destName}` : 'Jumping...')
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, ship?.speed, logEvent, reportError],
  )

  const handleDock = useCallback(async () => {
    try {
      const result = await mutate((c) => c.spacemolt.dock(), { label: 'dock' })
      logEvent(`Docked at ${result.delta.details?.base || 'base'}`)
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleUndock = useCallback(async () => {
    try {
      await mutate((c) => c.spacemolt.undock(), { label: 'undock' })
      logEvent('Undocked from station')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleRefresh = useCallback(() => {
    system.refetch()
  }, [system])

  const handleSearch = useCallback(async () => {
    const text = searchQuery.trim()
    if (!text) return
    try {
      const resp = await store.account.commands.spacemolt.search_systems({ text })
      logEvent(resp.structuredContent?.message)
    } catch (err) {
      reportError(err)
    }
  }, [store, searchQuery, logEvent, reportError])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
    },
    [handleSearch],
  )

  const handleFindRoute = useCallback(async () => {
    const text = routeQuery.trim()
    if (!text) return
    setRouteResult(null)
    setRouteLoading(true)
    try {
      const resp = await store.account.commands.spacemolt.find_route({ id: text })
      const result = resp.structuredContent ?? null
      setRouteResult(result)
      logEvent(result?.message)
    } catch (err) {
      reportError(err)
    } finally {
      setRouteLoading(false)
    }
  }, [store, routeQuery, logEvent, reportError])

  const handleRouteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFindRoute()
      }
    },
    [handleFindRoute],
  )

  const handleSurvey = useCallback(async () => {
    try {
      const result = await mutate((c) => c.spacemolt.survey_system(), { label: 'survey_system' })
      logEvent(result.delta.details?.message || 'Survey complete')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const isDocked = Boolean(location?.docked_at)
  const isTraveling = Boolean(location?.in_transit)
  const isJump = location?.transit_type === 'jump'
  const travelDestination =
    (isJump ? location?.transit_dest_system_name : location?.transit_dest_poi_name) ||
    location?.transit_dest_poi_name ||
    location?.transit_dest_system_name ||
    'unknown'
  const elapsed = location?.transit_ticks_elapsed ?? 0
  const arrivalTick = location?.transit_arrival_tick
  const eta = arrivalTick !== undefined ? Math.max(0, arrivalTick - currentTick) : null
  const totalTicks = eta !== null ? elapsed + eta : null
  const travelProgress = totalTicks && totalTicks > 0 ? Math.max(0, Math.min(100, (elapsed / totalTicks) * 100)) : 0

  // Module instances don't expose type/name filtering here, so always show the
  // survey button and let the server reject if no scanner is installed.
  const hasSurveyScanner = Boolean(modules?.length)

  const refreshButton = (
    <button
      className={shared.refreshBtn}
      onClick={handleRefresh}
      title="Refresh system info"
      type="button"
    >
      <RefreshCw size={14} />
    </button>
  )

  return (
    <Panel title="Navigation" icon={<Compass size={16} />} headerRight={refreshButton}>
        {/* Current system info */}
        {sys ? (
          <div className={styles.systemInfo}>
            <div className={styles.systemName}>{sys.name}</div>
            <div className={styles.systemMeta}>
              {sys.empire && (
                <span className={styles.metaTag}>
                  Empire:{' '}
                  <span className={styles.metaValue}>{sys.empire}</span>
                </span>
              )}
              <span className={styles.metaTag}>
                Security:{' '}
                <span className={styles.metaValue}>
                  {sys.security_status || `Level ${sys.police_level}`}
                </span>
              </span>
              {isDocked && (
                <span className={styles.dockedBadge}>Docked</span>
              )}
            </div>
            {sys.description && (
              <span className={styles.metaTag}>{sys.description}</span>
            )}
          </div>
        ) : (
          <div className={shared.emptyState}>No system data available</div>
        )}

        {/* Travel progress */}
        {isTraveling && (
          <div className={styles.travelBar}>
            <div className={styles.travelLabel}>
              <Navigation size={12} /> Traveling to{' '}
              {travelDestination}...
            </div>
            <ProgressBar
              value={travelProgress}
              max={100}
              color="purple"
              size="sm"
              showText={false}
            />
          </div>
        )}

        {/* Dock / Undock — show only the action available in current state */}
        {currentPoi && currentPoi.has_base && (
          <div className={styles.dockRow}>
            {isDocked ? (
              <button
                className={styles.searchBtn}
                onClick={handleUndock}
                type="button"
              >
                <ArrowRight size={13} /> Undock
              </button>
            ) : (
              <button
                className={styles.searchBtn}
                onClick={handleDock}
                type="button"
              >
                <Anchor size={13} /> Dock
              </button>
            )}
          </div>
        )}

        {/* POIs in system */}
        {sys && sys.pois.length > 0 && (
          <div>
            <div className={shared.sectionTitle}>Points of Interest</div>
            <div className={styles.poiList}>
              {sys.pois.map((p, i) => {
                const isActive = location?.poi_id === p.id
                return (
                  <div
                    key={p.id || `poi-${i}`}
                    className={`${styles.poiItem} ${
                      isActive ? styles.poiItemActive : ''
                    }`}
                    onClick={() => {
                      if (!isActive) handleTravel(p.id)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isActive) handleTravel(p.id)
                    }}
                  >
                    <div className={styles.poiLeft}>
                      <span className={styles.poiIcon}>
                        <MapPin size={14} />
                      </span>
                      <span className={styles.poiName}>{p.name}</span>
                      <span className={styles.poiType}>{p.type}</span>
                    </div>
                    <div className={styles.poiRight}>
                      {(p.online ?? 0) > 0 && (
                        <span className={styles.poiOnline}>
                          {p.online} online
                        </span>
                      )}
                      {!isActive && (
                        <span className={styles.travelIcon}>
                          <ArrowRight size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Connected systems */}
        {sys && sys.connections.length > 0 && (
          <div>
            <div className={shared.sectionTitle}>Connected Systems</div>
            <div className={styles.connectionList}>
              {sys.connections.map((conn) => (
                <div
                  key={conn.system_id}
                  className={styles.connectionItem}
                  onClick={() => handleJump(conn.system_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJump(conn.system_id)
                  }}
                >
                  <div className={styles.connectionLeft}>
                    <span className={styles.connectionIcon}>
                      <Globe size={14} />
                    </span>
                    <span className={styles.connectionName}>{conn.name}</span>
                  </div>
                  {conn.distance !== undefined && (
                    <span className={styles.connectionDist}>
                      {conn.distance} GU
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search systems */}
        <div>
          <div className={shared.sectionTitle}>Search Systems</div>
          <div className={styles.searchRow}>
            <input
              className={shared.textInput}
              type="text"
              placeholder="System name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <button
              className={styles.searchBtn}
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
              type="button"
            >
              <Search size={13} /> Find
            </button>
          </div>
        </div>

        {/* Find Route */}
        <div className={styles.routeSection}>
          <div className={shared.sectionTitle}>
            <Route size={13} /> Find Route
          </div>
          <div className={styles.searchRow}>
            <input
              className={shared.textInput}
              type="text"
              placeholder="Target system..."
              value={routeQuery}
              onChange={(e) => setRouteQuery(e.target.value)}
              onKeyDown={handleRouteKeyDown}
            />
            <button
              className={styles.searchBtn}
              onClick={handleFindRoute}
              disabled={!routeQuery.trim() || routeLoading}
              type="button"
            >
              <Route size={13} /> {routeLoading ? 'Finding...' : 'Find Route'}
            </button>
          </div>
          {routeResult && (
            <div className={styles.routeResult}>
              {routeResult.found ? (
                <>
                  <div className={styles.routeMessage}>{routeResult.message}</div>
                  {routeResult.route.length > 0 && (
                    <ol className={styles.routeList}>
                      {routeResult.route.map((step, idx) => {
                        const isCurrentSystem = step.system_id === sys?.id
                        const isAdjacentToCurrentIndex = idx > 0 && routeResult.route[idx - 1]?.system_id === sys?.id
                        const canJump = !isCurrentSystem && isAdjacentToCurrentIndex
                        return (
                          <li
                            key={step.system_id}
                            className={`${styles.routeStep} ${isCurrentSystem ? styles.routeStepActive : ''} ${canJump ? styles.routeStepClickable : ''}`}
                            onClick={() => {
                              if (canJump) handleJump(step.system_id)
                            }}
                            role={canJump ? 'button' : undefined}
                            tabIndex={canJump ? 0 : undefined}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && canJump) handleJump(step.system_id)
                            }}
                          >
                            <span className={styles.routeStepNumber}>{step.jumps}</span>
                            <span className={styles.routeStepName}>{step.name}</span>
                            {canJump && (
                              <span className={styles.routeStepJump}>
                                <ArrowRight size={12} /> Jump
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </>
              ) : (
                <div className={styles.routeNotFound}>{routeResult.message}</div>
              )}
            </div>
          )}
        </div>

        {/* Survey System */}
        {hasSurveyScanner && (
          <div className={styles.surveySection}>
            <div className={shared.sectionTitle}>
              <Radar size={13} /> System Survey
            </div>
            <button
              className={styles.searchBtn}
              onClick={handleSurvey}
              type="button"
            >
              <Radar size={13} /> Survey System
            </button>
          </div>
        )}
    </Panel>
  )
}
