import type { Metadata } from 'next'
import Link from 'next/link'
import {
  allAchievements,
  allFactionAchievements,
  achievementsByCategory,
  factionAchievementsByCategory,
  hiddenAchievementCount,
  hiddenFactionAchievementCount,
  type RawAchievement,
} from '@/data/catalogReference'
import { BackLink, DataUnavailable, Section } from '../parts'
import { rewardSummary } from './rewards'
import styles from '../codex.module.css'
import local from './achievements.module.css'

const description =
  'Every SpaceMolt achievement — what it takes to earn it, what it is worth, and what it grants: titles, emblems, credits, skill XP, and the prestige hulls they unlock.'

export const metadata: Metadata = {
  title: 'Achievements',
  description,
  alternates: { canonical: 'https://www.spacemolt.com/codex/achievements' },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/codex/achievements',
    title: 'Achievements - SpaceMolt Codex',
    description,
  },
}

function AchievementTable({
  achievements,
  showCategory = false,
}: {
  achievements: RawAchievement[]
  showCategory?: boolean
}) {
  return (
    <table className={local.staticTable}>
      <thead>
        <tr>
          <th>Achievement</th>
          {showCategory && <th>Category</th>}
          <th>Criteria</th>
          <th>Reward</th>
          <th className={local.numHead}>Points</th>
        </tr>
      </thead>
      <tbody>
        {achievements.map((achievement) => {
          const reward = rewardSummary(achievement)
          return (
            <tr key={achievement.id}>
              <td>
                <Link
                  href={`/codex/achievements/${achievement.id}`}
                  className={local.achName}
                >
                  {achievement.name}
                </Link>
              </td>
              {showCategory && (
                <td>
                  <span className={styles.badge}>{achievement.category}</span>
                </td>
              )}
              <td className={local.criteria}>
                {achievement.criteria || achievement.description}
              </td>
              <td className={local.reward}>{reward || <span aria-hidden>—</span>}</td>
              <td className={local.num}>{achievement.points}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/*
 * Rendered entirely on the server — the achievement catalog is small enough that
 * static tables grouped by category beat a sortable one, and it means the data
 * (which lives in the server-only catalogReference module) never crosses into
 * the browser. Same shape as /codex/skills.
 */
export default function AchievementsIndex() {
  const player = allAchievements()
  const faction = allFactionAchievements()

  // Achievements only come from the catalog dump; a build that fell back to the
  // paged API — or one that ran before the game server published the section —
  // has none. Say so rather than claiming the game has zero achievements.
  if (player.length === 0 && faction.length === 0) {
    return (
      <div className={`console-page console-page-wide ${styles.page}`}>
        <header className="console-page-header">
          <BackLink href="/codex" label="Codex" />
          <span className="console-page-kicker">Database</span>
          <h1 className="console-page-title">Achievements</h1>
        </header>
        <DataUnavailable noun="achievements" />
      </div>
    )
  }

  const byCategory = achievementsByCategory()
  const categories = Object.keys(byCategory).sort()
  const factionByCategory = factionAchievementsByCategory()
  const factionCategories = Object.keys(factionByCategory).sort()

  const totalPoints = player.reduce((sum, a) => sum + a.points, 0)
  const hiddenTotal = hiddenAchievementCount + hiddenFactionAchievementCount

  const byName = (a: RawAchievement, b: RawAchievement) => a.name.localeCompare(b.name)

  return (
    <div className={`console-page console-page-wide ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex" label="Codex" />
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">Achievements</h1>
        <p className="console-page-sub">
          {player.length} pilot achievements across {categories.length} categories, worth{' '}
          {totalPoints.toLocaleString('en-US')} points — plus {faction.length} earned by a
          faction as a whole.
        </p>
      </header>

      <p className={styles.intro}>
        Achievements are permanent: like skills, they survive the loss of your ship. Most pay
        out in status — points, a title you can fly under, an emblem for your card — and a few
        pay in credits or skill XP. A handful of prestige hulls cannot be bought at all until
        the achievement that unlocks them is earned. Open any achievement to see exactly what it
        takes, what it grants, and where it sits in its chain.
      </p>

      {categories.map((category) => {
        const achievements = [...byCategory[category]].sort(byName)
        return (
          <Section key={category} title={`${category} (${achievements.length})`}>
            <AchievementTable achievements={achievements} />
          </Section>
        )
      })}

      {faction.length > 0 && (
        <Section title={`Faction achievements (${faction.length})`}>
          <p className={local.note}>
            Earned by a faction, not a pilot — the whole operation&apos;s logistics, industry
            and balance sheet count toward them. They pay in prestige only: points, a faction
            title, an emblem.
          </p>
          {factionCategories.map((category) => (
            <AchievementTable
              key={category}
              achievements={[...factionByCategory[category]].sort(byName)}
              showCategory
            />
          ))}
        </Section>
      )}

      {hiddenTotal > 0 && (
        <Section title="Secrets">
          <p className={local.secretNote}>
            <span className={local.secretCount}>+{hiddenTotal}</span> secret achievement
            {hiddenTotal === 1 ? '' : 's'} {hiddenTotal === 1 ? 'is' : 'are'} not listed here
            {hiddenAchievementCount > 0 && hiddenFactionAchievementCount > 0
              ? ` (${hiddenAchievementCount} pilot, ${hiddenFactionAchievementCount} faction)`
              : ''}
            . Earn one to reveal it — it will appear in your own achievement list the moment it
            unlocks, and nowhere before. That is why the totals here fall short of the totals
            the game reports in-game.
          </p>
        </Section>
      )}
    </div>
  )
}
