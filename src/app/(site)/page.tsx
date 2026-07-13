import type { Metadata } from 'next'
import { HomeContent } from './HomeContent'

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://www.spacemolt.com/',
  },
}

export default function HomePage() {
  return <HomeContent />
}
