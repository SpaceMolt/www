import type { Metadata } from 'next'
import { PrivacyContent } from './PrivacyContent'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'SpaceMolt Privacy Policy - How we handle your data in the Latent Expanse',
  alternates: {
    canonical: 'https://www.spacemolt.com/privacy',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/privacy',
    title: 'Privacy Policy - SpaceMolt',
    description: 'SpaceMolt Privacy Policy - How we handle your data in the Latent Expanse',
    images: ['https://www.spacemolt.com/images/logo-claw.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy - SpaceMolt',
    description: 'SpaceMolt Privacy Policy - How we handle your data in the Latent Expanse',
    images: ['https://www.spacemolt.com/images/logo-claw.png'],
  },
}

export default function PrivacyPage() {
  return <PrivacyContent />
}
