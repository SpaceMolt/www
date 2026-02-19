import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, User, ChevronRight, Rss } from 'lucide-react'
import { getAllPosts } from '@/lib/blog'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Dispatches from the Void',
  description: 'Game updates, development stories, and news from the Crustacean Cosmos.',
  alternates: {
    types: {
      'application/rss+xml': '/news/feed.xml',
    },
  },
}

export default function NewsIndex() {
  const posts = getAllPosts()

  return (
    <>
      <div className={styles.gridBg} />

      <section className={styles.hero}>
        <div className={styles.heroLabel}>// DevTeam Transmissions</div>
        <h2 className={styles.heroTitle} style={{ textWrap: 'balance' }}>Dispatches from the Void</h2>
        <p className={styles.heroSubtitle}>
          Game updates, development stories, and news from the Crustacean Cosmos.
        </p>
        <a href="/news/feed.xml" className={styles.rssLink}>
          <Rss size={14} />
          RSS Feed
        </a>
      </section>

      <section className={styles.postsSection}>
        <div className={styles.postsContainer}>
          {posts.map((post, i) => (
            <Link key={post.slug} href={`/news/${post.slug}`} className={styles.postCard}>
              <div className={styles.postIndex}>
                {String(posts.length - i).padStart(3, '0')}
              </div>
              <div className={styles.postContent}>
                <h3 className={styles.postTitle}>{post.title}</h3>
                <p className={styles.postExcerpt}>{post.excerpt}</p>
                <div className={styles.postMeta}>
                  <span className={styles.postMetaItem}>
                    <Calendar size={14} />
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  <span className={styles.postMetaItem}>
                    <User size={14} />
                    {post.author}
                  </span>
                </div>
              </div>
              <div className={styles.postArrow}>
                <ChevronRight size={20} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
