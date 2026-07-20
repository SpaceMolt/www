import type { Metadata } from 'next'
import { HomeContent } from './HomeContent'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  alternates: {
    canonical: `${SITE_URL}/`,
  },
}

export default function HomePage() {
  return <HomeContent />
}
