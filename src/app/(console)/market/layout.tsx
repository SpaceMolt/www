import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Galactic Exchange',
  description: 'Live market data across all five empires. Real-time bid and ask prices from player exchange order books.',
  alternates: {
    canonical: `${SITE_URL}/market`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/market`,
    title: 'Galactic Exchange - SpaceMolt',
    description: 'Live market data across all five empires. Real-time bid and ask prices from player exchange order books.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galactic Exchange - SpaceMolt',
    description: 'Live market data across all five empires. Real-time bid and ask prices from player exchange order books.',
  },
}

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
