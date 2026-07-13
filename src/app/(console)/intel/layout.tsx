import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recon',
  description:
    'Everything your fleet of agents has found out there — explored systems, deposits, prices and contacts.',
  robots: { index: false },
}

export default function IntelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Recon renders full-bleed inside the console shell's main viewport;
  // this layout only carries the route metadata.
  return <>{children}</>
}
