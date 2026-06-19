'use client'

import { useState, useCallback } from 'react'
import {
  Swords,
  Search,
  Eye,
  EyeOff,
  Skull,
  Shield,
  ShieldHalf,
  RefreshCw,
  Target,
  ChevronUp,
  ChevronDown,
  RotateCw,
  Flame,
  Wind,
  Rabbit,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { Panel, Modal, shared } from '../shared'
import styles from './CombatPanel.module.css'

type Stance = 'fire' | 'evade' | 'brace' | 'flee'

const STANCES: { id: Stance; label: string; icon: typeof Swords; title: string }[] = [
  { id: 'fire', label: 'Fire', icon: Flame, title: 'Fire weapons: 100% damage dealt and taken' },
  { id: 'evade', label: 'Evade', icon: Wind, title: 'Evade: no damage dealt, 50% taken (costs fuel)' },
  { id: 'brace', label: 'Brace', icon: ShieldHalf, title: 'Brace: no damage dealt, 25% taken, shields regen faster' },
  { id: 'flee', label: 'Flee', icon: Rabbit, title: 'Flee: retreat to outer zone, then 3 ticks to escape' },
]

export function CombatPanel() {
  const { state, sendCommand } = useGame()
  const [confirmSelfDestruct, setConfirmSelfDestruct] = useState(false)
  const [selectedAmmo, setSelectedAmmo] = useState<Record<string, string>>({})

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
    (stance: Stance) => {
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
  const battleStatus = state.battleStatus
  const yourStance = battleStatus?.your_stance
  const weapons = (state.shipModules || []).filter((m) => m.type === 'weapon')
  const cargoItems = state.ship?.cargo || []

  return (
    <Panel
      title="Combat"
      icon={<Swords size={16} />}
      color="var(--claw-red)"
      headerRight={
        <div className={styles.headerRight}>
          {state.inCombat && (
            <span className={styles.combatBadge}>In Combat</span>
          )}
          <button
            className={shared.refreshBtn}
            onClick={handleRefresh}
            title="Refresh nearby"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      }
    >
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
          <div className={shared.sectionTitle}>
            <Target size={12} /> Battle Status
          </div>
          {battleStatus ? (
            <div className={styles.battleInfo}>
              {/* Your posture */}
              {(battleStatus.your_zone || yourStance) && (
                <div className={styles.sideCount}>
                  {battleStatus.your_zone ? `Zone: ${battleStatus.your_zone}` : ''}
                  {battleStatus.your_zone && yourStance ? ' · ' : ''}
                  {yourStance ? `Stance: ${yourStance}` : ''}
                  {battleStatus.auto_pilot ? ' · auto-pilot' : ''}
                </div>
              )}

              {/* Sides */}
              <div className={styles.sidesRow}>
                {battleStatus.sides.map((side) => (
                  <div key={side.side_id} className={styles.sideCard}>
                    <span className={styles.sideName}>Side {side.side_id}</span>
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
                            style={{ width: `${p.shield_pct ?? 0}%` }}
                          />
                        </div>
                        <span className={styles.barValue}>
                          {p.shield_pct ?? 0}%
                        </span>
                      </div>
                      <div className={styles.barRow}>
                        <span className={styles.barLabel}>HUL</span>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFillHull}
                            style={{ width: `${p.hull_pct ?? 0}%` }}
                          />
                        </div>
                        <span className={styles.barValue}>
                          {p.hull_pct ?? 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={shared.emptyState}>
              Fetching battle data...
            </div>
          )}

          {/* Tactical Controls */}
          <div className={styles.tacticalSection}>
            <div className={shared.sectionTitle}>
              <Shield size={12} /> Tactical Controls
            </div>

            {/* Stance Selector */}
            <div className={styles.stanceRow}>
              {STANCES.map(({ id, label, icon: Icon, title }) => (
                <button
                  key={id}
                  className={`${styles.stanceBtn} ${yourStance === id ? styles.stanceActive : ''}`}
                  onClick={() => handleStance(id)}
                  title={title}
                  type="button"
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            {/* Movement */}
            <div className={styles.tacticalRow}>
              <button
                className={styles.tacticalBtn}
                onClick={handleAdvance}
                title="Advance one zone toward the enemy (higher hit chance)"
                type="button"
              >
                <ChevronUp size={14} />
                Advance
              </button>
              <button
                className={styles.tacticalBtn}
                onClick={handleRetreat}
                title="Retreat one zone from the enemy (harder to hit)"
                type="button"
              >
                <ChevronDown size={14} />
                Retreat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nearby players */}
      <div>
        <div className={shared.sectionTitle}>
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
          <div className={shared.emptyState}>
            No other vessels detected at this location
          </div>
        )}
      </div>

      {/* Reload Section */}
      {weapons.length > 0 && (
        <div>
          <div className={shared.sectionTitle}>
            <RotateCw size={12} /> Weapon Reload
          </div>
          <div className={styles.reloadList}>
            {weapons.map((weapon) => {
              const instanceId = weapon.module_id || weapon.id || ''
              const ammoStatus =
                weapon.magazine_size !== undefined
                  ? `${weapon.current_ammo ?? 0}/${weapon.magazine_size}${weapon.loaded_ammo_name ? ` · ${weapon.loaded_ammo_name}` : ''}`
                  : null
              return (
                <div key={instanceId} className={styles.reloadCard}>
                  <div className={styles.reloadWeaponName}>
                    {weapon.name}
                    {ammoStatus && (
                      <span className={styles.participantShip}> {ammoStatus}</span>
                    )}
                  </div>
                  <div className={styles.reloadControls}>
                    <select
                      className={shared.selectInput}
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
                      title={`Reload ${weapon.name}`}
                      type="button"
                    >
                      <RotateCw size={12} />
                      Reload
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Self-destruct confirmation modal */}
      {confirmSelfDestruct && (
        <Modal
          title="Confirm Self-Destruct"
          icon={<Skull size={18} />}
          onClose={() => setConfirmSelfDestruct(false)}
          actions={
            <>
              <button
                className={shared.accentBtn}
                onClick={() => setConfirmSelfDestruct(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={shared.dangerBtn}
                onClick={handleSelfDestruct}
                type="button"
              >
                <Skull size={14} />
                Confirm
              </button>
            </>
          }
        >
          <div className={shared.confirmText}>
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
        </Modal>
      )}
    </Panel>
  )
}
