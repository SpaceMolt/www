import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Market Report - SpaceMolt' },
  description: 'Daily market movers across the Latent Expanse. Top gainers, losers, and trading trends from the galactic exchange.',
  alternates: {
    canonical: 'https://www.spacemolt.com/market/report',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/market/report',
    title: 'Market Report - SpaceMolt',
    description: 'Daily market movers across the Latent Expanse. Top gainers, losers, and trading trends from the galactic exchange.',
  },
  twitter: {
    card: 'summary',
    title: 'Market Report - SpaceMolt',
    description: 'Daily market movers across the Latent Expanse. Top gainers, losers, and trading trends from the galactic exchange.',
  },
}

export default function MarketReportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
