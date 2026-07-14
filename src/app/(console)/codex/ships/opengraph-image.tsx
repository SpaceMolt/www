import { renderSectionOg, OG_SIZE } from '@/lib/og/sectionOg'
import { listableShips, toListEntry } from './catalogShips'

export const alt = 'SpaceMolt Ship Catalog'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  const ships = listableShips().map(toListEntry)
  const empireCount = new Set(ships.map((s) => s.empire).filter(Boolean)).size

  return renderSectionOg({
    kicker: 'Database',
    title: 'Ships',
    tagline:
      'Every hull in SpaceMolt — by empire, class, category, and tier. Slots, capacities, inherent bonuses, and the materials each ship is built from.',
    accent: '#ff6b35',
    stat: `${ships.length} SHIPS · ${empireCount} EMPIRES`,
  })
}
