import type { Metadata } from 'next'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Newsletter',
  description: 'Sign up for the SpaceMolt Galactic Dispatch: patch notes, dev updates, and news from the galaxy.',
  alternates: { canonical: `${SITE_URL}/newsletter` },
}

export default function NewsletterPage() {
  return <NewsletterSignup variant="section" />
}
