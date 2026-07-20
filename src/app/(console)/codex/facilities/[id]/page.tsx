import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatItemId, getRecipe, type ItemStack } from '@/data/catalog'
import { allFacilities, getFacility, type RawFacility } from '@/data/catalogReference'
import { titleCase } from '@/lib/format'
import { BackLink, RecipeRefCard, Section, StatGrid, itemHref, type StatEntry } from '../../parts'
import styles from '../../codex.module.css'
import local from '../facilities.module.css'
import { chainFor } from '../chains'
import { SITE_URL } from '@/lib/links'

/**
 * Every one of the 2,652 facilities gets its own page — recipe pages link
 * straight at a specific tier, so a tier must be addressable. The page is
 * about that one facility, but it renders the whole upgrade chain around it:
 * the interesting content here is how cost, power and materials scale with
 * the level, which you cannot see from a single tier in isolation.
 */
export async function generateStaticParams() {
  return allFacilities().map((facility) => ({ id: facility.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const facility = getFacility(id)
  if (!facility) return {}

  const description =
    facility.description || `${facility.name} — ${facility.category} facility in the SpaceMolt catalog.`

  return {
    title: facility.name,
    description,
    alternates: { canonical: `${SITE_URL}/codex/facilities/${id}` },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/codex/facilities/${id}`,
      title: `${facility.name} - SpaceMolt Codex`,
      description,
    },
  }
}

function StackRow({ stacks }: { stacks: ItemStack[] }) {
  return (
    <div className={styles.chipLinkRow}>
      {stacks.map((stack) => (
        <Link key={stack.item_id} href={itemHref(stack.item_id)} className={styles.refItem}>
          {stack.quantity}x {formatItemId(stack.item_id)}
        </Link>
      ))}
    </div>
  )
}

function ticks(n: number): string {
  return `${n.toLocaleString('en-US')} tick${n === 1 ? '' : 's'}`
}

/** Every stat worth showing for one facility, in display order. */
function statEntries(f: RawFacility): StatEntry[] {
  const stats: StatEntry[] = []
  stats.push({ label: 'Category', value: titleCase(f.category) })
  stats.push({ label: 'Level', value: String(f.level) })
  stats.push({ label: 'Build Cost', value: `${f.build_cost.toLocaleString('en-US')} cr` })
  stats.push({ label: 'Build Time', value: ticks(f.build_time) })
  stats.push({ label: 'Labor Cost', value: f.labor_cost.toLocaleString('en-US') })
  stats.push({ label: 'Always On', value: f.always_on ? 'Yes' : 'No' })

  if (f.power_draw) stats.push({ label: 'Power Draw', value: String(f.power_draw) })
  if (f.power_supply) stats.push({ label: 'Power Supply', value: `+${f.power_supply}` })
  if (f.life_support_draw) stats.push({ label: 'Life Support Draw', value: String(f.life_support_draw) })
  if (f.life_support_supply) stats.push({ label: 'Life Support Supply', value: `+${f.life_support_supply}` })

  if (f.service_type) stats.push({ label: 'Service', value: titleCase(f.service_type.replace(/_/g, ' ')) })
  if (f.faction_service_type) {
    stats.push({ label: 'Faction Service', value: titleCase(f.faction_service_type.replace(/_/g, ' ')) })
  }
  if (f.personal_service_type) {
    stats.push({ label: 'Personal Service', value: titleCase(f.personal_service_type.replace(/_/g, ' ')) })
  }
  if (f.requires_service_type) {
    stats.push({ label: 'Requires Service', value: titleCase(f.requires_service_type.replace(/_/g, ' ')) })
  }
  if (f.empire) stats.push({ label: 'Empire', value: titleCase(f.empire.replace(/_/g, ' ')) })
  if (f.unique) stats.push({ label: 'Unique', value: 'One per station' })
  if (f.faction_cap != null) stats.push({ label: 'Faction Cap', value: String(f.faction_cap) })
  if (f.player_station_buildable) stats.push({ label: 'Player Stations', value: 'Buildable' })
  if (f.station_or_faction_only) stats.push({ label: 'Placement', value: 'Station or faction only' })
  if (f.pirate_base_only) stats.push({ label: 'Placement', value: 'Pirate bases only' })

  if (f.personal_bonus_type) {
    stats.push({
      label: titleCase(f.personal_bonus_type.replace(/_/g, ' ')),
      value: f.personal_bonus_value != null ? `+${f.personal_bonus_value}` : 'Yes',
    })
  }
  if (f.battery_capacity) stats.push({ label: 'Battery Capacity', value: String(f.battery_capacity) })
  if (f.fuel_output) stats.push({ label: 'Fuel Output', value: 'Yes' })
  if (f.fuel_capacity) stats.push({ label: 'Fuel Capacity', value: String(f.fuel_capacity) })
  if (f.scan_power) stats.push({ label: 'Scan Power', value: String(f.scan_power) })
  if (f.scan_falloff) stats.push({ label: 'Scan Falloff', value: String(f.scan_falloff) })
  if (f.dining_points) stats.push({ label: 'Dining Points', value: String(f.dining_points) })
  if (f.leisure_points) stats.push({ label: 'Leisure Points', value: String(f.leisure_points) })
  if (f.fleet_upkeep) stats.push({ label: 'Fleet Upkeep', value: 'Yes' })
  if (f.tourism_upkeep) stats.push({ label: 'Tourism Upkeep', value: 'Yes' })
  if (f.transit_deadline_bonus) {
    stats.push({ label: 'Transit Deadline Bonus', value: `+${f.transit_deadline_bonus}` })
  }
  if (f.expansion_scale) stats.push({ label: 'Expansion Scale', value: `${f.expansion_scale}x` })
  if (f.disguised) stats.push({ label: 'Disguised', value: 'Yes' })
  if (f.allows_contraband) stats.push({ label: 'Contraband', value: 'Allowed' })

  return stats
}

export default async function FacilityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const facility = getFacility(id)
  if (!facility) notFound()

  const chain = chainFor(id)
  const levels = chain?.levels ?? [facility]
  const recipe = facility.recipe_id ? getRecipe(facility.recipe_id) : undefined
  const expansionOf = facility.expansion_of ? getFacility(facility.expansion_of) : undefined

  return (
    <div className={`console-page ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex/facilities" label="Facilities" />
        <span className="console-page-kicker">Facility</span>
        <h1 className="console-page-title">{facility.name}</h1>
        {facility.description && <p className={styles.description}>{facility.description}</p>}
        <div className={styles.tagRow}>
          <span className={styles.badge}>{facility.category}</span>
          <span className={styles.badge}>
            Tier {facility.level}
            {levels.length > 1 ? ` of ${levels[levels.length - 1].level}` : ''}
          </span>
          {facility.service_type && (
            <span className={styles.badge}>{facility.service_type.replace(/_/g, ' ')}</span>
          )}
          {facility.empire && <span className={styles.badge}>{facility.empire.replace(/_/g, ' ')}</span>}
          {facility.unique && <span className={styles.badge}>unique</span>}
          {facility.pirate_base_only && <span className={styles.badge}>pirate only</span>}
          <span className={styles.badge}>{facility.id}</span>
        </div>
      </header>

      <Section title="Stats">
        <StatGrid stats={statEntries(facility)} />
      </Section>

      {facility.build_materials && facility.build_materials.length > 0 && (
        <Section title="Build Materials">
          <StackRow stacks={facility.build_materials} />
        </Section>
      )}

      {recipe && (
        <Section title="Produces">
          <RecipeRefCard recipe={recipe} />
        </Section>
      )}

      {facility.maintenance_inputs && facility.maintenance_inputs.length > 0 && (
        <Section title="Maintenance">
          <p className={styles.emptyNote}>
            Consumed continuously to keep the facility running. Starve it and it degrades.
          </p>
          <div style={{ marginTop: '0.7rem' }}>
            <StackRow stacks={facility.maintenance_inputs} />
          </div>
          {(facility.satisfied_description || facility.degraded_description) && (
            <div className={local.flavor}>
              {facility.satisfied_description && (
                <div className={local.flavorRow}>
                  <span className={`${local.flavorLabel} ${local.flavorSatisfied}`}>Supplied</span>
                  <span className={local.flavorText}>{facility.satisfied_description}</span>
                </div>
              )}
              {facility.degraded_description && (
                <div className={local.flavorRow}>
                  <span className={`${local.flavorLabel} ${local.flavorDegraded}`}>Starved</span>
                  <span className={local.flavorText}>{facility.degraded_description}</span>
                </div>
              )}
            </div>
          )}
        </Section>
      )}

      <Section title={levels.length > 1 ? `Upgrade Chain (${levels.length} tiers)` : 'Upgrade Chain'}>
        {levels.length > 1 ? (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Tier</th>
                    <th className={styles.th}>Facility</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Build Cost</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Build Time</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Labor</th>
                    <th className={`${styles.th} ${styles.thNum}`} title="Power draw">Power</th>
                    <th className={`${styles.th} ${styles.thNum}`} title="Life support draw">Life Sup.</th>
                    <th className={`${styles.th} ${styles.thNum}`} title="Distinct build materials">Materials</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((tier) => {
                    const self = tier.id === facility.id
                    return (
                      <tr key={tier.id} className={`${styles.tr} ${self ? local.rowActive : ''}`}>
                        <td className={`${styles.td} ${local.levelCell}`}>L{tier.level}</td>
                        <td className={`${styles.td} ${styles.tdName}`}>
                          {self ? (
                            <>
                              <span className={local.selfName}>{tier.name}</span>
                              <span className={local.selfMark}>this tier</span>
                            </>
                          ) : (
                            <Link href={`/codex/facilities/${tier.id}`} className={styles.nameLink}>
                              {tier.name}
                            </Link>
                          )}
                        </td>
                        <td className={`${styles.td} ${styles.tdNum}`}>
                          {tier.build_cost.toLocaleString('en-US')}
                        </td>
                        <td className={`${styles.td} ${styles.tdNum}`}>
                          {tier.build_time.toLocaleString('en-US')}
                        </td>
                        <td className={`${styles.td} ${styles.tdNum}`}>
                          {tier.labor_cost.toLocaleString('en-US')}
                        </td>
                        <td className={`${styles.td} ${styles.tdNum}`}>{tier.power_draw ?? '—'}</td>
                        <td className={`${styles.td} ${styles.tdNum}`}>{tier.life_support_draw ?? '—'}</td>
                        <td className={`${styles.td} ${styles.tdNum}`}>
                          {tier.build_materials?.length ?? 0}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className={local.chainNote}>
              Each tier is built by upgrading the one below it. Cost, build time and power draw
              climb with the tier; the recipe it runs stays the same.
            </p>
          </>
        ) : (
          <p className={styles.emptyNote}>
            {facility.name} has no upgrade path — it is built once, at this level.
          </p>
        )}
      </Section>

      {expansionOf && (
        <Section title="Expansion Of">
          <div className={styles.chipLinkRow}>
            <Link href={`/codex/facilities/${expansionOf.id}`} className={styles.refItem}>
              {expansionOf.name}
            </Link>
          </div>
        </Section>
      )}

      {facility.lore && (
        <Section title="Lore">
          <p className={local.lore}>{facility.lore}</p>
        </Section>
      )}
    </div>
  )
}
