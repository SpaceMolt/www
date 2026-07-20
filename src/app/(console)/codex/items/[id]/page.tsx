import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  allNonModuleItems, getItem, isModule, recipesConsuming, recipesProducing, shipsBuiltFrom,
} from '@/data/catalog'
import { titleCase } from '@/lib/format'
import {
  BackLink, RecipeRefGrid, Section, ShipRefList, SkillRefList, StatGrid, type StatEntry,
} from '../../parts'
import PriceHistoryChart from '@/components/PriceHistoryChart'
import styles from '../../codex.module.css'
import { SITE_URL } from '@/lib/links'

const RARITY_CLASSES: Record<string, string> = {
  common: styles.rarityCommon,
  uncommon: styles.rarityUncommon,
  rare: styles.rarityRare,
  exotic: styles.rarityExotic,
  legendary: styles.rarityLegendary,
}

export async function generateStaticParams() {
  return allNonModuleItems().map((item) => ({ id: item.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const item = getItem(id)
  if (!item || isModule(item)) return {}

  const description =
    item.description ||
    `${item.name} — ${item.category ?? 'item'} in the SpaceMolt catalog.`

  return {
    title: item.name,
    description,
    alternates: { canonical: `${SITE_URL}/codex/items/${id}` },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/codex/items/${id}`,
      title: `${item.name} - SpaceMolt Codex`,
      description,
    },
  }
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = getItem(id)

  // Modules are the same underlying type but a different section — send them there
  // rather than rendering a half-empty item page.
  if (!item || isModule(item)) notFound()

  const producedBy = recipesProducing(id)
  const usedIn = recipesConsuming(id)
  const builtInto = shipsBuiltFrom(id)
  const hasCrossRefs = producedBy.length > 0 || usedIn.length > 0 || builtInto.length > 0

  const stats: StatEntry[] = []
  if (item.category) stats.push({ label: 'Category', value: titleCase(item.category) })
  if (item.rarity) stats.push({ label: 'Rarity', value: titleCase(item.rarity) })
  stats.push({ label: 'Size', value: String(item.size ?? 0) })
  stats.push({ label: 'Base Value', value: `${(item.base_value ?? 0).toLocaleString('en-US')} cr` })
  stats.push({ label: 'Stackable', value: item.stackable ? 'Yes' : 'No' })
  stats.push({ label: 'Tradeable', value: item.tradeable === false ? 'No' : 'Yes' })
  if (item.extracted_by) stats.push({ label: 'Extracted By', value: titleCase(item.extracted_by) })
  if (item.ammo_type) stats.push({ label: 'Ammo Type', value: titleCase(item.ammo_type) })
  if (item.magazine_size) stats.push({ label: 'Magazine', value: String(item.magazine_size) })
  if (item.food_type) stats.push({ label: 'Food Type', value: titleCase(item.food_type) })
  if (item.hazardous) stats.push({ label: 'Hazardous', value: 'Yes' })
  if (item.quest_item) stats.push({ label: 'Quest Item', value: 'Yes' })
  if (item.region_lock?.length) {
    stats.push({ label: 'Region Locked', value: item.region_lock.map(titleCase).join(', ') })
  }

  const effect = item.effect
  if (effect) {
    if (effect.type) stats.push({ label: 'Effect', value: titleCase(effect.type) })
    if (effect.subtype) stats.push({ label: 'Effect Subtype', value: titleCase(effect.subtype) })
    if (effect.stat) stats.push({ label: 'Affects', value: titleCase(effect.stat) })
    if (effect.amount != null) stats.push({ label: 'Magnitude', value: `${effect.amount}` })
    if (effect.duration != null) {
      stats.push({ label: 'Duration', value: `${effect.duration} tick${effect.duration === 1 ? '' : 's'}` })
    }
    for (const [key, value] of Object.entries(effect.ammo ?? {})) {
      if (value != null) stats.push({ label: titleCase(key), value: String(value) })
    }
  }

  return (
    <div className={`console-page ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex/items" label="Items" />
        <span className="console-page-kicker">Item</span>
        <h1 className="console-page-title">{item.name}</h1>
        {item.description && <p className={styles.description}>{item.description}</p>}
        <div className={styles.tagRow}>
          {item.rarity && (
            <span className={`${styles.badge} ${RARITY_CLASSES[item.rarity] ?? ''}`}>
              {item.rarity}
            </span>
          )}
          {item.category && <span className={styles.badge}>{item.category}</span>}
          <span className={styles.badge}>{item.id}</span>
        </div>
      </header>

      <Section title="Stats">
        <StatGrid stats={stats} />
      </Section>

      <Section title="Price History">
        <PriceHistoryChart itemId={item.id} itemName={item.name} />
      </Section>

      {item.required_skills && Object.keys(item.required_skills).length > 0 && (
        <Section title="Required Skills">
          <SkillRefList skills={item.required_skills} />
        </Section>
      )}

      {producedBy.length > 0 && (
        <Section title={`Produced By (${producedBy.length})`}>
          <RecipeRefGrid recipes={producedBy} highlight={item.id} />
        </Section>
      )}

      {usedIn.length > 0 && (
        <Section title={`Used In (${usedIn.length})`}>
          <RecipeRefGrid recipes={usedIn} highlight={item.id} />
        </Section>
      )}

      {builtInto.length > 0 && (
        <Section title={`Ships Built From This (${builtInto.length})`}>
          <ShipRefList ships={builtInto} />
        </Section>
      )}

      {!hasCrossRefs && (
        <Section title="Cross-References">
          <p className={styles.emptyNote}>
            No recipe produces or consumes {item.name}, and no hull is built from it. It is
            found in the world — mined, looted, or bought — and used directly. See the{' '}
            <Link href="/docs">documentation</Link> for how items like this enter the economy.
          </p>
        </Section>
      )}
    </div>
  )
}
