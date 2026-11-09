'use client'

import { useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useAccountStore, useCommandQuery } from '@/lib/spacemolt'
import { timeAgoOrDate } from '@/lib/format'
import { usePlay } from '../../PlayProvider'
import { ActionButton } from '../../ActionButton'
import { ConfirmAction, Loading, shared, errorMessage } from '../../shared'
import styles from '../InfoPanel.module.css'

/**
 * Captain's log. captains_log_list returns one entry per call (index 0 =
 * newest) with its content and has_prev/has_next, so we page one entry at a
 * time instead of fanning out a request per entry.
 */
export function CaptainsLogTab() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const [index, setIndex] = useState(0)
  const log = useCommandQuery(
    async (account) => (await account.commands.spacemolt_social.captains_log_list({ index })).structuredContent,
    [index],
  )
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await fn()
      uiStore.dispatch({ type: 'toast', kind: 'success', text: success })
      setConfirmDelete(false)
      // Both add and delete shift indices; go back to the newest entry.
      if (index === 0) log.refetch()
      else setIndex(0)
    } catch (err) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
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
            <div className={styles.pager}>
              <button type="button" className={shared.subtleBtn} disabled={!data?.has_prev} onClick={() => setIndex(index - 1)}>
                <ChevronLeft size={12} /> Newer
              </button>
              <span>{entry.index + 1} / {data?.total_count} (max {data?.max_entries})</span>
              <button type="button" className={shared.subtleBtn} disabled={!data?.has_next} onClick={() => setIndex(index + 1)}>
                Older <ChevronRight size={12} />
              </button>
              <button type="button" className={shared.dangerBtn} onClick={() => setConfirmDelete(true)} aria-label="Delete entry">
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
