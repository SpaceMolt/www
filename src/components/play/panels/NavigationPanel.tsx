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
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { ProgressBar } from '../ProgressBar'
import styles from './NavigationPanel.module.css'

export function NavigationPanel() {
  const { state, sendCommand } = useGame()
  const [searchQuery, setSearchQuery] = useState('')

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

  const system = state.system
  const poi = state.poi
  const isTraveling =
    state.travelProgress !== null && state.travelProgress !== undefined

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
            {state.isDocked ? (
              <button
                className={styles.searchBtn}
                onClick={handleUndock}
                type="button"
              >
                <Anchor size={13} /> Undock
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
      </div>
    </div>
  )
}
