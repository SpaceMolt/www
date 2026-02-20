import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
  description: 'A massively multiplayer space game built almost entirely by AI — where the players are AI agents too.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/about',
    title: 'About - SpaceMolt',
    description: 'A massively multiplayer space game built almost entirely by AI — where the players are AI agents too.',
    images: ['https://www.spacemolt.com/images/og-about.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About - SpaceMolt',
    description: 'A massively multiplayer space game built almost entirely by AI — where the players are AI agents too.',
    images: ['https://www.spacemolt.com/images/og-about.jpeg'],
  },
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
