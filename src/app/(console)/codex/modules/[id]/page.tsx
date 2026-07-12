import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  allModules, getItem, isModule, recipesConsuming, recipesProducing, shipsBuiltFrom,
} from '@/data/catalog'
import { titleCase } from '@/lib/format'
import {
  BackLink, RecipeRefGrid, Section, ShipRefList, SkillRefList, StatGrid, moduleStatEntries,
  type StatEntry,
} from '../../parts'
import styles from '../../codex.module.css'

export async function generateStaticParams() {
  return allModules().map((mod) => ({ id: mod.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const mod = getItem(id)
  if (!mod || !isModule(mod)) return {}

  const description =
    mod.description || `${mod.name} — ${mod.type ?? 'ship'} module in the SpaceMolt catalog.`

  return {
    title: mod.name,
    description,
    alternates: { canonical: `https://www.spacemolt.com/codex/modules/${id}` },
    openGraph: {
      type: 'article',
      url: `https://www.spacemolt.com/codex/modules/${id}`,
      title: `${mod.name} - SpaceMolt Codex`,
      description,
    },
  }
}

export default async function ModuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const mod = getItem(id)

  if (!mod || !isModule(mod)) notFound()

  const producedBy = recipesProducing(id)
  const usedIn = recipesConsuming(id)
  const builtInto = shipsBuiltFrom(id)

  const fitting: StatEntry[] = [
    { label: 'Type', value: titleCase(mod.type ?? 'module') },
    { label: 'Slot', value: titleCase(mod.slot ?? '—') },
    { label: 'Size', value: String(mod.size ?? 0) },
    { label: 'Base Value', value: `${(mod.base_value ?? 0).toLocaleString('en-US')} cr` },
  ]

  const stats = moduleStatEntries(mod)

  return (
    <div className={`console-page ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex/modules" label="Modules" />
        <span className="console-page-kicker">Module</span>
        <h1 className="console-page-title">{mod.name}</h1>
        {mod.description && <p className={styles.description}>{mod.description}</p>}
        <div className={styles.tagRow}>
          {mod.type && <span className={styles.badge}>{mod.type}</span>}
          {mod.slot && <span className={styles.badge}>{mod.slot} slot</span>}
          <span className={styles.badge}>{mod.id}</span>
        </div>
      </header>

      <Section title="Fitting">
        <StatGrid stats={fitting} />
      </Section>

      {stats.length > 0 && (
        <Section title="Module Stats">
          <StatGrid stats={stats} />
        </Section>
      )}

      {mod.required_skills && Object.keys(mod.required_skills).length > 0 && (
        <Section title="Required Skills">
          <SkillRefList skills={mod.required_skills} />
        </Section>
      )}

      {producedBy.length > 0 && (
        <Section title={`Produced By (${producedBy.length})`}>
          <RecipeRefGrid recipes={producedBy} highlight={mod.id} />
        </Section>
      )}

      {usedIn.length > 0 && (
        <Section title={`Used In (${usedIn.length})`}>
          <RecipeRefGrid recipes={usedIn} highlight={mod.id} />
        </Section>
      )}

      {builtInto.length > 0 && (
        <Section title={`Ships Built From This (${builtInto.length})`}>
          <ShipRefList ships={builtInto} />
        </Section>
      )}

      {producedBy.length === 0 && usedIn.length === 0 && builtInto.length === 0 && (
        <Section title="Cross-References">
          <p className={styles.emptyNote}>
            No recipe produces or consumes this module — it is bought from a station market
            rather than crafted.
          </p>
        </Section>
      )}
    </div>
  )
}
