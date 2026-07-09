'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, Rss } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from '@/i18n'
import styles from './page.module.css'

interface Release {
  version: string
  release_date: string
  notes: string[]
}

interface ChangelogContentProps {
  releases: Release[]
  total: number
  totalPages: number
  currentVersion: string
  page: number
  firstOnPage: number
  lastOnPage: number
}

export function ChangelogContent({
  releases,
  total,
  totalPages,
  currentVersion,
  page,
  firstOnPage,
  lastOnPage,
}: ChangelogContentProps) {
  const { t } = useTranslation()
  const PER_PAGE = 20

  return (
    <>
      <div className={styles.gridBg} />

      <section className={styles.hero}>
        <div className={styles.heroLabel}>{t('changelog.eyebrow')}</div>
        <h1 className={styles.heroTitle}>{t('changelog.pageTitle')}</h1>
        <p className={styles.heroSubtitle}>
          {currentVersion && (
            <>
              {t('changelog.currentVersion', { version: currentVersion })}{' '}
            </>
          )}
          {total > 0 && t('changelog.totalReleases', { count: String(total) })}
        </p>
        <a href="/changelog/rss.xml" className={styles.rssLink}>
          <Rss size={14} />
          {t('changelog.rssFeed')}
        </a>
      </section>

      <section className={styles.releases}>
        {releases.length === 0 && (
          <div className={styles.empty}>{t('changelog.empty')}</div>
        )}
        {releases.map((release, i) => {
          const globalIndex = total - (page - 1) * PER_PAGE - i
          return (
            <article key={release.version} className={styles.release} id={`v${release.version}`}>
              <div className={styles.releaseHeader}>
                <div className={styles.releaseIndex}>
                  {String(globalIndex).padStart(3, '0')}
                </div>
                <div className={styles.releaseMeta}>
                  <span className={styles.releaseVersion}>v{release.version}</span>
                  <span className={styles.releaseDate}>
                    {new Date(release.release_date + 'T00:00:00').toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  {page === 1 && i === 0 && <span className={styles.latestBadge}>{t('changelog.latest')}</span>}
                </div>
              </div>
              <ul className={styles.releaseNotes}>
                {release.notes.map((note, j) => (
                  <li key={j} className={styles.releaseNote}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      disallowedElements={['p']}
                      unwrapDisallowed
                    >
                      {note}
                    </ReactMarkdown>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </section>

      {totalPages > 1 && (
        <nav className={styles.pagination}>
          {page > 1 ? (
            <Link href={`/changelog?page=${page - 1}`} className={styles.pageBtn}>
              <ChevronLeft size={16} />
              {t('changelog.newer')}
            </Link>
          ) : (
            <span className={styles.pageBtnDisabled}>
              <ChevronLeft size={16} />
              {t('changelog.newer')}
            </span>
          )}

          <span className={styles.pageInfo}>
            {t('changelog.pageInfo', { first: String(firstOnPage), last: String(lastOnPage), total: String(total) })}
          </span>

          {page < totalPages ? (
            <Link href={`/changelog?page=${page + 1}`} className={styles.pageBtn}>
              {t('changelog.older')}
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span className={styles.pageBtnDisabled}>
              {t('changelog.older')}
              <ChevronRight size={16} />
            </span>
          )}
        </nav>
      )}
    </>
  )
}
