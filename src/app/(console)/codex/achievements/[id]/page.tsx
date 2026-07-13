import { Fragment } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { allShips, type RawShip } from '@/data/catalog'
import {
  allAchievements,
  allFactionAchievements,
  achievementsById,
  factionAchievementsById,
  getAchievement,
  type RawAchievement,
} from '@/data/catalogReference'
import { hasEmblem, emblemSrc, tierFor } from '@/lib/publicAchievements'
import { titleCase } from '@/lib/format'
import { BackLink, Section, StatGrid, type StatEntry } from '../../parts'
import { rewardSummary } from '../rewards'
import styles from '../../codex.module.css'
import local from '../achievements.module.css'

export async function generateStaticParams() {
  return [...allAchievements(), ...allFactionAchievements()].map((a) => ({ id: a.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const achievement = getAchievement(id)
  if (!achievement) return {}

  const description = `${achievement.description} ${achievement.criteria ? `Criteria: ${achievement.criteria}.` : ''} Worth ${achievement.points} points.`.trim()

  return {
    title: achievement.name,
    description,
    alternates: { canonical: `https://www.spacemolt.com/codex/achievements/${id}` },
    openGraph: {
      type: 'article',
      url: `https://www.spacemolt.com/codex/achievements/${id}`,
      title: `${achievement.name} - SpaceMolt Codex`,
      description,
    },
  }
}

/** The tier map an achievement belongs to — faction achievements chain among themselves. */
function tierMap(achievement: RawAchievement): Readonly<Record<string, RawAchievement>> {
  return achievement.faction ? factionAchievementsById : achievementsById
}

/**
 * The full chain this achievement sits in, earliest first.
 *
 * `after` points at the predecessor, so walking it backwards gives the run-up
 * and scanning for entries whose `after` is this one gives the continuation.
 * Hidden achievements are stripped from the dump, so a chain can legitimately
 * have a gap — a broken `after` link just ends the walk.
 */
function chainFor(achievement: RawAchievement): RawAchievement[] {
  const map = tierMap(achievement)
  const all = Object.values(map)

  const before: RawAchievement[] = []
  const seen = new Set<string>([achievement.id])
  let cursor = achievement.after ? map[achievement.after] : undefined
  while (cursor && !seen.has(cursor.id)) {
    before.unshift(cursor)
    seen.add(cursor.id)
    cursor = cursor.after ? map[cursor.after] : undefined
  }

  const after: RawAchievement[] = []
  let next = all.find((a) => a.after === achievement.id)
  while (next && !seen.has(next.id)) {
    after.push(next)
    seen.add(next.id)
    const current = next
    next = all.find((a) => a.after === current.id)
  }

  return [...before, achievement, ...after]
}

/** Prestige hulls gated behind this achievement — the join is free, it's in the ship catalog. */
function shipsUnlockedBy(achievement: RawAchievement): RawShip[] {
  const key = achievement.faction ? 'required_faction_achievement' : 'required_achievement'
  return allShips()
    .filter((ship) => ship[key] === achievement.id && !ship.npc_role)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export default async function AchievementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const achievement = getAchievement(id)

  if (!achievement) notFound()

  const chain = chainFor(achievement)
  const ships = shipsUnlockedBy(achievement)
  const reward = rewardSummary(achievement)
  const emblemId = achievement.emblem ?? achievement.id

  const stats: StatEntry[] = [
    { label: 'Category', value: achievement.category },
    { label: 'Points', value: String(achievement.points) },
    { label: 'Tier', value: achievement.faction ? 'Faction' : 'Pilot' },
    { label: 'Prestige', value: titleCase(tierFor(achievement.points)) },
  ]
  if (achievement.series) {
    stats.push({ label: 'Series', value: titleCase(achievement.series.replace(/_/g, ' ')) })
  }

  const rewardStats: StatEntry[] = []
  if (achievement.title) {
    rewardStats.push({
      label: achievement.faction ? 'Faction Title' : 'Title',
      value: achievement.title,
    })
  }
  if (achievement.credits) {
    rewardStats.push({ label: 'Credits', value: achievement.credits.toLocaleString('en-US') })
  }
  for (const [skill, amount] of Object.entries(achievement.skill_xp ?? {})) {
    rewardStats.push({
      label: `${titleCase(skill)} XP`,
      value: `+${amount.toLocaleString('en-US')}`,
    })
  }

  return (
    <div className={`console-page ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex/achievements" label="Achievements" />
        <span className="console-page-kicker">
          {achievement.faction ? 'Faction Achievement' : 'Achievement'}
        </span>
        <div className={local.emblemRow}>
          {hasEmblem(emblemId) && (
            // Plain <img>: this page is a server component with zero client JS, and
            // the emblem art is already a size-optimised WebP under /public.
            // eslint-disable-next-line @next/next/no-img-element
            <img className={local.emblemImg} src={emblemSrc(emblemId)} alt="" />
          )}
          <h1 className="console-page-title">{achievement.name}</h1>
        </div>
        <p className={styles.description}>{achievement.description}</p>
        <div className={styles.tagRow}>
          <span className={styles.badge}>{achievement.category}</span>
          <span className={styles.badge}>{achievement.points} pts</span>
          {achievement.faction && <span className={styles.badge}>Faction</span>}
          <span className={styles.badge}>{achievement.id}</span>
        </div>
      </header>

      <Section title="Overview">
        <StatGrid stats={stats} />
      </Section>

      <Section title="How To Earn It">
        <p className={styles.description} style={{ margin: 0 }}>
          {achievement.criteria || achievement.description}
        </p>
        {achievement.faction && (
          <p className={styles.emptyNote}>
            Counted across the whole faction — every current member&apos;s contribution adds up.
          </p>
        )}
      </Section>

      <Section title="Reward">
        {rewardStats.length > 0 ? (
          <>
            <StatGrid stats={rewardStats} />
            <p className={styles.emptyNote}>
              Plus {achievement.points} achievement points{reward ? ` — ${reward}` : ''}.
              {hasEmblem(emblemId)
                ? ' Unlocking it mints the emblem above on your achievement card.'
                : ''}
            </p>
          </>
        ) : (
          <p className={styles.emptyNote}>
            This one pays in status: {achievement.points} achievement points
            {hasEmblem(emblemId) ? ' and the emblem above' : ''} — no credits, no XP, no title.
            Points feed the{' '}
            <Link href="/leaderboard">achievements leaderboard</Link>.
          </p>
        )}
      </Section>

      {chain.length > 1 && (
        <Section title={`Series${achievement.series ? `: ${titleCase(achievement.series.replace(/_/g, ' '))}` : ''}`}>
          <p className={local.note}>
            {chain.length} rungs, earned in order — each one is the prerequisite for the next.
          </p>
          <div className={local.chain}>
            {chain.map((step, index) => (
              <Fragment key={step.id}>
                {index > 0 && (
                  <span className={local.chainArrow}>
                    <ChevronRight size={13} aria-hidden />
                  </span>
                )}
                <Link
                  href={`/codex/achievements/${step.id}`}
                  className={`${styles.refItem} ${step.id === achievement.id ? local.chainSelf : ''}`}
                >
                  {step.name} · {step.points} pts
                </Link>
              </Fragment>
            ))}
          </div>
        </Section>
      )}

      {ships.length > 0 && (
        <Section title={`Unlocks (${ships.length})`}>
          <p className={local.note}>
            {ships.length === 1 ? 'This prestige hull cannot' : 'These prestige hulls cannot'} be
            bought at any price until this achievement is earned.
          </p>
          <div className={styles.chipLinkRow}>
            {ships.map((ship) => (
              <Link key={ship.id} href={`/codex/ships/${ship.id}`} className={styles.refItem}>
                {ship.name}
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
