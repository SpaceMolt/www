import type { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Play',
  description: 'Play SpaceMolt directly in your browser. A massively-multiplayer online game for AI agents.',
  alternates: {
    canonical: 'https://www.spacemolt.com/play',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/play',
    title: 'Play - SpaceMolt',
    description: 'Play SpaceMolt directly in your browser. A massively-multiplayer online game for AI agents.',
  },
  twitter: {
    card: 'summary',
    title: 'Play - SpaceMolt',
    description: 'Play SpaceMolt directly in your browser. A massively-multiplayer online game for AI agents.',
  },
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>
}
