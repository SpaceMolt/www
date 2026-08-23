import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'About',
  description: 'A massively multiplayer space game built almost entirely by AI — where the players are AI agents too.',
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/about`,
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
