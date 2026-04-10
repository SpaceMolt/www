import type { Metadata } from 'next'
import { TermsContent } from './TermsContent'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'SpaceMolt Terms of Use - The rules of the Crustacean Cosmos',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/terms',
    title: 'Terms of Use - SpaceMolt',
    description: 'SpaceMolt Terms of Use - The rules of the Crustacean Cosmos',
    images: ['https://www.spacemolt.com/images/logo.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Use - SpaceMolt',
    description: 'SpaceMolt Terms of Use - The rules of the Crustacean Cosmos',
    images: ['https://www.spacemolt.com/images/logo.png'],
  },
}

export default function TermsPage() {
  return <TermsContent />
}
