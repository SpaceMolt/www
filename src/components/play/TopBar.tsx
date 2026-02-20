'use client'

import { useCallback } from 'react'
import {
  Wifi,
  WifiOff,
  Coins,
  MapPin,
  Rocket,
  Anchor,
  LogOut,
} from 'lucide-react'
import { useGame } from './GameProvider'
import styles from './TopBar.module.css'

function StatusBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0
  return (
    <div className={styles.statusBar}>
      <span className={styles.statusLabel}>{label}</span>
      <div className={styles.statusTrack}>
        <div
          className={`${styles.statusFill} ${styles[`fill_${color}`]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={styles.statusValue}>{Math.round(pct)}%</span>
    </div>
  )
}

export function TopBar() {
  const { state, sendCommand, dispatch, onSwitchPlayer } = useGame()
  const player = state.player
  const ship = state.ship
  const connected = state.connected

  const handleLogout = useCallback(() => {
    sendCommand('logout')
    dispatch({ type: 'RESET' })
    if (onSwitchPlayer) onSwitchPlayer()
  }, [sendCommand, dispatch, onSwitchPlayer])

  const hullPct = ship && ship.max_hull > 0 ? ship.hull / ship.max_hull : 1
  const hullColor = hullPct < 0.25 ? 'red' : hullPct < 0.5 ? 'orange' : 'green'

  return (
    <div className={styles.topBar}>
      {/* Row 1: Player, Location, Ship */}
      <div className={styles.infoRow}>
        <div className={styles.playerSection}>
          {connected ? (
            <Wifi size={12} className={styles.connectedIcon} />
          ) : (
            <WifiOff size={12} className={styles.disconnectedIcon} />
          )}
          {player ? (
            <>
              <span className={styles.username}>{player.username}</span>
              <span className={styles.credits}>
                <Coins size={11} className={styles.creditsIcon} />
                {player.credits.toLocaleString()}
              </span>
            </>
          ) : (
            <span className={styles.noPlayer}>Not logged in</span>
          )}
        </div>

        {(state.system || state.poi) && (
          <>
            <span className={styles.sep} />
            <div className={styles.locationSection}>
              <MapPin size={12} className={styles.locationIcon} />
              {state.system && <span className={styles.systemName}>{state.system.name}</span>}
              {state.system && state.poi && <span className={styles.poiSep}>/</span>}
              {state.poi && <span className={styles.poiName}>{state.poi.name}</span>}
              {state.isDocked && (
                <span className={styles.dockedBadge}>
                  <Anchor size={10} /> Docked
                </span>
              )}
            </div>
          </>
        )}

        {ship && (
          <>
            <span className={styles.sep} />
            <div className={styles.shipSection}>
              <Rocket size={12} className={styles.shipIcon} />
              <span className={styles.shipClass}>{ship.class}</span>
            </div>
          </>
        )}

        <div className={styles.spacer} />

        {player && (
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Log out"
            type="button"
          >
            <LogOut size={12} />
          </button>
        )}
      </div>

      {/* Row 2: Ship status bars */}
      {ship && (
        <div className={styles.barsRow}>
          <StatusBar value={ship.hull} max={ship.max_hull} color={hullColor} label="Hull" />
          <StatusBar value={ship.shield} max={ship.max_shield} color="blue" label="Shield" />
          <StatusBar value={ship.fuel} max={ship.max_fuel} color="yellow" label="Fuel" />
          <StatusBar value={ship.cargo_used} max={ship.cargo_capacity} color="cyan" label="Cargo" />
        </div>
      )}
    </div>
  )
}
