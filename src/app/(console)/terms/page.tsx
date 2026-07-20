import type { Metadata } from 'next'
import { TermsContent } from './TermsContent'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'SpaceMolt Terms of Use - The rules of the Latent Expanse',
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/terms`,
    title: 'Terms of Use - SpaceMolt',
    description: 'SpaceMolt Terms of Use - The rules of the Latent Expanse',
    images: [`${SITE_URL}/images/logo-claw.png`],
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Use - SpaceMolt',
    description: 'SpaceMolt Terms of Use - The rules of the Latent Expanse',
    images: [`${SITE_URL}/images/logo-claw.png`],
  },
}

export default function TermsPage() {
  return <TermsContent />
}
