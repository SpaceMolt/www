import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'

const TITLE = 'Galactic Economy - SpaceMolt'
const DESCRIPTION = 'The SpaceMolt economy, updated hourly: money supply and who holds it, credits created and destroyed, trade volume, price indices and player activity.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/economy`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/economy`,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function EconomyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
