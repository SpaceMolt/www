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
import { useAccountStore, useCargo, useCommandMutation, useLocationState, useModules, usePlayer } from '@/lib/spacemolt'
import { usePlay, usePlayUi } from '../PlayProvider'
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
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const player = usePlayer()
  const location = useLocationState()
  const modules = useModules()
  const cargo = useCargo()
  const battle = usePlayUi((s) => s.battle)
  const inCombat = usePlayUi((s) => s.inCombat)

  const [confirmSelfDestruct, setConfirmSelfDestruct] = useState(false)
  const [selectedAmmo, setSelectedAmmo] = useState<Record<string, string>>({})

  const reportError = useCallback(
    (err: unknown) => {
      const text = err instanceof Error ? err.message : String(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
      uiStore.dispatch({ type: 'event', kind: 'danger', text })
    },
    [uiStore],
  )

  const handleAttack = useCallback(
    (id: string) => {
      mutate((c) => c.spacemolt.attack({ id }), { label: 'attack' }).catch(reportError)
    },
    [mutate, reportError],
  )

  const handleScan = useCallback(
    (id: string) => {
      mutate((c) => c.spacemolt.scan({ id }), { label: 'scan' }).catch(reportError)
    },
    [mutate, reportError],
  )

  const handleCloak = useCallback(() => {
    mutate((c) => c.spacemolt.cloak({ enable: !player?.is_cloaked }), { label: 'cloak' }).catch(reportError)
  }, [mutate, reportError, player?.is_cloaked])

  const handleSelfDestruct = useCallback(() => {
    setConfirmSelfDestruct(false)
    mutate((c) => c.spacemolt.self_destruct(), { label: 'self_destruct' }).catch(reportError)
  }, [mutate, reportError])

  const handleRefresh = useCallback(() => {
    store.account.refresh().catch(reportError)
  }, [store, reportError])

  // Tactical controls — battle stance/movement resolve synchronously
  // (query commands), not queued to the next tick, so they bypass mutate().
  const handleStance = useCallback(
    (stance: Stance) => {
      store.account.commands.spacemolt_battle.stance({ id: stance }).catch(reportError)
    },
    [store, reportError],
  )

  const handleAdvance = useCallback(() => {
    store.account.commands.spacemolt_battle.advance().catch(reportError)
  }, [store, reportError])

  const handleRetreat = useCallback(() => {
    store.account.commands.spacemolt_battle.retreat().catch(reportError)
  }, [store, reportError])

  const handleReload = useCallback(
    (instanceId: string) => {
      const ammoId = selectedAmmo[instanceId]
      if (!ammoId) return
      mutate((c) => c.spacemolt_battle.reload({ id: instanceId, target: ammoId }), { label: 'reload' }).catch(
        reportError,
      )
    },
    [mutate, reportError, selectedAmmo],
  )

  const isCloaked = player?.is_cloaked ?? false
  const nearbyPlayers = location?.nearby_players ?? []
  const nearbyPirates = location?.nearby_pirates ?? []
  const nearbyCount = nearbyPlayers.length + nearbyPirates.length
  const yourStance = battle?.your_stance
  const weapons = (modules ?? []).filter((m) => m.type === 'weapon')
  const cargoItems = cargo ?? []

  return (
    <Panel
      title="Combat"
      icon={<Swords size={16} />}
      color="var(--claw-red)"
      headerRight={
        <div className={styles.headerRight}>
          {inCombat && <span className={styles.combatBadge}>In Combat</span>}
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
      {inCombat && (
        <div className={styles.battleSection}>
          <div className={shared.sectionTitle}>
            <Target size={12} /> Battle Status
          </div>
          {battle ? (
            <div className={styles.battleInfo}>
              {/* Your posture */}
              {(battle.your_zone || yourStance) && (
                <div className={styles.sideCount}>
                  {battle.your_zone ? `Zone: ${battle.your_zone}` : ''}
                  {battle.your_zone && yourStance ? ' · ' : ''}
                  {yourStance ? `Stance: ${yourStance}` : ''}
                  {battle.auto_pilot ? ' · auto-pilot' : ''}
                </div>
              )}

              {/* Sides */}
              <div className={styles.sidesRow}>
                {battle.sides.map((side) => (
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
                {battle.participants.map((p) => (
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

      {/* Nearby players and pirates */}
      <div>
        <div className={shared.sectionTitle}>
          Nearby ({nearbyCount})
        </div>
        {nearbyCount > 0 ? (
          <div className={styles.playerList}>
            {nearbyPlayers.map((p) => {
              const displayName = p.username || 'Unknown'
              const playerId = p.player_id ?? ''

              return (
                <div key={playerId} className={styles.playerCard}>
                  <div className={styles.playerInfo}>
                    <div className={styles.playerNameRow}>
                      <span className={styles.playerName}>{displayName}</span>
                      {p.clan_tag && (
                        <span className={styles.clanTag}>
                          [{p.clan_tag}]
                        </span>
                      )}
                    </div>
                    {p.ship_class && (
                      <span className={styles.playerShip}>
                        <Shield size={10} /> {p.ship_class}
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
            {nearbyPirates.map((p) => {
              const displayName = p.name || 'Unknown pirate'
              const pirateId = p.pirate_id ?? ''

              return (
                <div key={pirateId} className={styles.playerCard}>
                  <div className={styles.playerInfo}>
                    <div className={styles.playerNameRow}>
                      <span className={styles.playerName}>{displayName}</span>
                      <span className={styles.npcTag}>Pirate</span>
                    </div>
                    {p.tier && (
                      <span className={styles.playerShip}>
                        <Shield size={10} /> {p.tier}
                      </span>
                    )}
                  </div>

                  <div className={styles.playerActions}>
                    <button
                      className={styles.scanBtn}
                      onClick={() => handleScan(pirateId)}
                      title={`Scan ${displayName}`}
                      type="button"
                    >
                      <Search size={14} />
                    </button>
                    <button
                      className={styles.attackBtn}
                      onClick={() => handleAttack(pirateId)}
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
              const instanceId = weapon.module_id ?? ''
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
                          {item.item_name} (x{item.quantity})
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
          </div>
        </Modal>
      )}
    </Panel>
  )
}
