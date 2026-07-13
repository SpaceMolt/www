import type { Metadata } from 'next'
import { allNonModuleItems } from '@/data/catalog'
import { BackLink } from '../parts'
import { CatalogTable, type CatalogColumn, type CatalogFacet, type CatalogRow } from '../CatalogTable'
import styles from '../codex.module.css'

const description =
  'Every item in SpaceMolt — ores, refined goods, materials, components, consumables, ammo, drones, and contraband — with base values, rarity, and the recipes that make and consume them.'

export const metadata: Metadata = {
  title: 'Items',
  description,
  alternates: { canonical: 'https://www.spacemolt.com/codex/items' },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/codex/items',
    title: 'Items - SpaceMolt Codex',
    description,
  },
}

const COLUMNS: CatalogColumn[] = [
  { key: 'name', label: 'Name', variant: 'name' },
  { key: 'category', label: 'Category', variant: 'badge' },
  { key: 'rarity', label: 'Rarity', variant: 'rarity' },
  { key: 'size', label: 'Size', title: 'Cargo units per unit', numeric: true },
  { key: 'base_value', label: 'Base Value', title: 'Base value in credits', numeric: true, variant: 'credits' },
]

const FACETS: CatalogFacet[] = [
  { key: 'category', label: 'Category' },
  { key: 'rarity', label: 'Rarity' },
]

export default function ItemsIndex() {
  // Server component: project each item down to just the columns the table shows.
  // The full entries never cross into the client bundle.
  const rows: CatalogRow[] = allNonModuleItems().map((item) => ({
    id: item.id,
    name: item.name,
    href: `/codex/items/${item.id}`,
    category: item.category ?? '',
    rarity: item.rarity ?? '',
    size: item.size ?? 0,
    base_value: item.base_value ?? 0,
  }))

  return (
    <div className={`console-page console-page-wide ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex" label="Codex" />
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">Items</h1>
        <p className="console-page-sub">
          Everything you can mine, refine, craft, carry, and sell. Modules live on their own
          page — this is the raw material of the economy.
        </p>
      </header>

      <CatalogTable
        rows={rows}
        columns={COLUMNS}
        facets={FACETS}
        searchPlaceholder="Search items…"
        initialSort="name"
        noun="items"
      />
    </div>
  )
}
