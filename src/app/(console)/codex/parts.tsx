/*
 * Shared SERVER-side building blocks for /codex/*.
 *
 * Everything here renders to plain HTML with zero client JS — detail pages must
 * not pull the 1.2 MB catalog chunk into the browser, which they would the moment
 * they mounted a 'use client' component that imports `@/data/catalog`
 * (`src/components/ItemDetail.tsx` does). So module stats and recipe cards are
 * re-rendered here as server components, and they gain something the /market
 * versions don't have: every referenced item and recipe is a real <Link>.
 */

import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getItem, isModule, formatItemId, type RawCatalogItem, type RawRecipe, type RawShip, type ItemStack } from '@/data/catalog'
import { titleCase } from '@/lib/format'
import styles from './codex.module.css'

// ── Links ──────────────────────────────────────────────────────────────

/** The codex route for an item id — modules and plain items live on different lists. */
export function itemHref(itemId: string): string {
  const item = getItem(itemId)
  return item && isModule(item) ? `/codex/modules/${itemId}` : `/codex/items/${itemId}`
}

export function recipeHref(recipeId: string): string {
  return `/codex/recipes/${recipeId}`
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={styles.backLink}>
      <ArrowLeft size={12} aria-hidden />
      {label}
    </Link>
  )
}

// ── Stats ──────────────────────────────────────────────────────────────

export interface StatEntry {
  label: string
  value: string
}

export function StatGrid({ stats }: { stats: StatEntry[] }) {
  return (
    <div className={styles.statGrid}>
      {stats.map((stat) => (
        <div key={stat.label} className={styles.stat}>
          <span className={styles.statLabel}>{stat.label}</span>
          <span className={styles.statValue}>{stat.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`console-panel ${styles.section}`}>
      <h2 className="console-panel-header">{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

/**
 * Shown in place of a codex section whose data the build could not fetch.
 *
 * Skills and facilities only exist in the one-shot catalog dump. When that
 * endpoint rate-limits us, `scripts/fetch-catalog.mjs` falls back to the paged
 * API, which serves items/recipes/ships and nothing else — so a build can
 * legitimately come out with zero skills and zero facilities. That must degrade
 * to a page that says so, not to a page that crashes the build or renders "0
 * skills across 0 disciplines" as if it were the truth.
 */
export function DataUnavailable({ noun }: { noun: string }) {
  return (
    <Section title="Temporarily unavailable">
      <p className={styles.emptyNote}>
        This build could not fetch the {noun} catalog from the game server, so there is nothing
        to show here. Nothing has been removed from the game — the data will be back on the next
        successful build. In the meantime the whole catalog, {noun} included, is available as a
        single JSON file:{' '}
        <a href="https://game.spacemolt.com/api/catalog.json" rel="noopener">
          game.spacemolt.com/api/catalog.json
        </a>
        .
      </p>
    </Section>
  )
}

/** Human labels for every module stat the catalog emits, in display order. */
const MODULE_STAT_LABELS: [keyof RawCatalogItem, string, ((v: number) => string)?][] = [
  ['cpu_usage', 'CPU Usage'],
  ['power_usage', 'Power Usage'],
  ['damage', 'Damage'],
  ['reach', 'Reach'],
  ['cooldown', 'Cooldown', (v) => `${v} tick${v === 1 ? '' : 's'}`],
  ['accuracy_bonus', 'Accuracy', (v) => `+${v}`],
  ['tracking_bonus', 'Tracking', (v) => `+${v}`],
  ['precision_factor', 'Precision'],
  ['armor_bypass_bonus', 'Armor Bypass', (v) => `+${v}`],
  ['shield_bypass_bonus', 'Shield Bypass', (v) => `+${v}`],
  ['shield_bonus', 'Shield', (v) => `+${v}`],
  ['armor_bonus', 'Armor', (v) => `+${v}`],
  ['hull_bonus', 'Hull', (v) => `+${v}`],
  ['hull_penalty', 'Hull Penalty', (v) => `${v}`],
  ['shield_recharge_bonus', 'Shield Regen', (v) => `+${v}`],
  ['armor_repair_rate', 'Armor Repair'],
  ['remote_repair_power', 'Remote Repair'],
  ['damage_reduction', 'Damage Reduction', (v) => `${v}%`],
  ['mining_power', 'Mining Power'],
  ['mining_range', 'Mining Range'],
  ['harvest_power', 'Harvest Power'],
  ['harvest_range', 'Harvest Range'],
  ['survey_power', 'Survey Power'],
  ['survey_range', 'Survey Range'],
  ['scanner_power', 'Scanner Power'],
  ['cloak_strength', 'Cloak Strength'],
  ['signature_bonus', 'Signature', (v) => `+${v}`],
  ['speed_bonus', 'Speed', (v) => `+${v}`],
  ['speed_penalty', 'Speed Penalty', (v) => `${v}`],
  ['tow_speed_penalty', 'Tow Speed Penalty', (v) => `${v}`],
  ['cargo_bonus', 'Cargo', (v) => `+${v}`],
  ['fuel_efficiency', 'Fuel Efficiency', (v) => `${v}%`],
  ['max_fuel_bonus', 'Max Fuel', (v) => `+${v}`],
  ['power_bonus', 'Power', (v) => `+${v}`],
  ['cpu_bonus', 'CPU', (v) => `+${v}`],
  ['drone_capacity', 'Drone Capacity'],
  ['drone_bandwidth', 'Drone Bandwidth'],
  ['webify_strength', 'Web Strength'],
  ['warp_stabilization', 'Warp Stabilization'],
  ['disruptor_power', 'Disruptor Power'],
  ['scramble_power', 'Scramble Power'],
  ['passenger_economy_berths', 'Economy Berths'],
  ['passenger_business_berths', 'Business Berths'],
  ['passenger_first_berths', 'First Class Berths'],
]

/** Every non-empty module stat on an item, ready for a <StatGrid>. */
export function moduleStatEntries(item: RawCatalogItem): StatEntry[] {
  const stats: StatEntry[] = []

  for (const [key, label, format] of MODULE_STAT_LABELS) {
    const value = item[key]
    if (typeof value !== 'number' || value === 0) continue
    stats.push({ label, value: format ? format(value) : String(value) })
  }

  if (item.damage_type) stats.push({ label: 'Damage Type', value: titleCase(item.damage_type) })

  if (item.resistance_bonus) {
    for (const [type, value] of Object.entries(item.resistance_bonus)) {
      stats.push({ label: `${titleCase(type)} Resist`, value: `+${value}%` })
    }
  }

  if (item.special) stats.push({ label: 'Special', value: titleCase(item.special) })

  return stats
}

/**
 * The one stat that best characterises a module — the list page's headline
 * column. Weapons lead with damage, defenses with what they add, and so on.
 */
const HEADLINE_KEYS: (keyof RawCatalogItem)[] = [
  'damage', 'mining_power', 'harvest_power', 'shield_bonus', 'armor_bonus', 'hull_bonus',
  'damage_reduction', 'shield_recharge_bonus', 'armor_repair_rate', 'remote_repair_power',
  'scanner_power', 'survey_power', 'cloak_strength', 'speed_bonus', 'cargo_bonus',
  'drone_capacity', 'webify_strength', 'disruptor_power', 'scramble_power', 'warp_stabilization',
  'fuel_efficiency', 'power_bonus', 'cpu_bonus', 'max_fuel_bonus', 'signature_bonus',
  'passenger_economy_berths', 'accuracy_bonus', 'tracking_bonus',
]

const HEADLINE_LABELS = new Map(MODULE_STAT_LABELS.map(([key, label]) => [key, label]))

export function headlineStat(item: RawCatalogItem): StatEntry | undefined {
  for (const key of HEADLINE_KEYS) {
    const value = item[key]
    if (typeof value === 'number' && value !== 0) {
      return { label: HEADLINE_LABELS.get(key) ?? titleCase(String(key)), value: String(value) }
    }
  }
  return undefined
}

// ── Cross-references ───────────────────────────────────────────────────

function StackList({ stacks, highlight }: { stacks: ItemStack[]; highlight?: string }) {
  return (
    <div className={styles.refSide}>
      {stacks.map((stack) => (
        <Link
          key={stack.item_id}
          href={itemHref(stack.item_id)}
          className={`${styles.refItem} ${stack.item_id === highlight ? styles.refItemSelf : ''}`}
        >
          {stack.quantity}x {formatItemId(stack.item_id)}
        </Link>
      ))}
    </div>
  )
}

/** A recipe as a cross-reference: inputs → outputs, everything linked. */
export function RecipeRefCard({ recipe, highlight }: { recipe: RawRecipe; highlight?: string }) {
  const meta: string[] = []
  if (recipe.crafting_time) meta.push(`${recipe.crafting_time} ticks`)
  if (recipe.facility_only) meta.push('Facility only')
  if (recipe.fuel_output) meta.push(`${recipe.fuel_output} fuel`)

  return (
    <div className={styles.refCard}>
      <div className={styles.refHeader}>
        <Link href={recipeHref(recipe.id)} className={styles.refName}>
          {recipe.name}
        </Link>
        {recipe.category && <span className={styles.refCategory}>{recipe.category}</span>}
      </div>
      <div className={styles.refFlow}>
        <StackList stacks={recipe.inputs ?? []} highlight={highlight} />
        <span className={styles.refArrow}>
          <ArrowRight size={13} aria-hidden />
        </span>
        <StackList stacks={recipe.outputs ?? []} highlight={highlight} />
      </div>
      {meta.length > 0 && <p className={styles.refMeta}>{meta.join(' · ')}</p>}
    </div>
  )
}

export function RecipeRefGrid({ recipes, highlight }: { recipes: RawRecipe[]; highlight?: string }) {
  return (
    <div className={styles.refGrid}>
      {recipes.map((recipe) => (
        <RecipeRefCard key={recipe.id} recipe={recipe} highlight={highlight} />
      ))}
    </div>
  )
}

/** Ships whose build materials include this item. */
export function ShipRefList({ ships }: { ships: RawShip[] }) {
  return (
    <div className={styles.chipLinkRow}>
      {ships.map((ship) => (
        <Link key={ship.id} href={`/codex/ships/${ship.id}`} className={styles.refItem}>
          {ship.name}
        </Link>
      ))}
    </div>
  )
}

/** Required-skill chips. Skill pages land with the skills section. */
export function SkillRefList({ skills }: { skills: Record<string, number> }) {
  return (
    <div className={styles.chipLinkRow}>
      {Object.entries(skills).map(([skill, level]) => (
        <Link key={skill} href={`/codex/skills/${skill}`} className={styles.refItem}>
          {titleCase(skill)} Lv.{level}
        </Link>
      ))}
    </div>
  )
}
