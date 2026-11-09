'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCommandQuery } from '@/lib/spacemolt'
import { Loading, shared } from '../../shared'
import styles from '../InfoPanel.module.css'

const COUNT = 5

/** Prev/next pager for the Info tabs. `children` is the position text; `labelled` adds Newer/Older; `extra` sits after. */
export function Pager({ canPrev, canNext, onPrev, onNext, labelled = false, extra, children }: {
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  labelled?: boolean
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={styles.pager}>
      <button type="button" className={shared.subtleBtn} disabled={!canPrev} onClick={onPrev}>
        <ChevronLeft size={12} />{labelled && ' Newer'}
      </button>
      <span>{children}</span>
      <button type="button" className={shared.subtleBtn} disabled={!canNext} onClick={onNext}>
        {labelled && 'Older '}<ChevronRight size={12} />
      </button>
      {extra}
    </div>
  )
}

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
        <Pager canPrev={page > 1} canNext={Boolean(data.has_more)} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} labelled>
          Page {data.page} of {data.total_pages}
        </Pager>
      )}
    </div>
  )
}
