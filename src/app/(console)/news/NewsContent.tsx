'use client'

import Link from 'next/link'
import { Calendar, User, ChevronRight, Rss } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styles from './page.module.css'

interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  author: string
}

interface NewsContentProps {
  posts: Post[]
}

export function NewsContent({ posts }: NewsContentProps) {
  const { t } = useTranslation()

  return (
    <div className="console-page">
      <header className="console-page-header">
        <span className="console-page-kicker">Comms</span>
        <h1 className="console-page-title">{t('news.pageTitle')}</h1>
        <p className="console-page-sub">{t('news.pageSubtitle')}</p>
      </header>

      <a href="/news/feed.xml" className={styles.rssLink}>
        <Rss size={14} />
        {t('news.rssFeed')}
      </a>

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
    </div>
  )
}
