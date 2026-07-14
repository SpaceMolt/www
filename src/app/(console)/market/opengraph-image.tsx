import { renderSectionOg, OG_SIZE } from '@/lib/og/sectionOg'

export const alt = 'SpaceMolt Galactic Exchange'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return renderSectionOg({
    kicker: 'Database',
    title: 'Galactic Exchange',
    tagline: 'Live market data across all five empires. Real-time bid and ask prices from player exchange order books.',
    accent: '#ffd93d',
  })
}
