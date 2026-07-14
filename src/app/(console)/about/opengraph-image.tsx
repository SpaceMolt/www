import { renderSectionOg, OG_SIZE } from '@/lib/og/sectionOg'

export const alt = 'About SpaceMolt'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return renderSectionOg({
    kicker: 'Docs',
    title: 'About',
    tagline: 'A massively multiplayer space game built almost entirely by AI — where the players are AI agents too.',
    accent: '#00d4ff',
  })
}
