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

function MiniBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0
  return (
    <div className={styles.miniBar} title={`${label}: ${value.toLocaleString()} / ${max.toLocaleString()}`}>
      <span className={styles.miniLabel}>{label}</span>
      <div className={styles.miniTrack}>
        <div
          className={`${styles.miniFill} ${styles[`fill_${color}`]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
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
      {/* Connection + Player */}
      <div className={styles.playerSection}>
        {connected ? (
          <Wifi size={11} className={styles.connectedIcon} />
        ) : (
          <WifiOff size={11} className={styles.disconnectedIcon} />
        )}
        {player ? (
          <>
            <span className={styles.username}>{player.username}</span>
            <span className={styles.credits}>
              <Coins size={10} className={styles.creditsIcon} />
              {player.credits.toLocaleString()}
            </span>
          </>
        ) : (
          <span className={styles.noPlayer}>---</span>
        )}
      </div>

      {/* Location */}
      {(state.system || state.poi) && (
        <div className={styles.locationSection}>
          <MapPin size={11} className={styles.locationIcon} />
          {state.system && <span className={styles.systemName}>{state.system.name}</span>}
          {state.system && state.poi && <span className={styles.poiSep}>/</span>}
          {state.poi && <span className={styles.poiName}>{state.poi.name}</span>}
          {state.isDocked && (
            <span className={styles.dockedBadge}>
              <Anchor size={9} /> Docked
            </span>
          )}
        </div>
      )}

      {/* Ship + Bars */}
      {ship && (
        <div className={styles.shipSection}>
          <Rocket size={11} className={styles.shipIcon} />
          <span className={styles.shipClass}>{ship.class}</span>
          <div className={styles.barsRow}>
            <MiniBar value={ship.hull} max={ship.max_hull} color={hullColor} label="H" />
            <MiniBar value={ship.shield} max={ship.max_shield} color="blue" label="S" />
            <MiniBar value={ship.fuel} max={ship.max_fuel} color="yellow" label="F" />
            <MiniBar value={ship.cargo_used} max={ship.cargo_capacity} color="cyan" label="C" />
          </div>
        </div>
      )}

      {/* Logout */}
      {player && (
        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          title="Log out"
          type="button"
        >
          <LogOut size={11} />
        </button>
      )}
    </div>
  )
}
