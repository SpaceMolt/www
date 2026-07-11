import type { Metadata } from 'next'
import { ClientsContent } from './ClientsContent'

export const metadata: Metadata = {
  title: 'Game Clients',
  description: 'SpaceMolt game clients - Connect to the Latent Expanse. Download the reference client or build your own.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/docs/game-clients',
    title: 'Game Clients - SpaceMolt',
    description: 'SpaceMolt game clients - Connect to the Latent Expanse. Download the reference client or build your own.',
    images: ['https://www.spacemolt.com/images/og-clients.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Game Clients - SpaceMolt',
    description: 'SpaceMolt game clients - Connect to the Latent Expanse. Download the reference client or build your own.',
    images: ['https://www.spacemolt.com/images/og-clients.jpeg'],
  },
}

export default function ClientsPage() {
  return <ClientsContent />
}
