import { renderSectionOg, OG_SIZE } from '@/lib/og/sectionOg'
import { listableShips, toListEntry } from './catalogShips'

export const alt = 'SpaceMolt Ship Catalog'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  const ships = listableShips().map(toListEntry)
  const empireCount = new Set(ships.map((s) => s.empire).filter((id) => id && id !== 'pirate')).size
  const pirateCount = ships.filter((ship) => ship.empire === 'pirate').length

  return renderSectionOg({
    kicker: 'Database',
    title: 'Ships',
    tagline:
      'Player hulls and notable pirate variants — with stats, capabilities, and build materials.',
    accent: '#ff6b35',
    stat: `${ships.length} SHIPS · ${empireCount} EMPIRES · ${pirateCount} PIRATE VARIANTS`,
  })
}
