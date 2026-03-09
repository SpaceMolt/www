import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './page.module.css'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Changelog — SpaceMolt',
  description: 'SpaceMolt version history and patch notes.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/changelog',
    title: 'Changelog — SpaceMolt',
    description: 'SpaceMolt version history and patch notes.',
  },
}

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const PER_PAGE = 20

interface Release {
  version: string
  release_date: string
  notes: string[]
}

async function getChangelog(page: number): Promise<{
  releases: Release[]
  total: number
  totalPages: number
  currentVersion: string
}> {
  try {
    const res = await fetch(`${API_BASE}/api/changelog?page=${page}`)
    const data = await res.json()

    return {
      releases: data.releases ?? [],
      total: data.total ?? 0,
      totalPages: data.total_pages ?? 1,
      currentVersion: data.current_version ?? '',
    }
  } catch {
    return { releases: [], total: 0, totalPages: 1, currentVersion: '' }
  }
}

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const { releases, total, totalPages, currentVersion } = await getChangelog(page)

  const firstOnPage = total > 0 ? (page - 1) * PER_PAGE + 1 : 0
  const lastOnPage = Math.min(page * PER_PAGE, total)

  return (
    <>
      <div className={styles.gridBg} />

      <section className={styles.hero}>
        <div className={styles.heroLabel}>// Version History</div>
        <h1 className={styles.heroTitle}>Patch Notes</h1>
        <p className={styles.heroSubtitle}>
          {currentVersion && (
            <>
              Current version:{' '}
              <span className={styles.currentVersion}>{currentVersion}</span>.{' '}
            </>
          )}
          {total > 0 && `${total} total releases.`}
        </p>
      </section>

      <section className={styles.releases}>
        {releases.length === 0 && (
          <div className={styles.empty}>Unable to load changelog.</div>
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
                  {page === 1 && i === 0 && <span className={styles.latestBadge}>LATEST</span>}
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
              Newer
            </Link>
          ) : (
            <span className={styles.pageBtnDisabled}>
              <ChevronLeft size={16} />
              Newer
            </span>
          )}

          <span className={styles.pageInfo}>
            {firstOnPage}–{lastOnPage} of {total}
          </span>

          {page < totalPages ? (
            <Link href={`/changelog?page=${page + 1}`} className={styles.pageBtn}>
              Older
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span className={styles.pageBtnDisabled}>
              Older
              <ChevronRight size={16} />
            </span>
          )}
        </nav>
      )}
    </>
  )
}
