'use client'

import { useState, useCallback } from 'react'
import { Users, Flag, Shield, UserPlus, UserMinus, Swords, RefreshCw } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import type { Faction, FactionMember } from '../types'
import styles from './FactionPanel.module.css'

interface FactionListEntry {
  id: string
  name: string
  tag: string
  member_count: number
}

export function FactionPanel() {
  const { state, sendCommand } = useGame()
  const [factionInfo, setFactionInfo] = useState<Faction | null>(null)
  const [factionList, setFactionList] = useState<FactionListEntry[]>([])
  const [listLoaded, setListLoaded] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createTag, setCreateTag] = useState('')
  const [inviteTarget, setInviteTarget] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)

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

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}><Users size={16} /></span>
          Faction
        </div>
        <button
          className={styles.refreshBtn}
          onClick={handleLoadFactions}
          title="Browse factions"
          disabled={loadingList}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className={styles.content}>
        {hasFaction ? (
          <>
            {/* Current Faction Info */}
            <div className={styles.factionCard}>
              <div className={styles.factionName}>
                {state.player?.faction_name ?? 'Your Faction'}
              </div>
              {state.player?.faction_tag && (
                <span className={styles.factionTag}>
                  [{state.player.faction_tag}]
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
                <div className={styles.sectionTitle}>
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
              <div className={styles.sectionTitle}>
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
              <div className={styles.sectionTitle}>
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
              <div className={styles.sectionTitle}>
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
          <div className={styles.sectionTitle}>
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
              <span className={styles.spinner} />
              Loading factions...
            </div>
          )}
          {listLoaded && factionList.length === 0 && (
            <div className={styles.emptyState}>
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
      </div>
    </div>
  )
}
