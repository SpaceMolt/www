'use client'

import { useState, useCallback, useEffect } from 'react'
import { Users, Flag, Shield, UserPlus, UserMinus, Swords, RefreshCw, Radar, DoorOpen, Trash2, Plus, Search, BarChart3, Eye, Crown, X, Handshake, LogIn, ChevronDown, ChevronRight } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import { Panel, shared } from '../shared'
import type { FactionInfoResponse, FactionMember } from '../types'
import styles from './FactionPanel.module.css'

// ---------------------------------------------------------------------------
// Local types for API responses not in shared types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

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
      >
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={shared.sectionTitle}>{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FactionPanel
// ---------------------------------------------------------------------------

export function FactionPanel() {
  const { state, sendCommand } = useGame()

  // Faction info
  const [factionInfo, setFactionInfo] = useState<FactionInfoResponse | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  // Faction browser
  const [factionList, setFactionList] = useState<FactionListEntry[]>([])
  const [listLoaded, setListLoaded] = useState(false)
  const [loadingList, setLoadingList] = useState(false)

  // Create faction form
  const [createName, setCreateName] = useState('')
  const [createTag, setCreateTag] = useState('')
  const [creating, setCreating] = useState(false)

  // Invite
  const [inviteTarget, setInviteTarget] = useState('')
  const [inviting, setInviting] = useState(false)

  // Pending invites (for non-members)
  const [pendingInvites, setPendingInvites] = useState<FactionInvite[]>([])
  const [invitesLoaded, setInvitesLoaded] = useState(false)
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [joiningFaction, setJoiningFaction] = useState<string | null>(null)
  const [decliningInvite, setDecliningInvite] = useState<string | null>(null)

  // Diplomacy
  const [diplomacyTarget, setDiplomacyTarget] = useState('')
  const [warReason, setWarReason] = useState('')
  const [peaceTerms, setPeaceTerms] = useState('')
  const [diplomacyLoading, setDiplomacyLoading] = useState(false)

  // Intel state
  const [intelQuery, setIntelQuery] = useState('')
  const [intelEntries, setIntelEntries] = useState<IntelEntry[]>([])
  const [intelStatus, setIntelStatus] = useState<IntelStatus | null>(null)
  const [submittingIntel, setSubmittingIntel] = useState(false)
  const [queryingIntel, setQueryingIntel] = useState(false)
  const [loadingIntelStatus, setLoadingIntelStatus] = useState(false)

  // Rooms state
  const [rooms, setRooms] = useState<FactionRoom[]>([])
  const [maxRooms, setMaxRooms] = useState(5)
  const [roomsLoaded, setRoomsLoaded] = useState(false)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<FactionRoomDetail | null>(null)
  const [loadingRoom, setLoadingRoom] = useState(false)
  const [roomFormName, setRoomFormName] = useState('')
  const [roomFormDesc, setRoomFormDesc] = useState('')
  const [roomFormAccess, setRoomFormAccess] = useState('members')
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null)

  // Kick / promote
  const [kickingPlayer, setKickingPlayer] = useState<string | null>(null)

  const hasFaction = Boolean(state.player?.faction_id)
  const playerId = state.player?.player_id

  // -------------------------------------------------------------------------
  // Auto-load faction info when panel opens (or faction changes)
  // -------------------------------------------------------------------------
  const loadFactionInfo = useCallback(async () => {
    if (!hasFaction) return
    setLoadingInfo(true)
    try {
      const res = await sendCommand('faction_info') as Record<string, unknown>
      setFactionInfo(res as unknown as FactionInfoResponse)
    } finally {
      setLoadingInfo(false)
    }
  }, [sendCommand, hasFaction])

  useEffect(() => {
    if (hasFaction) {
      loadFactionInfo()
    } else {
      setFactionInfo(null)
    }
  }, [hasFaction]) // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Faction creation
  // -------------------------------------------------------------------------
  const handleCreateFaction = useCallback(async () => {
    if (!createName.trim() || !createTag.trim()) return
    setCreating(true)
    try {
      await sendCommand('create_faction', {
        name: createName.trim(),
        tag: createTag.trim().toUpperCase(),
      })
      setCreateName('')
      setCreateTag('')
    } finally {
      setCreating(false)
    }
  }, [sendCommand, createName, createTag])

  // -------------------------------------------------------------------------
  // Leave faction
  // -------------------------------------------------------------------------
  const handleLeaveFaction = useCallback(async () => {
    await sendCommand('leave_faction')
    setFactionInfo(null)
    setRooms([])
    setRoomsLoaded(false)
    setIntelEntries([])
    setIntelStatus(null)
  }, [sendCommand])

  // -------------------------------------------------------------------------
  // Invite player
  // -------------------------------------------------------------------------
  const handleInvite = useCallback(async () => {
    if (!inviteTarget.trim()) return
    setInviting(true)
    try {
      await sendCommand('faction_invite', { player_id: inviteTarget.trim() })
      setInviteTarget('')
    } finally {
      setInviting(false)
    }
  }, [sendCommand, inviteTarget])

  // -------------------------------------------------------------------------
  // Kick member
  // -------------------------------------------------------------------------
  const handleKick = useCallback(async (memberId: string) => {
    setKickingPlayer(memberId)
    try {
      await sendCommand('faction_kick', { player_id: memberId })
      await loadFactionInfo()
    } finally {
      setKickingPlayer(null)
    }
  }, [sendCommand, loadFactionInfo])

  // -------------------------------------------------------------------------
  // Pending invites (non-member)
  // -------------------------------------------------------------------------
  const handleLoadInvites = useCallback(async () => {
    setLoadingInvites(true)
    try {
      const res = await sendCommand('faction_get_invites') as Record<string, unknown>
      const invites = (res.invites || []) as FactionInvite[]
      setPendingInvites(invites)
      setInvitesLoaded(true)
    } finally {
      setLoadingInvites(false)
    }
  }, [sendCommand])

  const handleAcceptInvite = useCallback(async (factionId: string) => {
    setJoiningFaction(factionId)
    try {
      await sendCommand('join_faction', { faction_id: factionId })
      setPendingInvites([])
      setInvitesLoaded(false)
    } finally {
      setJoiningFaction(null)
    }
  }, [sendCommand])

  const handleDeclineInvite = useCallback(async (factionId: string) => {
    setDecliningInvite(factionId)
    try {
      await sendCommand('faction_decline_invite', { faction_id: factionId })
      setPendingInvites(prev => prev.filter(i => i.faction_id !== factionId))
    } finally {
      setDecliningInvite(null)
    }
  }, [sendCommand])

  // -------------------------------------------------------------------------
  // Faction browser
  // -------------------------------------------------------------------------
  const handleLoadFactions = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await sendCommand('faction_list') as Record<string, unknown>
      const factions = (res.factions || []) as FactionListEntry[]
      setFactionList(factions)
      setListLoaded(true)
    } finally {
      setLoadingList(false)
    }
  }, [sendCommand])

  const handleJoinFaction = useCallback(async (factionId: string) => {
    setJoiningFaction(factionId)
    try {
      await sendCommand('join_faction', { faction_id: factionId })
      setFactionList([])
      setListLoaded(false)
    } finally {
      setJoiningFaction(null)
    }
  }, [sendCommand])

  // -------------------------------------------------------------------------
  // Diplomacy
  // -------------------------------------------------------------------------
  const handleDiplomacy = useCallback(async (action: string, factionId: string, extra?: Record<string, unknown>) => {
    if (!factionId) return
    setDiplomacyLoading(true)
    try {
      await sendCommand(action, { faction_id: factionId, ...extra })
      setDiplomacyTarget('')
      setWarReason('')
      setPeaceTerms('')
      await loadFactionInfo()
    } finally {
      setDiplomacyLoading(false)
    }
  }, [sendCommand, loadFactionInfo])

  const handleAcceptPeace = useCallback(async (factionId: string) => {
    setDiplomacyLoading(true)
    try {
      await sendCommand('faction_accept_peace', { faction_id: factionId })
      await loadFactionInfo()
    } finally {
      setDiplomacyLoading(false)
    }
  }, [sendCommand, loadFactionInfo])

  // -------------------------------------------------------------------------
  // Intel handlers
  // -------------------------------------------------------------------------
  const handleSubmitIntel = useCallback(async () => {
    if (!state.system?.id) return
    setSubmittingIntel(true)
    try {
      await sendCommand('faction_submit_intel', { systems: [{ system_id: state.system.id }] })
    } finally {
      setSubmittingIntel(false)
    }
  }, [sendCommand, state.system])

  const handleQueryIntel = useCallback(async () => {
    setQueryingIntel(true)
    try {
      const params: Record<string, unknown> = {}
      if (intelQuery.trim()) {
        params.system_name = intelQuery.trim()
      }
      const res = await sendCommand('faction_query_intel', params) as Record<string, unknown>
      const entries = (res.entries || []) as IntelEntry[]
      setIntelEntries(entries)
    } finally {
      setQueryingIntel(false)
    }
  }, [sendCommand, intelQuery])

  const handleIntelStatus = useCallback(async () => {
    setLoadingIntelStatus(true)
    try {
      const res = await sendCommand('faction_intel_status') as Record<string, unknown>
      setIntelStatus(res as unknown as IntelStatus)
    } finally {
      setLoadingIntelStatus(false)
    }
  }, [sendCommand])

  // -------------------------------------------------------------------------
  // Rooms handlers
  // -------------------------------------------------------------------------
  const handleLoadRooms = useCallback(async () => {
    setLoadingRooms(true)
    try {
      const res = await sendCommand('faction_rooms') as Record<string, unknown>
      const roomList = (res.rooms || []) as FactionRoom[]
      setRooms(roomList)
      if (typeof res.max_rooms === 'number') setMaxRooms(res.max_rooms)
      setRoomsLoaded(true)
    } finally {
      setLoadingRooms(false)
    }
  }, [sendCommand])

  const handleVisitRoom = useCallback(async (roomId: string) => {
    setLoadingRoom(true)
    setSelectedRoom(null)
    try {
      const res = await sendCommand('faction_visit_room', { room_id: roomId }) as unknown as FactionRoomDetail
      setSelectedRoom(res)
    } finally {
      setLoadingRoom(false)
    }
  }, [sendCommand])

  const handleCreateRoom = useCallback(async () => {
    if (!roomFormName.trim()) return
    setCreatingRoom(true)
    try {
      await sendCommand('faction_write_room', {
        name: roomFormName.trim(),
        content: roomFormDesc.trim(),
        access: roomFormAccess,
      })
      setRoomFormName('')
      setRoomFormDesc('')
      setRoomFormAccess('members')
      await handleLoadRooms()
    } finally {
      setCreatingRoom(false)
    }
  }, [sendCommand, roomFormName, roomFormDesc, roomFormAccess, handleLoadRooms])

  const handleDeleteRoom = useCallback(async (roomId: string) => {
    setDeletingRoomId(roomId)
    try {
      await sendCommand('faction_delete_room', { room_id: roomId })
      setRooms(prev => prev.filter(r => r.room_id !== roomId))
      if (selectedRoom?.room_id === roomId) setSelectedRoom(null)
    } finally {
      setDeletingRoomId(null)
    }
  }, [sendCommand, selectedRoom])

  // =========================================================================
  // RENDER
  // =========================================================================

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
            disabled={loadingInfo}
          >
            <RefreshCw size={14} />
          </button>
        ) : undefined
      }
    >
      {hasFaction ? (
        <>
          {/* ============================================================= */}
          {/* FACTION INFO CARD                                             */}
          {/* ============================================================= */}
          {loadingInfo && !factionInfo && (
            <div className={styles.loading}>
              <span className={shared.spinner} />
              Loading faction info...
            </div>
          )}

          {factionInfo && (
            <div className={styles.factionCard}>
              <div className={styles.factionHeader}>
                <div className={styles.factionName}>{factionInfo.name}</div>
                <span className={styles.factionTag}>[{factionInfo.tag}]</span>
              </div>
              {factionInfo.description && (
                <div className={styles.factionDescription}>{factionInfo.description}</div>
              )}
              <div className={styles.factionMeta}>
                <span className={styles.metaTag}>
                  <Users size={10} />
                  Members: <span className={styles.metaValue}>{factionInfo.member_count}</span>
                </span>
                <span className={styles.metaTag}>
                  <Crown size={10} />
                  Leader: <span className={styles.metaValue}>{factionInfo.leader_username}</span>
                </span>
                {typeof factionInfo.treasury === 'number' && (
                  <span className={styles.metaTag}>
                    Treasury: <span className={styles.metaValue}>{factionInfo.treasury.toLocaleString()} cr</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ALLIES & ENEMIES                                              */}
          {/* ============================================================= */}
          {factionInfo && (factionInfo.allies?.length || factionInfo.enemies?.length) ? (
            <>
              <div className={styles.divider} />
              <div className={styles.relationsRow}>
                {factionInfo.allies && factionInfo.allies.length > 0 && (
                  <div className={styles.relationGroup}>
                    <div className={styles.relationLabel}>
                      <Shield size={10} /> Allies
                    </div>
                    {factionInfo.allies.map((ally: FactionRelation) => (
                      <span key={ally.id} className={styles.allyBadge}>
                        [{ally.tag}] {ally.name}
                      </span>
                    ))}
                  </div>
                )}
                {factionInfo.enemies && factionInfo.enemies.length > 0 && (
                  <div className={styles.relationGroup}>
                    <div className={styles.relationLabel}>
                      <Swords size={10} /> Enemies
                    </div>
                    {factionInfo.enemies.map((enemy: FactionRelation) => (
                      <span key={enemy.id} className={styles.enemyBadge}>
                        [{enemy.tag}] {enemy.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {/* ============================================================= */}
          {/* ACTIVE WARS                                                   */}
          {/* ============================================================= */}
          {factionInfo?.wars && factionInfo.wars.length > 0 && (
            <>
              <div className={styles.divider} />
              <Section title="Active Wars" icon={<Swords size={12} />}>
                <div className={styles.warList}>
                  {factionInfo.wars.map((war: FactionWar) => (
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
                        onClick={() => {
                          setDiplomacyTarget(war.target_faction_id)
                          setPeaceTerms('')
                        }}
                        size="sm"
                        variant="secondary"
                      />
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* ============================================================= */}
          {/* PEACE PROPOSALS                                               */}
          {/* ============================================================= */}
          {factionInfo?.peace_proposals && factionInfo.peace_proposals.length > 0 && (
            <>
              <div className={styles.divider} />
              <Section title="Peace Proposals" icon={<Handshake size={12} />}>
                <div className={styles.proposalList}>
                  {factionInfo.peace_proposals.map((proposal: PeaceProposal) => (
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
                        disabled={diplomacyLoading}
                        loading={diplomacyLoading}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          <div className={styles.divider} />

          {/* ============================================================= */}
          {/* MEMBERS                                                       */}
          {/* ============================================================= */}
          {factionInfo?.members && factionInfo.members.length > 0 && (
            <Section title="Members" icon={<Users size={12} />}>
              <div className={styles.memberList}>
                {factionInfo.members.map((member: FactionMember) => (
                  <div key={member.player_id} className={styles.memberItem}>
                    <div className={styles.memberLeft}>
                      <span className={`${styles.onlineDot} ${member.is_online ? styles.online : ''}`} />
                      <span className={styles.memberName}>{member.username}</span>
                    </div>
                    <div className={styles.memberRight}>
                      <span className={styles.memberRole}>{member.role}</span>
                      {member.player_id !== playerId && (
                        <button
                          className={styles.kickBtn}
                          onClick={() => handleKick(member.player_id)}
                          disabled={kickingPlayer === member.player_id}
                          title={`Kick ${member.username}`}
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

          {/* ============================================================= */}
          {/* INVITE PLAYER                                                 */}
          {/* ============================================================= */}
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
                value={inviteTarget}
                onChange={(e) => setInviteTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
              <ActionButton
                label="Invite"
                icon={<UserPlus size={12} />}
                onClick={handleInvite}
                disabled={!inviteTarget.trim() || inviting}
                loading={inviting}
                size="sm"
              />
            </div>
          </div>

          <div className={styles.divider} />

          {/* ============================================================= */}
          {/* DIPLOMACY                                                     */}
          {/* ============================================================= */}
          <Section title="Diplomacy" icon={<Shield size={12} />} defaultOpen={false}>
            <div className={styles.diplomacySection}>
              <div className={styles.field}>
                <label className={styles.label}>Target Faction ID</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Faction ID (from browser below)"
                  value={diplomacyTarget}
                  onChange={(e) => setDiplomacyTarget(e.target.value)}
                />
              </div>
              <div className={styles.diplomacyRow}>
                <ActionButton
                  label="Set Ally"
                  icon={<Shield size={12} />}
                  onClick={() => handleDiplomacy('faction_set_ally', diplomacyTarget)}
                  disabled={!diplomacyTarget || diplomacyLoading}
                  loading={diplomacyLoading}
                  size="sm"
                />
                <ActionButton
                  label="Set Enemy"
                  icon={<Swords size={12} />}
                  onClick={() => handleDiplomacy('faction_set_enemy', diplomacyTarget)}
                  disabled={!diplomacyTarget || diplomacyLoading}
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
                  value={warReason}
                  onChange={(e) => setWarReason(e.target.value)}
                />
              </div>
              <ActionButton
                label="Declare War"
                icon={<Flag size={12} />}
                onClick={() => handleDiplomacy('faction_declare_war', diplomacyTarget, { reason: warReason })}
                disabled={!diplomacyTarget || diplomacyLoading}
                loading={diplomacyLoading}
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
                  value={peaceTerms}
                  onChange={(e) => setPeaceTerms(e.target.value)}
                />
              </div>
              <ActionButton
                label="Propose Peace"
                icon={<Handshake size={12} />}
                onClick={() => handleDiplomacy('faction_propose_peace', diplomacyTarget, { terms: peaceTerms })}
                disabled={!diplomacyTarget || diplomacyLoading}
                loading={diplomacyLoading}
                variant="secondary"
                size="sm"
              />
            </div>
          </Section>

          <div className={styles.divider} />

          {/* ============================================================= */}
          {/* INTEL                                                         */}
          {/* ============================================================= */}
          <Section title="Intel" icon={<Radar size={12} />} defaultOpen={false}>
            <div className={styles.intelSection}>
              <ActionButton
                label="Submit Intel"
                icon={<Radar size={12} />}
                onClick={handleSubmitIntel}
                disabled={!state.system?.id || submittingIntel}
                loading={submittingIntel}
                size="sm"
              />

              <div className={styles.intelQueryRow}>
                <input
                  className={styles.inviteInput}
                  type="text"
                  placeholder="System name filter..."
                  value={intelQuery}
                  onChange={(e) => setIntelQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQueryIntel()}
                />
                <ActionButton
                  label="Query"
                  icon={<Search size={12} />}
                  onClick={handleQueryIntel}
                  disabled={queryingIntel}
                  loading={queryingIntel}
                  size="sm"
                />
              </div>

              {intelEntries.length > 0 && (
                <div className={styles.intelList}>
                  {intelEntries.map((entry) => (
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
                disabled={loadingIntelStatus}
                loading={loadingIntelStatus}
                variant="secondary"
                size="sm"
              />

              {intelStatus && (
                <div className={styles.intelStats}>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Intel Level</span>
                    <span className={styles.intelStatValue}>{intelStatus.intel_level}</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Reports (24h)</span>
                    <span className={styles.intelStatValue}>{intelStatus.reports_24h ?? '--'}</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Total Reports</span>
                    <span className={styles.intelStatValue}>{intelStatus.total_reports ?? '--'}</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Unique Systems</span>
                    <span className={styles.intelStatValue}>{intelStatus.unique_systems ?? '--'}</span>
                  </div>
                  {intelStatus.top_contributors && intelStatus.top_contributors.length > 0 && (
                    <div className={styles.intelStatItem}>
                      <span className={styles.intelStatLabel}>Top Contributor</span>
                      <span className={styles.intelStatValue}>
                        {intelStatus.top_contributors[0].username} ({intelStatus.top_contributors[0].reports})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          <div className={styles.divider} />

          {/* ============================================================= */}
          {/* ROOMS                                                         */}
          {/* ============================================================= */}
          <Section title="Rooms" icon={<DoorOpen size={12} />} defaultOpen={false}>
            <div className={styles.roomSection}>
              {!roomsLoaded && !loadingRooms && (
                <ActionButton
                  label="Load Rooms"
                  icon={<DoorOpen size={12} />}
                  onClick={handleLoadRooms}
                  variant="secondary"
                  size="sm"
                />
              )}

              {loadingRooms && (
                <div className={styles.loading}>
                  <span className={shared.spinner} />
                  Loading rooms...
                </div>
              )}

              {roomsLoaded && rooms.length === 0 && (
                <div className={shared.emptyState}>
                  No faction rooms yet.
                </div>
              )}

              {rooms.length > 0 && (
                <div className={styles.roomList}>
                  {rooms.map((room) => (
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
                          disabled={loadingRoom}
                          size="sm"
                        />
                        <ActionButton
                          label="Delete"
                          icon={<Trash2 size={12} />}
                          onClick={() => handleDeleteRoom(room.room_id)}
                          disabled={deletingRoomId === room.room_id}
                          loading={deletingRoomId === room.room_id}
                          variant="danger"
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedRoom && (
                <div className={styles.roomContent}>
                  <div className={styles.roomContentHeader}>
                    <span className={styles.roomContentTitle}>{selectedRoom.name}</span>
                    <span className={styles.roomContentMeta}>
                      {selectedRoom.access} -- by {selectedRoom.author}
                    </span>
                  </div>
                  <div className={styles.roomContentBody}>
                    {selectedRoom.description || 'No description.'}
                  </div>
                  <div className={styles.roomContentFooter}>
                    Created: {selectedRoom.created_at} -- Updated: {selectedRoom.updated_at}
                  </div>
                </div>
              )}

              {loadingRoom && (
                <div className={styles.loading}>
                  <span className={shared.spinner} />
                  Loading room...
                </div>
              )}

              {/* Create Room Form */}
              {roomsLoaded && (
                <div className={styles.roomForm}>
                  <div className={styles.roomFormTitle}>
                    <Plus size={12} /> Create Room
                    <span className={styles.roomFormCount}>
                      {rooms.length}/{maxRooms}
                    </span>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Name</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Room name"
                      value={roomFormName}
                      onChange={(e) => setRoomFormName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Description</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Room description..."
                      value={roomFormDesc}
                      onChange={(e) => setRoomFormDesc(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Access</label>
                    <select
                      className={styles.select}
                      value={roomFormAccess}
                      onChange={(e) => setRoomFormAccess(e.target.value)}
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
                      disabled={!roomFormName.trim() || creatingRoom || rooms.length >= maxRooms}
                      loading={creatingRoom}
                      size="sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </Section>

          <div className={styles.divider} />

          {/* ============================================================= */}
          {/* LEAVE FACTION                                                 */}
          {/* ============================================================= */}
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
          {/* ============================================================= */}
          {/* NON-MEMBER: PENDING INVITES                                   */}
          {/* ============================================================= */}
          <Section title="Pending Invites" icon={<UserPlus size={12} />}>
            {!invitesLoaded && !loadingInvites && (
              <ActionButton
                label="Check Invites"
                icon={<UserPlus size={14} />}
                onClick={handleLoadInvites}
                variant="secondary"
                size="sm"
              />
            )}
            {loadingInvites && (
              <div className={styles.loading}>
                <span className={shared.spinner} />
                Loading invites...
              </div>
            )}
            {invitesLoaded && pendingInvites.length === 0 && (
              <div className={shared.emptyState}>
                No pending invites.
              </div>
            )}
            {pendingInvites.length > 0 && (
              <div className={styles.inviteList}>
                {pendingInvites.map((invite) => (
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
                        disabled={joiningFaction === invite.faction_id}
                        loading={joiningFaction === invite.faction_id}
                        size="sm"
                      />
                      <ActionButton
                        label="Decline"
                        icon={<X size={12} />}
                        onClick={() => handleDeclineInvite(invite.faction_id)}
                        disabled={decliningInvite === invite.faction_id}
                        loading={decliningInvite === invite.faction_id}
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

          {/* ============================================================= */}
          {/* NON-MEMBER: CREATE FACTION                                    */}
          {/* ============================================================= */}
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
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Tag (4 chars max)</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. SWLF"
                  maxLength={4}
                  value={createTag}
                  onChange={(e) => setCreateTag(e.target.value.toUpperCase())}
                />
              </div>
              <div className={styles.formActions}>
                <ActionButton
                  label="Create Faction"
                  icon={<Flag size={14} />}
                  onClick={handleCreateFaction}
                  disabled={!createName.trim() || !createTag.trim() || creating}
                  loading={creating}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className={styles.divider} />

      {/* =================================================================== */}
      {/* FACTION BROWSER (visible to both members and non-members)           */}
      {/* =================================================================== */}
      <Section title="Faction Browser" icon={<Users size={12} />} defaultOpen={false}>
        {!listLoaded && !loadingList && (
          <ActionButton
            label="Browse Factions"
            icon={<Users size={14} />}
            onClick={handleLoadFactions}
            variant="secondary"
            size="sm"
          />
        )}
        {loadingList && (
          <div className={styles.loading}>
            <span className={shared.spinner} />
            Loading factions...
          </div>
        )}
        {listLoaded && factionList.length === 0 && (
          <div className={shared.emptyState}>
            No factions found in the galaxy.
          </div>
        )}
        {factionList.length > 0 && (
          <div className={styles.factionList}>
            {factionList.map((f) => (
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
                      onClick={() => setDiplomacyTarget(f.id)}
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
                      disabled={joiningFaction === f.id}
                      loading={joiningFaction === f.id}
                      size="sm"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {listLoaded && (
          <ActionButton
            label="Refresh"
            icon={<RefreshCw size={12} />}
            onClick={handleLoadFactions}
            disabled={loadingList}
            loading={loadingList}
            variant="secondary"
            size="sm"
          />
        )}
      </Section>
    </Panel>
  )
}
