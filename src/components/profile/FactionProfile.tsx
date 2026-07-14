import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  Building2,
  Crown,
  Handshake,
  ScrollText,
  Swords,
  Trophy,
  Users,
  Vault,
} from 'lucide-react'
import {
  type PublicFactionProfile,
  formatCompact,
  formatDate,
  formatNumber,
  safeAccent,
  timeAgo,
} from '@/lib/publicProfile'
import { FactionLink, PlayerLink } from './ProfileLink'
import styles from './FactionProfile.module.css'

export function FactionProfile({ profile }: { profile: PublicFactionProfile }) {
  const accent = safeAccent(profile.primary_color)
  const secondary = safeAccent(profile.secondary_color)
  const ach = profile.achievements
  const achPct = ach.total > 0 ? Math.round((ach.earned / ach.total) * 100) : 0
  const hasDiplomacy =
    profile.allies.length > 0 || profile.enemies.length > 0 || profile.wars.length > 0

  return (
    <main className={styles.page} style={{ '--accent': accent, '--accent2': secondary } as CSSProperties}>
      <div className={styles.ambient} aria-hidden />

      <header className={styles.header}>
        <div className={styles.banner} aria-hidden />
        <div className={styles.identity}>
          <p className={styles.kicker}>Faction Dossier</p>
          <h1 className={styles.name}>
            <span className={styles.tagInline}>[{profile.tag}]</span>
            {profile.name}
          </h1>
          {profile.description && <p className={styles.description}>{profile.description}</p>}
          {profile.titles && profile.titles.length > 0 && (
            <div className={styles.titles}>
              {profile.titles.map((t) => (
                <span key={t} className={styles.titleChip}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <dl className={styles.meta}>
          <div className={styles.metaItem}>
            <dt>
              <Crown size={13} aria-hidden /> Leader
            </dt>
            <dd>{profile.leader ? <PlayerLink name={profile.leader} className={styles.inlineLink} /> : '—'}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>
              <Users size={13} aria-hidden /> Members
            </dt>
            <dd>{formatNumber(profile.member_count)}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>
              <Vault size={13} aria-hidden /> Treasury
            </dt>
            <dd>{formatCompact(profile.treasury)} cr</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Founded</dt>
            <dd>{formatDate(profile.created_at)}</dd>
          </div>
        </dl>
      </header>

      {profile.charter && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <ScrollText size={15} aria-hidden /> Charter
          </h2>
          <blockquote className={styles.charter}>{profile.charter}</blockquote>
        </section>
      )}

      <div className={styles.cards}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Trophy size={14} aria-hidden /> Achievements
          </h2>
          <div className={styles.cardBody}>
            <p className={styles.cardMain}>
              {ach.earned} <span className={styles.cardDenom}>/ {ach.total}</span>
              <span className={styles.cardPoints}>{ach.points} pts</span>
            </p>
            <div className={styles.completionBar}>
              <div className={styles.completionFill} style={{ width: `${achPct}%` }} />
            </div>
            <Link
              href={`/faction/${encodeURIComponent(profile.tag)}/achievements`}
              className={styles.cardLink}
            >
              View full cabinet →
            </Link>
          </div>
        </section>

        {profile.ranks.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Leaderboard Placements</h2>
            <ul className={styles.rankList}>
              {profile.ranks.map((r) => (
                <li key={r.category}>
                  <Link href="/leaderboard" className={styles.rankRow}>
                    <span className={styles.rankBadge}>#{r.rank}</span>
                    <span className={styles.rankLabel}>{r.label}</span>
                    <span className={styles.rankValue}>{formatCompact(r.value)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {hasDiplomacy && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Handshake size={15} aria-hidden /> Diplomacy
          </h2>
          <div className={styles.diplomacy}>
            {profile.allies.length > 0 && (
              <div className={styles.dipGroup}>
                <h3 className={styles.dipLabel}>Allies</h3>
                <div className={styles.dipChips}>
                  {profile.allies.map((a) => (
                    <FactionLink key={a.tag} tag={a.tag} className={`${styles.dipChip} ${styles.ally}`}>
                      [{a.tag}] {a.name}
                    </FactionLink>
                  ))}
                </div>
              </div>
            )}
            {profile.enemies.length > 0 && (
              <div className={styles.dipGroup}>
                <h3 className={styles.dipLabel}>Enemies</h3>
                <div className={styles.dipChips}>
                  {profile.enemies.map((e) => (
                    <FactionLink key={e.tag} tag={e.tag} className={`${styles.dipChip} ${styles.enemy}`}>
                      [{e.tag}] {e.name}
                    </FactionLink>
                  ))}
                </div>
              </div>
            )}
            {profile.wars.length > 0 && (
              <div className={styles.dipGroup}>
                <h3 className={styles.dipLabel}>
                  <Swords size={13} aria-hidden /> Active Wars
                </h3>
                <ul className={styles.warList}>
                  {profile.wars.map((w) => (
                    <li key={w.target_tag} className={styles.warRow}>
                      <FactionLink tag={w.target_tag} className={styles.inlineLink}>
                        [{w.target_tag}] {w.target_name}
                      </FactionLink>
                      <span className={styles.warScore}>
                        {w.our_kills} : {w.their_kills}
                      </span>
                      <span className={styles.warMeta}>
                        {w.aggressor ? 'declared' : 'defending'} · since {formatDate(w.started_at)}
                        {w.reason ? ` · ${w.reason}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {profile.stations.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Building2 size={15} aria-hidden /> Stations
          </h2>
          <ul className={styles.stationList}>
            {profile.stations.map((st) => (
              <li key={st.id}>
                <Link href={`/stations/${encodeURIComponent(st.id)}`} className={styles.stationRow}>
                  <span className={styles.stationName}>{st.name}</span>
                  {st.system_name && <span className={styles.stationSystem}>{st.system_name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <Users size={15} aria-hidden /> Roster
        </h2>
        <div className={styles.rosterWrap}>
          <table className={styles.roster}>
            <thead>
              <tr>
                <th>Pilot</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {profile.members.map((m) => (
                <tr key={m.username}>
                  <td>
                    <PlayerLink name={m.username} className={styles.inlineLink} />
                  </td>
                  <td>{m.role || '—'}</td>
                  <td>{formatDate(m.joined_at)}</td>
                  <td>{timeAgo(m.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
