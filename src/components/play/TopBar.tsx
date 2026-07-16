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
import { useAccountStore, useConnectionPhase, useLocationState, usePlayer, useShip } from '@/lib/spacemolt'
import { usePlay } from './PlayProvider'
import { BugReportButton } from './BugReportButton'
import { TickCooldown } from './TickCooldown'
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
      <span className={styles.statusValue}>{value}/{max}</span>
    </div>
  )
}

export function TopBar() {
  const store = useAccountStore()
  const { onSwitchPlayer } = usePlay()
  const player = usePlayer()
  const ship = useShip()
  const location = useLocationState()
  const { phase } = useConnectionPhase()
  const connected = phase === 'ready'
  const isDocked = Boolean(location?.docked_at)

  const handleLogout = useCallback(() => {
    // Switching players tears down the AccountProvider (fresh Account per
    // player), so no local state reset is needed beyond leaving the session.
    void store.account.logout().catch(() => {})
    if (onSwitchPlayer) onSwitchPlayer()
  }, [store, onSwitchPlayer])

  const maxHull = ship?.max_hull ?? 0
  const hullPct = ship && maxHull > 0 ? (ship.hull ?? 0) / maxHull : 1
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
                {(player.credits ?? 0).toLocaleString()}
              </span>
              {/* trading_restricted_until badge removed: the v2 player state
                  section doesn't carry the field (server schema gap) */}
            </>
          ) : (
            <span className={styles.noPlayer}>Not logged in</span>
          )}
        </div>

        {(location?.system_name || location?.poi_name) && (
          <>
            <span className={styles.sep} />
            <div className={styles.locationSection}>
              <MapPin size={12} className={styles.locationIcon} />
              {location?.system_name && <span className={styles.systemName}>{location.system_name}</span>}
              {location?.system_name && location?.poi_name && <span className={styles.poiSep}>/</span>}
              {location?.poi_name && <span className={styles.poiName}>{location.poi_name}</span>}
              {isDocked && (
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
              <span className={styles.shipClass}>{ship.name}</span>
            </div>
          </>
        )}

        <div className={styles.spacer} />

        {player && (
          <TickCooldown />
        )}
        {player && (
          <BugReportButton contextType="generic" />
        )}
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
          <StatusBar value={ship.hull ?? 0} max={maxHull} color={hullColor} label="Hull" />
          <StatusBar value={ship.shield ?? 0} max={ship.max_shield ?? 0} color="blue" label="Shield" />
          <StatusBar value={ship.fuel ?? 0} max={ship.max_fuel ?? 0} color="yellow" label="Fuel" />
          <StatusBar value={ship.cargo_used ?? 0} max={ship.cargo_capacity ?? 0} color="cyan" label="Cargo" />
        </div>
      )}
    </div>
  )
}
