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
import { SpacemoltError } from '@spacemolt/lib'
import type { FactionQueryIntelResponse } from '@spacemolt/lib'
import {
  useAccountStore,
  useCommandMutation,
  useCurrentTick,
  useLocationState,
  useModules,
  usePendingAction,
  usePlayer,
  usePoi,
  useShip,
  useSystem,
} from '@/lib/spacemolt'
import { usePlay } from './PlayProvider'
import { ProgressBar } from './ProgressBar'
import { MiningModal } from './MiningModal'
import type { GalaxyPanelHandle, MapSystemData, PlannedRoute } from './panels/GalaxyPanel'
import { titleCase as formatLabel } from '@/lib/format'
import styles from './LeftSidebar.module.css'

// Intel query response entries — shaped by the faction intel query, not a
// cached state section.
type IntelEntry = FactionQueryIntelResponse['entries'][number]

export const EMPIRE_NAMES: Record<string, string> = {
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

function errorMessage(err: unknown): string {
  if (err instanceof SpacemoltError) return err.message
  if (err instanceof Error) return err.message
  return 'Action failed'
}

// useCommandMutation's runner returns the generic MutationResult shape
// (details: Record<string, unknown>), not the per-command typed response —
// narrow the optional `message` field defensively.
function detailMessage(details: unknown): string | undefined {
  const message = (details as { message?: unknown } | undefined)?.message
  return typeof message === 'string' ? message : undefined
}

export function LeftSidebar({ galaxyRef, exploreSystem, onExploreSystemChange, plannedRoute, onPlannedRouteChange, activeTab, onTabChange, autoTravelActive, onHighlightedSystemsChange }: LeftSidebarProps) {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const player = usePlayer()
  const ship = useShip()
  const modules = useModules()
  const location = useLocationState()
  const pendingAction = usePendingAction()
  const currentTick = useCurrentTick()
  const systemQuery = useSystem()
  const poiQuery = usePoi()
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

  // Fetch intel status on mount to determine intel level
  useEffect(() => {
    if (intelStatusFetched.current || !player?.faction_id) return
    intelStatusFetched.current = true
    store.account.commands.spacemolt_intel.intel_status().then((result) => {
      const level = result.structuredContent?.intel_level
      if (typeof level === 'number') setIntelLevel(level)
    }).catch(() => {})
  }, [player?.faction_id, store])

  // Fetch intel for selected system
  useEffect(() => {
    if (!exploreSystem || intelLevel < 2) {
      setSelectedSystemIntel(null)
      return
    }
    let cancelled = false
    store.account.commands.spacemolt_intel.query_intel({ system_id: exploreSystem.id, limit: 1 }).then((r) => {
      if (cancelled) return
      const entries = r.structuredContent?.entries
      setSelectedSystemIntel(entries && entries.length > 0 ? entries[0] : null)
    }).catch(() => { if (!cancelled) setSelectedSystemIntel(null) })
    return () => { cancelled = true }
  }, [exploreSystem, intelLevel, store])

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
      store.account.commands.spacemolt_intel.query_intel({ resource_type: resourceId, limit: 100 }).then((r) => {
        const entries = r.structuredContent?.entries
        if (entries && entries.length > 0) {
          setIntelResults(entries)
          onHighlightedSystemsChange?.(new Set(entries.map(e => e.system_id)))
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
  }, [searchQuery, hasIntel, store, onHighlightedSystemsChange])

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

  const systemData = systemQuery.data
  const system = systemData && 'system' in systemData ? systemData.system : undefined
  const poiData = poiQuery.data
  const poi = poiData && 'poi' in poiData ? poiData.poi : undefined

  const isDocked = Boolean(location?.docked_at)
  const isTraveling = Boolean(location?.in_transit)
  const actionBusy = pendingAction !== null || autoTravelActive

  const isJumpTransit = location?.transit_type === 'jump'
  const travelDestination =
    (isJumpTransit ? location?.transit_dest_system_name : location?.transit_dest_poi_name) ||
    location?.transit_dest_poi_name ||
    location?.transit_dest_system_name ||
    'unknown'
  const transitElapsed = location?.transit_ticks_elapsed ?? 0
  const transitArrivalTick = location?.transit_arrival_tick
  const transitEta = transitArrivalTick !== undefined ? Math.max(0, transitArrivalTick - currentTick) : null
  const transitTotalTicks = transitEta !== null ? transitElapsed + transitEta : null
  const travelProgress =
    transitTotalTicks && transitTotalTicks > 0 ? Math.max(0, Math.min(100, (transitElapsed / transitTotalTicks) * 100)) : 0

  const logEvent = useCallback((text?: string) => {
    if (text) uiStore.dispatch({ type: 'event', kind: 'info', text })
  }, [uiStore])

  const reportError = useCallback((err: unknown) => {
    const text = errorMessage(err)
    uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    uiStore.dispatch({ type: 'event', kind: 'danger', text })
  }, [uiStore])

  const handleTravel = useCallback(
    async (poiId: string) => {
      const targetPoi = system?.pois.find((p) => p.id === poiId)
      let estimatedMs: number | undefined
      if (poi?.position?.x !== undefined && poi.position.y !== undefined && targetPoi?.position) {
        const dx = targetPoi.position.x - poi.position.x
        const dy = targetPoi.position.y - poi.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const speed = Math.max(0.1, ship?.speed ?? 1)
        const travelTicks = Math.max(1, Math.ceil(distance / speed))
        estimatedMs = travelTicks * 10000
      }
      try {
        const result = await mutate((c) => c.spacemolt.travel({ id: poiId }), { label: 'travel', estimatedMs })
        logEvent(detailMessage(result.delta.details) || `Traveling to ${targetPoi?.name || 'destination'}...`)
      } catch (err) {
        reportError(err)
      }
    },
    [mutate, system, poi, ship?.speed, logEvent, reportError],
  )

  const handleJump = useCallback(
    async (systemId: string) => {
      const speed = ship?.speed ?? 1
      const estimatedMs = Math.max(10, 70 - 10 * speed) * 1000
      try {
        await mutate((c) => c.spacemolt.jump({ id: systemId }), { label: 'jump', estimatedMs })
        logEvent('Jumping...')
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

  const handleMine = useCallback(async () => {
    try {
      const result = await mutate((c) => c.spacemolt.mine(), { label: 'mine' })
      logEvent(detailMessage(result.delta.details) || 'Mining started')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleSurvey = useCallback(async () => {
    try {
      const result = await mutate((c) => c.spacemolt.survey_system(), { label: 'survey_system' })
      logEvent(detailMessage(result.delta.details) || 'Survey complete')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleRefuel = useCallback(async () => {
    try {
      const result = await mutate((c) => c.spacemolt.refuel(), { label: 'refuel' })
      logEvent(detailMessage(result.delta.details) || 'Refueled')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleRepair = useCallback(async () => {
    try {
      const result = await mutate((c) => c.spacemolt.repair(), { label: 'repair' })
      logEvent(detailMessage(result.delta.details) || 'Repaired')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, logEvent, reportError])

  const handleScanNearest = useCallback(async () => {
    const targetId = location?.nearby_players?.[0]?.player_id
    if (!targetId) return
    try {
      const result = await mutate((c) => c.spacemolt.scan({ id: targetId }), { label: 'scan' })
      logEvent(detailMessage(result.delta.details) || 'Scan complete')
    } catch (err) {
      reportError(err)
    }
  }, [mutate, location, logEvent, reportError])

  const handlePlotCourse = useCallback(async () => {
    if (!exploreSystem) return
    try {
      const result = await store.account.commands.spacemolt.find_route({ id: exploreSystem.id })
      const data = result.structuredContent
      if (data?.found) {
        onPlannedRouteChange({
          route: data.route.map((r) => ({ system_id: r.system_id, name: r.name, jumps: r.jumps })),
          totalJumps: data.total_jumps,
          targetSystem: data.target_system,
          fuelPerJump: data.fuel_per_jump,
          estimatedFuel: data.estimated_fuel,
          fuelAvailable: data.fuel_available,
        })
      }
    } catch (err) {
      reportError(err)
    }
  }, [exploreSystem, store, onPlannedRouteChange, reportError])

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
    [galaxyRef, onExploreSystemChange, onTabChange],
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
                  {location?.resources && location.resources.length > 0 && (
                    <div className={styles.resourceList}>
                      {location.resources.map((r) => (
                        <div key={r.item_id} className={styles.resourceItem}>
                          <span className={styles.resourceName}>{r.item_name || r.item_id}</span>
                          <span className={styles.resourceRichness}>{r.richness}</span>
                          <span className={styles.resourceRemaining}>
                            {r.remaining === undefined
                              ? ''
                              : r.remaining < 0
                                ? '∞'
                                : r.remaining === 0
                                  ? 'depleted'
                                  : r.remaining.toLocaleString()}
                          </span>
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
              <span>→ {travelDestination}</span>
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

        {/* Contextual Actions */}
        <div className={styles.actions}>
          <div className={styles.sectionLabel}>Actions</div>

          {/* Dock / Undock */}
          {poi?.base_id && (
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
          {!isDocked && location?.resources && location.resources.length > 0 && (
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
          {!isDocked && location?.nearby_players && location.nearby_players.length > 0 && (
            <button
              className={styles.actionBtn}
              onClick={handleScanNearest}
              disabled={actionBusy}
              type="button"
            >
              <Swords size={13} />
              <span>Scan Nearest</span>
            </button>
          )}

          {/* Survey */}
          {Boolean(modules?.length) && (
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
          {isDocked && ship && (ship.fuel ?? 0) < (ship.max_fuel ?? 0) && (
            <button
              className={styles.actionBtn}
              onClick={handleRefuel}
              disabled={actionBusy}
              type="button"
            >
              <Fuel size={13} />
              <span>Refuel ({ship.fuel}/{ship.max_fuel})</span>
            </button>
          )}

          {/* Repair — docked and below max hull */}
          {isDocked && ship && (ship.hull ?? 0) < (ship.max_hull ?? 0) && (
            <button
              className={styles.actionBtn}
              onClick={handleRepair}
              disabled={actionBusy}
              type="button"
            >
              <Wrench size={13} />
              <span>Repair ({ship.hull}/{ship.max_hull})</span>
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
                            .flatMap((p) => p.resources ?? [])
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
