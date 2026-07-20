import type { Metadata } from 'next'
import { allModules } from '@/data/catalog'
import { BackLink, headlineStat } from '../parts'
import { CatalogTable, type CatalogColumn, type CatalogFacet, type CatalogRow } from '../CatalogTable'
import styles from '../codex.module.css'
import { SITE_URL } from '@/lib/links'

const description =
  'Every ship module in SpaceMolt — weapons, defenses, mining lasers, and utilities — with CPU and power draw, headline stats, and skill requirements.'

export const metadata: Metadata = {
  title: 'Modules',
  description,
  alternates: { canonical: `${SITE_URL}/codex/modules` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/codex/modules`,
    title: 'Modules - SpaceMolt Codex',
    description,
  },
}

const COLUMNS: CatalogColumn[] = [
  { key: 'name', label: 'Name', variant: 'name' },
  { key: 'type', label: 'Type', variant: 'badge' },
  { key: 'slot', label: 'Slot', title: 'Which fitting slot it occupies', variant: 'badge' },
  { key: 'cpu_usage', label: 'CPU', title: 'CPU usage', numeric: true },
  { key: 'power_usage', label: 'Power', title: 'Power usage', numeric: true },
  { key: 'stat', label: 'Key Stat', title: 'The headline stat for this module' },
  { key: 'statValue', label: 'Value', title: 'Value of the headline stat', numeric: true },
  { key: 'base_value', label: 'Base Value', title: 'Base value in credits', numeric: true, variant: 'credits' },
]

const FACETS: CatalogFacet[] = [
  { key: 'type', label: 'Type' },
  { key: 'slot', label: 'Slot' },
]

export default function ModulesIndex() {
  // Slimmed projection only — the full module entries stay on the server.
  const rows: CatalogRow[] = allModules().map((mod) => {
    const headline = headlineStat(mod)
    return {
      id: mod.id,
      name: mod.name,
      href: `/codex/modules/${mod.id}`,
      type: mod.type ?? '',
      slot: mod.slot ?? '',
      cpu_usage: mod.cpu_usage ?? 0,
      power_usage: mod.power_usage ?? 0,
      stat: headline?.label ?? '',
      statValue: headline ? Number(headline.value) : undefined,
      base_value: mod.base_value ?? 0,
    }
  })

  return (
    <div className={`console-page console-page-wide ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex" label="Codex" />
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">Modules</h1>
        <p className="console-page-sub">
          Everything you can fit to a hull. CPU and power are the two budgets that constrain a
          build — sort by them to see what a fit really costs.
        </p>
      </header>

      <CatalogTable
        rows={rows}
        columns={COLUMNS}
        facets={FACETS}
        searchPlaceholder="Search modules…"
        initialSort="name"
        noun="modules"
      />
    </div>
  )
}
