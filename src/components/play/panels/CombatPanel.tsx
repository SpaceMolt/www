'use client'

import { useState, useCallback, useEffect } from 'react'
import type { NotificationShipCaptured } from '@spacemolt/lib'
import { useTranslation } from '@/i18n'
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
  PawPrint,
  Crosshair,
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
  useConnectionPhase,
} from '@/lib/spacemolt'
import { getItem } from '@/data/catalog'
import { CombatBattleView } from './CombatBattleView'
import { ArenaTab } from './combat/ArenaTab'
import { HistoryTab } from './combat/HistoryTab'
import { compatibleAmmo, enemiesOf, formatDamage, reloadPlan } from './combat/combatLogic'
import { usePlay, usePlayUi } from '../PlayProvider'
import { PanelWithTabs, Modal, ConfirmAction, shared, errorMessage } from '../shared'
import styles from './CombatPanel.module.css'

type Stance = 'fire' | 'evade' | 'brace' | 'flee'
type TabId = 'battle' | 'arena' | 'history'

const TABS = [
  { id: 'battle', label: 'Battle', icon: <Swords size={12} /> },
  { id: 'arena', label: 'Arena', icon: <Trophy size={12} /> },
  { id: 'history', label: 'History', icon: <History size={12} /> },
]
const FEED_LINES = 20

const STANCES: { id: Stance; icon: typeof Swords }[] = [
  { id: 'fire', icon: Flame },
  { id: 'evade', icon: Wind },
  { id: 'brace', icon: ShieldHalf },
  { id: 'flee', icon: Rabbit },
]

export function CombatPanel() {
  const { t } = useTranslation()
  const store = useAccountStore()
  const { phase } = useConnectionPhase()
  const { uiStore } = usePlay()
  const mutate = useCommandMutation()
  const player = usePlayer()
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const modules = useModules()
  const cargo = useCargo()
  const battle = usePlayUi((s) => s.battle)
  const inCombat = usePlayUi((s) => s.inCombat)
  const battleSyncPending = usePlayUi((s) => s.battleSyncPending)
  const activeBattleId = usePlayUi((s) => s.activeBattleId)
  const lastBattleId = usePlayUi((s) => s.lastBattleId)
  const viewedBattleId = activeBattleId ?? lastBattleId
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
  const [feed, setFeed] = useState<string[]>([])
  const [captured, setCaptured] = useState<NotificationShipCaptured | null>(null)

  useEffect(() => {
    setFeed([])
  }, [activeBattleId])

  useEffect(() => {
    const add = (line: string) => setFeed((lines) => [...lines, line].slice(-FEED_LINES))
    const offDamage = store.account.on('battle_damage', (d) => add(formatDamage(d)))
    const offJoined = store.account.on('battle_joined', (j) => add(`${j.username} joined side ${j.side_id}`))
    const offCaptured = store.account.on('ship_captured', setCaptured)
    return () => {
      offDamage()
      offJoined()
      offCaptured()
    }
  }, [store])

  useEffect(() => {
    if (isDocked) setConfirmSelfDestruct(false)
  }, [isDocked])

  const reportError = useCallback(
    (err: unknown) => uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) }),
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

  const handleHunt = useCallback(
    (id: string) => {
      mutate((c) => c.spacemolt.hunt({ id }), { label: 'hunt' }).catch(reportError)
    },
    [mutate, reportError],
  )

  const handleCloak = useCallback(() => {
    mutate((c) => c.spacemolt.cloak({ enable: !player?.is_cloaked }), { label: 'cloak' }).catch(reportError)
  }, [mutate, reportError, player?.is_cloaked])

  // In battle, self-destruct is a free countdown query; the standalone command
  // is immediate, has an escalating fee, and the server refuses it mid-battle.
  const handleSelfDestruct = useCallback(() => {
    setConfirmSelfDestruct(false)
    if (inCombat) {
      store.account.commands.spacemolt_battle
        .self_destruct()
        .then(({ structuredContent: r }) => uiStore.dispatch({ type: 'event', kind: 'warning', text: r?.message ?? 'Self-destruct countdown requested' }))
        .catch(reportError)
      return
    }
    mutate((c) => c.spacemolt.self_destruct(), { label: 'self_destruct' }).catch(reportError)
  }, [inCombat, store, uiStore, mutate, reportError])

  const handleTarget = useCallback(
    (id: string) => {
      store.account.commands.spacemolt_battle
        .target({ id })
        .then(({ structuredContent: r }) => uiStore.dispatch({ type: 'event', kind: 'info', text: r?.message ?? 'Target set' }))
        .catch(reportError)
    },
    [store, uiStore, reportError],
  )

  const handleEngage = useCallback(
    (sideId: number) => {
      setEngageSide(null)
      store.account.commands.spacemolt_battle
        .engage(sideId ? { side_id: sideId } : {})
        .then(({ structuredContent: r }) => {
          uiStore.dispatch({ type: 'event', kind: 'success', text: r?.message ?? 'Joining the battle' })
          systemBattle.refetch()
        })
        .catch(reportError)
    },
    [store, uiStore, reportError, systemBattle.refetch],
  )

  const handleRefresh = useCallback(() => {
    store.account.refresh().catch(reportError)
    nearbyQuery.refetch()
  }, [store, reportError, nearbyQuery.refetch])

  // Tactical controls — battle stance/movement resolve synchronously
  // (query commands), not queued to the next tick, so they bypass mutate().
  const handleStance = useCallback(
    (stance: Stance) => {
      if (store.getPhase() !== 'ready' || !uiStore.getState().inCombat || uiStore.getState().battleSyncPending) return
      store.account.commands.spacemolt_battle.stance({ id: stance }).catch(reportError)
    },
    [store, uiStore, reportError],
  )

  const handleAdvance = useCallback(() => {
    if (store.getPhase() !== 'ready' || !uiStore.getState().inCombat || uiStore.getState().battleSyncPending) return
    store.account.commands.spacemolt_battle.advance().catch(reportError)
  }, [store, uiStore, reportError])

  const handleRetreat = useCallback(() => {
    if (store.getPhase() !== 'ready' || !uiStore.getState().inCombat || uiStore.getState().battleSyncPending) return
    store.account.commands.spacemolt_battle.retreat().catch(reportError)
  }, [store, uiStore, reportError])

  const handleReload = useCallback(
    (instanceId: string, ammoId?: string) => {
      if (!ammoId) return
      mutate((c) => c.spacemolt_battle.reload({ id: instanceId, target: ammoId }), { label: 'reload' }).catch(
        reportError,
      )
    },
    [mutate, reportError],
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
    mutate((c) => c.spacemolt_battle.reload({ weapons: entries }), { label: 'reload' })
      .then((result) => {
        const details = result.delta.details
        const text = details && 'summary' in details ? (details.message ?? `Reloaded ${details.results.filter((r) => r.success).length} weapons`) : 'Reloaded'
        uiStore.dispatch({ type: 'event', kind: 'success', text })
      })
      .catch(reportError)
  }

  const isCloaked = player?.is_cloaked ?? false
  const nearbyPlayers = location?.nearby_players ?? []
  const nearbyPirates = location?.nearby_pirates ?? []
  const nearbyCreatures = nearbyQuery.data?.creatures ?? []
  const nearbyCount = nearbyPlayers.length + nearbyPirates.length + nearbyCreatures.length
  const yourStance = battle?.your_stance
  const currentTarget = battle?.participants.find((p) => p.player_id === battle.your_target_id)

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
      {tab === 'battle' && !isDocked && <>
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
          title={inCombat ? 'Start the in-battle self-destruct countdown' : 'Self-destruct'}
          type="button"
        >
          <Skull size={14} />
          Self-Destruct
        </button>
      </div>

      {/* Authenticated commands are independent of the visualizer's historical playhead. */}
      {inCombat && (
        <fieldset className={styles.commandDeck} disabled={!canControl}>
          <legend>{t('battles.playCombat.liveControls')}</legend>
          <div className={styles.commandPosture}>
            <Target size={12} aria-hidden />
            <span>{battleSyncPending ? t('battles.playCombat.awaitingState') : <>{battle?.your_zone || t('battles.playCombat.awaitingState')}{yourStance ? ` · ${yourStance}` : ''}</>}</span>
            {phase !== 'ready' && <span>{t('battles.playCombat.disconnected')}</span>}
          </div>
          <div className={styles.stanceRow}>
            {STANCES.map(({ id, icon: Icon }) => (
              <button key={id} className={`${styles.stanceBtn} ${yourStance === id ? styles.stanceActive : ''}`} onClick={() => handleStance(id)} aria-pressed={yourStance === id} title={t(`battles.playCombat.stanceHint.${id}`)} type="button">
                <Icon size={12} aria-hidden /> {t(`battles.playCombat.stance.${id}`)}
              </button>
            ))}
          </div>
          <div className={styles.tacticalRow}>
            <button className={styles.tacticalBtn} onClick={handleAdvance} type="button"><ChevronUp size={14} aria-hidden /> {t('battles.playCombat.advance')}</button>
            <button className={styles.tacticalBtn} onClick={handleRetreat} type="button"><ChevronDown size={14} aria-hidden /> {t('battles.playCombat.retreat')}</button>
          </div>
          <small>{t('battles.playCombat.controlsHint')}</small>
        </fieldset>
      )}

      {inCombat && (
        <div>
          <div className={shared.sectionTitle}>
            <Crosshair size={12} /> Target: {currentTarget ? currentTarget.username : 'auto'}
          </div>
          <div className={styles.controlsRow}>
            {battle && enemiesOf(battle).map((p) => (
              <button
                key={p.player_id}
                className={`${styles.stanceBtn} ${p.player_id === battle.your_target_id ? styles.stanceActive : ''}`}
                onClick={() => handleTarget(p.player_id)}
                disabled={!canControl}
                aria-pressed={p.player_id === battle.your_target_id}
                title={`Focus fire on ${p.username}`}
                type="button"
              >
                <Crosshair size={11} aria-hidden /> {p.username} {p.hull_pct ?? 0}%
              </button>
            ))}
          </div>
        </div>
      )}

      {inCombat && feed.length > 0 && (
        <div>
          <div className={shared.sectionTitle}>Damage feed</div>
          <ol className={styles.feed}>
            {feed.map((line, i) => <li key={i}>{line}</li>)}
          </ol>
        </div>
      )}

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

      {viewedBattleId && <CombatBattleView key={viewedBattleId} battleId={viewedBattleId} playerId={player?.id} participating={inCombat} />}

      {/* Keep the authoritative roster available even if public replay data is delayed. */}
      {inCombat && (
        <details className={styles.battleSection}>
          <summary className={styles.rosterSummary}>{t('battles.playCombat.currentRoster')}</summary>
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
                        {p.player_id === battle.your_target_id && ' · your target'}
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

        </details>
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
            <button
              className={styles.reloadBtn}
              onClick={handleReloadAll}
              disabled={reloadAll.length === 0}
              title={reloadAll.length ? `Reload ${reloadAll.length} weapons in one tick` : 'Every magazine is full or has no ammo in cargo'}
              type="button"
            >
              <RotateCw size={12} /> Reload all
            </button>
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
                    <span className={styles.participantShip}>
                      {' '}{weapon.current_ammo ?? 0}/{weapon.magazine_size}{weapon.loaded_ammo_name ? ` · ${weapon.loaded_ammo_name}` : ''}
                    </span>
                  </div>
                  <div className={styles.reloadControls}>
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
                      <option value="">{options.length ? 'Select ammo' : 'No compatible ammo in cargo'}</option>
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
                  </div>
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
