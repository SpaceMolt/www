'use client'

import { useState, useCallback, useEffect } from 'react'
import type { NotificationShipCaptured } from '@spacemolt/lib'
import {
  Swords,
  Search,
  Eye,
  EyeOff,
  Skull,
  Shield,
  RefreshCw,
  RotateCw,
  PawPrint,
  Flag,
  Trophy,
  History,
  X,
} from 'lucide-react'
import {
  useAccountStore,
  useCargo,
  useCommandMutation,
  useCommandQuery,
  useLocationState,
  useModules,
  usePlayer,
  useShip,
  useConnectionPhase,
} from '@/lib/spacemolt'
import { getItem, getShip } from '@/data/catalog'
import { useFittedModules } from '../hooks/useGates'
import { CombatBattleView } from './CombatBattleView'
import { ArenaTab } from './combat/ArenaTab'
import { HistoryTab } from './combat/HistoryTab'
import { BattleHud, useBattleLog, type Stance } from './combat/BattleHud'
import { compatibleAmmo, reloadPlan } from './combat/combatLogic'
import { usePlay, usePlayUi } from '../PlayProvider'
import { PanelWithTabs, Modal, ConfirmAction, shared, useAction } from '../shared'
import styles from './CombatPanel.module.css'

type TabId = 'battle' | 'arena' | 'history'

const TABS = [
  { id: 'battle', label: 'Battle', icon: <Swords size={12} /> },
  { id: 'arena', label: 'Arena', icon: <Trophy size={12} /> },
  { id: 'history', label: 'History', icon: <History size={12} /> },
]

export function CombatPanel() {
  const store = useAccountStore()
  const { phase } = useConnectionPhase()
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const player = usePlayer()
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const modules = useModules()
  const cargo = useCargo()
  const shipClassId = useShip()?.class_id
  const fittedModules = useFittedModules()
  const battle = usePlayUi((s) => s.battle)
  const inCombat = usePlayUi((s) => s.inCombat)
  const battleSyncPending = usePlayUi((s) => s.battleSyncPending)
  const activeBattleId = usePlayUi((s) => s.activeBattleId)
  const lastBattleId = usePlayUi((s) => s.lastBattleId)
  const viewedBattleId = activeBattleId ?? lastBattleId
  const battleLog = useBattleLog(activeBattleId ?? undefined)
  const canControl = !isDocked && inCombat && !battleSyncPending && phase === 'ready'

  // Wildlife is only on the get_nearby response — the cached location state
  // carries nearby players and pirates but no creatures.
  const nearbyQuery = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_nearby()).structuredContent,
    [location?.poi_id],
    { enabled: !isDocked && Boolean(location?.poi_id), refreshOnSections: ['location'] },
  )

  // A battle in this system that you are not part of; status() reports it to observers.
  const systemBattle = useCommandQuery(
    async (account) => (await account.commands.spacemolt_battle.status()).structuredContent,
    [location?.poi_id],
    {
      enabled: !isDocked && !inCombat && phase === 'ready',
      refreshOnSections: ['location'],
      refreshOnEvents: ['battle_started', 'battle_ended', 'battle_joined', 'battle_left'],
    },
  )

  const [tab, setTab] = useState<TabId>('battle')
  const [confirmSelfDestruct, setConfirmSelfDestruct] = useState(false)
  const [selectedAmmo, setSelectedAmmo] = useState<Record<string, string>>({})
  const [engageSide, setEngageSide] = useState<number | null>(null)
  const [captured, setCaptured] = useState<NotificationShipCaptured | null>(null)

  useEffect(() => store.account.on('ship_captured', setCaptured), [store])

  useEffect(() => {
    if (isDocked) setConfirmSelfDestruct(false)
  }, [isDocked])

  const { run } = useAction()

  const handleAttack = useCallback(
    (id: string) => {
      run('attack', () => mutate((c) => c.spacemolt.attack({ id }), { label: 'attack' }))
    },
    [mutate, run],
  )

  const handleScan = useCallback(
    (id: string) => {
      run('scan', () => mutate((c) => c.spacemolt.scan({ id }), { label: 'scan' }))
    },
    [mutate, run],
  )

  const handleHunt = useCallback(
    (id: string) => {
      run('hunt', () => mutate((c) => c.spacemolt.hunt({ id }), { label: 'hunt' }))
    },
    [mutate, run],
  )

  const handleCloak = useCallback(() => {
    run('cloak', () => mutate((c) => c.spacemolt.cloak({ enable: !player?.is_cloaked }), { label: 'cloak' }))
  }, [mutate, run, player?.is_cloaked])

  // In battle, self-destruct is a free countdown query; the standalone command
  // is immediate, has an escalating fee, and the server refuses it mid-battle.
  const handleSelfDestruct = useCallback(() => {
    setConfirmSelfDestruct(false)
    if (inCombat) {
      run('self_destruct', async () => {
        const { structuredContent: r } = await store.account.commands.spacemolt_battle.self_destruct()
        uiStore.dispatch({ type: 'event', kind: 'warning', text: r?.message ?? 'Self-destruct countdown requested' })
      })
      return
    }
    run('self_destruct', () => mutate((c) => c.spacemolt.self_destruct(), { label: 'self_destruct' }))
  }, [inCombat, store, uiStore, mutate, run])

  const handleTarget = useCallback(
    (id: string) => {
      run('target', async () => {
        const { structuredContent: r } = await store.account.commands.spacemolt_battle.target({ id })
        uiStore.dispatch({ type: 'event', kind: 'info', text: r?.message ?? 'Target set' })
      })
    },
    [store, uiStore, run],
  )

  const handleEngage = useCallback(
    (sideId: number) => {
      setEngageSide(null)
      run(
        'engage',
        () => store.account.commands.spacemolt_battle.engage(sideId ? { side_id: sideId } : {}),
        ({ structuredContent: r }) => r?.message ?? 'Joining the battle',
      ).then((r) => r && systemBattle.refetch())
    },
    [store, run, systemBattle.refetch],
  )

  const handleRefresh = useCallback(() => {
    run('refresh', () => store.account.refresh())
    nearbyQuery.refetch()
  }, [store, run, nearbyQuery.refetch])

  // Tactical controls — battle stance/movement resolve synchronously
  // (query commands), not queued to the next tick, so they bypass mutate().
  const handleStance = useCallback(
    (stance: Stance) => {
      if (store.getPhase() !== 'ready' || !uiStore.getState().inCombat || uiStore.getState().battleSyncPending) return
      run('stance', () => store.account.commands.spacemolt_battle.stance({ id: stance }), (r) => r.structuredContent?.message ?? `Stance set: ${stance}`)
    },
    [store, uiStore, run],
  )

  const handleAdvance = useCallback(() => {
    if (store.getPhase() !== 'ready' || !uiStore.getState().inCombat || uiStore.getState().battleSyncPending) return
    run('advance', () => store.account.commands.spacemolt_battle.advance(), (r) => r.structuredContent?.message ?? 'Advancing')
  }, [store, uiStore, run])

  const handleRetreat = useCallback(() => {
    if (store.getPhase() !== 'ready' || !uiStore.getState().inCombat || uiStore.getState().battleSyncPending) return
    run('retreat', () => store.account.commands.spacemolt_battle.retreat(), (r) => r.structuredContent?.message ?? 'Retreating')
  }, [store, uiStore, run])

  const handleReload = useCallback(
    (instanceId: string, ammoId?: string) => {
      if (!ammoId) return
      run('reload', () => mutate((c) => c.spacemolt_battle.reload({ id: instanceId, target: ammoId }), { label: 'reload' }))
    },
    [mutate, run],
  )

  const weapons = (modules ?? []).filter((m) => m.type === 'weapon' && m.magazine_size !== undefined)
  const cargoItems = cargo ?? []
  const ammoFor = (weapon: (typeof weapons)[number]) => compatibleAmmo(weapon, cargoItems, getItem)
  const ammoChoice = (weapon: (typeof weapons)[number]) => {
    const options = ammoFor(weapon)
    return (
      selectedAmmo[weapon.module_id] ??
      options.find((o) => o.item_id === weapon.loaded_ammo_id)?.item_id ??
      options[0]?.item_id
    )
  }
  const reloadAll = reloadPlan(
    weapons.map((w) => ({
      weaponId: w.module_id,
      ammoId: ammoChoice(w),
      loadedId: w.loaded_ammo_id,
      full: (w.current_ammo ?? 0) >= (w.magazine_size ?? 0),
    })),
  )

  const handleReloadAll = () => {
    // ponytail: the lib types `weapons` as string[], but the server takes {weapon_instance_id, ammo_item_id} entries.
    const entries = reloadAll as unknown as string[]
    run('reload', () => mutate((c) => c.spacemolt_battle.reload({ weapons: entries }), { label: 'reload' }), ({ delta: { details } }) =>
      details && 'summary' in details ? (details.message ?? `Reloaded ${details.results.filter((r) => r.success).length} weapons`) : 'Reloaded',
    )
  }

  const isCloaked = player?.is_cloaked ?? false
  // gameserver State.HasCloakDevice; the server refuses to engage a cloak in battle.
  const hasCloak = fittedModules.some((m) => (m.cloak_strength ?? 0) > 0) ||
    Boolean(shipClassId && getShip(shipClassId)?.inherent_capabilities?.some((c) => c.type === 'integrated_cloak' && c.value > 0))
  const showCloak = isCloaked || hasCloak
  const nearbyPlayers = location?.nearby_players ?? []
  const nearbyPirates = location?.nearby_pirates ?? []
  const nearbyCreatures = nearbyQuery.data?.creatures ?? []
  const nearbyCount = nearbyPlayers.length + nearbyPirates.length + nearbyCreatures.length

  const observed = systemBattle.error ? undefined : systemBattle.data
  const observedSides = !inCombat && observed && !observed.is_participant ? (observed.sides ?? []) : []

  // Docking (including a death/respawn) retains replay access, not the space
  // combat command surface. This also hides any open self-destruct dialog and
  // stale nearby targets immediately when the authoritative location changes.
  const dockedBattleTab = viewedBattleId ? (
    <CombatBattleView key={viewedBattleId} battleId={viewedBattleId} playerId={player?.id} participating={false} />
  ) : (
    <div className={shared.emptyState}>Undock to fight. Past battles are in the History tab.</div>
  )

  return (
    <PanelWithTabs
      title="Combat"
      icon={<Swords size={16} />}
      color="var(--claw-red)"
      tabs={TABS}
      activeTab={tab}
      onTabChange={(id) => setTab(id as TabId)}
      headerRight={
        !isDocked && <div className={styles.headerRight}>
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
      {captured && (
        <div className={styles.notice}>
          <span>
            <Flag size={12} /> {captured.captor_username} captured {captured.former_owner_username}&apos;s {captured.ship_class}
            {captured.prize_poi_name ? ` at ${captured.prize_poi_name}${captured.prize_system_name ? `, ${captured.prize_system_name}` : ''}` : ''}.
            {captured.captor_id === player?.id && ' Claim it from the Crew panel, Prizes tab.'}
          </span>
          <button className={shared.subtleBtn} onClick={() => setCaptured(null)} type="button" title="Dismiss"><X size={12} /></button>
        </div>
      )}
      {tab === 'arena' && <ArenaTab inCombat={inCombat} />}
      {tab === 'history' && <HistoryTab lastBattleId={lastBattleId} username={player?.username} />}
      {tab === 'battle' && isDocked && dockedBattleTab}
      {tab === 'battle' && !isDocked && inCombat && (battle && activeBattleId ? (
        <BattleHud
          battle={battle}
          battleId={activeBattleId}
          log={battleLog}
          canControl={canControl}
          status={phase !== 'ready' ? 'Connection lost · controls disabled' : battleSyncPending ? 'Syncing battle state' : undefined}
          weapons={(modules ?? []).filter((m) => m.type === 'weapon')}
          ammoFor={ammoFor}
          ammoChoice={ammoChoice}
          onPickAmmo={(weaponId, itemId) => setSelectedAmmo((prev) => ({ ...prev, [weaponId]: itemId }))}
          reloadAllCount={reloadAll.length}
          onStance={handleStance}
          onAdvance={handleAdvance}
          onRetreat={handleRetreat}
          onTarget={handleTarget}
          onReload={handleReload}
          onReloadAll={handleReloadAll}
          onSelfDestruct={() => setConfirmSelfDestruct(true)}
        />
      ) : <div className={shared.emptyState}>Fetching battle data...</div>)}
      {tab === 'battle' && !isDocked && !inCombat && <>
      {/* Controls */}
      <div className={styles.controlsRow}>
        {showCloak && (
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
        )}

        <button
          className={styles.selfDestructBtn}
          onClick={() => setConfirmSelfDestruct(true)}
          title={inCombat ? 'Start the in-battle self-destruct countdown' : 'Self-destruct'}
          type="button"
        >
          <Skull size={14} />
          Self-Destruct
        </button>
      </div>

      {observedSides.length > 0 && (
        <div className={styles.reloadCard}>
          <div className={styles.reloadWeaponName}>
            <Swords size={12} /> Battle in this system · {observed?.participants?.length ?? 0} combatants
            {observed?.tick_duration ? ` · ${observed.tick_duration} ticks` : ''}
          </div>
          <div className={styles.sidesRow}>
            {observedSides.map((side) => (
              <div key={side.side_id} className={styles.sideCard}>
                <span className={styles.sideName}>
                  Side {side.side_id}{side.faction_tag ? ` [${side.faction_tag}]` : ''}
                </span>
                <span className={styles.sideCount}>
                  {(observed?.participants ?? []).filter((p) => p.side_id === side.side_id).map((p) => p.username).join(', ') || `${side.player_count} pilots`}
                </span>
                <button className={styles.reloadBtn} onClick={() => setEngageSide(side.side_id)} type="button">
                  <Swords size={12} /> Join
                </button>
              </div>
            ))}
          </div>
          <div className={styles.reloadControls}>
            <button className={styles.reloadBtn} onClick={() => setEngageSide(0)} type="button">Join my faction&apos;s side</button>
            <small className={styles.hint}>You join at the outer zone in fire stance next tick. Joining drops your cloak.</small>
          </div>
          {engageSide !== null && (
            <ConfirmAction
              message={engageSide ? `Join side ${engageSide} of this battle?` : 'Join this battle on your faction side (or a new side)?'}
              icon={<Swords size={14} />}
              onConfirm={() => handleEngage(engageSide)}
              onCancel={() => setEngageSide(null)}
              confirmLabel="Engage"
            />
          )}
        </div>
      )}

      {viewedBattleId && <CombatBattleView key={viewedBattleId} battleId={viewedBattleId} playerId={player?.id} participating={false} />}

      {/* Nearby ships are attack targets; in a battle you can only fight its participants. */}
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
            {nearbyCreatures.map((creature) => {
              const displayName = creature.name || 'Unknown creature'
              const hull =
                creature.max_hull > 0 ? `${creature.hull}/${creature.max_hull} HULL` : ''
              const detail = [creature.species, creature.role, hull].filter(Boolean).join(' · ')

              return (
                <div key={creature.creature_id} className={styles.playerCard}>
                  <div className={styles.playerInfo}>
                    <div className={styles.playerNameRow}>
                      <span className={styles.playerName}>{displayName}</span>
                      <span className={styles.npcTag}>Wildlife</span>
                    </div>
                    {detail && (
                      <span className={styles.playerShip}>
                        <PawPrint size={10} /> {detail}
                      </span>
                    )}
                  </div>

                  <div className={styles.playerActions}>
                    <button
                      className={styles.attackBtn}
                      onClick={() => handleHunt(creature.creature_id)}
                      title={`Hunt ${displayName}`}
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
          <div className={styles.participantHeader}>
            <div className={shared.sectionTitle}>
              <RotateCw size={12} /> Weapon Reload
            </div>
            {reloadAll.length > 0 && (
              <button
                className={styles.reloadBtn}
                onClick={handleReloadAll}
                title={`Reload ${reloadAll.length} weapons in one tick`}
                type="button"
              >
                <RotateCw size={12} /> Reload all
              </button>
            )}
          </div>
          <div className={styles.reloadList}>
            {weapons.map((weapon) => {
              const instanceId = weapon.module_id
              const options = ammoFor(weapon)
              const choice = ammoChoice(weapon)
              return (
                <div key={instanceId} className={styles.reloadCard}>
                  <div className={styles.reloadWeaponName}>
                    {weapon.name}
                    {!weapon.current_ammo && <span className={styles.emptyTag}>Empty</span>}
                    <span className={styles.participantShip}>
                      {' '}{weapon.current_ammo ?? 0}/{weapon.magazine_size}{weapon.loaded_ammo_name ? ` · ${weapon.loaded_ammo_name}` : ''}
                    </span>
                  </div>
                  {options.length === 0 && (
                    <span className={styles.participantShip}>No {weapon.ammo_type ? `${weapon.ammo_type} ` : ''}ammo in cargo</span>
                  )}
                  {options.length > 0 && <div className={styles.reloadControls}>
                    <select
                      className={shared.selectInput}
                      value={choice ?? ''}
                      aria-label={`Ammo for ${weapon.name}`}
                      onChange={(e) =>
                        setSelectedAmmo((prev) => ({
                          ...prev,
                          [instanceId]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select ammo</option>
                      {options.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.item_name} (x{item.quantity})
                        </option>
                      ))}
                    </select>
                    <button
                      className={styles.reloadBtn}
                      onClick={() => handleReload(instanceId, choice)}
                      disabled={!choice}
                      title={`Reload ${weapon.name}`}
                      type="button"
                    >
                      <RotateCw size={12} />
                      Reload
                    </button>
                  </div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      </>}

      {/* Self-destruct confirmation modal */}
      {confirmSelfDestruct && !isDocked && (
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
          {inCombat ? (
            <div className={shared.confirmText}>
              This starts the in-battle self-destruct countdown. It is free and runs on its own each battle tick;
              when it reaches zero your ship is destroyed. Starting it again does not reset it.
            </div>
          ) : (
          <div className={shared.confirmText}>
            This will destroy your ship and all cargo. You will respawn at your
            home base. This action cannot be undone.
            <br /><br />
            <strong>Fee schedule:</strong> First 2 self-destructs per 24h are free.
            3rd costs 200 cr, then doubles (400, 800, 1600...).
            Repeated use restricts trading and gifting.
          </div>
          )}
        </Modal>
      )}
    </PanelWithTabs>
  )
}
