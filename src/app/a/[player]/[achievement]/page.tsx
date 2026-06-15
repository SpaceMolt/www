import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  fetchPlayerAchievements,
  findAchievement,
  accentFor,
  empireLabel,
  rarityLabel,
  safeDecode,
} from '@/lib/publicAchievements'
import { ShareActions } from './ShareActions'
import styles from './page.module.css'

type Params = Promise<{ player: string; achievement: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { player: rawP, achievement: rawA } = await params
  const player = safeDecode(rawP)
  const achievement = safeDecode(rawA)
  const data = await fetchPlayerAchievements(player)
  const ach = findAchievement(data, achievement)
  if (!data || !ach || !ach.earned) {
    return { title: 'Achievement — SpaceMolt' }
  }
  const title = `${data.subject.name} unlocked “${ach.name}”`
  const description = `${ach.description} — ${rarityLabel(ach.rarity_pct)}. Play SpaceMolt free.`
  return {
    title: `${ach.name} — ${data.subject.name}`,
    description,
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function AchievementSharePage({
  params,
}: {
  params: Params
}) {
  const { player: rawP, achievement: rawA } = await params
  const player = safeDecode(rawP)
  const achievement = safeDecode(rawA)
  const data = await fetchPlayerAchievements(player)
  if (!data) notFound()

  const ach = findAchievement(data, achievement)
  if (!ach) notFound()

  const accent = accentFor(data.subject.empire)
  const emblemGlyph = (ach.emblem || ach.name).charAt(0).toUpperCase()

  if (!ach.earned) {
    return (
      <main className={styles.page} style={{ '--accent': accent } as CSSProperties}>
        <div className={styles.ambient} aria-hidden />
        <section className={styles.lockedCard}>
          <p className={styles.eyebrow}>Locked</p>
          <h1 className={styles.lockedName}>{ach.hidden ? 'Secret Achievement' : ach.name}</h1>
          <p className={styles.desc}>
            {data.subject.name} hasn’t earned this one yet. The galaxy is wide — claim it first.
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
          <div className={styles.emblemRing} />
          <div className={styles.emblemCore}>
            <span>{emblemGlyph}</span>
          </div>
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
            <span className={styles.rarityLabel}>{rarityLabel(ach.rarity_pct)}</span>
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
            <span className={styles.pilotName}>{data.subject.name}</span>
            <span className={styles.pilotEmpire}>{empireLabel(data.subject.empire)}</span>
          </div>
          <div className={styles.pilotMeta}>
            {data.subject.faction_tag && (
              <span className={styles.factionChip}>[{data.subject.faction_tag}]</span>
            )}
            <span className={styles.points}>+{ach.points} pts</span>
          </div>
        </footer>
      </section>

      <div className={styles.actions}>
        <Link href="/" className={styles.ctaPrimary}>
          ▶ Play SpaceMolt free
        </Link>
        <ShareActions
          name={ach.name}
          pilot={data.subject.name}
          rarity={rarityLabel(ach.rarity_pct)}
        />
      </div>

      <p className={styles.tagline}>
        Earned in the Crustacean Cosmos · {data.subject.name} holds {data.summary.earned} of{' '}
        {data.summary.total} achievements
      </p>
    </main>
  )
}
