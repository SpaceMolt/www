'use client'

import { useState } from 'react'
import { Search, User, Trophy } from 'lucide-react'
import { useCommandQuery } from '@/lib/spacemolt'
import { formatDate, formatDuration, formatNumber } from '@/lib/format'
import { ActionButton } from '../../ActionButton'
import { Loading, shared } from '../../shared'
import styles from '../InfoPanel.module.css'

/** Public profile lookup by username (get_player_profile). */
/** Bookkeeping stats the server tracks for taxes; not a lifetime stat to a player. */
const INTERNAL_STAT = /taxable|_snapshot$/

export function PilotTab() {
  const [input, setInput] = useState('')
  const [username, setUsername] = useState('')
  const profile = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_player_profile({ username })).structuredContent,
    [username],
    { enabled: Boolean(username) },
  )
  const search = () => setUsername(input.trim())
  const p = username ? profile.data : undefined

  return (
    <div className={styles.tabBody}>
      <div className={styles.filterRow}>
        <input
          className={styles.noteInput}
          style={{ flex: 1 }}
          type="text"
          placeholder="Pilot username"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <ActionButton label="Look Up" icon={<Search size={12} />} onClick={search} disabled={!input.trim()} variant="secondary" size="sm" />
      </div>
      {username && profile.loading && <Loading message="Looking up pilot..." />}
      {username && profile.error && !profile.loading && <div className={styles.errorBanner}>{profile.error}</div>}
      {p && !profile.loading && !profile.error && (
        <>
          <div className={styles.versionCard} style={p.primary_color ? { borderColor: p.primary_color } : undefined}>
            <div className={styles.versionNumber}>
              <User size={12} /> {p.clan_tag ? `[${p.clan_tag}] ` : ''}{p.username}
            </div>
            <div className={styles.versionDate}>
              {p.empire_name ?? p.empire} - {p.online ? 'Online' : 'Offline'} - joined {formatDate(p.created_at)}
            </div>
            {p.faction && (
              <div className={styles.versionDate}>
                Faction: [{p.faction.tag}] {p.faction.name}{p.faction.role ? ` (${p.faction.role})` : ''}
              </div>
            )}
            {p.status_message && <div className={styles.versionMotd}>{p.status_message}</div>}
            {p.titles && p.titles.length > 0 && <div className={styles.versionDate}>Titles: {p.titles.join(', ')}</div>}
            <div className={styles.versionDate}>
              <Trophy size={10} /> {p.achievements.earned}/{p.achievements.total} achievements, {formatNumber(p.achievements.points)} pts
            </div>
          </div>
          {p.ranks.length > 0 && (
            <div className={styles.logList}>
              {p.ranks.map((r) => (
                <div key={r.category} className={styles.logItem}>#{r.rank} {r.label} ({formatNumber(r.value)})</div>
              ))}
            </div>
          )}
          <div className={shared.sectionTitle}>Lifetime Stats</div>
          <div className={styles.statsGrid}>
            {Object.entries(p.stats).filter(([key]) => !INTERNAL_STAT.test(key)).map(([key, value]) => (
              <div key={key} className={styles.statItem}>
                <span className={styles.statLabel}>{key.replace(/_/g, ' ')}</span>
                <span className={styles.statValue}>{key === 'time_played' ? formatDuration(value) : formatNumber(value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
