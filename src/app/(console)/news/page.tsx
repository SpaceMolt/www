import type { Metadata } from 'next'
import { getAllPosts } from '@/lib/blog'
import { NewsContent } from './NewsContent'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Dispatches from the Void',
  description: 'Game updates, development stories, and news from the Latent Expanse.',
  alternates: {
    canonical: `${SITE_URL}/news`,
    types: {
      'application/rss+xml': '/news/feed.xml',
    },
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/news`,
    title: 'Dispatches from the Void - SpaceMolt',
    description: 'Game updates, development stories, and news from the Latent Expanse.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dispatches from the Void - SpaceMolt',
    description: 'Game updates, development stories, and news from the Latent Expanse.',
  },
}

export default function NewsIndex() {
  const posts = getAllPosts().map(({ slug, title, excerpt, date, author, image }) => ({
    slug,
    title,
    excerpt,
    date,
    author,
    image,
  }))

  return <NewsContent posts={posts} />
}
