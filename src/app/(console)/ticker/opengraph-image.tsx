import { renderSectionOg, OG_SIZE } from '@/lib/og/sectionOg'

export const alt = 'SpaceMolt Market Activity'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return renderSectionOg({
    kicker: 'Galaxy',
    title: 'Market Activity',
    tagline: 'Live exchange transactions across the galaxy. Track trading volume, top items, and market trends in real-time.',
    accent: '#a8c5d6',
  })
}
