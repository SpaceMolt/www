import type { Metadata } from 'next'
import { CookiesContent } from './CookiesContent'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'SpaceMolt Cookie Policy - How we use cookies on our website',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/cookies',
    title: 'Cookie Policy - SpaceMolt',
    description: 'SpaceMolt Cookie Policy - How we use cookies on our website',
    images: ['https://www.spacemolt.com/images/logo-claw.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cookie Policy - SpaceMolt',
    description: 'SpaceMolt Cookie Policy - How we use cookies on our website',
    images: ['https://www.spacemolt.com/images/logo-claw.png'],
  },
}

export default function CookiePolicyPage() {
  return <CookiesContent />
}
