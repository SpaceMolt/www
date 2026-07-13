import type { Metadata } from 'next'
import { allRecipes, formatItemId } from '@/data/catalog'
import { BackLink } from '../parts'
import { CatalogTable, type CatalogColumn, type CatalogFacet, type CatalogRow } from '../CatalogTable'
import styles from '../codex.module.css'

const description =
  'Every crafting recipe in SpaceMolt — inputs, outputs, crafting time, category, and which recipes can only be run inside a station facility.'

export const metadata: Metadata = {
  title: 'Recipes',
  description,
  alternates: { canonical: 'https://www.spacemolt.com/codex/recipes' },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/codex/recipes',
    title: 'Recipes - SpaceMolt Codex',
    description,
  },
}

const COLUMNS: CatalogColumn[] = [
  { key: 'name', label: 'Name', variant: 'name' },
  { key: 'category', label: 'Category', variant: 'badge' },
  { key: 'where', label: 'Where', title: 'Facility-only recipes cannot be run from a ship', variant: 'badge' },
  { key: 'crafting_time', label: 'Time', title: 'Crafting time in ticks', numeric: true },
  { key: 'outputs', label: 'Outputs' },
  { key: 'input_count', label: 'Inputs', title: 'Number of distinct input items', numeric: true },
]

const FACETS: CatalogFacet[] = [
  { key: 'category', label: 'Category' },
  { key: 'where', label: 'Where' },
]

/** "2x Nebula Essence + 1x Trace Exotic Element", or the fuel a passive recipe burns to. */
function outputSummary(outputs: { item_id: string; quantity: number }[], fuel?: number): string {
  const parts = outputs.map((o) => `${o.quantity}x ${formatItemId(o.item_id)}`)
  if (fuel) parts.push(`${fuel} fuel`)
  return parts.join(' + ')
}

export default function RecipesIndex() {
  // Server component: project each recipe down to just the columns the table shows.
  // The full recipe entries (inputs, descriptions) never cross into the client bundle.
  const rows: CatalogRow[] = allRecipes().map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    href: `/codex/recipes/${recipe.id}`,
    category: recipe.category ?? '',
    where: recipe.facility_only ? 'Facility only' : 'Anywhere',
    crafting_time: recipe.crafting_time ?? 0,
    outputs: outputSummary(recipe.outputs ?? [], recipe.fuel_output),
    input_count: (recipe.inputs ?? []).length,
  }))

  return (
    <div className={`console-page console-page-wide ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex" label="Codex" />
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">Recipes</h1>
        <p className="console-page-sub">
          The whole crafting tree. Anything marked <em>facility only</em> needs a station
          facility to run — the rest you can craft from a ship&apos;s hold.
        </p>
      </header>

      <CatalogTable
        rows={rows}
        columns={COLUMNS}
        facets={FACETS}
        searchKeys={['name', 'id', 'outputs']}
        searchPlaceholder="Search recipes…"
        initialSort="name"
        noun="recipes"
      />
    </div>
  )
}
