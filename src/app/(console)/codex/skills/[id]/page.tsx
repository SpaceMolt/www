import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { allModules, allShips, type RawCatalogItem, type RawShip } from '@/data/catalog'
import { allSkills, getSkill, type RawSkill } from '@/data/catalogReference'
import { titleCase } from '@/lib/format'
import { BackLink, Section, StatGrid, itemHref, type StatEntry } from '../../parts'
import styles from '../../codex.module.css'
import local from '../skills.module.css'

export async function generateStaticParams() {
  return allSkills().map((skill) => ({ id: skill.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const skill = getSkill(id)
  if (!skill) return {}

  const description = `${skill.description} Trained by: ${skill.training_source}`

  return {
    title: skill.name,
    description,
    alternates: { canonical: `https://www.spacemolt.com/codex/skills/${id}` },
    openGraph: {
      type: 'article',
      url: `https://www.spacemolt.com/codex/skills/${id}`,
      title: `${skill.name} - SpaceMolt Codex`,
      description,
    },
  }
}

/** "armorEffectiveness" → "Armor Effectiveness" */
function bonusLabel(key: string): string {
  return titleCase(key.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
}

/**
 * The levels worth showing. `xp_per_level` is 100 entries long — dumping all of
 * them is unreadable, so show every level through 10 (where new players actually
 * live) and then every tenth to the cap.
 */
function milestones(maxLevel: number): number[] {
  const levels: number[] = []
  for (let level = 1; level <= Math.min(10, maxLevel); level++) levels.push(level)
  for (let level = 20; level <= maxLevel; level += 10) levels.push(level)
  if (levels[levels.length - 1] !== maxLevel) levels.push(maxLevel)
  return levels
}

function XpCurve({ skill }: { skill: RawSkill }) {
  const xp = skill.xp_per_level
  const rows = milestones(skill.max_level).filter((level) => xp[level - 1] != null)

  return (
    <table className={local.staticTable}>
      <thead>
        <tr>
          <th className={local.numHead}>Level</th>
          <th className={local.numHead}>XP For This Level</th>
          <th className={local.numHead}>Total XP</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((level) => {
          const total = xp[level - 1]
          const previous = level > 1 ? xp[level - 2] : 0
          return (
            <tr key={level} className={level === skill.max_level ? local.milestone : undefined}>
              <td className={local.num}>{level}</td>
              <td className={local.num}>{(total - previous).toLocaleString('en-US')}</td>
              <td className={local.num}>{total.toLocaleString('en-US')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Modules gated behind a level of this skill, cheapest requirement first. */
function modulesRequiring(skillId: string): { module: RawCatalogItem; level: number }[] {
  return allModules()
    .flatMap((module) => {
      const level = module.required_skills?.[skillId]
      return level == null ? [] : [{ module, level }]
    })
    .sort((a, b) => a.level - b.level || a.module.name.localeCompare(b.module.name))
}

/** Player hulls gated behind a piloting level (the only ship-level skill gate the catalog has). */
function shipsRequiringPiloting(): { ship: RawShip; level: number }[] {
  return allShips()
    .filter((ship) => ship.piloting_required != null && !ship.npc_role)
    .map((ship) => ({ ship, level: ship.piloting_required as number }))
    .sort((a, b) => a.level - b.level || a.ship.name.localeCompare(b.ship.name))
}

export default async function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const skill = getSkill(id)

  if (!skill) notFound()

  const xp = skill.xp_per_level
  const totalXp = xp[xp.length - 1] ?? 0

  const stats: StatEntry[] = [
    { label: 'Category', value: skill.category },
    { label: 'Max Level', value: String(skill.max_level) },
    { label: `XP To Lv.${skill.max_level}`, value: totalXp.toLocaleString('en-US') },
  ]
  if (skill.empire_restriction) {
    stats.push({ label: 'Empire Only', value: titleCase(skill.empire_restriction) })
  }

  const bonuses = Object.entries(skill.bonus_per_level ?? {})
  const bonusStats: StatEntry[] = bonuses.map(([key, value]) => ({
    label: bonusLabel(key),
    value: `${value}% / level`,
  }))

  // Cross-references: what this skill actually unlocks. These come from the
  // client-safe catalog (modules + ships), scanned here on the server.
  const gatedModules = modulesRequiring(id)
  const gatedShips = id === 'piloting' ? shipsRequiringPiloting() : []
  const shipLevels = [...new Set(gatedShips.map((entry) => entry.level))].sort((a, b) => a - b)

  return (
    <div className={`console-page ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex/skills" label="Skills" />
        <span className="console-page-kicker">Skill</span>
        <h1 className="console-page-title">{skill.name}</h1>
        <p className={styles.description}>{skill.description}</p>
        <div className={styles.tagRow}>
          <span className={styles.badge}>{skill.category}</span>
          {skill.empire_restriction && (
            <span className={styles.badge}>{titleCase(skill.empire_restriction)} only</span>
          )}
          <span className={styles.badge}>{skill.id}</span>
        </div>
      </header>

      <Section title="Overview">
        <StatGrid stats={stats} />
      </Section>

      <Section title="Training">
        <p className={styles.description} style={{ margin: 0 }}>
          {skill.training_source}
        </p>
        {skill.empire_restriction && (
          <p className={styles.emptyNote}>
            Only {titleCase(skill.empire_restriction)} citizens can train this skill.
          </p>
        )}
      </Section>

      {bonusStats.length > 0 && (
        <Section title="Bonus Per Level">
          <StatGrid stats={bonusStats} />
          <p className={styles.emptyNote}>
            Each level applies the listed percentage — {bonuses.length === 1 ? 'it reaches' : 'they reach'}{' '}
            {bonuses.map(([, value]) => `${value * skill.max_level}%`).join(' / ')} at level{' '}
            {skill.max_level}. Read the description above for whether a bonus raises the stat or
            reduces the cost.
          </p>
        </Section>
      )}

      {bonusStats.length === 0 && (
        <Section title="Bonus Per Level">
          <p className={styles.emptyNote}>
            This skill grants no flat per-level stat bonus — it gates access and unlocks
            behaviour rather than scaling a number.
          </p>
        </Section>
      )}

      <Section title="XP Curve">
        <p className={local.curveNote}>
          XP is cumulative: the total column is the running XP needed to reach that level from
          zero. Levels 1–10 are shown in full, then every tenth level to the cap.
        </p>
        <XpCurve skill={skill} />
      </Section>

      {gatedModules.length > 0 && (
        <Section title={`Modules Requiring ${skill.name} (${gatedModules.length})`}>
          <div className={styles.chipLinkRow}>
            {gatedModules.map(({ module, level }) => (
              <Link key={module.id} href={itemHref(module.id)} className={styles.refItem}>
                {module.name} Lv.{level}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {gatedShips.length > 0 && (
        <Section title={`Hulls Requiring ${skill.name} (${gatedShips.length})`}>
          {shipLevels.map((level) => {
            const ships = gatedShips.filter((entry) => entry.level === level)
            return (
              <div key={level}>
                <p className={local.curveNote}>
                  Level {level} — {ships.length} hull{ships.length === 1 ? '' : 's'}
                </p>
                <div className={styles.chipLinkRow}>
                  {ships.map(({ ship }) => (
                    <Link key={ship.id} href="/ships" className={styles.refItem}>
                      {ship.name}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </Section>
      )}

      {gatedModules.length === 0 && gatedShips.length === 0 && (
        <Section title="Unlocks">
          <p className={styles.emptyNote}>
            No module or hull is gated behind {skill.name} — its value is entirely in the
            per-level bonus. See the <Link href="/docs">documentation</Link> for how skills feed
            into the systems they modify.
          </p>
        </Section>
      )}
    </div>
  )
}
