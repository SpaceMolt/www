'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { Users, Flag, Shield, UserPlus, UserMinus, Swords, RefreshCw, Radar, DoorOpen, Trash2, Plus, Eye, Crown, X, Handshake, LogIn, Satellite, Undo2, KeyRound, Settings2, Warehouse, Target, Landmark } from 'lucide-react'
import type {
  Commands,
  FactionGetInvitesResponse,
  FactionInfoResponse,
  FactionListResponse,
  FactionRoomsResponse,
  FactionVisitRoomResponse,
  MutationResult,
} from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, usePlayer } from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { ActionButton } from '../ActionButton'
import { ConfirmAction, Panel, Section, errorMessage, shared } from '../shared'
import styles from './FactionPanel.module.css'
import { MobileBaseSection } from './faction/MobileBaseSection'
import { IntelSection } from './faction/IntelSection'
import { MembersSection, Pager } from './faction/MembersSection'
import { RolesSection } from './faction/RolesSection'
import { EditFactionSection } from './faction/EditFactionSection'
import { GaragesSection } from './faction/GaragesSection'
import { MissionsSection } from './faction/MissionsSection'
import { TreasurySection } from './faction/TreasurySection'
import { FACTION_PAGE_SIZE } from './faction/factionAdmin'

// Types derived from the generated command response shapes.
type FactionListEntry = FactionListResponse['factions'][number]
type FactionInvite = FactionGetInvitesResponse['invites'][number]
type FactionRoom = FactionRoomsResponse['rooms'][number]
type FactionRoomDetail = FactionVisitRoomResponse
type FactionWar = NonNullable<FactionInfoResponse['wars']>[number]
type PeaceProposal = NonNullable<FactionInfoResponse['peace_proposals']>[number]
type FactionRelation = NonNullable<FactionInfoResponse['allies']>[number]

// Panel state — single reducer instead of 27 useState hooks
interface PanelState {
  factionInfo: FactionInfoResponse | null
  loadingInfo: boolean
  factionList: FactionListEntry[]
  listOffset: number
  listTotal: number
  membersOffset: number
  /** Which destructive action is awaiting confirmation: 'leave', 'war', 'ally:<id>', 'room:<id>'. */
  confirming: string | null
  listLoaded: boolean
  loadingList: boolean
  createName: string
  createTag: string
  creating: boolean
  inviteTarget: string
  inviting: boolean
  pendingInvites: FactionInvite[]
  invitesLoaded: boolean
  loadingInvites: boolean
  joiningFaction: string | null
  decliningInvite: string | null
  diplomacyTarget: string
  warReason: string
  peaceTerms: string
  diplomacyLoading: boolean
  rooms: FactionRoom[]
  maxRooms: number
  roomsLoaded: boolean
  loadingRooms: boolean
  selectedRoom: FactionRoomDetail | null
  loadingRoom: boolean
  roomFormName: string
  roomFormDesc: string
  roomFormAccess: string
  creatingRoom: boolean
  deletingRoomId: string | null
}

const INITIAL_STATE: PanelState = {
  factionInfo: null, loadingInfo: false,
  factionList: [], listOffset: 0, listTotal: 0, membersOffset: 0, confirming: null, listLoaded: false, loadingList: false,
  createName: '', createTag: '', creating: false,
  inviteTarget: '', inviting: false,
  pendingInvites: [], invitesLoaded: false, loadingInvites: false,
  joiningFaction: null, decliningInvite: null,
  diplomacyTarget: '', warReason: '', peaceTerms: '', diplomacyLoading: false,
  rooms: [], maxRooms: 5, roomsLoaded: false, loadingRooms: false,
  selectedRoom: null, loadingRoom: false,
  roomFormName: '', roomFormDesc: '', roomFormAccess: 'members',
  creatingRoom: false, deletingRoomId: null,
}

type PanelAction = Partial<PanelState> | ((prev: PanelState) => Partial<PanelState>)

function merge(prev: PanelState, action: PanelAction): PanelState {
  const next = typeof action === 'function' ? action(prev) : action
  return { ...prev, ...next }
}

// FactionPanel
const FACTION_PUSHES = [
  'faction_mobile_base_update', 'faction_alliance_proposal', 'faction_alliance_formed', 'faction_alliance_broken',
  'faction_peace_proposal', 'faction_peace_accepted', 'faction_war_declared', 'faction_promote',
] as const

export function FactionPanel() {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const player = usePlayer()
  const [s, set] = useReducer(merge, INITIAL_STATE)

  const hasFaction = Boolean(player?.faction_id)
  const playerId = player?.id

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorMessage(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    },
    [uiStore],
  )

  const reportDone = useCallback((text: string) => uiStore.dispatch({ type: 'toast', kind: 'success', text }), [uiStore])

  const loadFactionInfo = useCallback(async () => {
    if (!hasFaction) return
    set({ loadingInfo: true })
    try {
      const res = await store.account.commands.spacemolt_faction.info({ limit: FACTION_PAGE_SIZE, offset: s.membersOffset })
      set({ factionInfo: res.structuredContent ?? null })
    } catch (err) {
      reportError(err)
    } finally {
      set({ loadingInfo: false })
    }
  }, [store, reportError, hasFaction, s.membersOffset])

  useEffect(() => {
    if (hasFaction) {
      loadFactionInfo()
    } else {
      set({ factionInfo: null })
    }
  }, [loadFactionInfo, hasFaction])

  // Other players' diplomacy and mobile-base moves change faction_info. The server sends no push
  // when a member joins or leaves, so the roster also reloads when the panel opens (mount) and
  // when the browser tab becomes visible again.
  useEffect(() => {
    if (!hasFaction) return
    const offs = FACTION_PUSHES.map((push) => store.account.on(push, () => { void loadFactionInfo() }))
    const onVisible = () => { if (document.visibilityState === 'visible') void loadFactionInfo() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      offs.forEach((off) => off())
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [store, loadFactionInfo, hasFaction])

  const handleCreateFaction = useCallback(async () => {
    if (!s.createName.trim() || !s.createTag.trim()) return
    set({ creating: true })
    try {
      await mutate((c) => c.spacemolt_faction.create({ id: s.createTag.trim().toUpperCase(), text: s.createName.trim() }), {
        label: 'create_faction',
      })
      set({ createName: '', createTag: '' })
    } catch (err) {
      reportError(err)
    } finally {
      set({ creating: false })
    }
  }, [mutate, reportError, s.createName, s.createTag])

  const handleLeaveFaction = useCallback(async () => {
    set({ confirming: null })
    try {
      await mutate((c) => c.spacemolt_faction.leave(), { label: 'leave_faction' })
      set({ factionInfo: null, rooms: [], roomsLoaded: false, membersOffset: 0 })
    } catch (err) {
      reportError(err)
    }
  }, [mutate, reportError])

  const handleInvite = useCallback(async () => {
    if (!s.inviteTarget.trim()) return
    set({ inviting: true })
    try {
      await mutate((c) => c.spacemolt_faction.invite({ id: s.inviteTarget.trim() }), { label: 'faction_invite' })
      reportDone(`Invited ${s.inviteTarget.trim()}`)
      set({ inviteTarget: '' })
    } catch (err) {
      reportError(err)
    } finally {
      set({ inviting: false })
    }
  }, [mutate, reportError, reportDone, s.inviteTarget])

  const handleWithdrawInvite = useCallback(async () => {
    if (!s.inviteTarget.trim()) return
    set({ inviting: true })
    try {
      await mutate((c) => c.spacemolt_faction.withdraw_invite({ id: s.inviteTarget.trim() }), { label: 'faction_withdraw_invite' })
      set({ inviteTarget: '' })
    } catch (err) {
      reportError(err)
    } finally {
      set({ inviting: false })
    }
  }, [mutate, reportError, s.inviteTarget])

  /** One-shot diplomacy action by faction id, then refresh. `done` is the success toast; `reset` clears form fields on success. */
  const runDiplomacy = useCallback(async <T,>(
    label: string,
    action: (c: Commands) => Promise<MutationResult<T>>,
    done?: string | ((result: MutationResult<T>) => string),
    { reset = {}, closeConfirm = true }: { reset?: Partial<PanelState>; closeConfirm?: boolean } = {},
  ) => {
    set({ diplomacyLoading: true, ...(closeConfirm ? { confirming: null } : {}) })
    try {
      const result = await mutate(action, { label })
      const text = typeof done === 'function' ? done(result) : done
      if (text) reportDone(text)
      set(reset)
      await loadFactionInfo()
    } catch (err) {
      reportError(err)
    } finally {
      set({ diplomacyLoading: false })
    }
  }, [mutate, reportError, reportDone, loadFactionInfo])

  const handleLoadInvites = useCallback(async () => {
    set({ loadingInvites: true })
    try {
      const res = await store.account.commands.spacemolt_faction.get_invites()
      set({ pendingInvites: res.structuredContent?.invites ?? [], invitesLoaded: true })
    } catch (err) {
      reportError(err)
    } finally {
      set({ loadingInvites: false })
    }
  }, [store, reportError])

  const handleAcceptInvite = useCallback(async (factionId: string) => {
    set({ joiningFaction: factionId })
    try {
      await mutate((c) => c.spacemolt_faction.accept_invite({ id: factionId }), { label: 'faction_accept_invite' })
      set({ pendingInvites: [], invitesLoaded: false })
    } catch (err) {
      reportError(err)
    } finally {
      set({ joiningFaction: null })
    }
  }, [mutate, reportError])

  const handleDeclineInvite = useCallback(async (factionId: string) => {
    set({ decliningInvite: factionId })
    try {
      await store.account.commands.spacemolt_faction.decline_invite({ id: factionId })
      set(prev => ({ pendingInvites: prev.pendingInvites.filter(i => i.faction_id !== factionId) }))
    } catch (err) {
      reportError(err)
    } finally {
      set({ decliningInvite: null })
    }
  }, [store, reportError])

  const handleLoadFactions = useCallback(async (offset = 0) => {
    set({ loadingList: true })
    try {
      const res = await store.account.commands.spacemolt_faction.list({ limit: FACTION_PAGE_SIZE, offset })
      set({
        factionList: res.structuredContent?.factions ?? [],
        listOffset: offset,
        listTotal: res.structuredContent?.total_count ?? 0,
        listLoaded: true,
      })
    } catch (err) {
      reportError(err)
    } finally {
      set({ loadingList: false })
    }
  }, [store, reportError])

  const handleJoinFaction = useCallback(async (factionId: string) => {
    set({ joiningFaction: factionId })
    try {
      await mutate((c) => c.spacemolt_faction.join({ id: factionId }), { label: 'join_faction' })
      set({ factionList: [], listLoaded: false })
    } catch (err) {
      reportError(err)
    } finally {
      set({ joiningFaction: null })
    }
  }, [mutate, reportError])

  const handleProposeAlly = useCallback(() => {
    if (!s.diplomacyTarget) return
    return runDiplomacy('propose_ally', (c) => c.spacemolt_faction.propose_ally({ id: s.diplomacyTarget }), 'Alliance proposed', { reset: { diplomacyTarget: '' }, closeConfirm: false })
  }, [runDiplomacy, s.diplomacyTarget])

  const handleSetEnemy = useCallback(() => {
    if (!s.diplomacyTarget) return
    return runDiplomacy('set_enemy', (c) => c.spacemolt_faction.set_enemy({ id: s.diplomacyTarget }), 'Marked as enemy', { reset: { diplomacyTarget: '' }, closeConfirm: false })
  }, [runDiplomacy, s.diplomacyTarget])

  const handleDeclareWar = useCallback(() => {
    if (!s.diplomacyTarget) return
    return runDiplomacy(
      'declare_war',
      (c) => c.spacemolt_faction.declare_war({ id: s.diplomacyTarget, text: s.warReason || undefined }),
      (r) => r.delta.details?.message ?? 'War declared',
      { reset: { diplomacyTarget: '', warReason: '' } },
    )
  }, [runDiplomacy, s.diplomacyTarget, s.warReason])

  const handleProposePeace = useCallback(() => {
    if (!s.diplomacyTarget) return
    return runDiplomacy(
      'propose_peace',
      (c) => c.spacemolt_faction.propose_peace({ id: s.diplomacyTarget, text: s.peaceTerms || undefined }),
      'Peace proposed',
      { reset: { diplomacyTarget: '', peaceTerms: '' }, closeConfirm: false },
    )
  }, [runDiplomacy, s.diplomacyTarget, s.peaceTerms])

  const handleAcceptPeace = useCallback(async (factionId: string) => {
    set({ diplomacyLoading: true })
    try {
      await mutate((c) => c.spacemolt_faction.accept_peace({ id: factionId }), { label: 'accept_peace' })
      await loadFactionInfo()
    } catch (err) {
      reportError(err)
    } finally {
      set({ diplomacyLoading: false })
    }
  }, [mutate, reportError, loadFactionInfo])

  const handleLoadRooms = useCallback(async () => {
    set({ loadingRooms: true })
    try {
      const res = await store.account.commands.spacemolt_faction.rooms()
      set({
        rooms: res.structuredContent?.rooms ?? [],
        maxRooms: res.structuredContent?.max_rooms ?? 5,
        roomsLoaded: true,
      })
    } catch (err) {
      reportError(err)
    } finally {
      set({ loadingRooms: false })
    }
  }, [store, reportError])

  const handleVisitRoom = useCallback(async (roomId: string) => {
    set({ loadingRoom: true, selectedRoom: null })
    try {
      const res = await store.account.commands.spacemolt_faction.visit_room({ id: roomId })
      set({ selectedRoom: res.structuredContent ?? null })
    } catch (err) {
      reportError(err)
    } finally {
      set({ loadingRoom: false })
    }
  }, [store, reportError])

  const handleCreateRoom = useCallback(async () => {
    if (!s.roomFormName.trim()) return
    set({ creatingRoom: true })
    try {
      await store.account.commands.spacemolt_faction_admin.write_room({
        name: s.roomFormName.trim(),
        description: s.roomFormDesc.trim(),
        access: s.roomFormAccess as 'public' | 'members' | 'officers',
      })
      set({ roomFormName: '', roomFormDesc: '', roomFormAccess: 'members' })
      await handleLoadRooms()
    } catch (err) {
      reportError(err)
    } finally {
      set({ creatingRoom: false })
    }
  }, [store, reportError, s.roomFormName, s.roomFormDesc, s.roomFormAccess, handleLoadRooms])

  const handleDeleteRoom = useCallback(async (roomId: string) => {
    set({ deletingRoomId: roomId, confirming: null })
    try {
      await store.account.commands.spacemolt_faction.delete_room({ id: roomId })
      set(prev => ({
        rooms: prev.rooms.filter(r => r.room_id !== roomId),
        selectedRoom: prev.selectedRoom?.room_id === roomId ? null : prev.selectedRoom,
      }))
    } catch (err) {
      reportError(err)
    } finally {
      set({ deletingRoomId: null })
    }
  }, [store, reportError])

  return (
    <Panel
      title="Faction"
      icon={<Users size={16} />}
      headerRight={
        hasFaction ? (
          <button
            className={shared.refreshBtn}
            onClick={loadFactionInfo}
            title="Refresh faction info"
            disabled={s.loadingInfo}
          >
            <RefreshCw size={14} />
          </button>
        ) : undefined
      }
    >
      {hasFaction ? (
        <>
          {s.loadingInfo && !s.factionInfo && (
            <div className={styles.loading}>
              <span className={shared.spinner} />
              Loading faction info...
            </div>
          )}

          {s.factionInfo && (
            <div className={styles.factionCard}>
              <div className={styles.factionHeader}>
                <div className={styles.factionName}>{s.factionInfo.name}</div>
                <span className={styles.factionTag}>[{s.factionInfo.tag}]</span>
              </div>
              {s.factionInfo.description && (
                <div className={styles.factionDescription}>{s.factionInfo.description}</div>
              )}
              <div className={styles.factionMeta}>
                <span className={styles.metaTag}>
                  <Users size={10} />
                  Members: <span className={styles.metaValue}>{s.factionInfo.member_count}</span>
                </span>
                <span className={styles.metaTag}>
                  <Crown size={10} />
                  Leader: <span className={styles.metaValue}>{s.factionInfo.leader_username}</span>
                </span>
                {typeof s.factionInfo.treasury === 'number' && (
                  <span className={styles.metaTag}>
                    Treasury: <span className={styles.metaValue}>{s.factionInfo.treasury.toLocaleString()} cr</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {s.factionInfo && (s.factionInfo.mobile_base || s.factionInfo.mobile_base_commission) && (
            <>
              <div className={styles.divider} />
              <Section title="Mobile Base" icon={<Satellite size={12} />}>
                <MobileBaseSection info={s.factionInfo} playerId={playerId} onChanged={loadFactionInfo} />
              </Section>
            </>
          )}

          {s.factionInfo && (s.factionInfo.allies?.length || s.factionInfo.enemies?.length) ? (
            <>
              <div className={styles.divider} />
              <div className={styles.relationsRow}>
                {s.factionInfo.allies && s.factionInfo.allies.length > 0 && (
                  <div className={styles.relationGroup}>
                    <div className={styles.relationLabel}>
                      <Shield size={10} /> Allies
                    </div>
                    {s.factionInfo.allies.map((ally: FactionRelation) => (
                      s.confirming === `ally:${ally.id}` ? (
                        <ConfirmAction
                          key={ally.id}
                          message={`End alliance with [${ally.tag}]?`}
                          onConfirm={() => runDiplomacy('remove_ally', (c) => c.spacemolt_faction.remove_ally({ id: ally.id }))}
                          onCancel={() => set({ confirming: null })}
                        />
                      ) : (
                        <span key={ally.id} className={styles.allyBadge}>
                          [{ally.tag}] {ally.name}
                          <button className={styles.badgeBtn} onClick={() => set({ confirming: `ally:${ally.id}` })} disabled={s.diplomacyLoading} title="End alliance" aria-label={`End alliance with ${ally.name}`} type="button">
                            <X size={9} />
                          </button>
                        </span>
                      )
                    ))}
                  </div>
                )}
                {s.factionInfo.enemies && s.factionInfo.enemies.length > 0 && (
                  <div className={styles.relationGroup}>
                    <div className={styles.relationLabel}>
                      <Swords size={10} /> Enemies
                    </div>
                    {s.factionInfo.enemies.map((enemy: FactionRelation) => (
                      <span key={enemy.id} className={styles.enemyBadge}>
                        [{enemy.tag}] {enemy.name}
                        <button className={styles.badgeBtn} onClick={() => runDiplomacy('remove_enemy', (c) => c.spacemolt_faction.remove_enemy({ id: enemy.id }))} disabled={s.diplomacyLoading} title="Return to neutral" aria-label={`Return ${enemy.name} to neutral`} type="button">
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {s.factionInfo?.alliance_proposals && s.factionInfo.alliance_proposals.length > 0 && (
            <>
              <div className={styles.divider} />
              <Section title="Alliance Proposals" icon={<Shield size={12} />}>
                <div className={styles.proposalList}>
                  {s.factionInfo.alliance_proposals.map((p) => (
                    <div key={p.from_faction_id} className={styles.proposalItem}>
                      <div className={styles.proposalInfo}>
                        <span className={styles.proposalFrom}>From: [{p.from_faction_tag}] {p.from_faction_name}</span>
                      </div>
                      <ActionButton
                        label="Accept"
                        icon={<Shield size={12} />}
                        onClick={() => runDiplomacy('accept_ally', (c) => c.spacemolt_faction.accept_ally({ id: p.from_faction_id }), `Allied with ${p.from_faction_name}`)}
                        loading={s.diplomacyLoading}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {s.factionInfo?.wars && s.factionInfo.wars.length > 0 && (
            <>
              <div className={styles.divider} />
              <Section title="Active Wars" icon={<Swords size={12} />}>
                <div className={styles.warList}>
                  {s.factionInfo.wars.map((war: FactionWar) => (
                    <div key={war.target_faction_id} className={styles.warItem}>
                      <div className={styles.warHeader}>
                        <span className={styles.warTarget}>
                          vs [{war.target_faction_tag || '??'}] {war.target_faction_name}
                        </span>
                      </div>
                      <div className={styles.warStats}>
                        <span className={styles.warKills}>
                          Kills: <span className={styles.metaValue}>{war.our_kills ?? 0}</span>
                        </span>
                        <span className={styles.warKills}>
                          Losses: <span className={styles.warLosses}>{war.their_kills ?? 0}</span>
                        </span>
                        {war.reason && (
                          <span className={styles.warReason}>Reason: {war.reason}</span>
                        )}
                      </div>
                      {s.confirming === `peace:${war.target_faction_id}` ? (
                        <>
                          <input
                            className={styles.input}
                            type="text"
                            placeholder="Terms of peace (optional)"
                            aria-label="Peace terms"
                            value={s.peaceTerms}
                            onChange={(e) => set({ peaceTerms: e.target.value })}
                          />
                          <ConfirmAction
                            message={`Propose peace to ${war.target_faction_name}?`}
                            variant="confirm"
                            confirmLabel="Propose"
                            confirmDisabled={s.diplomacyLoading}
                            onConfirm={() => runDiplomacy('propose_peace', (c) => c.spacemolt_faction.propose_peace({ id: war.target_faction_id, text: s.peaceTerms || undefined }), `Peace proposed to ${war.target_faction_name}`)}
                            onCancel={() => set({ confirming: null })}
                          />
                        </>
                      ) : (
                        <ActionButton
                          label="Propose Peace"
                          icon={<Handshake size={12} />}
                          onClick={() => set({ confirming: `peace:${war.target_faction_id}`, peaceTerms: '' })}
                          size="sm"
                          variant="secondary"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {s.factionInfo?.peace_proposals && s.factionInfo.peace_proposals.length > 0 && (
            <>
              <div className={styles.divider} />
              <Section title="Peace Proposals" icon={<Handshake size={12} />}>
                <div className={styles.proposalList}>
                  {s.factionInfo.peace_proposals.map((proposal: PeaceProposal) => (
                    <div key={proposal.from_faction_id} className={styles.proposalItem}>
                      <div className={styles.proposalInfo}>
                        <span className={styles.proposalFrom}>From: {proposal.from_faction_name}</span>
                        {proposal.terms && (
                          <span className={styles.proposalTerms}>Terms: {proposal.terms}</span>
                        )}
                      </div>
                      <ActionButton
                        label="Accept"
                        icon={<Handshake size={12} />}
                        onClick={() => handleAcceptPeace(proposal.from_faction_id)}
                        disabled={s.diplomacyLoading}
                        loading={s.diplomacyLoading}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          <div className={styles.divider} />

          {s.factionInfo?.members && s.factionInfo.members.length > 0 && (
            <Section title="Members" icon={<Users size={12} />}>
              <MembersSection
                info={s.factionInfo}
                playerId={playerId}
                onPage={(offset) => set({ membersOffset: offset })}
                onChanged={loadFactionInfo}
              />
            </Section>
          )}

          <div className={styles.divider} />

          <div>
            <div className={shared.sectionTitle}>
              <span className={shared.sectionIcon}><UserPlus size={12} /></span>
              Invite Player
            </div>
            <div className={styles.inviteRow}>
              <input
                className={styles.inviteInput}
                type="text"
                placeholder="Player name"
                value={s.inviteTarget}
                onChange={(e) => set({ inviteTarget: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
              <ActionButton
                label="Invite"
                icon={<UserPlus size={12} />}
                onClick={handleInvite}
                disabled={!s.inviteTarget.trim() || s.inviting}
                loading={s.inviting}
                size="sm"
              />
              <ActionButton
                label="Withdraw"
                icon={<Undo2 size={12} />}
                onClick={handleWithdrawInvite}
                disabled={!s.inviteTarget.trim() || s.inviting}
                variant="secondary"
                size="sm"
              />
            </div>
          </div>

          <div className={styles.divider} />

          <Section title="Diplomacy" icon={<Shield size={12} />} defaultOpen={false}>
            <div className={styles.diplomacySection}>
              <div className={styles.field}>
                <label className={styles.label}>Target Faction</label>
                {s.factionList.length > 0 ? (
                  <select className={styles.input} aria-label="Target faction" value={s.diplomacyTarget} onChange={(e) => set({ diplomacyTarget: e.target.value })}>
                    <option value="">Pick a faction</option>
                    {s.factionList.filter((f) => f.id !== player?.faction_id).map((f) => <option key={f.id} value={f.id}>[{f.tag}] {f.name}</option>)}
                  </select>
                ) : (
                  <span className={styles.label}>Open the faction browser below and pick a faction.</span>
                )}
              </div>
              <div className={styles.diplomacyRow}>
                <ActionButton
                  label="Propose Ally"
                  icon={<Shield size={12} />}
                  onClick={handleProposeAlly}
                  disabled={!s.diplomacyTarget || s.diplomacyLoading}
                  loading={s.diplomacyLoading}
                  size="sm"
                />
                <ActionButton
                  label="Set Enemy"
                  icon={<Swords size={12} />}
                  onClick={handleSetEnemy}
                  disabled={!s.diplomacyTarget || s.diplomacyLoading}
                  variant="danger"
                  size="sm"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>War Reason</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Reason for declaration..."
                  value={s.warReason}
                  onChange={(e) => set({ warReason: e.target.value })}
                />
              </div>
              {s.confirming === 'war' ? (
                <ConfirmAction
                  message="Declare war? Members of both factions can attack each other anywhere."
                  onConfirm={handleDeclareWar}
                  onCancel={() => set({ confirming: null })}
                />
              ) : (
                <ActionButton
                  label="Declare War"
                  icon={<Flag size={12} />}
                  onClick={() => set({ confirming: 'war' })}
                  disabled={!s.diplomacyTarget || s.diplomacyLoading}
                  loading={s.diplomacyLoading}
                  variant="danger"
                  size="sm"
                />
              )}
              <div className={styles.divider} />
              <div className={styles.field}>
                <label className={styles.label}>Peace Terms</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Terms of peace..."
                  value={s.peaceTerms}
                  onChange={(e) => set({ peaceTerms: e.target.value })}
                />
              </div>
              <ActionButton
                label="Propose Peace"
                icon={<Handshake size={12} />}
                onClick={handleProposePeace}
                disabled={!s.diplomacyTarget || s.diplomacyLoading}
                loading={s.diplomacyLoading}
                variant="secondary"
                size="sm"
              />
            </div>
          </Section>

          <div className={styles.divider} />

          <Section title="Intel" icon={<Radar size={12} />} defaultOpen={false}>
            <IntelSection allies={s.factionInfo?.allies ?? []} />
          </Section>

          <div className={styles.divider} />

          {s.factionInfo && (
            <>
              <Section title="Roles" icon={<KeyRound size={12} />} defaultOpen={false}>
                <RolesSection info={s.factionInfo} onChanged={loadFactionInfo} />
              </Section>
              <div className={styles.divider} />
              <Section title="Faction Settings" icon={<Settings2 size={12} />} defaultOpen={false}>
                <EditFactionSection key={s.factionInfo.id} info={s.factionInfo} onChanged={loadFactionInfo} />
              </Section>
              <div className={styles.divider} />
              <Section title="Treasury & Licenses" icon={<Landmark size={12} />} defaultOpen={false}>
                <TreasurySection info={s.factionInfo} onChanged={loadFactionInfo} />
              </Section>
              <div className={styles.divider} />
            </>
          )}

          <Section title="Garages" icon={<Warehouse size={12} />} defaultOpen={false}>
            <GaragesSection />
          </Section>

          <div className={styles.divider} />

          <Section title="Faction Missions" icon={<Target size={12} />} defaultOpen={false}>
            <MissionsSection />
          </Section>

          <div className={styles.divider} />

          <Section title="Rooms" icon={<DoorOpen size={12} />} defaultOpen={false}>
            <div className={styles.roomSection}>
              {!s.roomsLoaded && !s.loadingRooms && (
                <ActionButton
                  label="Load Rooms"
                  icon={<DoorOpen size={12} />}
                  onClick={handleLoadRooms}
                  variant="secondary"
                  size="sm"
                />
              )}

              {s.loadingRooms && (
                <div className={styles.loading}>
                  <span className={shared.spinner} />
                  Loading rooms...
                </div>
              )}

              {s.roomsLoaded && s.rooms.length === 0 && (
                <div className={shared.emptyState}>
                  No faction rooms yet.
                </div>
              )}

              {s.rooms.length > 0 && (
                <div className={styles.roomList}>
                  {s.rooms.map((room) => (
                    <div key={room.room_id} className={styles.roomItem}>
                      <div className={styles.roomItemInfo}>
                        <span className={styles.roomItemName}>{room.name}</span>
                        <span className={styles.roomItemMeta}>
                          {room.access || 'members'} -- {room.author || 'unknown'}
                        </span>
                      </div>
                      <div className={styles.roomItemActions}>
                        <ActionButton
                          label="Visit"
                          icon={<Eye size={12} />}
                          onClick={() => handleVisitRoom(room.room_id)}
                          disabled={s.loadingRoom}
                          size="sm"
                        />
                        {s.confirming === `room:${room.room_id}` ? (
                          <ConfirmAction
                            message="Delete this room? This cannot be undone."
                            onConfirm={() => handleDeleteRoom(room.room_id)}
                            onCancel={() => set({ confirming: null })}
                          />
                        ) : (
                          <ActionButton
                            label="Delete"
                            icon={<Trash2 size={12} />}
                            onClick={() => set({ confirming: `room:${room.room_id}` })}
                            disabled={s.deletingRoomId === room.room_id}
                            loading={s.deletingRoomId === room.room_id}
                            variant="danger"
                            size="sm"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {s.selectedRoom && (
                <div className={styles.roomContent}>
                  <div className={styles.roomContentHeader}>
                    <span className={styles.roomContentTitle}>{s.selectedRoom.name}</span>
                    <span className={styles.roomContentMeta}>
                      {s.selectedRoom.access} -- by {s.selectedRoom.author}
                    </span>
                  </div>
                  <div className={styles.roomContentBody}>
                    {s.selectedRoom.description || 'No description.'}
                  </div>
                  <div className={styles.roomContentFooter}>
                    Created: {s.selectedRoom.created_at} -- Updated: {s.selectedRoom.updated_at}
                  </div>
                </div>
              )}

              {s.loadingRoom && (
                <div className={styles.loading}>
                  <span className={shared.spinner} />
                  Loading room...
                </div>
              )}

              {s.roomsLoaded && (
                <div className={styles.roomForm}>
                  <div className={styles.roomFormTitle}>
                    <Plus size={12} /> Create Room
                    <span className={styles.roomFormCount}>
                      {s.rooms.length}/{s.maxRooms}
                    </span>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Name</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Room name"
                      value={s.roomFormName}
                      onChange={(e) => set({ roomFormName: e.target.value })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Description</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Room description..."
                      value={s.roomFormDesc}
                      onChange={(e) => set({ roomFormDesc: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Access</label>
                    <select
                      className={styles.select}
                      value={s.roomFormAccess}
                      onChange={(e) => set({ roomFormAccess: e.target.value })}
                    >
                      <option value="public">Public</option>
                      <option value="members">Members</option>
                      <option value="officers">Officers</option>
                    </select>
                  </div>
                  <div className={styles.formActions}>
                    <ActionButton
                      label="Create Room"
                      icon={<Plus size={12} />}
                      onClick={handleCreateRoom}
                      disabled={!s.roomFormName.trim() || s.creatingRoom || s.rooms.length >= s.maxRooms}
                      loading={s.creatingRoom}
                      size="sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </Section>

          <div className={styles.divider} />

          {s.confirming === 'leave' ? (
            <ConfirmAction
              message="Leave your faction?"
              onConfirm={handleLeaveFaction}
              onCancel={() => set({ confirming: null })}
            />
          ) : (
            <ActionButton
              label="Leave Faction"
              icon={<UserMinus size={14} />}
              onClick={() => set({ confirming: 'leave' })}
              variant="danger"
              size="sm"
            />
          )}
        </>
      ) : (
        <>
          <Section title="Pending Invites" icon={<UserPlus size={12} />}>
            {!s.invitesLoaded && !s.loadingInvites && (
              <ActionButton
                label="Check Invites"
                icon={<UserPlus size={14} />}
                onClick={handleLoadInvites}
                variant="secondary"
                size="sm"
              />
            )}
            {s.loadingInvites && (
              <div className={styles.loading}>
                <span className={shared.spinner} />
                Loading invites...
              </div>
            )}
            {s.invitesLoaded && s.pendingInvites.length === 0 && (
              <div className={shared.emptyState}>
                No pending invites.
              </div>
            )}
            {s.pendingInvites.length > 0 && (
              <div className={styles.inviteList}>
                {s.pendingInvites.map((invite) => (
                  <div key={invite.faction_id} className={styles.inviteItem}>
                    <div className={styles.inviteItemInfo}>
                      <span className={styles.inviteItemName}>
                        [{invite.faction_tag}] {invite.faction_name}
                      </span>
                      {invite.invited_by && (
                        <span className={styles.inviteItemMeta}>
                          Invited by {invite.invited_by}
                        </span>
                      )}
                    </div>
                    <div className={styles.inviteItemActions}>
                      <ActionButton
                        label="Join"
                        icon={<LogIn size={12} />}
                        onClick={() => handleAcceptInvite(invite.faction_id)}
                        disabled={s.joiningFaction === invite.faction_id}
                        loading={s.joiningFaction === invite.faction_id}
                        size="sm"
                      />
                      <ActionButton
                        label="Decline"
                        icon={<X size={12} />}
                        onClick={() => handleDeclineInvite(invite.faction_id)}
                        disabled={s.decliningInvite === invite.faction_id}
                        loading={s.decliningInvite === invite.faction_id}
                        variant="danger"
                        size="sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className={styles.divider} />

          <div>
            <div className={shared.sectionTitle}>
              <span className={shared.sectionIcon}><Flag size={12} /></span>
              Create Faction
            </div>
            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Faction Name</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Star Wolves"
                  value={s.createName}
                  onChange={(e) => set({ createName: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Tag (exactly 4 characters)</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. SWLF"
                  maxLength={4}
                  value={s.createTag}
                  onChange={(e) => set({ createTag: e.target.value.toUpperCase() })}
                />
              </div>
              <div className={styles.formActions}>
                <ActionButton
                  label="Create Faction"
                  icon={<Flag size={14} />}
                  onClick={handleCreateFaction}
                  disabled={!s.createName.trim() || s.createTag.trim().length !== 4 || s.creating}
                  loading={s.creating}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className={styles.divider} />

      <Section title="Faction Browser" icon={<Users size={12} />} defaultOpen={false}>
        {!s.listLoaded && !s.loadingList && (
          <ActionButton
            label="Browse Factions"
            icon={<Users size={14} />}
            onClick={() => handleLoadFactions()}
            variant="secondary"
            size="sm"
          />
        )}
        {s.loadingList && (
          <div className={styles.loading}>
            <span className={shared.spinner} />
            Loading factions...
          </div>
        )}
        {s.listLoaded && s.factionList.length === 0 && (
          <div className={shared.emptyState}>
            No factions found in the galaxy.
          </div>
        )}
        {s.factionList.length > 0 && (
          <div className={styles.factionList}>
            {s.factionList.map((f) => (
              <div key={f.id} className={styles.factionListItem}>
                <div className={styles.factionListInfo}>
                  {hasFaction ? (
                    <button className={`${styles.factionListName} ${styles.diplomacyTargetBtn}`} onClick={() => set({ diplomacyTarget: f.id })} title="Set as diplomacy target" type="button">
                      {f.name}
                    </button>
                  ) : <span className={styles.factionListName}>{f.name}</span>}
                  <span className={styles.factionListTag}>[{f.tag}]</span>
                </div>
                <div className={styles.factionListRight}>
                  <span className={styles.factionListMembers}>
                    {f.member_count ?? '?'} members
                  </span>
                  {hasFaction ? (
                    <button
                      className={styles.diplomacyTargetBtn}
                      onClick={() => set({ diplomacyTarget: f.id })}
                      title="Set as diplomacy target"
                      aria-label={`Set ${f.name} as diplomacy target`}
                      type="button"
                    >
                      <Shield size={10} /> {s.diplomacyTarget === f.id ? 'Target' : 'Set target'}
                    </button>
                  ) : (
                    <ActionButton
                      label="Join"
                      icon={<LogIn size={12} />}
                      onClick={() => handleJoinFaction(f.id)}
                      disabled={s.joiningFaction === f.id}
                      loading={s.joiningFaction === f.id}
                      size="sm"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {s.listLoaded && (
          <Pager offset={s.listOffset} total={s.listTotal} onPage={handleLoadFactions} />
        )}
        {s.listLoaded && (
          <ActionButton
            label="Refresh"
            icon={<RefreshCw size={12} />}
            onClick={() => handleLoadFactions(s.listOffset)}
            disabled={s.loadingList}
            loading={s.loadingList}
            variant="secondary"
            size="sm"
          />
        )}
      </Section>
    </Panel>
  )
}
