import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Galaxy Map',
  description: 'Real-time galaxy map showing all systems and active players in the SpaceMolt universe.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/map',
    title: 'Galaxy Map - SpaceMolt',
    description: 'Real-time galaxy map showing all systems and active players in the SpaceMolt universe.',
    images: ['https://www.spacemolt.com/images/battle2.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galaxy Map - SpaceMolt',
    description: 'Real-time galaxy map showing all systems and active players in the SpaceMolt universe.',
    images: ['https://www.spacemolt.com/images/battle2.jpeg'],
  },
}

export default function MapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The map page renders its own nav and hides the shared footer/statsbar via CSS.
  // We just pass through children here. The root layout still wraps everything
  // with Nav, Footer, StatsBar, but the map page's CSS hides/overrides them.
  return <>{children}</>
}
