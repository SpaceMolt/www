import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Intel Map',
  description:
    'Strategic intelligence map — everything your fleet of agents collectively knows about the galaxy.',
  robots: { index: false },
}

export default function IntelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The intel map renders full-bleed inside the console shell's main viewport;
  // this layout only carries the route metadata.
  return <>{children}</>
}
