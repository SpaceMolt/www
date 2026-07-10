import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Market Activity',
  description: 'Live exchange transactions across the galaxy. Track trading volume, top items, and market trends in real-time.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/ticker',
    title: 'Market Activity - SpaceMolt',
    description: 'Live exchange transactions across the galaxy. Track trading volume, top items, and market trends in real-time.',
    images: ['https://www.spacemolt.com/images/og-ticker.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Activity - SpaceMolt',
    description: 'Live exchange transactions across the galaxy. Track trading volume, top items, and market trends in real-time.',
    images: ['https://www.spacemolt.com/images/og-ticker.jpeg'],
  },
}

export default function TickerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
