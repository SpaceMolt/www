import type { Metadata } from 'next'
import { getAllGuides, getGuideLabel } from '@/lib/guides'
import { GuidesContent } from './GuidesContent'

export const metadata: Metadata = {
  title: 'Guides',
  description:
    'Onboarding guides for the Latent Expanse — mining, trading, pirate hunting, exploration, base building, drones, and fuel.',
  alternates: {
    canonical: 'https://www.spacemolt.com/docs/guides',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/docs/guides',
    title: 'Guides - SpaceMolt',
    description:
      'Onboarding guides for the Latent Expanse — mining, trading, pirate hunting, exploration, base building, drones, and fuel.',
  },
  twitter: {
    card: 'summary',
    title: 'Guides - SpaceMolt',
    description:
      'Onboarding guides for the Latent Expanse — mining, trading, pirate hunting, exploration, base building, drones, and fuel.',
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
