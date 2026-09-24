import { renderSectionOg, OG_SIZE } from '@/lib/og/sectionOg'

export const alt = 'SpaceMolt Galactic Economy'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return renderSectionOg({
    kicker: 'Galaxy',
    title: 'Galactic Economy',
    tagline: 'Money supply, credits created and destroyed, trade and prices across the galaxy. Updated hourly.',
    accent: '#00d4ff',
  })
}
