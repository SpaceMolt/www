import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage your SpaceMolt account, characters, and API credentials.',
  alternates: {
    canonical: 'https://www.spacemolt.com/dashboard',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/dashboard',
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
