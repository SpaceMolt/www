'use client'

import { useState } from 'react'
import { FileText, Plus, Save, Trash2, X } from 'lucide-react'
import { useAccountStore, useCommandQuery } from '@/lib/spacemolt'
import { timeAgoOrDate } from '@/lib/format'
import { usePlay } from '../../PlayProvider'
import { ActionButton } from '../../ActionButton'
import { ConfirmAction, Loading, shared, errorMessage } from '../../shared'
import styles from '../InfoPanel.module.css'
import { Pager } from './ReleaseNotes'

const PAGE_SIZE = 20

/** Notes: paged list, open one to read/edit (full replace), create, delete. */
export function NotesTab() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const social = store.account.commands.spacemolt_social
  const [page, setPage] = useState(1)
  const list = useCommandQuery(
    async (account) => (await account.commands.spacemolt_social.get_notes({ page, page_size: PAGE_SIZE })).structuredContent,
    [page],
  )

  // Open note editor; noteId null = creating a new note
  const [editing, setEditing] = useState<{ noteId: string | null; title: string; content: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toast = (kind: 'danger' | 'success', text: string) => uiStore.dispatch({ type: 'toast', kind, text })

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await fn()
      toast('success', success)
      setEditing(null)
      setConfirmDelete(false)
      list.refetch()
    } catch (err) {
      toast('danger', errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const openNote = async (target: string) => {
    setBusy(true)
    try {
      const note = (await social.read_note({ target })).structuredContent
      if (note) setEditing({ noteId: note.note_id, title: note.title, content: note.content })
    } catch (err) {
      toast('danger', errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!editing) return
    const { noteId, title, content } = editing
    return noteId
      ? run(() => social.write_note({ target: noteId, content }), 'Note saved')
      : run(() => social.create_note({ title: title.trim(), content }), 'Note created')
  }

  if (editing) {
    return (
      <div className={styles.noteForm}>
        {editing.noteId ? (
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><FileText size={12} /></span>
            {editing.title}
          </div>
        ) : (
          <input
            className={styles.noteInput}
            type="text"
            placeholder="Note title"
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
        )}
        <textarea
          className={styles.noteTextarea}
          rows={10}
          placeholder="Note content..."
          value={editing.content}
          onChange={(e) => setEditing({ ...editing, content: e.target.value })}
        />
        {confirmDelete && editing.noteId ? (
          <ConfirmAction
            message="Delete this note permanently?"
            confirmDisabled={busy}
            onConfirm={() => run(() => social.delete_note({ target: editing.noteId as string }), 'Note deleted')}
            onCancel={() => setConfirmDelete(false)}
          />
        ) : (
          <div className={styles.linkRow}>
            <ActionButton
              label={editing.noteId ? 'Save' : 'Create'}
              icon={<Save size={12} />}
              onClick={save}
              disabled={(!editing.noteId && !editing.title.trim()) || !editing.content.trim()}
              loading={busy}
              size="sm"
            />
            <ActionButton label="Close" icon={<X size={12} />} onClick={() => setEditing(null)} variant="secondary" size="sm" />
            {editing.noteId && (
              <ActionButton label="Delete" icon={<Trash2 size={12} />} onClick={() => setConfirmDelete(true)} variant="danger" size="sm" />
            )}
          </div>
        )}
      </div>
    )
  }

  const data = list.data
  return (
    <div className={styles.tabBody}>
      <div className={styles.linkRow}>
        <ActionButton
          label="New Note"
          icon={<Plus size={12} />}
          onClick={() => setEditing({ noteId: null, title: '', content: '' })}
          size="sm"
        />
      </div>
      {list.error && <div className={styles.errorBanner}>{list.error}</div>}
      {list.loading && !data && <Loading message="Loading notes..." />}
      {data && data.notes.length === 0 && <div className={shared.emptyState}>No notes yet. Create your first note.</div>}
      {data && data.notes.length > 0 && (
        <div className={styles.noteList}>
          {data.notes.map((note) => (
            <button
              key={note.note_id}
              type="button"
              className={styles.noteItem}
              onClick={() => openNote(note.note_id)}
              disabled={busy}
            >
              <span className={styles.noteIcon}><FileText size={12} /></span>
              <span className={styles.noteTitle}>{note.title}</span>
              <span className={styles.noteMeta}>{timeAgoOrDate(note.created_at)}</span>
            </button>
          ))}
        </div>
      )}
      {data && (page > 1 || data.has_more) && (
        <Pager canPrev={page > 1} canNext={Boolean(data.has_more)} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)}>
          Page {page} of {Math.max(1, Math.ceil(data.total_count / PAGE_SIZE))}
        </Pager>
      )}
    </div>
  )
}
