import type { CSSProperties } from 'react'
import Link from 'next/link'
import {
  type PublicAchievementEntry,
  accentFor,
  empireLabel,
  rarityLabel,
  hasEmblem,
  emblemSrc,
} from '@/lib/publicAchievements'
import { ShareActions } from './ShareActions'
import styles from './AchievementDetailCard.module.css'

export interface DetailSubject {
  type: 'player' | 'faction'
  name: string
  empire?: string
  faction_tag?: string
}

// The full-page achievement detail / share card, shared by the player share page
// (/a/[player]/[achievement]) and the faction detail page. Renders the earned
// card or a locked teaser, themed by the subject's accent.
export function AchievementDetailCard({
  ach,
  subject,
  summary,
}: {
  ach: PublicAchievementEntry
  subject: DetailSubject
  summary: { earned: number; total: number }
}) {
  const accent = accentFor(subject.empire)
  const noun = subject.type === 'faction' ? 'factions' : 'pilots'
  const emblemGlyph = (ach.emblem || ach.name).charAt(0).toUpperCase()
  const subjectMeta =
    subject.type === 'faction'
      ? subject.faction_tag
        ? `[${subject.faction_tag}]`
        : 'Faction'
      : empireLabel(subject.empire)

  if (!ach.earned) {
    return (
      <main className={styles.page} style={{ '--accent': accent } as CSSProperties}>
        <div className={styles.ambient} aria-hidden />
        <section className={styles.lockedCard}>
          <p className={styles.eyebrow}>Locked</p>
          <h1 className={styles.lockedName}>{ach.hidden ? 'Secret Achievement' : ach.name}</h1>
          <p className={styles.desc}>
            {subject.name} {subject.type === 'faction' ? 'haven’t' : 'hasn’t'} earned this one yet.
            The galaxy is wide — claim it first.
          </p>
          <Link href="/" className={styles.ctaPrimary}>Play SpaceMolt free</Link>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page} style={{ '--accent': accent } as CSSProperties}>
      <div className={styles.ambient} aria-hidden />
      <div className={styles.stars} aria-hidden />

      <section className={styles.card}>
        <span className={`${styles.bracket} ${styles.btl}`} aria-hidden />
        <span className={`${styles.bracket} ${styles.btr}`} aria-hidden />
        <span className={`${styles.bracket} ${styles.bbl}`} aria-hidden />
        <span className={`${styles.bracket} ${styles.bbr}`} aria-hidden />

        <header className={styles.cardHead}>
          <p className={styles.eyebrow}>
            <span className={styles.pulse} aria-hidden /> Achievement Unlocked
          </p>
          <span className={styles.category}>{ach.category}</span>
        </header>

        <div className={styles.emblem} aria-hidden>
          {hasEmblem(ach.id) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.emblemImg} src={emblemSrc(ach.id)} alt="" />
          ) : (
            <>
              <div className={styles.emblemRing} />
              <div className={styles.emblemCore}>
                <span>{emblemGlyph}</span>
              </div>
            </>
          )}
        </div>

        <h1 className={styles.name}>{ach.name}</h1>
        <p className={styles.desc}>{ach.description}</p>

        <div className={styles.rarity}>
          <div className={styles.rarityHead}>
            <span className={styles.rarityPct}>
              {ach.rarity_pct > 0 && ach.rarity_pct < 1
                ? `${ach.rarity_pct.toFixed(1)}%`
                : ach.rarity_pct >= 1
                  ? `${Math.round(ach.rarity_pct)}%`
                  : '—'}
            </span>
            <span className={styles.rarityLabel}>{rarityLabel(ach.rarity_pct, noun)}</span>
          </div>
          <div className={styles.meter}>
            <div
              className={styles.meterFill}
              style={{ width: `${Math.max(2, Math.min(100, ach.rarity_pct))}%` }}
            />
          </div>
        </div>

        <footer className={styles.pilot}>
          <div className={styles.pilotId}>
            <span className={styles.pilotName}>{subject.name}</span>
            <span className={styles.pilotEmpire}>{subjectMeta}</span>
          </div>
          <div className={styles.pilotMeta}>
            {subject.type === 'player' && subject.faction_tag && (
              <span className={styles.factionChip}>[{subject.faction_tag}]</span>
            )}
            <span className={styles.points}>+{ach.points} pts</span>
          </div>
        </footer>
      </section>

      <div className={styles.actions}>
        <Link href="/" className={styles.ctaPrimary}>
          ▶ Play SpaceMolt free
        </Link>
        <ShareActions name={ach.name} pilot={subject.name} rarity={rarityLabel(ach.rarity_pct, noun)} />
      </div>

      <p className={styles.tagline}>
        Earned in the Crustacean Cosmos · {subject.name} holds {summary.earned} of {summary.total}{' '}
        achievements
      </p>
    </main>
  )
}
