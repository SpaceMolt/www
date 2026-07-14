'use client'

import { useState, useCallback, useEffect, useReducer } from 'react'
import { Users, Flag, Shield, UserPlus, UserMinus, Swords, RefreshCw, Radar, DoorOpen, Trash2, Plus, Search, BarChart3, Eye, Crown, X, Handshake, LogIn, ChevronDown, ChevronRight } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import { Panel, shared } from '../shared'
import type { FactionInfoResponse, FactionMember } from '../types'
import { playerHref } from '@/components/profile/ProfileLink'
import styles from './FactionPanel.module.css'

// Local types for API responses not in shared types
interface FactionListEntry {
  id: string
  name: string
  tag: string
  member_count?: number
  leader_username?: string
}

interface FactionInvite {
  faction_id: string
  faction_name: string
  faction_tag: string
  invited_at?: string
  invited_by?: string
}

interface IntelEntry {
  system_id: string
  name: string
  submitted_by?: string
  submitter_name?: string
  police_level?: number
  connections?: string[]
}

interface IntelStatus {
  intel_level: number
  reports_24h?: number
  total_reports?: number
  unique_players?: number
  unique_systems?: number
  top_contributors?: { username: string; reports: number }[]
}

interface FactionRoom {
  room_id: string
  name: string
  access?: string
  author?: string
  updated_at?: string
}

interface FactionRoomDetail {
  room_id: string
  name: string
  description: string
  access: string
  author: string
  created_at: string
  updated_at: string
}

type FactionWar = NonNullable<FactionInfoResponse['wars']>[number]
type PeaceProposal = NonNullable<FactionInfoResponse['peace_proposals']>[number]
type FactionRelation = NonNullable<FactionInfoResponse['allies']>[number]

// Panel state — single reducer instead of 27 useState hooks
interface PanelState {
  factionInfo: FactionInfoResponse | null
  loadingInfo: boolean
  factionList: FactionListEntry[]
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
  intelQuery: string
  intelEntries: IntelEntry[]
  intelStatus: IntelStatus | null
  submittingIntel: boolean
  queryingIntel: boolean
  loadingIntelStatus: boolean
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
  kickingPlayer: string | null
}

const INITIAL_STATE: PanelState = {
  factionInfo: null, loadingInfo: false,
  factionList: [], listLoaded: false, loadingList: false,
  createName: '', createTag: '', creating: false,
  inviteTarget: '', inviting: false,
  pendingInvites: [], invitesLoaded: false, loadingInvites: false,
  joiningFaction: null, decliningInvite: null,
  diplomacyTarget: '', warReason: '', peaceTerms: '', diplomacyLoading: false,
  intelQuery: '', intelEntries: [], intelStatus: null,
  submittingIntel: false, queryingIntel: false, loadingIntelStatus: false,
  rooms: [], maxRooms: 5, roomsLoaded: false, loadingRooms: false,
  selectedRoom: null, loadingRoom: false,
  roomFormName: '', roomFormDesc: '', roomFormAccess: 'members',
  creatingRoom: false, deletingRoomId: null,
  kickingPlayer: null,
}

type PanelAction = Partial<PanelState> | ((prev: PanelState) => Partial<PanelState>)

function merge(prev: PanelState, action: PanelAction): PanelState {
  const next = typeof action === 'function' ? action(prev) : action
  return { ...prev, ...next }
}

// Collapsible Section
function Section({ title, icon, children, defaultOpen = true }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        className={styles.sectionToggle}
        onClick={() => setOpen(!open)}
        type="button"
        aria-expanded={open}
      >
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={shared.sectionTitle}>{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && children}
    </div>
  )
}

// FactionPanel
export function FactionPanel() {
  const { state, sendCommand } = useGame()
  const [s, set] = useReducer(merge, INITIAL_STATE)

  const hasFaction = Boolean(state.player?.faction_id)
  const playerId = state.player?.id

  const loadFactionInfo = useCallback(async () => {
    if (!hasFaction) return
    set({ loadingInfo: true })
    try {
      const res = await sendCommand('faction_info') as Record<string, unknown>
      set({ factionInfo: res as unknown as FactionInfoResponse })
    } finally {
      set({ loadingInfo: false })
    }
  }, [sendCommand, hasFaction])

  useEffect(() => {
    if (hasFaction) {
      loadFactionInfo()
    } else {
      set({ factionInfo: null })
    }
  }, [loadFactionInfo, hasFaction])

  const handleCreateFaction = useCallback(async () => {
    if (!s.createName.trim() || !s.createTag.trim()) return
    set({ creating: true })
    try {
      await sendCommand('create_faction', {
        name: s.createName.trim(),
        tag: s.createTag.trim().toUpperCase(),
      })
      set({ createName: '', createTag: '' })
    } finally {
      set({ creating: false })
    }
  }, [sendCommand, s.createName, s.createTag])

  const handleLeaveFaction = useCallback(async () => {
    await sendCommand('leave_faction')
    set({
      factionInfo: null, rooms: [], roomsLoaded: false,
      intelEntries: [], intelStatus: null,
    })
  }, [sendCommand])

  const handleInvite = useCallback(async () => {
    if (!s.inviteTarget.trim()) return
    set({ inviting: true })
    try {
      await sendCommand('faction_invite', { player_id: s.inviteTarget.trim() })
      set({ inviteTarget: '' })
    } finally {
      set({ inviting: false })
    }
  }, [sendCommand, s.inviteTarget])

  const handleKick = useCallback(async (memberId: string) => {
    set({ kickingPlayer: memberId })
    try {
      await sendCommand('faction_kick', { player_id: memberId })
      await loadFactionInfo()
    } finally {
      set({ kickingPlayer: null })
    }
  }, [sendCommand, loadFactionInfo])

  const handleLoadInvites = useCallback(async () => {
    set({ loadingInvites: true })
    try {
      const res = await sendCommand('faction_get_invites') as Record<string, unknown>
      set({ pendingInvites: (res.invites || []) as FactionInvite[], invitesLoaded: true })
    } finally {
      set({ loadingInvites: false })
    }
  }, [sendCommand])

  const handleAcceptInvite = useCallback(async (factionId: string) => {
    set({ joiningFaction: factionId })
    try {
      await sendCommand('faction_accept_invite', { faction_id: factionId })
      set({ pendingInvites: [], invitesLoaded: false })
    } finally {
      set({ joiningFaction: null })
    }
  }, [sendCommand])

  const handleDeclineInvite = useCallback(async (factionId: string) => {
    set({ decliningInvite: factionId })
    try {
      await sendCommand('faction_decline_invite', { faction_id: factionId })
      set(prev => ({ pendingInvites: prev.pendingInvites.filter(i => i.faction_id !== factionId) }))
    } finally {
      set({ decliningInvite: null })
    }
  }, [sendCommand])

  const handleLoadFactions = useCallback(async () => {
    set({ loadingList: true })
    try {
      const res = await sendCommand('faction_list') as Record<string, unknown>
      set({ factionList: (res.factions || []) as FactionListEntry[], listLoaded: true })
    } finally {
      set({ loadingList: false })
    }
  }, [sendCommand])

  const handleJoinFaction = useCallback(async (factionId: string) => {
    set({ joiningFaction: factionId })
    try {
      await sendCommand('join_faction', { faction_id: factionId })
      set({ factionList: [], listLoaded: false })
    } finally {
      set({ joiningFaction: null })
    }
  }, [sendCommand])

  const handleDiplomacy = useCallback(async (action: string, factionId: string, extra?: Record<string, unknown>) => {
    if (!factionId) return
    set({ diplomacyLoading: true })
    try {
      await sendCommand(action, { faction_id: factionId, ...extra })
      set({ diplomacyTarget: '', warReason: '', peaceTerms: '' })
      await loadFactionInfo()
    } finally {
      set({ diplomacyLoading: false })
    }
  }, [sendCommand, loadFactionInfo])

  const handleAcceptPeace = useCallback(async (factionId: string) => {
    set({ diplomacyLoading: true })
    try {
      await sendCommand('faction_accept_peace', { faction_id: factionId })
      await loadFactionInfo()
    } finally {
      set({ diplomacyLoading: false })
    }
  }, [sendCommand, loadFactionInfo])

  const handleSubmitIntel = useCallback(async () => {
    if (!state.system?.id) return
    set({ submittingIntel: true })
    try {
      await sendCommand('faction_submit_intel', { systems: [{ system_id: state.system.id }] })
    } finally {
      set({ submittingIntel: false })
    }
  }, [sendCommand, state.system])

  const handleQueryIntel = useCallback(async () => {
    set({ queryingIntel: true })
    try {
      const params: Record<string, unknown> = {}
      if (s.intelQuery.trim()) params.system_name = s.intelQuery.trim()
      const res = await sendCommand('faction_query_intel', params) as Record<string, unknown>
      set({ intelEntries: (res.entries || []) as IntelEntry[] })
    } finally {
      set({ queryingIntel: false })
    }
  }, [sendCommand, s.intelQuery])

  const handleIntelStatus = useCallback(async () => {
    set({ loadingIntelStatus: true })
    try {
      const res = await sendCommand('faction_intel_status') as Record<string, unknown>
      set({ intelStatus: res as unknown as IntelStatus })
    } finally {
      set({ loadingIntelStatus: false })
    }
  }, [sendCommand])

  const handleLoadRooms = useCallback(async () => {
    set({ loadingRooms: true })
    try {
      const res = await sendCommand('faction_rooms') as Record<string, unknown>
      set({
        rooms: (res.rooms || []) as FactionRoom[],
        maxRooms: typeof res.max_rooms === 'number' ? res.max_rooms : 5,
        roomsLoaded: true,
      })
    } finally {
      set({ loadingRooms: false })
    }
  }, [sendCommand])

  const handleVisitRoom = useCallback(async (roomId: string) => {
    set({ loadingRoom: true, selectedRoom: null })
    try {
      const res = await sendCommand('faction_visit_room', { room_id: roomId }) as unknown as FactionRoomDetail
      set({ selectedRoom: res })
    } finally {
      set({ loadingRoom: false })
    }
  }, [sendCommand])

  const handleCreateRoom = useCallback(async () => {
    if (!s.roomFormName.trim()) return
    set({ creatingRoom: true })
    try {
      await sendCommand('faction_write_room', {
        name: s.roomFormName.trim(),
        content: s.roomFormDesc.trim(),
        access: s.roomFormAccess,
      })
      set({ roomFormName: '', roomFormDesc: '', roomFormAccess: 'members' })
      await handleLoadRooms()
    } finally {
      set({ creatingRoom: false })
    }
  }, [sendCommand, s.roomFormName, s.roomFormDesc, s.roomFormAccess, handleLoadRooms])

  const handleDeleteRoom = useCallback(async (roomId: string) => {
    if (!confirm('Delete this room? This cannot be undone.')) return
    set({ deletingRoomId: roomId })
    try {
      await sendCommand('faction_delete_room', { room_id: roomId })
      set(prev => ({
        rooms: prev.rooms.filter(r => r.room_id !== roomId),
        selectedRoom: prev.selectedRoom?.room_id === roomId ? null : prev.selectedRoom,
      }))
    } finally {
      set({ deletingRoomId: null })
    }
  }, [sendCommand])

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
                      <span key={ally.id} className={styles.allyBadge}>
                        [{ally.tag}] {ally.name}
                      </span>
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
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

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
                      <ActionButton
                        label="Propose Peace"
                        icon={<Handshake size={12} />}
                        onClick={() => set({ diplomacyTarget: war.target_faction_id, peaceTerms: '' })}
                        size="sm"
                        variant="secondary"
                      />
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
              <div className={styles.memberList}>
                {s.factionInfo.members.map((member: FactionMember) => (
                  <div key={member.player_id} className={styles.memberItem}>
                    <div className={styles.memberLeft}>
                      <span className={`${styles.onlineDot} ${member.is_online ? styles.online : ''}`} />
                      {/* New tab so the live play session isn't navigated away. */}
                      <a
                        href={playerHref(member.username)}
                        className={styles.memberName}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {member.username}
                      </a>
                    </div>
                    <div className={styles.memberRight}>
                      <span className={styles.memberRole}>{member.role}</span>
                      {member.player_id !== playerId && (
                        <button
                          className={styles.kickBtn}
                          onClick={() => handleKick(member.player_id)}
                          disabled={s.kickingPlayer === member.player_id}
                          title={`Kick ${member.username}`}
                          aria-label={`Kick ${member.username}`}
                          type="button"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className={styles.divider} />

          <div>
            <div className={shared.sectionTitle}>
              <span className={styles.sectionIcon}><UserPlus size={12} /></span>
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
            </div>
          </div>

          <div className={styles.divider} />

          <Section title="Diplomacy" icon={<Shield size={12} />} defaultOpen={false}>
            <div className={styles.diplomacySection}>
              <div className={styles.field}>
                <label className={styles.label}>Target Faction ID</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Faction ID (from browser below)"
                  value={s.diplomacyTarget}
                  onChange={(e) => set({ diplomacyTarget: e.target.value })}
                />
              </div>
              <div className={styles.diplomacyRow}>
                <ActionButton
                  label="Propose Ally"
                  icon={<Shield size={12} />}
                  onClick={() => handleDiplomacy('faction_propose_ally', s.diplomacyTarget)}
                  disabled={!s.diplomacyTarget || s.diplomacyLoading}
                  loading={s.diplomacyLoading}
                  size="sm"
                />
                <ActionButton
                  label="Set Enemy"
                  icon={<Swords size={12} />}
                  onClick={() => handleDiplomacy('faction_set_enemy', s.diplomacyTarget)}
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
              <ActionButton
                label="Declare War"
                icon={<Flag size={12} />}
                onClick={() => handleDiplomacy('faction_declare_war', s.diplomacyTarget, { reason: s.warReason })}
                disabled={!s.diplomacyTarget || s.diplomacyLoading}
                loading={s.diplomacyLoading}
                variant="danger"
                size="sm"
              />
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
                onClick={() => handleDiplomacy('faction_propose_peace', s.diplomacyTarget, { terms: s.peaceTerms })}
                disabled={!s.diplomacyTarget || s.diplomacyLoading}
                loading={s.diplomacyLoading}
                variant="secondary"
                size="sm"
              />
            </div>
          </Section>

          <div className={styles.divider} />

          <Section title="Intel" icon={<Radar size={12} />} defaultOpen={false}>
            <div className={styles.intelSection}>
              <ActionButton
                label="Submit Intel"
                icon={<Radar size={12} />}
                onClick={handleSubmitIntel}
                disabled={!state.system?.id || s.submittingIntel}
                loading={s.submittingIntel}
                size="sm"
              />

              <div className={styles.intelQueryRow}>
                <input
                  className={styles.inviteInput}
                  type="text"
                  placeholder="System name filter..."
                  value={s.intelQuery}
                  onChange={(e) => set({ intelQuery: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleQueryIntel()}
                />
                <ActionButton
                  label="Query"
                  icon={<Search size={12} />}
                  onClick={handleQueryIntel}
                  disabled={s.queryingIntel}
                  loading={s.queryingIntel}
                  size="sm"
                />
              </div>

              {s.intelEntries.length > 0 && (
                <div className={styles.intelList}>
                  {s.intelEntries.map((entry) => (
                    <div key={entry.system_id} className={styles.intelItem}>
                      <span className={styles.intelSystemName}>{entry.name}</span>
                      {entry.submitter_name && (
                        <span className={styles.intelMeta}>by {entry.submitter_name}</span>
                      )}
                      {entry.police_level !== undefined && (
                        <span className={styles.intelMeta}>police: {entry.police_level}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <ActionButton
                label="Intel Status"
                icon={<BarChart3 size={12} />}
                onClick={handleIntelStatus}
                disabled={s.loadingIntelStatus}
                loading={s.loadingIntelStatus}
                variant="secondary"
                size="sm"
              />

              {s.intelStatus && (
                <div className={styles.intelStats}>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Intel Level</span>
                    <span className={styles.intelStatValue}>{s.intelStatus.intel_level}</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Reports (24h)</span>
                    <span className={styles.intelStatValue}>{s.intelStatus.reports_24h ?? '--'}</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Total Reports</span>
                    <span className={styles.intelStatValue}>{s.intelStatus.total_reports ?? '--'}</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Unique Systems</span>
                    <span className={styles.intelStatValue}>{s.intelStatus.unique_systems ?? '--'}</span>
                  </div>
                  {s.intelStatus.top_contributors && s.intelStatus.top_contributors.length > 0 && (
                    <div className={styles.intelStatItem}>
                      <span className={styles.intelStatLabel}>Top Contributor</span>
                      <span className={styles.intelStatValue}>
                        {s.intelStatus.top_contributors[0].username} ({s.intelStatus.top_contributors[0].reports})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                        <ActionButton
                          label="Delete"
                          icon={<Trash2 size={12} />}
                          onClick={() => handleDeleteRoom(room.room_id)}
                          disabled={s.deletingRoomId === room.room_id}
                          loading={s.deletingRoomId === room.room_id}
                          variant="danger"
                          size="sm"
                        />
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

          <ActionButton
            label="Leave Faction"
            icon={<UserMinus size={14} />}
            onClick={handleLeaveFaction}
            variant="danger"
            size="sm"
          />
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
              <span className={styles.sectionIcon}><Flag size={12} /></span>
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
                <label className={styles.label}>Tag (4 chars max)</label>
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
                  disabled={!s.createName.trim() || !s.createTag.trim() || s.creating}
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
            onClick={handleLoadFactions}
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
                  <span className={styles.factionListName}>{f.name}</span>
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
                      type="button"
                    >
                      <Shield size={10} />
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
          <ActionButton
            label="Refresh"
            icon={<RefreshCw size={12} />}
            onClick={handleLoadFactions}
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
