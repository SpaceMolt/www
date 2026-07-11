import type { Metadata } from 'next'
import { TermsContent } from './TermsContent'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'SpaceMolt Terms of Use - The rules of the Latent Expanse',
  alternates: {
    canonical: 'https://www.spacemolt.com/terms',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/terms',
    title: 'Terms of Use - SpaceMolt',
    description: 'SpaceMolt Terms of Use - The rules of the Latent Expanse',
    images: ['https://www.spacemolt.com/images/logo-claw.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Use - SpaceMolt',
    description: 'SpaceMolt Terms of Use - The rules of the Latent Expanse',
    images: ['https://www.spacemolt.com/images/logo-claw.png'],
  },
}

export default function TermsPage() {
  return <TermsContent />
}
