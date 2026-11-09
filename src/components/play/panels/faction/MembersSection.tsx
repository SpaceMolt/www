'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Commands, FactionInfoResponse } from '@spacemolt/lib'
import { useCommandMutation } from '@/lib/spacemolt'
import { playerHref } from '@/components/profile/ProfileLink'
import { ConfirmAction, shared } from '../../shared'
import styles from '../FactionPanel.module.css'
import { pageState } from './factionAdmin'
import { useRun } from './useRun'

type PromoteRole = Parameters<Commands['spacemolt_faction_admin']['promote']>[0]['role_id']

/** Prev/next buttons for an offset-paged list; renders nothing on a single page. */
export function Pager({ offset, limit, total, onPage }: { offset: number; limit?: number; total: number; onPage: (offset: number) => void }) {
  const { page, pages, prevOffset, nextOffset } = pageState({ offset, limit, total })
  if (pages <= 1) return null
  return (
    <div className={styles.pager}>
      <button className={shared.subtleBtn} onClick={() => prevOffset !== null && onPage(prevOffset)} disabled={prevOffset === null} aria-label="Previous page" type="button">
        <ChevronLeft size={12} />
      </button>
      <span>Page {page} of {pages}</span>
      <button className={shared.subtleBtn} onClick={() => nextOffset !== null && onPage(nextOffset)} disabled={nextOffset === null} aria-label="Next page" type="button">
        <ChevronRight size={12} />
      </button>
    </div>
  )
}

/** Member roster: role changes (promote/demote), kick with confirmation, and paging past 50. */
export function MembersSection({ info, playerId, onPage, onChanged }: {
  info: FactionInfoResponse
  playerId: string | undefined
  onPage: (offset: number) => void
  onChanged: () => void
}) {
  const mutate = useCommandMutation()
  const { busy, run } = useRun()
  const [kicking, setKicking] = useState<string | null>(null)
  const roles = [...(info.roles ?? [])].sort((a, b) => b.priority - a.priority)
  // Members carry the role name; promote takes the role id.
  const roleIdOf = (roleName: string) => roles.find((r) => r.name === roleName || r.id === roleName)?.id ?? ''

  const promote = async (memberId: string, username: string, roleId: string) => {
    const role = roles.find((r) => r.id === roleId)
    const ok = await run(
      `role:${memberId}`,
      // Custom role ids are valid server-side; the lib enum lists only the built-in ones.
      () => mutate((c) => c.spacemolt_faction_admin.promote({ player_id: memberId, role_id: roleId as PromoteRole }), { label: 'faction_promote' }),
      `${username} is now ${role?.name ?? roleId}`,
    )
    if (ok) onChanged()
  }

  const kick = async (memberId: string, username: string) => {
    setKicking(null)
    if (await run(`kick:${memberId}`, () => mutate((c) => c.spacemolt_faction.kick({ id: memberId }), { label: 'faction_kick' }), `Kicked ${username}`)) onChanged()
  }

  return (
    <>
      <div className={styles.memberList}>
        {(info.members ?? []).map((member) => (
          <div key={member.player_id} className={styles.memberItem}>
            <div className={styles.memberLeft}>
              <span className={`${styles.onlineDot} ${member.is_online ? styles.online : ''}`} />
              {/* New tab so the live play session isn't navigated away. */}
              <a href={playerHref(member.username)} className={styles.memberName} target="_blank" rel="noreferrer">
                {member.username}
              </a>
            </div>
            {kicking === member.player_id ? (
              <ConfirmAction message={`Kick ${member.username}?`} onConfirm={() => kick(member.player_id, member.username)} onCancel={() => setKicking(null)} />
            ) : (
              <div className={styles.memberRight}>
                {member.player_id !== playerId && roles.length > 0 && member.player_id !== info.leader_id ? (
                  <select
                    className={styles.roleSelect}
                    value={roleIdOf(member.role)}
                    onChange={(e) => promote(member.player_id, member.username, e.target.value)}
                    disabled={busy === `role:${member.player_id}`}
                    aria-label={`Role for ${member.username}`}
                  >
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                ) : (
                  <span className={styles.memberRole}>{member.role}</span>
                )}
                {member.player_id !== playerId && (
                  <button
                    className={styles.kickBtn}
                    onClick={() => setKicking(member.player_id)}
                    disabled={busy === `kick:${member.player_id}`}
                    title={`Kick ${member.username}`}
                    aria-label={`Kick ${member.username}`}
                    type="button"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <Pager offset={info.members_offset ?? 0} limit={info.members_limit} total={info.member_count} onPage={onPage} />
    </>
  )
}
