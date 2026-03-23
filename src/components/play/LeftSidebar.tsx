'use client'

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react'
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
  Database,
  Gem,
} from 'lucide-react'
import { useGame } from './GameProvider'
import { ProgressBar } from './ProgressBar'
import { MiningModal } from './MiningModal'
import type { GalaxyPanelHandle, MapSystemData, PlannedRoute } from './panels/GalaxyPanel'
import { formatLabel } from './panels/facilities/FacilityCard'
import styles from './LeftSidebar.module.css'

// Intel query response types (not in generated types)
interface IntelPoi {
  id: string
  type: string
  name: string
  class?: string
  base_id?: string
  base_name?: string
  resources?: { resource_id: string; richness: number; remaining: number }[]
}

interface IntelEntry {
  system_id: string
  name: string
  empire?: string
  police_level: number
  connections?: string[]
  pois?: IntelPoi[]
  submitted_by: string
  submitter_name: string
  submitted_at_tick: number
  auto_synced?: boolean
}

interface IntelQueryResult {
  entries: IntelEntry[]
  count: number
  total: number
  intel_level: number
}

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
  onHighlightedSystemsChange?: (systems: Set<string> | null) => void
}

export function LeftSidebar({ galaxyRef, exploreSystem, onExploreSystemChange, plannedRoute, onPlannedRouteChange, activeTab, onTabChange, autoTravelActive, onHighlightedSystemsChange }: LeftSidebarProps) {
  const { state, sendCommand, api } = useGame()
  const [expandedPoi, setExpandedPoi] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMiningModal, setShowMiningModal] = useState(false)

  // Intel state
  const [intelLevel, setIntelLevel] = useState<number>(0)
  const [intelResults, setIntelResults] = useState<IntelEntry[] | null>(null)
  const [intelSearching, setIntelSearching] = useState(false)
  const [selectedSystemIntel, setSelectedSystemIntel] = useState<IntelEntry | null>(null)
  const intelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intelStatusFetched = useRef(false)

  // Switch to Explore tab when a system is selected from the map
  useEffect(() => {
    if (exploreSystem) onTabChange('explore')
  }, [exploreSystem, onTabChange])

  // Fetch intel status on mount to determine intel level (use api directly to avoid event log noise)
  useEffect(() => {
    if (intelStatusFetched.current || !state.player?.faction_id || !api) return
    intelStatusFetched.current = true
    api.callStructured<{ intel_level?: number }>('spacemolt_intel', 'intel_status').then((result) => {
      if (result && typeof result.intel_level === 'number') {
        setIntelLevel(result.intel_level)
      }
    }).catch(() => {})
  }, [state.player?.faction_id, api])

  // Fetch intel for selected system
  useEffect(() => {
    if (!exploreSystem || intelLevel < 2) {
      setSelectedSystemIntel(null)
      return
    }
    if (!api) return
    let cancelled = false
    api.callStructured<IntelQueryResult>('spacemolt_intel', 'query_intel', { system_id: exploreSystem.id, limit: 1 }).then((r) => {
      if (cancelled) return
      if (r?.entries?.length) {
        setSelectedSystemIntel(r.entries[0])
      } else {
        setSelectedSystemIntel(null)
      }
    }).catch(() => { if (!cancelled) setSelectedSystemIntel(null) })
    return () => { cancelled = true }
  }, [exploreSystem, intelLevel, api])

  // Intel search: debounced query when search changes
  const hasIntel = intelLevel >= 2
  useEffect(() => {
    if (intelDebounceRef.current) clearTimeout(intelDebounceRef.current)

    if (!hasIntel || !searchQuery.trim()) {
      setIntelResults(null)
      setIntelSearching(false)
      onHighlightedSystemsChange?.(null)
      return
    }

    setIntelSearching(true)
    const query = searchQuery.trim()
    const resourceId = query.toLowerCase().replace(/\s+/g, '_')

    intelDebounceRef.current = setTimeout(() => {
      if (!api) return
      api.callStructured<IntelQueryResult>('spacemolt_intel', 'query_intel', { resource_type: resourceId, limit: 100 }).then((r) => {
        if (r?.entries?.length) {
          setIntelResults(r.entries)
          onHighlightedSystemsChange?.(new Set(r.entries.map(e => e.system_id)))
        } else {
          setIntelResults(null)
          onHighlightedSystemsChange?.(null)
        }
        setIntelSearching(false)
      }).catch(() => {
        setIntelResults(null)
        setIntelSearching(false)
        onHighlightedSystemsChange?.(null)
      })
    }, 400)

    return () => {
      if (intelDebounceRef.current) clearTimeout(intelDebounceRef.current)
    }
  }, [searchQuery, hasIntel, api, onHighlightedSystemsChange])

  const handleIntelResultSelect = useCallback((entry: IntelEntry) => {
    const systems = galaxyRef.current?.getSystems() ?? []
    const mapSys = systems.find(s => s.id === entry.system_id)
    if (mapSys) {
      onExploreSystemChange(mapSys)
      setSearchQuery('')
      setIntelResults(null)
      onHighlightedSystemsChange?.(null)
      onTabChange('explore')
      galaxyRef.current?.panToSystem(mapSys.id)
    }
  }, [galaxyRef, onExploreSystemChange, onTabChange, onHighlightedSystemsChange])

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
              placeholder={hasIntel ? 'Search systems or resources…' : 'Search systems…'}
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
              {/* System name matches */}
              {searchResults.length > 0 && (
                <>
                  {hasIntel && <div className={styles.searchSectionLabel}>Systems</div>}
                  {searchResults.map((sys) => (
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
                  ))}
                </>
              )}

              {/* Intel resource matches */}
              {hasIntel && intelSearching && (
                <div className={styles.searchSectionLabel}>
                  <Database size={10} /> Searching intel…
                </div>
              )}
              {hasIntel && !intelSearching && intelResults && intelResults.length > 0 && (() => {
                const normalizedQuery = searchQuery.trim().toLowerCase().replace(/\s+/g, '_')
                return (
                  <>
                    <div className={styles.searchSectionLabel}>
                      <Database size={10} /> Intel — {intelResults.length} system{intelResults.length !== 1 ? 's' : ''} with resource
                    </div>
                    {intelResults.map((entry) => (
                      <button
                        key={entry.system_id}
                        className={styles.searchResultItem}
                        onClick={() => handleIntelResultSelect(entry)}
                      >
                        <span className={styles.searchResultName}>{entry.name}</span>
                        <span className={styles.searchResultIntelDetail}>
                          {(entry.pois ?? [])
                            .flatMap(p => p.resources ?? [])
                            .filter(r => r.resource_id.toLowerCase().includes(normalizedQuery))
                            .slice(0, 2)
                            .map(r => `${formatLabel(r.resource_id)} ×${r.richness}`)
                            .join(', ')}
                        </span>
                      </button>
                    ))}
                  </>
                )
              })()}

              {searchResults.length === 0 && !intelSearching && (!intelResults || intelResults.length === 0) && (
                <div className={styles.searchEmpty}>No results found</div>
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

            {/* Intel detail for selected system */}
            {selectedSystemIntel && (
              <div className={styles.intelSection}>
                <div className={styles.sectionLabel}>
                  <Database size={10} /> Faction Intel
                </div>
                <div className={styles.intelMeta}>
                  <span className={styles.metaTag}>Sec {selectedSystemIntel.police_level}</span>
                  {selectedSystemIntel.empire && (
                    <span className={styles.metaTag}>{selectedSystemIntel.empire}</span>
                  )}
                  <span className={styles.intelSubmitter}>
                    by {selectedSystemIntel.submitter_name}
                  </span>
                </div>

                {(selectedSystemIntel.pois ?? []).length > 0 && (
                  <div className={styles.intelPoiList}>
                    {(selectedSystemIntel.pois ?? []).map((p) => (
                      <div key={p.id} className={styles.intelPoiItem}>
                        <div className={styles.intelPoiHeader}>
                          <MapPin size={10} />
                          <span className={styles.intelPoiName}>{p.name}</span>
                          <span className={styles.intelPoiType}>
                            {p.type}{p.class ? ` · ${p.class}` : ''}
                          </span>
                        </div>
                        {p.base_name && (
                          <div className={styles.intelPoiStation}>
                            <Anchor size={9} /> {p.base_name}
                          </div>
                        )}
                        {p.resources && p.resources.length > 0 && (
                          <div className={styles.intelResourceList}>
                            {p.resources.map((r) => (
                              <div key={r.resource_id} className={styles.intelResourceItem}>
                                <Gem size={9} className={styles.intelResourceIcon} />
                                <span className={styles.intelResourceName}>{formatLabel(r.resource_id)}</span>
                                <span className={styles.intelResourceRichness}>×{r.richness}</span>
                                <span className={styles.intelResourceRemaining}>
                                  {r.remaining < 0 ? '∞' : r.remaining === 0 ? 'depleted' : r.remaining.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
            <div>{hasIntel ? 'Search for systems or resources' : 'Search for a system to view its details'}</div>
          </div>
        )}
      </div>

      {showMiningModal && (
        <MiningModal onClose={() => setShowMiningModal(false)} />
      )}
    </div>
  )
}
