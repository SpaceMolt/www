'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCommandQuery } from '@/lib/spacemolt'
import { Loading, shared } from '../../shared'
import styles from '../InfoPanel.module.css'

const COUNT = 5

/** Paged changelog from get_version (newest first). */
export function ReleaseNotes() {
  const [page, setPage] = useState(1)
  const version = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_version({ page, count: COUNT })).structuredContent,
    [page],
  )
  const data = version.data

  return (
    <div className={styles.actionLogSection}>
      {version.error && <div className={styles.errorBanner}>{version.error}</div>}
      {version.loading && !data && <Loading message="Loading release notes..." />}
      {data?.versions.map((v) => (
        <div key={v.version} className={styles.logEntry}>
          <div className={styles.logEntryHeader}>
            <span className={styles.logCategory}>v{v.version}</span>
            <span className={styles.logTimestamp}>{v.release_date}</span>
          </div>
          {v.notes.map((note, i) => (
            <div key={i} className={`${styles.logEntrySummary} ${styles.textBody}`}>{note}</div>
          ))}
        </div>
      ))}
      {data && data.total_pages > 1 && (
        <div className={styles.pager}>
          <button type="button" className={shared.subtleBtn} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={12} /> Newer
          </button>
          <span>Page {data.page} of {data.total_pages}</span>
          <button type="button" className={shared.subtleBtn} disabled={!data.has_more} onClick={() => setPage(page + 1)}>
            Older <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
