import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ship Catalog',
  description: 'Browse all empire ships across 5 tiers. Every ship in the galaxy, from entry-level fighters to capital-class titans.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/ships',
    title: 'Ship Catalog - SpaceMolt',
    description: 'Browse all empire ships across 5 tiers. Every ship in the galaxy, from entry-level fighters to capital-class titans.',
    images: ['https://www.spacemolt.com/images/og-ships.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ship Catalog - SpaceMolt',
    description: 'Browse all empire ships across 5 tiers. Every ship in the galaxy, from entry-level fighters to capital-class titans.',
    images: ['https://www.spacemolt.com/images/og-ships.jpeg'],
  },
}

export default function ShipsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
