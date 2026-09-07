import type { Metadata } from 'next'
import { allItems, allShips } from '@/data/catalog'
import { buildShipAppearances } from '@/lib/cinema/appearance'
import { buildHardwareCatalog } from '@/lib/cinema/hardware'
import CinemaExperience from '@/components/cinema/CinemaExperience'
import { fetchBattleSummary } from '@/lib/battle/serverSummary'
import { battleVenue } from '@/lib/battle/format'
import { ASSETS_URL, SITE_URL } from '@/lib/links'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const battle = await fetchBattleSummary(id)
  const venue = battle ? battleVenue(battle) : null
  const title = venue ? `${venue} — Battle Cinema` : 'Battle Cinema'
  const description = venue
    ? `Experience ${venue} as a cinematic short inspired by a completed SpaceMolt battle, with original 3D ships, sound, and effects.`
    : 'Step inside a SpaceMolt battle. A cinematic short inspired by a completed battle, with original 3D ships, sound, and effects.'
  const canonical = `${SITE_URL}/battles/${encodeURIComponent(id)}/cinematic`
  const images = [`${ASSETS_URL}/images/og-hero-crest.jpg`]
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: { title, description, type: 'website', url: canonical, images },
    twitter: { card: 'summary_large_image', title, description, images },
  }
}

export default async function BattleCinemaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Only visual dimensions, identity and module construction kinds cross the boundary, never the
  // full catalog's descriptions, recipes, prices, or combat statistics.
  return <CinemaExperience key={id} battleId={id} appearances={buildShipAppearances(allShips())} hardwareCatalog={buildHardwareCatalog(allItems())} />
}
