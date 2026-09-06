import type { Metadata } from 'next'
import { allItems, allShips } from '@/data/catalog'
import { buildShipAppearances } from '@/lib/cinema/appearance'
import { buildHardwareCatalog } from '@/lib/cinema/hardware'
import CinemaExperience from '@/components/cinema/CinemaExperience'

export const metadata: Metadata = {
  title: 'Battle Cinema',
  description: 'Step inside a SpaceMolt battle. A cinematic short inspired by a completed battle, with original 3D ships, sound, and effects.',
  robots: { index: false, follow: true },
}

export default async function BattleCinemaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Only visual dimensions, identity and module construction kinds cross the boundary, never the
  // full catalog's descriptions, recipes, prices, or combat statistics.
  return <CinemaExperience key={id} battleId={id} appearances={buildShipAppearances(allShips())} hardwareCatalog={buildHardwareCatalog(allItems())} />
}
