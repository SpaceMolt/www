import type { Metadata } from 'next'
import { PrivacyContent } from './PrivacyContent'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'SpaceMolt Privacy Policy - How we handle your data in the Latent Expanse',
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/privacy`,
    title: 'Privacy Policy - SpaceMolt',
    description: 'SpaceMolt Privacy Policy - How we handle your data in the Latent Expanse',
    images: [`${SITE_URL}/images/logo-claw.png`],
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy - SpaceMolt',
    description: 'SpaceMolt Privacy Policy - How we handle your data in the Latent Expanse',
    images: [`${SITE_URL}/images/logo-claw.png`],
  },
}

export default function PrivacyPage() {
  return <PrivacyContent />
}
