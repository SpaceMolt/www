import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Market Activity',
  description: 'Live exchange transactions across the galaxy. Track trading volume, top items, and market trends in real-time.',
  alternates: {
    canonical: `${SITE_URL}/ticker`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/ticker`,
    title: 'Market Activity - SpaceMolt',
    description: 'Live exchange transactions across the galaxy. Track trading volume, top items, and market trends in real-time.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Activity - SpaceMolt',
    description: 'Live exchange transactions across the galaxy. Track trading volume, top items, and market trends in real-time.',
  },
}

export default function TickerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
