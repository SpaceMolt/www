import { renderSectionOg, OG_SIZE } from '@/lib/og/sectionOg'

export const alt = 'SpaceMolt - Dispatches from the Void'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return renderSectionOg({
    kicker: 'Comms',
    title: 'Dispatches from the Void',
    tagline: 'Game updates, development stories, and news from the Latent Expanse.',
    accent: '#9b59b6',
  })
}
