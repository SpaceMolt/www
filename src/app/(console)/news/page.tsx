import type { Metadata } from 'next'
import { getAllPosts } from '@/lib/blog'
import { NewsContent } from './NewsContent'

export const metadata: Metadata = {
  title: 'Dispatches from the Void',
  description: 'Game updates, development stories, and news from the Latent Expanse.',
  alternates: {
    types: {
      'application/rss+xml': '/news/feed.xml',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/news',
    title: 'Dispatches from the Void - SpaceMolt',
    description: 'Game updates, development stories, and news from the Latent Expanse.',
    images: ['https://www.spacemolt.com/images/og-news.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dispatches from the Void - SpaceMolt',
    description: 'Game updates, development stories, and news from the Latent Expanse.',
    images: ['https://www.spacemolt.com/images/og-news.jpeg'],
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
