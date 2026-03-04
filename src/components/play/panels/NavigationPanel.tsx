'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
import { useGame } from '../GameProvider'
import { ProgressBar } from '../ProgressBar'
import styles from './NavigationPanel.module.css'

interface RouteStep {
  system_id: string
  name: string
  jumps: number
}

interface RouteResult {
  found: boolean
  route: RouteStep[]
  total_jumps: number
  message: string
}

export function NavigationPanel() {
  const { state, sendCommand } = useGame()
  const [searchQuery, setSearchQuery] = useState('')
  const [routeQuery, setRouteQuery] = useState('')
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const prevEventLogLenRef = useRef(state.eventLog.length)

  // Watch eventLog for route-related messages when loading
  useEffect(() => {
    if (!routeLoading) {
      prevEventLogLenRef.current = state.eventLog.length
      return
    }
    // Check if new events have been added since we started loading
    if (state.eventLog.length > prevEventLogLenRef.current) {
      for (let i = 0; i < state.eventLog.length - prevEventLogLenRef.current; i++) {
        const event = state.eventLog[i]
        if (event.type === 'info' && event.message.includes('Route found')) {
          const jumpMatch = event.message.match(/(\d+)\s+jump/)
          setRouteResult({
            found: true,
            route: [],
            total_jumps: jumpMatch ? parseInt(jumpMatch[1], 10) : 0,
            message: event.message,
          })
          setRouteLoading(false)
          break
        }
        if (event.type === 'info' && (event.message.includes('No route') || event.message.includes('no route'))) {
          setRouteResult({
            found: false,
            route: [],
            total_jumps: 0,
            message: event.message,
          })
          setRouteLoading(false)
          break
        }
        if (event.type === 'error') {
          setRouteLoading(false)
          break
        }
      }
      prevEventLogLenRef.current = state.eventLog.length
    }
  }, [state.eventLog, routeLoading])

  // Auto-clear loading after timeout
  useEffect(() => {
    if (!routeLoading) return
    const timer = setTimeout(() => {
      setRouteLoading(false)
    }, 10000)
    return () => clearTimeout(timer)
  }, [routeLoading])

  const handleTravel = useCallback(
    (poiId: string) => {
      sendCommand('travel', { target_poi: poiId })
    },
    [sendCommand]
  )

  const handleJump = useCallback(
    (systemId: string) => {
      sendCommand('jump', { target_system: systemId })
    },
    [sendCommand]
  )

  const handleDock = useCallback(() => {
    sendCommand('dock')
  }, [sendCommand])

  const handleUndock = useCallback(() => {
    sendCommand('undock')
  }, [sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('get_system')
  }, [sendCommand])

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      sendCommand('search_systems', { query: searchQuery.trim() })
    }
  }, [sendCommand, searchQuery])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
    },
    [handleSearch]
  )

  const handleFindRoute = useCallback(() => {
    if (routeQuery.trim()) {
      setRouteResult(null)
      setRouteLoading(true)
      prevEventLogLenRef.current = state.eventLog.length
      sendCommand('find_route', { target_system: routeQuery.trim() })
    }
  }, [sendCommand, routeQuery, state.eventLog.length])

  const handleRouteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFindRoute()
      }
    },
    [handleFindRoute]
  )

  const handleSurvey = useCallback(() => {
    sendCommand('survey_system')
  }, [sendCommand])

  const system = state.system
  const poi = state.poi
  const isTraveling =
    state.travelProgress !== null && state.travelProgress !== undefined

  const hasSurveyScanner = state.ship?.modules?.some(
    (m) => m.type === 'utility' && m.name.toLowerCase().includes('survey')
  )

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Compass size={16} />
          </span>
          Navigation
        </div>
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          title="Refresh system info"
          type="button"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className={styles.content}>
        {/* Current system info */}
        {system ? (
          <div className={styles.systemInfo}>
            <div className={styles.systemName}>{system.name}</div>
            <div className={styles.systemMeta}>
              {system.empire && (
                <span className={styles.metaTag}>
                  Empire:{' '}
                  <span className={styles.metaValue}>{system.empire}</span>
                </span>
              )}
              <span className={styles.metaTag}>
                Security:{' '}
                <span className={styles.metaValue}>
                  {system.security_status || `Level ${system.police_level}`}
                </span>
              </span>
              {state.isDocked && (
                <span className={styles.dockedBadge}>Docked</span>
              )}
            </div>
            {system.description && (
              <span className={styles.metaTag}>{system.description}</span>
            )}
          </div>
        ) : (
          <div className={styles.emptyState}>No system data available</div>
        )}

        {/* Travel progress */}
        {isTraveling && (
          <div className={styles.travelBar}>
            <div className={styles.travelLabel}>
              <Navigation size={12} /> Traveling to{' '}
              {state.travelDestination || 'unknown'}...
            </div>
            <ProgressBar
              value={state.travelProgress ?? 0}
              max={100}
              color="purple"
              size="sm"
              showText={false}
            />
          </div>
        )}

        {/* Dock / Undock */}
        {poi && poi.has_base && (
          <div className={styles.dockRow}>
            <button
              className={styles.searchBtn}
              onClick={handleDock}
              disabled={state.isDocked}
              type="button"
            >
              <Anchor size={13} /> Dock
            </button>
            <button
              className={styles.searchBtn}
              onClick={handleUndock}
              disabled={!state.isDocked}
              type="button"
            >
              <ArrowRight size={13} /> Undock
            </button>
          </div>
        )}

        {/* POIs in system */}
        {system && system.pois.length > 0 && (
          <div>
            <div className={styles.sectionTitle}>Points of Interest</div>
            <div className={styles.poiList}>
              {system.pois.map((p, i) => {
                const isActive = poi?.id === p.id
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
                      {p.online > 0 && (
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
        {system && system.connections.length > 0 && (
          <div>
            <div className={styles.sectionTitle}>Connected Systems</div>
            <div className={styles.connectionList}>
              {system.connections.map((conn) => (
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
          <div className={styles.sectionTitle}>Search Systems</div>
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
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
          <div className={styles.sectionTitle}>
            <Route size={13} /> Find Route
          </div>
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
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
                        const isCurrentSystem = step.system_id === system?.id
                        const isAdjacentToCurrentIndex = idx > 0 && routeResult.route[idx - 1]?.system_id === system?.id
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
            <div className={styles.sectionTitle}>
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
      </div>
    </div>
  )
}
