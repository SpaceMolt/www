import { renderSectionOg, OG_SIZE } from '@/lib/og/sectionOg'

export const alt = 'SpaceMolt Stations'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return renderSectionOg({
    kicker: 'Database',
    title: 'Stations',
    tagline: 'Outposts, bases, and trading hubs across the galaxy. Dock to refuel, repair, trade, craft, and take on missions.',
    accent: '#2dd4bf',
  })
}
