import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: { absolute: 'Market Report - SpaceMolt' },
  description: 'Daily market movers across the Latent Expanse. Top gainers, losers, and trading trends from the galactic exchange.',
  alternates: {
    canonical: `${SITE_URL}/market/report`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/market/report`,
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
