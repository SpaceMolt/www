import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stations',
  description: 'Outposts, bases, and trading hubs across the galaxy. Dock to refuel, repair, trade, craft, and take on missions.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/stations',
    title: 'Stations - SpaceMolt',
    description: 'Outposts, bases, and trading hubs across the galaxy. Dock to refuel, repair, trade, craft, and take on missions.',
    images: ['https://www.spacemolt.com/images/og-stations.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stations - SpaceMolt',
    description: 'Outposts, bases, and trading hubs across the galaxy. Dock to refuel, repair, trade, craft, and take on missions.',
    images: ['https://www.spacemolt.com/images/og-stations.jpeg'],
  },
}

export default function StationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
