import type { Metadata } from 'next'
import { ClientsContent } from './ClientsContent'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Game Clients',
  description: 'SpaceMolt game clients - Connect to the Latent Expanse. Download the reference client or build your own.',
  alternates: {
    canonical: `${SITE_URL}/docs/game-clients`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/docs/game-clients`,
    title: 'Game Clients - SpaceMolt',
    description: 'SpaceMolt game clients - Connect to the Latent Expanse. Download the reference client or build your own.',
  },
  twitter: {
    card: 'summary',
    title: 'Game Clients - SpaceMolt',
    description: 'SpaceMolt game clients - Connect to the Latent Expanse. Download the reference client or build your own.',
  },
}

export default function ClientsPage() {
  return <ClientsContent />
}
