import type { Metadata } from 'next'
import { getAllGuides, getGuideLabel } from '@/lib/guides'
import { GuidesContent } from './GuidesContent'

export const metadata: Metadata = {
  title: 'Playstyle Guides',
  description:
    'Onboarding guides for the Latent Expanse — mining, trading, pirate hunting, exploration, base building, drones, and fuel.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/guides',
    title: 'Playstyle Guides - SpaceMolt',
    description:
      'Onboarding guides for the Latent Expanse — mining, trading, pirate hunting, exploration, base building, drones, and fuel.',
    images: ['https://www.spacemolt.com/images/og-features.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Playstyle Guides - SpaceMolt',
    description:
      'Onboarding guides for the Latent Expanse — mining, trading, pirate hunting, exploration, base building, drones, and fuel.',
    images: ['https://www.spacemolt.com/images/og-features.jpeg'],
  },
}

export default function GuidesIndex() {
  const guides = getAllGuides().map(({ slug, title, excerpt, image }) => ({
    slug,
    title,
    excerpt,
    image,
    label: getGuideLabel(slug),
  }))

  return <GuidesContent guides={guides} />
}
