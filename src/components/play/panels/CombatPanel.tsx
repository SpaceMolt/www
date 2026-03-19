'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Swords,
  Search,
  Eye,
  EyeOff,
  Skull,
  Shield,
  RefreshCw,
  Target,
  ChevronUp,
  ChevronDown,
  RotateCw,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import styles from './CombatPanel.module.css'

interface BattleParticipant {
  player_id: string
  username: string
  side_id: number
  zone: string
  ship_class: string
  hull_pct: number
  shield_pct: number
  stance: string
  target_id: string
}

interface BattleSide {
  side_id: number
  player_count: number
  faction_name: string
  faction_tag: string
}

interface BattleStatus {
  battle_id: string
  system_id: string
  is_participant: boolean
  tick_duration: number
  sides: BattleSide[]
  participants: BattleParticipant[]
}

export function CombatPanel() {
  const { state, sendCommand, send } = useGame()
  const [confirmSelfDestruct, setConfirmSelfDestruct] = useState(false)
  const [battleStatus, setBattleStatus] = useState<BattleStatus | null>(null)
  const [selectedAmmo, setSelectedAmmo] = useState<Record<string, string>>({})
  const sendRef = useRef(send)
  sendRef.current = send

  // Auto-fetch battle status every 5 seconds when in combat
  useEffect(() => {
    if (!state.inCombat) {
      setBattleStatus(null)
      return
    }

    const fetchBattleStatus = () => {
      sendRef.current({ type: 'get_battle_status' })
    }

    // Fetch immediately on entering combat
    fetchBattleStatus()

    const interval = setInterval(fetchBattleStatus, 5000)
    return () => clearInterval(interval)
  }, [state.inCombat])

  // Listen for battle status responses via custom DOM events.
  // GameProvider dispatches 'spacemolt:ok' events for OK responses;
  // we filter for get_battle_status to populate local state.
  useEffect(() => {
    if (!state.inCombat) return

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.action === 'get_battle_status' && detail?.battle_id) {
        setBattleStatus(detail as unknown as BattleStatus)
      }
    }
    window.addEventListener('spacemolt:ok', handler)
    return () => window.removeEventListener('spacemolt:ok', handler)
  }, [state.inCombat])

  const handleAttack = useCallback(
    (playerId: string) => {
      sendCommand('attack', { target_id: playerId })
    },
    [sendCommand]
  )

  const handleScan = useCallback(
    (playerId: string) => {
      sendCommand('scan', { target_id: playerId })
    },
    [sendCommand]
  )

  const handleCloak = useCallback(() => {
    sendCommand('cloak', { enable: !state.player?.is_cloaked })
  }, [sendCommand, state.player?.is_cloaked])

  const handleSelfDestruct = useCallback(() => {
    sendCommand('self_destruct')
    setConfirmSelfDestruct(false)
  }, [sendCommand])

  const handleRefresh = useCallback(() => {
    sendCommand('get_nearby')
  }, [sendCommand])

  // Tactical controls
  const handleStance = useCallback(
    (stance: 'aggressive' | 'balanced' | 'defensive') => {
      sendCommand('battle', { action: 'stance', stance })
    },
    [sendCommand]
  )

  const handleAdvance = useCallback(() => {
    sendCommand('battle', { action: 'advance' })
  }, [sendCommand])

  const handleRetreat = useCallback(() => {
    sendCommand('battle', { action: 'retreat' })
  }, [sendCommand])

  const handleEngage = useCallback(() => {
    sendCommand('battle', { action: 'engage' })
  }, [sendCommand])

  // Reload handler
  const handleReload = useCallback(
    (instanceId: string) => {
      const ammoId = selectedAmmo[instanceId]
      if (!ammoId) return
      sendCommand('reload', {
        weapon_instance_id: instanceId,
        ammo_item_id: ammoId,
      })
    },
    [sendCommand, selectedAmmo]
  )

  const isCloaked = state.player?.is_cloaked ?? false
  const nearby = state.nearby || []
  // ship.modules is string[] (module instance IDs); no weapon filtering available from this field
  const moduleIds = state.ship?.modules || []
  const cargoItems = state.ship?.cargo || []

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>
              <Swords size={16} />
            </span>
            Combat
          </div>
          {state.inCombat && (
            <span className={styles.combatBadge}>In Combat</span>
          )}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          title="Refresh nearby"
          type="button"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className={styles.content}>
        {/* Controls */}
        <div className={styles.controlsRow}>
          <button
            className={`${styles.cloakBtn} ${
              isCloaked ? styles.cloakActive : ''
            }`}
            onClick={handleCloak}
            title={isCloaked ? 'Disable cloak' : 'Enable cloak'}
            type="button"
          >
            {isCloaked ? <EyeOff size={14} /> : <Eye size={14} />}
            {isCloaked ? 'Cloaked' : 'Cloak'}
          </button>

          <button
            className={styles.selfDestructBtn}
            onClick={() => setConfirmSelfDestruct(true)}
            title="Self-destruct"
            type="button"
          >
            <Skull size={14} />
            Self-Destruct
          </button>
        </div>

        {/* Battle Status */}
        {state.inCombat && (
          <div className={styles.battleSection}>
            <div className={styles.sectionTitle}>
              <Target size={12} /> Battle Status
            </div>
            {battleStatus ? (
              <div className={styles.battleInfo}>
                {/* Sides */}
                <div className={styles.sidesRow}>
                  {battleStatus.sides.map((side) => (
                    <div key={side.side_id} className={styles.sideCard}>
                      <span className={styles.sideName}>
                        {side.faction_tag
                          ? `[${side.faction_tag}] ${side.faction_name}`
                          : `Side ${side.side_id}`}
                      </span>
                      <span className={styles.sideCount}>
                        {side.player_count}{' '}
                        {side.player_count === 1 ? 'pilot' : 'pilots'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Participants */}
                <div className={styles.participantList}>
                  {battleStatus.participants.map((p) => (
                    <div
                      key={p.player_id}
                      className={styles.participantCard}
                    >
                      <div className={styles.participantHeader}>
                        <span className={styles.participantName}>
                          {p.username}
                        </span>
                        <span className={styles.participantShip}>
                          {p.ship_class}
                        </span>
                      </div>
                      <div className={styles.barGroup}>
                        <div className={styles.barRow}>
                          <span className={styles.barLabel}>SHD</span>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFillShield}
                              style={{ width: `${p.shield_pct}%` }}
                            />
                          </div>
                          <span className={styles.barValue}>
                            {p.shield_pct}%
                          </span>
                        </div>
                        <div className={styles.barRow}>
                          <span className={styles.barLabel}>HUL</span>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFillHull}
                              style={{ width: `${p.hull_pct}%` }}
                            />
                          </div>
                          <span className={styles.barValue}>
                            {p.hull_pct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                Fetching battle data...
              </div>
            )}

            {/* Tactical Controls */}
            <div className={styles.tacticalSection}>
              <div className={styles.sectionTitle}>
                <Shield size={12} /> Tactical Controls
              </div>

              {/* Stance Selector */}
              <div className={styles.stanceRow}>
                <button
                  className={styles.stanceBtn}
                  onClick={() => handleStance('aggressive')}
                  title="Aggressive stance: max damage, less defense"
                  type="button"
                >
                  <Swords size={12} />
                  Aggressive
                </button>
                <button
                  className={styles.stanceBtn}
                  onClick={() => handleStance('balanced')}
                  title="Balanced stance: equal offense and defense"
                  type="button"
                >
                  <Target size={12} />
                  Balanced
                </button>
                <button
                  className={styles.stanceBtn}
                  onClick={() => handleStance('defensive')}
                  title="Defensive stance: max defense, less damage"
                  type="button"
                >
                  <Shield size={12} />
                  Defensive
                </button>
              </div>

              {/* Movement + Engage */}
              <div className={styles.tacticalRow}>
                <button
                  className={styles.tacticalBtn}
                  onClick={handleAdvance}
                  title="Advance toward target"
                  type="button"
                >
                  <ChevronUp size={14} />
                  Advance
                </button>
                <button
                  className={styles.tacticalBtn}
                  onClick={handleRetreat}
                  title="Retreat from battle"
                  type="button"
                >
                  <ChevronDown size={14} />
                  Retreat
                </button>
                <button
                  className={styles.engageBtn}
                  onClick={handleEngage}
                  title="Engage enemy"
                  type="button"
                >
                  <Swords size={14} />
                  Engage
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Nearby players */}
        <div>
          <div className={styles.sectionTitle}>
            Nearby ({nearby.length})
          </div>
          {nearby.length > 0 ? (
            <div className={styles.playerList}>
              {nearby.map((player) => {
                const displayName = player.username || 'Unknown'
                const playerId = player.player_id ?? ''

                return (
                  <div key={playerId} className={styles.playerCard}>
                    <div className={styles.playerInfo}>
                      <div className={styles.playerNameRow}>
                        <span
                          className={styles.playerName}
                          style={
                            player.primary_color
                              ? { color: player.primary_color }
                              : undefined
                          }
                        >
                          {displayName}
                        </span>
                        {player.clan_tag && (
                          <span className={styles.clanTag}>
                            [{player.clan_tag}]
                          </span>
                        )}
                      </div>
                      {player.ship_class && (
                        <span className={styles.playerShip}>
                          <Shield size={10} /> {player.ship_class}
                        </span>
                      )}
                    </div>

                    <div className={styles.playerActions}>
                      <button
                        className={styles.scanBtn}
                        onClick={() => handleScan(playerId)}
                        title={`Scan ${displayName}`}
                        type="button"
                      >
                        <Search size={14} />
                      </button>
                      <button
                        className={styles.attackBtn}
                        onClick={() => handleAttack(playerId)}
                        title={`Attack ${displayName}`}
                        type="button"
                      >
                        <Swords size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              No other vessels detected at this location
            </div>
          )}
        </div>

        {/* Reload Section */}
        {moduleIds.length > 0 && (
          <div>
            <div className={styles.sectionTitle}>
              <RotateCw size={12} /> Weapon Reload
            </div>
            <div className={styles.reloadList}>
              {moduleIds.map((instanceId) => (
                <div key={instanceId} className={styles.reloadCard}>
                  <div className={styles.reloadWeaponName}>{instanceId}</div>
                  <div className={styles.reloadControls}>
                    <select
                      className={styles.ammoSelect}
                      value={selectedAmmo[instanceId] || ''}
                      onChange={(e) =>
                        setSelectedAmmo((prev) => ({
                          ...prev,
                          [instanceId]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select ammo</option>
                      {cargoItems.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.name} (x{item.quantity})
                        </option>
                      ))}
                    </select>
                    <button
                      className={styles.reloadBtn}
                      onClick={() => handleReload(instanceId)}
                      disabled={!selectedAmmo[instanceId]}
                      title={`Reload ${instanceId}`}
                      type="button"
                    >
                      <RotateCw size={12} />
                      Reload
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Self-destruct confirmation modal */}
      {confirmSelfDestruct && (
        <div
          className={styles.confirmOverlay}
          onClick={() => setConfirmSelfDestruct(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles.confirmDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.confirmTitle}>
              <Skull size={18} /> Confirm Self-Destruct
            </div>
            <div className={styles.confirmText}>
              This will destroy your ship and all cargo. You will respawn at your
              home base. This action cannot be undone.
              <br /><br />
              <strong>Fee schedule:</strong> First 2 self-destructs per 24h are free.
              3rd costs 200 cr, then doubles (400, 800, 1600...).
              Repeated use restricts trading and gifting.
              {state.player?.trading_restricted_until && new Date(state.player.trading_restricted_until) > new Date() && (
                <>
                  <br /><br />
                  <span style={{ color: 'var(--claw-red)' }}>
                    You are currently trade-restricted until {new Date(state.player.trading_restricted_until).toLocaleTimeString()}.
                  </span>
                </>
              )}
            </div>
            <div className={styles.confirmActions}>
              <button
                className={styles.cloakBtn}
                onClick={() => setConfirmSelfDestruct(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.selfDestructBtn}
                onClick={handleSelfDestruct}
                type="button"
              >
                <Skull size={14} />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
