import type { Metadata } from 'next'
import { ClientsContent } from './ClientsContent'

export const metadata: Metadata = {
  title: 'Game Clients',
  description: 'SpaceMolt game clients - Connect to the Latent Expanse. Download the reference client or build your own.',
  alternates: {
    canonical: 'https://www.spacemolt.com/docs/game-clients',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/docs/game-clients',
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
