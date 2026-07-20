import type { Metadata } from 'next'
import { getItem, getRecipe } from '@/data/catalog'
import { titleCase } from '@/lib/format'
import { BackLink, DataUnavailable } from '../parts'
import { CatalogTable, type CatalogColumn, type CatalogFacet, type CatalogRow } from '../CatalogTable'
import styles from '../codex.module.css'
import { allChains } from './chains'
import { empireShortName } from './empireNames'
import { SITE_URL } from '@/lib/links'

const description =
  'Every station facility in SpaceMolt, grouped into its upgrade chain — production lines, services, infrastructure, and faction buildings, with build costs, power draw, and the recipe each one runs.'

export const metadata: Metadata = {
  title: 'Facilities',
  description,
  alternates: { canonical: `${SITE_URL}/codex/facilities` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/codex/facilities`,
    title: 'Facilities - SpaceMolt Codex',
    description,
  },
}

const COLUMNS: CatalogColumn[] = [
  { key: 'name', label: 'Facility', title: 'Entry-level facility of the upgrade chain', variant: 'name' },
  { key: 'category', label: 'Category', variant: 'badge' },
  { key: 'produces', label: 'Produces / Provides', title: 'What the chain outputs, or the station service it provides' },
  { key: 'tiers', label: 'Tiers', title: 'Number of upgrade levels in this chain', numeric: true },
  { key: 'entry_cost', label: 'Entry Cost', title: 'Build cost of the lowest tier, in credits', numeric: true, variant: 'credits' },
  { key: 'top_cost', label: 'Top Cost', title: 'Build cost of the highest tier, in credits', numeric: true, variant: 'credits' },
]

const FACETS: CatalogFacet[] = [
  { key: 'category', label: 'Category' },
  { key: 'service', label: 'Service' },
  { key: 'empire', label: 'Empire' },
]

/** What a chain makes: its recipe's output item, or the service it provides. */
function producesLabel(recipeId: string | undefined, serviceType: string | undefined): string {
  if (recipeId) {
    const recipe = getRecipe(recipeId)
    const output = recipe?.outputs?.[0]
    if (output) {
      const item = getItem(output.item_id)
      const name = item?.name ?? titleCase(output.item_id.replace(/_/g, ' '))
      return output.quantity > 1 ? `${output.quantity}x ${name}` : name
    }
    if (recipe) return recipe.name
  }
  if (serviceType) return `${titleCase(serviceType.replace(/_/g, ' '))} service`
  return ''
}

export default function FacilitiesIndex() {
  // Server component. 2,652 facilities collapse into 859 upgrade chains, and only
  // this slim projection of each chain crosses into the client table — never the
  // facility records themselves. `aka` is search-only (not a column): it carries the
  // names of the upper tiers so searching "Abyss Solidification Engine" still finds
  // the chain it caps.
  const rows: CatalogRow[] = allChains().map((chain) => {
    const { root, levels } = chain
    const top = levels[levels.length - 1]
    const service = levels.find((f) => f.service_type)?.service_type
    const empire = levels.find((f) => f.empire)?.empire

    return {
      id: root.id,
      name: root.name,
      href: `/codex/facilities/${root.id}`,
      category: root.category,
      service: service ? titleCase(service.replace(/_/g, ' ')) : '',
      empire: empire ? empireShortName(empire) : '',
      produces: producesLabel(root.recipe_id, service),
      tiers: levels.length,
      entry_cost: root.build_cost,
      top_cost: top.build_cost,
      aka: levels.slice(1).map((f) => f.name).join(' · '),
    }
  })

  const facilityCount = rows.reduce((sum, row) => sum + (row.tiers as number), 0)

  // Facilities only come from the catalog dump; a build that fell back to the
  // paged API has none. Say so rather than rendering an empty table.
  if (rows.length === 0) {
    return (
      <div className={`console-page console-page-wide ${styles.page}`}>
        <header className="console-page-header">
          <BackLink href="/codex" label="Codex" />
          <span className="console-page-kicker">Database</span>
          <h1 className="console-page-title">Facilities</h1>
        </header>
        <DataUnavailable noun="facilities" />
      </div>
    )
  }

  return (
    <div className={`console-page console-page-wide ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex" label="Codex" />
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">Facilities</h1>
        <p className="console-page-sub">
          The buildings that make a station a station — production lines, docks, markets,
          reactors, and the faction halls that hold territory.
        </p>
      </header>

      <p className={styles.intro}>
        The catalog defines {facilityCount.toLocaleString('en-US')} facilities, but they are not{' '}
        {facilityCount.toLocaleString('en-US')} different buildings. Each one sits at a level in
        an upgrade chain, and following those upgrades collapses the whole set into{' '}
        {rows.length.toLocaleString('en-US')} chains — one per craftable recipe, plus the
        services, infrastructure, and faction buildings. Every row below is one chain, from its
        entry-level building to its final tier; open one to see the cost, power draw, and build
        materials at every level. Search matches the names of every tier, not just the first.
      </p>

      <CatalogTable
        rows={rows}
        columns={COLUMNS}
        facets={FACETS}
        searchKeys={['name', 'id', 'aka', 'produces']}
        searchPlaceholder="Search facilities, any tier…"
        initialSort="name"
        noun="chains"
      />
    </div>
  )
}
