'use client'

import { useCallback, useRef, useState } from 'react'
import {
  Wifi,
  WifiOff,
  Coins,
  MapPin,
  Rocket,
  Anchor,
  LogOut,
  AlertTriangle,
  Keyboard,
  ChevronDown,
  Users,
} from 'lucide-react'
import { useAccountStore, useConnectionPhase, useLocationState, usePlayer, useShip } from '@/lib/spacemolt'
import { usePlay } from './PlayProvider'
import { BugReportButton } from './BugReportButton'
import { TickCooldown } from './TickCooldown'
import { useClickOutside } from './hooks/useClickOutside'
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

function formatCountdown(isoDate: string): string {
  const remaining = new Date(isoDate).getTime() - Date.now()
  if (remaining <= 0) return 'expired'
  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** The username, as a menu that switches to another character on the account without the picker. */
function CharacterMenu({ username }: { username: string }) {
  const store = useAccountStore()
  const { players = [], onSelectPlayer, onSwitchPlayer } = usePlay()
  const myId = usePlayer()?.id
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, open, close)
  const others = players.filter((p) => p.id !== myId).sort((a, b) => a.username.localeCompare(b.username))
  // Same teardown as the log-out button: end this session, then mount the next character.
  const leave = (next?: () => void) => {
    setOpen(false)
    void store.account.logout().catch(() => {})
    next?.()
  }

  return (
    <div className={styles.charMenu} ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') close() }}>
      <button className={styles.usernameBtn} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" title="Switch character" type="button">
        <span className={styles.username}>{username}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className={styles.charMenuPanel} role="menu">
          {others.map((p) => (
            <button key={p.id} className={styles.charMenuItem} role="menuitem" onClick={() => leave(() => onSelectPlayer?.(p.id))} type="button">
              {p.username}
            </button>
          ))}
          <button className={`${styles.charMenuItem} ${styles.charMenuAll}`} role="menuitem" onClick={() => leave(onSwitchPlayer)} type="button">
            <Users size={11} /> All characters
          </button>
        </div>
      )}
    </div>
  )
}

export function TopBar({ onShowShortcuts }: { onShowShortcuts?: () => void }) {
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
              <CharacterMenu username={player.username} />
              <span className={styles.credits}>
                <Coins size={11} className={styles.creditsIcon} />
                {(player.credits ?? 0).toLocaleString()}
              </span>
              {player.trading_restricted_until && new Date(player.trading_restricted_until) > new Date() && (
                <span
                  className={styles.tradingRestricted}
                  title={`Until ${new Date(player.trading_restricted_until).toLocaleTimeString()}`}
                >
                  <AlertTriangle size={10} />
                  Trading locked ({formatCountdown(player.trading_restricted_until)})
                </span>
              )}
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
        {onShowShortcuts && (
          <button className={`${styles.logoutBtn} ${styles.shortcutsBtn}`} onClick={onShowShortcuts} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" type="button">
            <Keyboard size={12} />
          </button>
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
