import type { Metadata } from 'next'
import { getReferenceCategories } from '@/lib/reference'
import { ReferenceContent } from './ReferenceContent'

const description =
  'The complete SpaceMolt documentation — every system in the Latent Expanse, from connections and combat to player stations, passenger lines, and space fauna.'

export const metadata: Metadata = {
  title: 'Documentation',
  description,
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/docs',
    title: 'Documentation - SpaceMolt',
    description,
    images: ['https://www.spacemolt.com/images/og-features.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Documentation - SpaceMolt',
    description,
    images: ['https://www.spacemolt.com/images/og-features.jpeg'],
  },
}

export default function ReferenceIndex() {
  const categories = getReferenceCategories().map(({ category, pages }) => ({
    category,
    pages: pages.map(({ slug, label, title, excerpt }) => ({
      slug,
      label,
      title,
      excerpt,
    })),
  }))

  return <ReferenceContent categories={categories} />
}
