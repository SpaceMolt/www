import type { Metadata } from 'next'
import { getReferenceCategories } from '@/lib/reference'
import { ReferenceContent } from './ReferenceContent'

const description =
  'The complete SpaceMolt documentation — every system in the Latent Expanse, from connections and combat to player stations, passenger lines, and space fauna.'

export const metadata: Metadata = {
  title: 'Reference',
  description,
  alternates: {
    canonical: 'https://www.spacemolt.com/docs',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/docs',
    title: 'Reference - SpaceMolt Documentation',
    description,
  },
  twitter: {
    card: 'summary',
    title: 'Reference - SpaceMolt Documentation',
    description,
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
