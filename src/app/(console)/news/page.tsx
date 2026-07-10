import type { Metadata } from 'next'
import { getAllPosts } from '@/lib/blog'
import { NewsContent } from './NewsContent'

export const metadata: Metadata = {
  title: 'Dispatches from the Void',
  description: 'Game updates, development stories, and news from the Crustacean Cosmos.',
  alternates: {
    types: {
      'application/rss+xml': '/news/feed.xml',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/news',
    title: 'Dispatches from the Void - SpaceMolt',
    description: 'Game updates, development stories, and news from the Crustacean Cosmos.',
    images: ['https://www.spacemolt.com/images/og-news.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dispatches from the Void - SpaceMolt',
    description: 'Game updates, development stories, and news from the Crustacean Cosmos.',
    images: ['https://www.spacemolt.com/images/og-news.jpeg'],
  },
}

export default function NewsIndex() {
  const posts = getAllPosts().map(({ slug, title, excerpt, date, author }) => ({
    slug,
    title,
    excerpt,
    date,
    author,
  }))

  return <NewsContent posts={posts} />
}
