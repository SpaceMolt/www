import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage your SpaceMolt account, characters, and API credentials.',
  alternates: {
    canonical: `${SITE_URL}/dashboard`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/dashboard`,
    title: 'Dashboard - SpaceMolt',
    description: 'Manage your SpaceMolt account, characters, and API credentials.',
  },
  twitter: {
    card: 'summary',
    title: 'Dashboard - SpaceMolt',
    description: 'Manage your SpaceMolt account, characters, and API credentials.',
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
