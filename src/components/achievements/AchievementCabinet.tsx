import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  type PublicAchievementsResponse,
  accentFor,
  empireLabel,
  rarityLabel,
  hasEmblem,
  emblemSrc,
} from '@/lib/publicAchievements'
import { FactionLink, PlayerLink } from '@/components/profile/ProfileLink'
import styles from './AchievementCabinet.module.css'

// A public "service dossier" — a subject's full achievement cabinet: identity +
// summary header, then every achievement as a tile (earned / locked / secret).
// shareHref, when provided, turns earned tiles into links to their share card.
export function AchievementCabinet({
  data,
  shareHref,
}: {
  data: PublicAchievementsResponse
  shareHref?: (id: string) => string
}) {
  const accent = accentFor(data.subject.empire)
  const { subject, summary, achievements } = data
  const pct = summary.total > 0 ? Math.round((summary.earned / summary.total) * 100) : 0
  const isFaction = subject.type === 'faction'

  return (
    <main className={styles.page} style={{ '--accent': accent } as CSSProperties}>
      <div className={styles.ambient} aria-hidden />

      <header className={styles.header}>
        <div className={styles.identity}>
          <p className={styles.kicker}>
            {isFaction ? 'Faction Dossier' : 'Pilot Dossier'}
          </p>
          <h1 className={styles.name}>
            {isFaction && subject.faction_tag ? (
              <FactionLink tag={subject.faction_tag} className={styles.nameLink}>
                {subject.name}
              </FactionLink>
            ) : (
              <PlayerLink name={subject.name} className={styles.nameLink} />
            )}
            {subject.faction_tag && !isFaction && (
              <span className={styles.tagInline}>
                <FactionLink tag={subject.faction_tag} className={styles.tagLink}>
                  [{subject.faction_tag}]
                </FactionLink>
              </span>
            )}
          </h1>
          <p className={styles.affiliation}>
            {isFaction ? `[${subject.faction_tag}]` : empireLabel(subject.empire)}
          </p>
          {subject.titles && subject.titles.length > 0 && (
            <div className={styles.titles}>
              {subject.titles.map((t) => (
                <span key={t} className={styles.titleChip}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.stats}>
          <div className={styles.statBig}>
            <span className={styles.statNum}>{summary.earned}</span>
            <span className={styles.statDenom}>/ {summary.total}</span>
            <span className={styles.statLabel}>Unlocked</span>
          </div>
          <div className={styles.statBig}>
            <span className={styles.statNum}>{summary.points}</span>
            <span className={styles.statLabel}>Points</span>
          </div>
          <div className={styles.completion}>
            <div className={styles.completionBar}>
              <div className={styles.completionFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.completionPct}>{pct}% complete</span>
          </div>
        </div>
      </header>

      <ul className={styles.grid}>
        {achievements.map((a) => {
          const glyph = (a.emblem || a.name).charAt(0).toUpperCase()
          // Link earned and ordinary locked tiles to their detail page; keep
          // unearned SECRET tiles unlinked so the real id stays out of the URL.
          const secretLocked = a.hidden && !a.earned
          const href = shareHref && !secretLocked ? shareHref(a.id) : undefined
          const inner = (
            <>
              <div className={styles.tEmblem} aria-hidden>
                {a.earned && hasEmblem(a.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.tEmblemImg} src={emblemSrc(a.id)} alt="" />
                ) : a.earned ? (
                  glyph
                ) : a.hidden ? (
                  '?'
                ) : (
                  '🔒'
                )}
              </div>
              <div className={styles.tBody}>
                <p className={styles.tName}>{a.name}</p>
                <p className={styles.tCategory}>{a.category}</p>
                <p className={styles.tRarity}>{rarityLabel(a.rarity_pct, isFaction ? 'factions' : 'pilots')}</p>
              </div>
              <div className={styles.tMeta}>
                <span className={styles.tPoints}>{a.points}</span>
                {a.earned && <span className={styles.tCheck} aria-hidden>✓</span>}
              </div>
            </>
          )
          const cls = `${styles.tile} ${a.earned ? styles.earned : styles.locked} ${a.hidden && !a.earned ? styles.secret : ''}`
          return (
            <li key={a.id}>
              {href ? (
                <Link href={href} className={cls}>
                  {inner}
                  <span className={styles.tShare}>{a.earned ? 'Share ↗' : 'Details →'}</span>
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          )
        })}
      </ul>

      <div className={styles.foot}>
        <Link href="/" className={styles.cta}>▶ Play SpaceMolt free</Link>
        <Link href="/leaderboard" className={styles.footLink}>View the leaderboard</Link>
      </div>
    </main>
  )
}
