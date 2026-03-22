'use client'

import { useState, useCallback } from 'react'
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
} from 'lucide-react'
import { useGame } from './GameProvider'
import { ProgressBar } from './ProgressBar'
import styles from './LeftSidebar.module.css'

export function LeftSidebar() {
  const { state, sendCommand } = useGame()
  const [expandedPoi, setExpandedPoi] = useState<string | null>(null)

  const system = state.system
  const poi = state.poi
  const isDocked = state.isDocked
  const isTraveling =
    state.travelProgress !== null && state.travelProgress !== undefined
  const actionBusy = state.pendingAction !== null

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

  const togglePoiExpand = useCallback((poiId: string) => {
    setExpandedPoi((prev) => (prev === poiId ? null : poiId))
  }, [])

  return (
    <div className={styles.sidebar}>
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
          <button
            className={styles.actionBtn}
            onClick={handleMine}
            disabled={actionBusy}
            type="button"
          >
            <Pickaxe size={13} />
            <span>Mine</span>
          </button>
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
  )
}
