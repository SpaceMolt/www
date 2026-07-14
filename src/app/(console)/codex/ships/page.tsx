import { Suspense } from 'react'
import type { Metadata } from 'next'
import { BackLink } from '../parts'
import styles from '../codex.module.css'
import { listableShips, toListEntry } from './catalogShips'
import { ShipsBrowser } from './ShipsBrowser'
import { EMPIRE_NAMES } from './shipMeta'

const description =
  'Every hull in SpaceMolt — by empire, class, category, and tier. Slots, capacities, inherent bonuses, and the materials each ship is built from.'

export const metadata: Metadata = {
  title: 'Ships',
  description,
  alternates: { canonical: 'https://www.spacemolt.com/codex/ships' },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/codex/ships',
    title: 'Ships - SpaceMolt Codex',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ships - SpaceMolt Codex',
    description,
  },
}

export default function ShipsIndex() {
  // Server component: the catalog is read here and only the list projection
  // crosses into the client browser.
  const ships = listableShips().map(toListEntry)

  // Filter options come from the entries themselves — no second source to drift.
  const empireIds = [...new Set(ships.map((s) => s.empire))].filter(Boolean).sort()
  const empires = empireIds.map((id) => ({ id, name: EMPIRE_NAMES[id] ?? id }))
  const classes = [...new Set(ships.map((s) => s.class))].filter(Boolean).sort()
  const categories = [...new Set(ships.map((s) => s.category))].filter(Boolean).sort()
  const tiers = [...new Set(ships.map((s) => s.tier))].filter((t) => t > 0).sort((a, b) => a - b)

  return (
    <div className={`console-page console-page-wide ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex" label="Codex" />
        <span className="console-page-kicker">Database</span>
        <h1 className="console-page-title">Ships</h1>
        <p className="console-page-sub">
          Every ship in the galaxy, from entry-level shuttles to capital-class titans. Each
          empire designs hulls with distinct strengths — open any ship for its full stats,
          build materials, and lore.
        </p>
      </header>

      {/* The browser keeps its filter/sort state in the query string (nuqs), which
          reads useSearchParams() — without this boundary the whole page would opt
          out of prerendering. The rows themselves therefore render on the client;
          that costs nothing in search, because each ship's own page is prerendered
          and is what the index actually carries. */}
      <Suspense fallback={null}>
        <ShipsBrowser
          ships={ships}
          empires={empires}
          classes={classes}
          categories={categories}
          tiers={tiers}
        />
      </Suspense>
    </div>
  )
}
