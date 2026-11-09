'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, History, Search } from 'lucide-react'
import { useCommandQuery } from '@/lib/spacemolt'
import { fetchRecentBattles, type ProfileBattle } from '@/lib/publicProfile'
import { shared } from '../../shared'
import { describeTick, nextTickStart } from './combatLogic'
import styles from '../CombatPanel.module.css'

const PAGE_TICKS = 20

export function HistoryTab({ lastBattleId, username }: { lastBattleId: string | null; username?: string }) {
  const [input, setInput] = useState(lastBattleId ?? '')
  const [battleId, setBattleId] = useState(lastBattleId ?? '')
  // Tick starts of the pages already viewed, for Prev.
  const [pages, setPages] = useState<(number | undefined)[]>([undefined])
  const [recent, setRecent] = useState<ProfileBattle[] | null>(null)
  const tickStart = pages[pages.length - 1]

  useEffect(() => {
    if (lastBattleId) setInput((current) => current || lastBattleId)
  }, [lastBattleId])

  // The public battles API lists finished battles by participant name.
  useEffect(() => {
    if (!username) return
    let live = true
    fetchRecentBattles(username).then((list) => live && setRecent(list), () => live && setRecent([]))
    return () => {
      live = false
    }
  }, [username])

  const open = (id: string) => {
    setInput(id)
    setBattleId(id)
    setPages([undefined])
  }

  const summary = useCommandQuery(
    async (account) => (await account.commands.spacemolt_battle.summary({ id: battleId })).structuredContent,
    [battleId],
    { enabled: Boolean(battleId) },
  )
  const log = useCommandQuery(
    async (account) =>
      (await account.commands.spacemolt_battle.log({ id: battleId, limit: PAGE_TICKS, tick_start: tickStart })).structuredContent,
    [battleId, tickStart],
    { enabled: Boolean(battleId) },
  )
  const sum = summary.data
  const entries = log.data?.entries ?? []
  const next = nextTickStart(entries)

  return (
    <>
      <form
        className={styles.formRow}
        onSubmit={(e) => {
          e.preventDefault()
          if (input.trim()) open(input.trim())
        }}
      >
        <input className={shared.textInput} placeholder="Battle ID" aria-label="Battle ID" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className={shared.accentBtn} type="submit" disabled={!input.trim()}>
          <Search size={12} /> Load
        </button>
      </form>

      {recent && recent.length > 0 && (
        <div>
          <div className={shared.sectionTitle}><History size={12} /> Your recent battles</div>
          <div className={styles.reloadList}>
            {recent.map((b) => (
              <button key={b.battle_id} className={`${shared.listCard} ${styles.listButton}`} onClick={() => open(b.battle_id)} type="button">
                <span className={shared.listCardName}>{b.sides.map((s) => s.participants.join(', ')).join(' vs ')}</span>
                <span className={shared.listCardMeta}>
                  {b.outcome ?? 'active'}
                  {b.ended_at ? ` · ${new Date(b.ended_at).toLocaleString()}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!battleId && <div className={shared.emptyState}>Enter a battle ID to see its summary and tick log.</div>}
      {summary.error && <div className={shared.emptyState}>{summary.error}</div>}

      {sum && (
        <div className={styles.reloadCard}>
          <div className={styles.participantHeader}>
            <span className={styles.reloadWeaponName}>
              {sum.system_name} · {sum.status === 'active' ? 'in progress' : sum.outcome}
            </span>
            <a className={styles.participantShip} href={`/battles/${encodeURIComponent(sum.battle_id)}`} target="_blank" rel="noreferrer">
              Full replay <ExternalLink size={10} />
            </a>
          </div>
          <div className={styles.statRow}>
            <span>{sum.duration_ticks} ticks</span>
            <span>{sum.participant_count} pilots</span>
            <span>{sum.ships_destroyed} destroyed</span>
            {sum.ships_captured ? <span>{sum.ships_captured} captured</span> : null}
            <span>{sum.total_damage} damage</span>
            {sum.category && <span>{sum.category}</span>}
          </div>
          {sum.top_damage && <small className={styles.hint}>Top damage: {sum.top_damage.username} ({sum.top_damage.damage})</small>}
          <div className={styles.sidesRow}>
            {sum.sides.map((side) => (
              <div key={side.side_id} className={styles.sideCard}>
                <span className={styles.sideName}>
                  Side {side.side_id}
                  {side.faction_tag ? ` [${side.faction_tag}]` : ''}
                  {side.side_id === sum.winning_side ? ' · won' : ''}
                </span>
                <span className={styles.sideCount}>{side.participants.join(', ')}</span>
              </div>
            ))}
          </div>
          {sum.destroyed_names?.length ? <small className={styles.hint}>Destroyed: {sum.destroyed_names.join(', ')}</small> : null}
          {sum.captures?.map((c) => (
            <small key={c.boarding_operation_id} className={styles.hint}>
              {c.captor_username} captured {c.former_owner_username}&apos;s {c.ship_class}
            </small>
          ))}
        </div>
      )}

      {battleId && (
        <div>
          <div className={shared.sectionTitle}>
            Tick log{log.data ? ` · ${log.data.total_ticks} ticks logged` : ''}
          </div>
          {log.error && <div className={shared.emptyState}>{log.error}</div>}
          {log.data && entries.length === 0 && <div className={shared.emptyState}>No ticks in this range.</div>}
          <ol className={styles.feed}>
            {entries.map((entry) => {
              const lines = describeTick(entry)
              return (
                <li key={entry.tick}>
                  <span className={styles.feedTick}>T{entry.tick}</span> {lines.length ? lines.join(' · ') : 'no hits'}
                </li>
              )
            })}
          </ol>
          <div className={styles.reloadControls}>
            <button className={shared.subtleBtn} disabled={pages.length < 2} onClick={() => setPages((p) => p.slice(0, -1))} type="button">
              <ChevronLeft size={12} /> Prev
            </button>
            <button
              className={shared.subtleBtn}
              disabled={!log.data?.has_more || next === undefined}
              onClick={() => setPages((p) => [...p, next])}
              type="button"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
