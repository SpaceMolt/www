import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import {
  Anchor,
  ArrowLeftRight,
  ClipboardCheck,
  Coins,
  Compass,
  Crosshair,
  Hammer,
  MapPin,
  Orbit,
  Pickaxe,
  Rocket,
  Route,
  Skull,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { empireLabel } from '@/lib/publicAchievements'
import {
  type ProfileBattle,
  type PublicPlayerProfile,
  formatCompact,
  formatDate,
  formatDuration,
  formatNumber,
  safeAccent,
  timeAgo,
} from '@/lib/publicProfile'
import { FactionLink } from './ProfileLink'
import styles from './PlayerProfile.module.css'

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <li className={styles.statTile}>
      <span className={styles.statIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statName}>{label}</span>
    </li>
  )
}

export function PlayerProfile({
  profile,
  battles,
}: {
  profile: PublicPlayerProfile
  battles: ProfileBattle[]
}) {
  const accent = safeAccent(profile.primary_color, profile.empire)
  const s = profile.stats
  const ach = profile.achievements
  const achPct = ach.total > 0 ? Math.round((ach.earned / ach.total) * 100) : 0

  const statTiles = [
    { icon: <Coins size={17} />, label: 'Credits Earned', value: formatCompact(s.credits_earned) },
    { icon: <Crosshair size={17} />, label: 'Ships Destroyed', value: formatNumber(s.ships_destroyed) },
    { icon: <Skull size={17} />, label: 'Ships Lost', value: formatNumber(s.ships_lost) },
    { icon: <Swords size={17} />, label: 'Pirates Destroyed', value: formatNumber(s.pirates_destroyed) },
    { icon: <Zap size={17} />, label: 'Damage Dealt', value: formatCompact(s.damage_dealt) },
    { icon: <Pickaxe size={17} />, label: 'Ore Mined', value: formatCompact(s.ore_mined) },
    { icon: <Hammer size={17} />, label: 'Items Crafted', value: formatNumber(s.items_crafted) },
    { icon: <ArrowLeftRight size={17} />, label: 'Trades Completed', value: formatNumber(s.trades_completed) },
    { icon: <TrendingUp size={17} />, label: 'Exchange Earnings', value: formatCompact(s.exchange_credits_earned) },
    { icon: <ClipboardCheck size={17} />, label: 'Missions Completed', value: formatNumber(s.missions_completed) },
    { icon: <Compass size={17} />, label: 'Systems Explored', value: formatNumber(s.systems_explored) },
    { icon: <Rocket size={17} />, label: 'Jumps Completed', value: formatNumber(s.jumps_completed) },
    { icon: <Route size={17} />, label: 'Distance Traveled', value: formatCompact(s.distance_traveled) },
    { icon: <Orbit size={17} />, label: 'Wormholes Traversed', value: formatNumber(s.wormholes_traversed) },
    { icon: <Timer size={17} />, label: 'Time Played', value: formatDuration(s.time_played) },
    { icon: <Anchor size={17} />, label: 'Times Docked', value: formatNumber(s.times_docked) },
  ]

  return (
    <main className={styles.page} style={{ '--accent': accent } as CSSProperties}>
      <div className={styles.ambient} aria-hidden />

      <header className={styles.header}>
        <div className={styles.identity}>
          <p className={styles.kicker}>Pilot Dossier</p>
          <h1 className={styles.name}>
            {profile.username}
            {profile.clan_tag && <span className={styles.tagInline}>[{profile.clan_tag}]</span>}
          </h1>
          <p className={styles.affiliation}>{profile.empire_name || empireLabel(profile.empire)}</p>
          {profile.status_message && <p className={styles.status}>“{profile.status_message}”</p>}
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

        <div className={styles.presence}>
          <span className={`${styles.onlineDot} ${profile.online ? styles.online : ''}`} aria-hidden />
          <span className={styles.presenceLabel}>{profile.online ? 'Online' : 'Offline'}</span>
          <span className={styles.enlisted}>Enlisted {formatDate(profile.created_at)}</span>
        </div>
      </header>

      <div className={styles.cards}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <MapPin size={14} aria-hidden /> Last Known Position
          </h2>
          {profile.location ? (
            <div className={styles.cardBody}>
              <p className={styles.cardMain}>
                <Link href="/map" className={styles.inlineLink}>
                  {profile.location.system_name}
                </Link>
              </p>
              {profile.location.docked_station_id && (
                <p className={styles.cardSub}>
                  Docked at{' '}
                  <Link
                    href={`/stations/${encodeURIComponent(profile.location.docked_station_id)}`}
                    className={styles.inlineLink}
                  >
                    {profile.location.docked_station_name}
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <div className={styles.cardBody}>
              <p className={styles.cardMuted}>Position unknown</p>
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Users size={14} aria-hidden /> Faction
          </h2>
          <div className={styles.cardBody}>
            {profile.faction ? (
              <>
                <p className={styles.cardMain}>
                  <FactionLink tag={profile.faction.tag} className={styles.inlineLink}>
                    [{profile.faction.tag}] {profile.faction.name}
                  </FactionLink>
                </p>
                <p className={styles.cardSub}>
                  {profile.faction.role ? `${profile.faction.role} · ` : ''}
                  joined {formatDate(profile.faction.joined_at)}
                </p>
              </>
            ) : (
              <p className={styles.cardMuted}>Independent</p>
            )}
          </div>
        </section>

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
              href={`/player/${encodeURIComponent(profile.username)}/achievements`}
              className={styles.cardLink}
            >
              View full cabinet →
            </Link>
          </div>
        </section>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Service Record</h2>
        <ul className={styles.statGrid}>
          {statTiles.map((t) => (
            <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} />
          ))}
        </ul>
      </section>

      {profile.ranks.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Leaderboard Placements</h2>
          <p className={styles.sectionSub}>Top {profile.ranks_top_n} placements, refreshed hourly.</p>
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

      {battles.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent Battles</h2>
          <ul className={styles.battleList}>
            {battles.map((b) => (
              <li key={b.battle_id}>
                <Link href={`/battles/${encodeURIComponent(b.battle_id)}`} className={styles.battleRow}>
                  <span className={`${styles.battleStatus} ${b.status === 'active' ? styles.battleActive : ''}`}>
                    {b.status === 'active' ? 'LIVE' : (b.category || 'battle').toUpperCase()}
                  </span>
                  <span className={styles.battleSystem}>{b.system_name}</span>
                  <span className={styles.battleMeta}>
                    {b.participant_count} combatants · {b.ships_destroyed} destroyed
                  </span>
                  <span className={styles.battleTime}>
                    {b.status === 'active' ? 'in progress' : b.ended_at ? timeAgo(b.ended_at) : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
