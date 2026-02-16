'use client'

import { useCallback } from 'react'
import {
  Wifi,
  WifiOff,
  Coins,
  Globe,
  MapPin,
  Rocket,
  Anchor,
  LogOut,
} from 'lucide-react'
import { useGame } from './GameProvider'
import { ProgressBar } from './ProgressBar'
import styles from './TopBar.module.css'

export function TopBar() {
  const { state, sendCommand, dispatch } = useGame()
  const player = state.player
  const ship = state.ship
  const connected = state.connected

  const handleUndock = useCallback(() => {
    sendCommand('undock')
  }, [sendCommand])

  const handleLogout = useCallback(() => {
    sendCommand('logout')
    dispatch({ type: 'RESET' })
    try {
      localStorage.removeItem('spacemolt_username')
      localStorage.removeItem('spacemolt_password')
      localStorage.removeItem('spacemolt_token')
    } catch {
      // localStorage may not be available
    }
  }, [sendCommand, dispatch])

  const hullPct = ship && ship.max_hull > 0 ? ship.hull / ship.max_hull : 1
  const hullColor = hullPct < 0.25 ? 'red' : hullPct < 0.5 ? 'orange' : 'green'

  return (
    <div className={styles.topBar}>
      {/* Section 1: Player identity */}
      <div className={styles.playerSection}>
        <div className={styles.connectionStatus}>
          {connected ? (
            <Wifi size={12} className={styles.connectedIcon} />
          ) : (
            <WifiOff size={12} className={styles.disconnectedIcon} />
          )}
          <span className={connected ? styles.connectedDot : styles.disconnectedDot} />
        </div>
        {player ? (
          <>
            <span className={styles.username}>{player.username}</span>
            <span className={styles.credits}>
              <Coins size={11} className={styles.creditsIcon} />
              <span className={styles.creditsValue}>
                {player.credits.toLocaleString()}
              </span>
            </span>
            {player.empire && (
              <span className={styles.empire}>{player.empire}</span>
            )}
            <button
              className={styles.logoutBtn}
              onClick={handleLogout}
              title="Log out"
              type="button"
            >
              <LogOut size={11} />
            </button>
          </>
        ) : (
          <span className={styles.noPlayer}>Not logged in</span>
        )}
      </div>

      {/* Section 2: Location */}
      {(state.system || state.poi) && (
        <>
          <span className={styles.sep} />
          <div className={styles.locationSection}>
            <MapPin size={12} className={styles.locationIcon} />
            {state.system && (
              <span className={styles.systemName}>{state.system.name}</span>
            )}
            {state.system && state.poi && (
              <span className={styles.poiSep}>/</span>
            )}
            {state.poi && (
              <span className={styles.poiName}>{state.poi.name}</span>
            )}
          </div>
        </>
      )}

      {/* Section 3: Ship + docking */}
      {ship && (
        <>
          <span className={styles.sep} />
          <div className={styles.shipSection}>
            <Rocket size={12} className={styles.shipIcon} />
            <span className={styles.shipClass}>{ship.class}</span>
            {state.isDocked && (
              <>
                <span className={styles.dockedBadge}>
                  <Anchor size={10} /> Docked
                </span>
                <button
                  className={styles.undockBtn}
                  onClick={handleUndock}
                  type="button"
                >
                  <LogOut size={10} /> Undock
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Section 4: Status bars */}
      {ship && (
        <>
          <span className={styles.sep} />
          <div className={styles.barsSection}>
            <div className={styles.barItem}>
              <ProgressBar
                value={ship.hull}
                max={ship.max_hull}
                color={hullColor}
                label="Hull"
                size="sm"
              />
            </div>
            <div className={styles.barItem}>
              <ProgressBar
                value={ship.shield}
                max={ship.max_shield}
                color="blue"
                label="Shield"
                size="sm"
              />
            </div>
            <div className={styles.barItem}>
              <ProgressBar
                value={ship.fuel}
                max={ship.max_fuel}
                color="yellow"
                label="Fuel"
                size="sm"
              />
            </div>
            <div className={styles.barItem}>
              <ProgressBar
                value={ship.cargo_used}
                max={ship.cargo_capacity}
                color="cyan"
                label="Cargo"
                size="sm"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
