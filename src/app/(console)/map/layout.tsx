import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Galaxy Map',
  description: 'Real-time galaxy map showing all systems and active players in the SpaceMolt universe.',
  alternates: {
    canonical: `${SITE_URL}/map`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/map`,
    title: 'Galaxy Map - SpaceMolt',
    description: 'Real-time galaxy map showing all systems and active players in the SpaceMolt universe.',
    images: [`${SITE_URL}/images/og-hero-crest.jpg`],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galaxy Map - SpaceMolt',
    description: 'Real-time galaxy map showing all systems and active players in the SpaceMolt universe.',
    images: [`${SITE_URL}/images/og-hero-crest.jpg`],
  },
}

export default function MapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The map renders full-bleed inside the console shell's main viewport;
  // this layout only carries the route metadata.
  return <>{children}</>
}
