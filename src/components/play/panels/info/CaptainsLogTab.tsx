'use client'

import { useState } from 'react'
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import { useAccountStore, useCommandQuery } from '@/lib/spacemolt'
import { timeAgoOrDate } from '@/lib/format'
import { ActionButton } from '../../ActionButton'
import { ConfirmAction, Loading, shared, useAction } from '../../shared'
import styles from '../InfoPanel.module.css'
import { Pager } from './ReleaseNotes'

/**
 * Captain's log. captains_log_list returns one entry per call (index 0 =
 * newest) with its content and has_prev/has_next, so we page one entry at a
 * time instead of fanning out a request per entry.
 */
export function CaptainsLogTab() {
  const store = useAccountStore()
  const [index, setIndex] = useState(0)
  const log = useCommandQuery(
    async (account) => (await account.commands.spacemolt_social.captains_log_list({ index })).structuredContent,
    [index],
  )
  const [draft, setDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { busy: running, run: runAction } = useAction()
  const busy = running !== null

  const run = async (fn: () => Promise<unknown>, success: string) => {
    const ok = await runAction('log', async () => { await fn(); return true }, success, 'toast')
    if (!ok) return
    setConfirmDelete(false)
    // Both add and delete shift indices; go back to the newest entry.
    if (index === 0) log.refetch()
    else setIndex(0)
  }

  const social = store.account.commands.spacemolt_social
  const data = log.data
  const entry = data?.entry

  return (
    <div className={styles.tabBody}>
      <div className={styles.noteForm}>
        <textarea
          className={styles.noteTextarea}
          placeholder="New log entry..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <ActionButton
          label="Add Entry"
          icon={<Plus size={12} />}
          onClick={() => run(async () => {
            await social.captains_log_add({ content: draft.trim() })
            setDraft('')
          }, 'Log entry added')}
          disabled={!draft.trim()}
          loading={busy}
          size="sm"
        />
      </div>
      <div className={styles.divider} />
      {log.error && <div className={styles.errorBanner}>{log.error}</div>}
      {log.loading && !data && <Loading message="Loading log..." />}
      {data && !entry && <div className={shared.emptyState}>Your captain&apos;s log is empty.</div>}
      {entry && (
        <>
          <div className={styles.logEntry}>
            <div className={styles.logEntryHeader}>
              <span className={styles.logCategory}><BookOpen size={10} /> #{entry.index + 1}</span>
              <span className={styles.logTimestamp}>{timeAgoOrDate(entry.created_at)}</span>
            </div>
            <div className={`${styles.logEntrySummary} ${styles.textBody}`}>{entry.entry}</div>
          </div>
          {confirmDelete ? (
            <ConfirmAction
              message="Delete this log entry?"
              confirmDisabled={busy}
              onConfirm={() => run(() => social.captains_log_delete({ index: entry.index }), 'Log entry deleted')}
              onCancel={() => setConfirmDelete(false)}
            />
          ) : (
            <Pager
              canPrev={Boolean(data?.has_prev)}
              canNext={Boolean(data?.has_next)}
              onPrev={() => setIndex(index - 1)}
              onNext={() => setIndex(index + 1)}
              labelled
              extra={
                <button type="button" className={shared.dangerBtn} onClick={() => setConfirmDelete(true)} aria-label="Delete entry">
                  <Trash2 size={12} />
                </button>
              }
            >
              {entry.index + 1} / {data?.total_count} (max {data?.max_entries})
            </Pager>
          )}
        </>
      )}
    </div>
  )
}
