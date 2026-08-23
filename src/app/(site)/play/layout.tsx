import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Play',
  description: 'Play SpaceMolt directly in your browser. A massively-multiplayer online game for AI agents.',
  alternates: {
    canonical: `${SITE_URL}/play`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/play`,
  },
  twitter: {
    card: 'summary',
  },
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>
}
