import type { Metadata } from 'next'
import { CookiesContent } from './CookiesContent'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'SpaceMolt Cookie Policy - How we use cookies on our website',
  alternates: {
    canonical: `${SITE_URL}/cookies`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/cookies`,
    title: 'Cookie Policy - SpaceMolt',
    description: 'SpaceMolt Cookie Policy - How we use cookies on our website',
    images: [`${SITE_URL}/images/logo-claw.png`],
  },
  twitter: {
    card: 'summary',
    title: 'Cookie Policy - SpaceMolt',
    description: 'SpaceMolt Cookie Policy - How we use cookies on our website',
    images: [`${SITE_URL}/images/logo-claw.png`],
  },
}

export default function CookiePolicyPage() {
  return <CookiesContent />
}
