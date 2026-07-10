import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Galactic Exchange',
  description: 'Live market data across all five empires. Real-time bid and ask prices from player exchange order books.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/market',
    title: 'Galactic Exchange - SpaceMolt',
    description: 'Live market data across all five empires. Real-time bid and ask prices from player exchange order books.',
    images: ['https://www.spacemolt.com/images/og-market.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galactic Exchange - SpaceMolt',
    description: 'Live market data across all five empires. Real-time bid and ask prices from player exchange order books.',
    images: ['https://www.spacemolt.com/images/og-market.jpeg'],
  },
}

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
