'use client'

import { useState, useCallback, useEffect, type RefObject } from 'react'
import {
  MapPin,
  Globe,
  ArrowRight,
  Anchor,
  Pickaxe,
  Swords,
  Radar,
  ChevronDown,
  Navigation,
  Fuel,
  Wrench,
  Search,
  Compass,
} from 'lucide-react'
import { useGame } from './GameProvider'
import { ProgressBar } from './ProgressBar'
import { MiningModal } from './MiningModal'
import type { GalaxyPanelHandle, MapSystemData, PlannedRoute } from './panels/GalaxyPanel'
import styles from './LeftSidebar.module.css'

const EMPIRE_NAMES: Record<string, string> = {
  solarian: 'Solarian Confederacy',
  voidborn: 'Voidborn Collective',
  crimson: 'Crimson Pact',
  nebula: 'Nebula Trade Federation',
  outerrim: 'Outer Rim Explorers',
}

export type SidebarTab = 'current' | 'explore'

interface LeftSidebarProps {
  galaxyRef: RefObject<GalaxyPanelHandle | null>
  exploreSystem: MapSystemData | null
  onExploreSystemChange: (system: MapSystemData | null) => void
  plannedRoute: PlannedRoute | null
  onPlannedRouteChange: (route: PlannedRoute | null) => void
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  autoTravelActive: boolean
}

export function LeftSidebar({ galaxyRef, exploreSystem, onExploreSystemChange, plannedRoute, onPlannedRouteChange, activeTab, onTabChange, autoTravelActive }: LeftSidebarProps) {
  const { state, sendCommand } = useGame()
  const [expandedPoi, setExpandedPoi] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMiningModal, setShowMiningModal] = useState(false)

  // Switch to Explore tab when a system is selected from the map
  useEffect(() => {
    if (exploreSystem) onTabChange('explore')
  }, [exploreSystem, onTabChange])

  const system = state.system
  const poi = state.poi
  const isDocked = state.isDocked
  const isTraveling =
    state.travelProgress !== null && state.travelProgress !== undefined
  const actionBusy = state.pendingAction !== null || autoTravelActive

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

  const handleMine = useCallback(() => {
    sendCommand('mine')
  }, [sendCommand])

  const handleSurvey = useCallback(() => {
    sendCommand('survey_system')
  }, [sendCommand])

  const handleRefuel = useCallback(() => {
    sendCommand('refuel')
  }, [sendCommand])

  const handleRepair = useCallback(() => {
    sendCommand('repair')
  }, [sendCommand])

  const handlePlotCourse = useCallback(async () => {
    if (!exploreSystem) return
    try {
      const result = await sendCommand('find_route', { target_system: exploreSystem.id })
      if (result && result.found) {
        onPlannedRouteChange({
          route: result.route as PlannedRoute['route'],
          totalJumps: result.total_jumps as number,
          targetSystem: result.target_system as string,
          fuelPerJump: result.fuel_per_jump as number,
          estimatedFuel: result.estimated_fuel as number,
          fuelAvailable: result.fuel_available as number,
        })
      }
    } catch {
      // Route planning failed
    }
  }, [exploreSystem, sendCommand, onPlannedRouteChange])

  const togglePoiExpand = useCallback((poiId: string) => {
    setExpandedPoi((prev) => (prev === poiId ? null : poiId))
  }, [])

  const handleSearchSelect = useCallback(
    (sys: MapSystemData) => {
      onExploreSystemChange(sys)
      setSearchQuery('')
      onTabChange('explore')
      galaxyRef.current?.panToSystem(sys.id)
    },
    [galaxyRef, onExploreSystemChange],
  )

  // Fuzzy filter systems
  const searchResults = searchQuery
    ? (galaxyRef.current?.getSystems() ?? [])
        .filter((sys) => {
          const query = searchQuery.toLowerCase()
          const name = sys.name.toLowerCase()
          let qi = 0
          for (let ni = 0; ni < name.length && qi < query.length; ni++) {
            if (name[ni] === query[qi]) qi++
          }
          return qi === query.length
        })
        .slice(0, 20)
    : []

  return (
    <div className={styles.sidebar}>
      {/* Tab Bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'current' ? styles.tabActive : ''}`}
          onClick={() => onTabChange('current')}
        >
          <MapPin size={12} />
          <span>System</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'explore' ? styles.tabActive : ''}`}
          onClick={() => onTabChange('explore')}
        >
          <Compass size={12} />
          <span>Explore</span>
        </button>
      </div>

      {/* Current System Tab */}
      <div className={styles.tabContent} style={{ display: activeTab === 'current' ? 'flex' : 'none' }}>
        {/* Current Location */}
        <div className={styles.location}>
          {system ? (
            <>
              <div className={styles.systemName}>{system.name}</div>
              <div className={styles.systemMeta}>
                {system.empire && (
                  <span className={styles.metaTag}>{system.empire}</span>
                )}
                <span className={styles.metaTag}>
                  {system.security_status || `Sec ${system.police_level}`}
                </span>
                {isDocked && (
                  <span className={styles.dockedBadge}>Docked</span>
                )}
              </div>
              {poi && (
                <div className={styles.currentPoiBlock}>
                  <div className={styles.currentPoi}>
                    <MapPin size={12} />
                    <span>{poi.name}</span>
                    <span className={styles.poiType}>{poi.type}{poi.class ? ` · ${poi.class}` : ''}</span>
                  </div>
                  {poi.description && (
                    <div className={styles.poiDescription}>{poi.description}</div>
                  )}
                  {poi.resources && poi.resources.length > 0 && (
                    <div className={styles.resourceList}>
                      {poi.resources.map((r) => (
                        <div key={r.resource_id} className={styles.resourceItem}>
                          <span className={styles.resourceName}>{r.name || r.resource_id}</span>
                          <span className={styles.resourceRichness}>{r.richness}</span>
                          <span className={styles.resourceRemaining}>{r.remaining_display || `${r.remaining}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>No system data</div>
          )}
        </div>

        {/* Travel Progress */}
        {isTraveling && (
          <div className={styles.travelBar}>
            <div className={styles.travelLabel}>
              <Navigation size={11} />
              <span>→ {state.travelDestination || 'unknown'}</span>
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

        {/* Contextual Actions */}
        <div className={styles.actions}>
          <div className={styles.sectionLabel}>Actions</div>

          {/* Dock / Undock */}
          {poi && poi.base_id && (
            isDocked ? (
              <button
                className={styles.actionBtn}
                onClick={handleUndock}
                disabled={actionBusy}
                type="button"
              >
                <ArrowRight size={13} />
                <span>Undock</span>
              </button>
            ) : (
              <button
                className={styles.actionBtn}
                onClick={handleDock}
                disabled={actionBusy}
                type="button"
              >
                <Anchor size={13} />
                <span>Dock</span>
              </button>
            )
          )}

          {/* Mine — only when undocked and POI has resources */}
          {!isDocked && poi?.resources && poi.resources.length > 0 && (
            <>
              <button
                className={styles.actionBtn}
                onClick={handleMine}
                disabled={actionBusy}
                type="button"
              >
                <Pickaxe size={13} />
                <span>Mine</span>
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => setShowMiningModal(true)}
                disabled={actionBusy}
                type="button"
              >
                <Pickaxe size={13} />
                <span>Mine Until Full</span>
              </button>
            </>
          )}

          {/* Attack — only when undocked and there are nearby targets */}
          {!isDocked && state.nearby.length > 0 && (
            <button
              className={styles.actionBtn}
              onClick={() => sendCommand('scan', { target_id: state.nearby[0]?.player_id })}
              disabled={actionBusy}
              type="button"
            >
              <Swords size={13} />
              <span>Scan Nearest</span>
            </button>
          )}

          {/* Survey */}
          {Boolean(state.ship?.modules?.length) && (
            <button
              className={styles.actionBtn}
              onClick={handleSurvey}
              disabled={actionBusy}
              type="button"
            >
              <Radar size={13} />
              <span>Survey System</span>
            </button>
          )}

          {/* Refuel — docked and below max fuel */}
          {isDocked && state.ship && state.ship.fuel < state.ship.max_fuel && (
            <button
              className={styles.actionBtn}
              onClick={handleRefuel}
              disabled={actionBusy}
              type="button"
            >
              <Fuel size={13} />
              <span>Refuel ({state.ship.fuel}/{state.ship.max_fuel})</span>
            </button>
          )}

          {/* Repair — docked and below max hull */}
          {isDocked && state.ship && state.ship.hull < state.ship.max_hull && (
            <button
              className={styles.actionBtn}
              onClick={handleRepair}
              disabled={actionBusy}
              type="button"
            >
              <Wrench size={13} />
              <span>Repair ({state.ship.hull}/{state.ship.max_hull})</span>
            </button>
          )}
        </div>

        {/* POIs */}
        {system && system.pois.length > 0 && (
          <div className={styles.poiSection}>
            <div className={styles.sectionLabel}>Points of Interest</div>
            <div className={styles.poiList}>
              {system.pois.map((p, i) => {
                const isActive = poi?.id === p.id
                const isExpanded = expandedPoi === p.id
                return (
                  <div key={p.id || `poi-${i}`} className={styles.poiEntry}>
                    <div
                      className={`${styles.poiItem} ${isActive ? styles.poiItemActive : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => togglePoiExpand(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') togglePoiExpand(p.id)
                      }}
                    >
                      {p.has_base ? <Anchor size={12} className={styles.poiIcon} /> : <MapPin size={12} className={styles.poiIcon} />}
                      <span className={styles.poiName}>{p.name}</span>
                      <span className={styles.poiType}>{p.type}</span>
                      {(p.online ?? 0) > 0 && (
                        <span className={styles.poiOnline}>{p.online}</span>
                      )}
                      <ChevronDown
                        size={12}
                        className={`${styles.poiChevron} ${isExpanded ? styles.poiChevronOpen : ''}`}
                      />
                    </div>
                    {isExpanded && (
                      <div className={styles.poiDetails}>
                        <div className={styles.poiDetailRow}>
                          <span className={styles.poiDetailLabel}>Type</span>
                          <span>{p.type}{p.class ? ` (${p.class})` : ''}</span>
                        </div>
                        {p.base_name && (
                          <div className={styles.poiDetailRow}>
                            <span className={styles.poiDetailLabel}>Station</span>
                            <span>{p.base_name}</span>
                          </div>
                        )}
                        {p.position && (
                          <div className={styles.poiDetailRow}>
                            <span className={styles.poiDetailLabel}>Position</span>
                            <span>{p.position.x?.toFixed(1)}, {p.position.y?.toFixed(1)} AU</span>
                          </div>
                        )}
                        {(p.online ?? 0) > 0 && (
                          <div className={styles.poiDetailRow}>
                            <span className={styles.poiDetailLabel}>Online</span>
                            <span>{p.online}</span>
                          </div>
                        )}
                        {!isActive && (
                          <button
                            className={styles.poiTravelBtn}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTravel(p.id)
                            }}
                            disabled={actionBusy}
                            type="button"
                          >
                            <ArrowRight size={12} /> Travel Here
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Connected Systems */}
        {system && system.connections.length > 0 && (
          <div className={styles.connectionsSection}>
            <div className={styles.sectionLabel}>Connections</div>
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
                  <Globe size={12} />
                  <span className={styles.connectionName}>{conn.name}</span>
                  {conn.distance !== undefined && (
                    <span className={styles.connectionDist}>{conn.distance} GU</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Explore Tab */}
      <div className={styles.tabContent} style={{ display: activeTab === 'explore' ? 'flex' : 'none' }}>
        {/* Search */}
        <div className={styles.exploreSearch}>
          <div className={styles.searchInputWrapper}>
            <Search size={13} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search systems…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value === '') onExploreSystemChange(null)
              }}
            />
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className={styles.searchResults}>
              {searchResults.length > 0 ? (
                searchResults.map((sys) => (
                  <button
                    key={sys.id}
                    className={styles.searchResultItem}
                    onClick={() => handleSearchSelect(sys)}
                  >
                    <span className={styles.searchResultName}>{sys.name}</span>
                    {sys.empire && (
                      <span className={styles.searchResultEmpire}>
                        {EMPIRE_NAMES[sys.empire] || sys.empire}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className={styles.searchEmpty}>No systems found</div>
              )}
            </div>
          )}
        </div>

        {/* Selected System Detail */}
        {exploreSystem && !searchQuery && (
          <div className={styles.systemDetail}>
            <div className={styles.systemDetailName}>{exploreSystem.name}</div>
            {exploreSystem.empire && (
              <div className={styles.systemDetailEmpire}>
                {EMPIRE_NAMES[exploreSystem.empire] || exploreSystem.empire}
              </div>
            )}
            <div className={styles.systemDetailTags}>
              {exploreSystem.is_home && (
                <span className={styles.detailTag}>Capital</span>
              )}
              {exploreSystem.has_station && (
                <span className={styles.detailTag}>Station</span>
              )}
              {exploreSystem.is_stronghold && (
                <span className={styles.detailTagDanger}>Pirate Stronghold</span>
              )}
              {!exploreSystem.empire && !exploreSystem.is_stronghold && (
                <span className={styles.detailTag}>Neutral Space</span>
              )}
            </div>
            <button
              className={styles.plotCourseBtn}
              onClick={handlePlotCourse}
              disabled={actionBusy}
              type="button"
            >
              <Navigation size={13} />
              <span>Plot a Course</span>
            </button>
            <div className={styles.systemDetailConnections}>
              <div className={styles.sectionLabel}>Connections</div>
              {exploreSystem.connections.length > 0 ? (
                <div className={styles.connectionList}>
                  {exploreSystem.connections.map((connId: string) => {
                    const connSys = galaxyRef.current?.getSystems().find((s) => s.id === connId)
                    return (
                      <div
                        key={connId}
                        className={styles.connectionItem}
                        onClick={() => {
                          if (connSys) handleSearchSelect(connSys)
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && connSys) handleSearchSelect(connSys)
                        }}
                      >
                        <Globe size={12} />
                        <span className={styles.connectionName}>{connSys?.name || connId}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>No connections</div>
              )}
            </div>
          </div>
        )}

        {/* Empty state when nothing selected */}
        {!exploreSystem && !searchQuery && (
          <div className={styles.exploreEmpty}>
            <Search size={24} className={styles.exploreEmptyIcon} />
            <div>Search for a system to view its details</div>
          </div>
        )}
      </div>

      {showMiningModal && (
        <MiningModal onClose={() => setShowMiningModal(false)} />
      )}
    </div>
  )
}
