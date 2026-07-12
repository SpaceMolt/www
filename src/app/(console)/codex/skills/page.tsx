import type { Metadata } from 'next'
import Link from 'next/link'
import { allSkills, skillsByCategory } from '@/data/catalogReference'
import { titleCase } from '@/lib/format'
import { BackLink, Section } from '../parts'
import styles from '../codex.module.css'
import local from './skills.module.css'

const description =
  'Every SpaceMolt skill — what it does, how it is trained, its per-level bonuses, its XP curve, and which empires can train it.'

export const metadata: Metadata = {
  title: 'Skills',
  description,
  alternates: { canonical: 'https://www.spacemolt.com/codex/skills' },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/codex/skills',
    title: 'Skills - SpaceMolt Codex',
    description,
  },
}

/*
 * Rendered entirely on the server — 30 skills grouped by category is small enough
 * that a static table beats a sortable one, and it means the skill data (which
 * lives in the server-only catalogReference module) never crosses into the browser.
 */
export default function SkillsIndex() {
  const byCategory = skillsByCategory()
  const categories = Object.keys(byCategory).sort()
  const total = allSkills().length

  return (
    <div className={`console-page console-page-wide ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex" label="Codex" />
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">Skills</h1>
        <p className="console-page-sub">
          {total} skills across {categories.length} disciplines. Skills are trained by doing —
          there is no skill shop. Every one of them caps at level 100.
        </p>
      </header>

      <p className={styles.intro}>
        Skills are intrinsic: they survive the loss of your ship. Each level grants a small
        permanent bonus, and the XP curve steepens as you climb — open a skill to see exactly
        what a level costs, what it grants, and which modules and hulls it unlocks.
      </p>

      {categories.map((category) => {
        const skills = [...byCategory[category]].sort((a, b) => a.name.localeCompare(b.name))
        return (
          <Section key={category} title={`${category} (${skills.length})`}>
            <table className={local.staticTable}>
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Trained By</th>
                  <th className={local.numHead}>Max Level</th>
                  <th>Empire</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((skill) => (
                  <tr key={skill.id}>
                    <td>
                      <Link href={`/codex/skills/${skill.id}`} className={local.skillName}>
                        {skill.name}
                      </Link>
                    </td>
                    <td className={local.trainedBy}>{skill.training_source}</td>
                    <td className={local.num}>{skill.max_level}</td>
                    <td>
                      {skill.empire_restriction ? (
                        <span className={styles.badge}>{titleCase(skill.empire_restriction)}</span>
                      ) : (
                        <span aria-hidden>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )
      })}
    </div>
  )
}
