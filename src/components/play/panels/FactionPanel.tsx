'use client'

import { useState, useCallback } from 'react'
import { Users, Flag, Shield, UserPlus, UserMinus, Swords, RefreshCw, Radar, DoorOpen, Trash2, Plus, Search, BarChart3, Eye } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import { Panel, shared } from '../shared'
import type { FactionInfoResponse, FactionMember } from '../types'
import styles from './FactionPanel.module.css'

interface FactionListEntry {
  id: string
  name: string
  tag: string
  member_count: number
}

interface IntelEntry {
  system_id: string
  system_name: string
  submitted_by?: string
  submitted_at?: string
  players_seen?: number
  police_level?: number
}

interface IntelStatus {
  systems_known: number
  total_systems: number
  coverage_pct: string
  contributors: number
  top_contributor: string
}

interface FactionRoom {
  room_id: string
  name: string
  access: string
  author: string
  updated_at: string
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

export function FactionPanel() {
  const { state, sendCommand } = useGame()
  const [factionInfo, setFactionInfo] = useState<FactionInfoResponse | null>(null)
  const [factionList, setFactionList] = useState<FactionListEntry[]>([])
  const [listLoaded, setListLoaded] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createTag, setCreateTag] = useState('')
  const [inviteTarget, setInviteTarget] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)

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

  const hasFaction = Boolean(state.player?.faction_id)

  const handleCreateFaction = useCallback(() => {
    if (!createName.trim() || !createTag.trim()) return
    setCreating(true)
    sendCommand('create_faction', {
      name: createName.trim(),
      tag: createTag.trim().toUpperCase(),
    })
    setTimeout(() => setCreating(false), 2000)
  }, [sendCommand, createName, createTag])

  const handleLeaveFaction = useCallback(() => {
    sendCommand('leave_faction')
  }, [sendCommand])

  const handleInvite = useCallback(() => {
    if (!inviteTarget.trim()) return
    setInviting(true)
    sendCommand('faction_invite', { player_id: inviteTarget.trim() })
    setInviteTarget('')
    setTimeout(() => setInviting(false), 2000)
  }, [sendCommand, inviteTarget])

  const handleViewInvites = useCallback(() => {
    sendCommand('get_faction_invites')
  }, [sendCommand])

  const handleLoadFactions = useCallback(() => {
    setLoadingList(true)
    sendCommand('faction_list')
    setTimeout(() => {
      setLoadingList(false)
      setListLoaded(true)
    }, 3000)
  }, [sendCommand])

  const handleDiplomacy = useCallback((action: string, factionId: string) => {
    sendCommand(action, { faction_id: factionId })
  }, [sendCommand])

  // Intel handlers
  const handleSubmitIntel = useCallback(() => {
    if (!state.system?.id) return
    setSubmittingIntel(true)
    sendCommand('faction_submit_intel', { systems: [{ system_id: state.system.id }] })
    setTimeout(() => setSubmittingIntel(false), 2000)
  }, [sendCommand, state.system])

  const handleQueryIntel = useCallback(() => {
    setQueryingIntel(true)
    const params: Record<string, unknown> = {}
    if (intelQuery.trim()) {
      params.system_name = intelQuery.trim()
    }
    sendCommand('faction_query_intel', params)
    setTimeout(() => setQueryingIntel(false), 3000)
  }, [sendCommand, intelQuery])

  const handleIntelStatus = useCallback(() => {
    setLoadingIntelStatus(true)
    sendCommand('faction_intel_status')
    setTimeout(() => setLoadingIntelStatus(false), 3000)
  }, [sendCommand])

  // Rooms handlers
  const handleLoadRooms = useCallback(() => {
    setLoadingRooms(true)
    sendCommand('faction_rooms')
    setTimeout(() => {
      setLoadingRooms(false)
      setRoomsLoaded(true)
    }, 3000)
  }, [sendCommand])

  const handleVisitRoom = useCallback((roomId: string) => {
    setLoadingRoom(true)
    setSelectedRoom(null)
    sendCommand('faction_visit_room', { room_id: roomId })
    setTimeout(() => setLoadingRoom(false), 3000)
  }, [sendCommand])

  const handleCreateRoom = useCallback(() => {
    if (!roomFormName.trim()) return
    setCreatingRoom(true)
    sendCommand('faction_write_room', {
      name: roomFormName.trim(),
      description: roomFormDesc.trim(),
      access: roomFormAccess,
    })
    setRoomFormName('')
    setRoomFormDesc('')
    setRoomFormAccess('members')
    setTimeout(() => setCreatingRoom(false), 2000)
  }, [sendCommand, roomFormName, roomFormDesc, roomFormAccess])

  const handleDeleteRoom = useCallback((roomId: string) => {
    if (!confirm('Delete this room? This cannot be undone.')) return
    setDeletingRoomId(roomId)
    sendCommand('faction_delete_room', { room_id: roomId })
    setTimeout(() => setDeletingRoomId(null), 2000)
  }, [sendCommand])

  return (
    <Panel
      title="Faction"
      icon={<Users size={16} />}
      headerRight={
        <button
          className={shared.refreshBtn}
          onClick={handleLoadFactions}
          title="Browse factions"
          disabled={loadingList}
        >
          <RefreshCw size={14} />
        </button>
      }
    >
        {hasFaction ? (
          <>
            {/* Current Faction Info */}
            <div className={styles.factionCard}>
              <div className={styles.factionName}>
                {factionInfo?.name ?? 'Your Faction'}
              </div>
              {factionInfo?.tag && (
                <span className={styles.factionTag}>
                  [{factionInfo.tag}]
                </span>
              )}
              <div className={styles.factionMeta}>
                <span className={styles.metaTag}>
                  <Users size={10} />
                  Members: <span className={styles.metaValue}>
                    {factionInfo?.member_count ?? '--'}
                  </span>
                </span>
              </div>
            </div>

            {/* Members */}
            {factionInfo?.members && factionInfo.members.length > 0 && (
              <div>
                <div className={shared.sectionTitle}>
                  <span className={styles.sectionIcon}><Users size={12} /></span>
                  Members
                </div>
                <div className={styles.memberList}>
                  {factionInfo.members.map((member: FactionMember) => (
                    <div key={member.player_id} className={styles.memberItem}>
                      <div className={styles.memberLeft}>
                        <span className={styles.memberIcon}>
                          <Users size={12} />
                        </span>
                        <span className={styles.memberName}>{member.username}</span>
                      </div>
                      <span className={styles.memberRole}>{member.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.divider} />

            {/* Invite Player */}
            <div>
              <div className={shared.sectionTitle}>
                <span className={styles.sectionIcon}><UserPlus size={12} /></span>
                Invite Player
              </div>
              <div className={styles.inviteRow}>
                <input
                  className={styles.inviteInput}
                  type="text"
                  placeholder="Player ID or username"
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

            {/* Diplomacy */}
            <div>
              <div className={shared.sectionTitle}>
                <span className={styles.sectionIcon}><Shield size={12} /></span>
                Diplomacy
              </div>
              <div className={styles.diplomacyRow}>
                <ActionButton
                  label="Ally"
                  icon={<Shield size={12} />}
                  onClick={() => handleDiplomacy('faction_ally', '')}
                  size="sm"
                />
                <ActionButton
                  label="Enemy"
                  icon={<Swords size={12} />}
                  onClick={() => handleDiplomacy('faction_enemy', '')}
                  variant="danger"
                  size="sm"
                />
                <ActionButton
                  label="Declare War"
                  icon={<Flag size={12} />}
                  onClick={() => handleDiplomacy('faction_war', '')}
                  variant="danger"
                  size="sm"
                />
              </div>
            </div>

            <div className={styles.divider} />

            {/* Intel */}
            <div className={styles.intelSection}>
              <div className={shared.sectionTitle}>
                <span className={styles.sectionIcon}><Radar size={12} /></span>
                Intel
              </div>

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
                      <span className={styles.intelSystemName}>{entry.system_name}</span>
                      {entry.submitted_by && (
                        <span className={styles.intelMeta}>by {entry.submitted_by}</span>
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
                    <span className={styles.intelStatLabel}>Systems Known</span>
                    <span className={styles.intelStatValue}>{intelStatus.systems_known}</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Total Systems</span>
                    <span className={styles.intelStatValue}>{intelStatus.total_systems}</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Coverage</span>
                    <span className={styles.intelStatValue}>{intelStatus.coverage_pct}%</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Contributors</span>
                    <span className={styles.intelStatValue}>{intelStatus.contributors}</span>
                  </div>
                  <div className={styles.intelStatItem}>
                    <span className={styles.intelStatLabel}>Top Contributor</span>
                    <span className={styles.intelStatValue}>{intelStatus.top_contributor}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rooms - only when docked */}
            {state.isDocked && (
              <>
                <div className={styles.divider} />

                <div className={styles.roomSection}>
                  <div className={shared.sectionTitle}>
                    <span className={styles.sectionIcon}><DoorOpen size={12} /></span>
                    Rooms
                  </div>

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
                              {room.access} -- {room.author}
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
                        disabled={!roomFormName.trim() || creatingRoom}
                        loading={creatingRoom}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className={styles.divider} />

            {/* Leave Faction */}
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
            {/* Create Faction */}
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

            <div className={styles.divider} />

            {/* View Invites */}
            <ActionButton
              label="View Invites"
              icon={<UserPlus size={14} />}
              onClick={handleViewInvites}
              variant="secondary"
              size="sm"
            />
          </>
        )}

        <div className={styles.divider} />

        {/* Faction Browser */}
        <div>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><Users size={12} /></span>
            Faction Browser
          </div>
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
                  <span className={styles.factionListName}>{f.name}</span>
                  <span className={styles.factionListTag}>[{f.tag}]</span>
                  <span className={styles.factionListMembers}>
                    {f.member_count} members
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
    </Panel>
  )
}
