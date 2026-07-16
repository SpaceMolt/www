'use client'

import { useState, useCallback } from 'react'
import {
  Info,
  Map,
  BookOpen,
  FileText,
  HelpCircle,
  ExternalLink,
  ScrollText,
} from 'lucide-react'
import { SpacemoltError } from '@spacemolt/lib'
import type { Commands, GetActionLogResponse, GetNotesResponse } from '@spacemolt/lib'
import { useAccountStore, usePlayer } from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { ActionButton } from '../ActionButton'
import { PanelWithTabs, shared } from '../shared'
import styles from './InfoPanel.module.css'

type Note = GetNotesResponse['notes'][number]
type ActionLogEntry = GetActionLogResponse['entries'][number]
type ActionLogCategory = NonNullable<Parameters<Commands['spacemolt_social']['get_action_log']>[0]>['category']

interface LogEntry {
  id: string
  message: string
  timestamp: string
}

const ACTION_LOG_CATEGORIES = [
  'all', 'combat', 'trading', 'crafting', 'ship', 'faction', 'mission', 'skill', 'salvage', 'mining',
] as const

function errorMessage(err: unknown): string {
  if (err instanceof SpacemoltError) return err.message
  if (err instanceof Error) return err.message
  return 'Action failed'
}

function formatRelativeTime(isoStr: string): string {
  const date = new Date(isoStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function InfoPanel() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const player = usePlayer()
  const welcome = store.account.welcome

  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [logLoaded, setLogLoaded] = useState(false)
  const [loadingLog, setLoadingLog] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'log'>('info')

  // Create note form
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [creatingNote, setCreatingNote] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)

  // Action Log state
  const [actionLogCategory, setActionLogCategory] = useState<string>('all')
  const [actionLogEntries, setActionLogEntries] = useState<ActionLogEntry[]>([])
  const [actionLogHasMore, setActionLogHasMore] = useState(false)
  const [loadingActionLog, setLoadingActionLog] = useState(false)
  const [loadingMoreActionLog, setLoadingMoreActionLog] = useState(false)

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorMessage(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    },
    [uiStore],
  )

  const handleHelp = useCallback(async () => {
    try {
      const resp = await store.account.commands.spacemolt.get_commands()
      const actions = resp.structuredContent?.actions ?? []
      const tools = new Set(actions.map((a) => a.tool)).size
      uiStore.dispatch({
        type: 'event',
        kind: 'info',
        text: `${actions.length} commands available across ${tools} tools. Use get_guide for a playstyle walkthrough.`,
      })
    } catch (err) {
      reportError(err)
    }
  }, [store, uiStore, reportError])

  const handleLoadNotes = useCallback(async () => {
    setLoadingNotes(true)
    try {
      const resp = await store.account.commands.spacemolt_social.get_notes()
      setNotes(resp.structuredContent?.notes ?? [])
      setNotesLoaded(true)
    } catch (err) {
      reportError(err)
    } finally {
      setLoadingNotes(false)
    }
  }, [store, reportError])

  const handleCreateNote = useCallback(async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return
    setCreatingNote(true)
    try {
      await store.account.commands.spacemolt_social.create_note({
        title: noteTitle.trim(),
        content: noteContent.trim(),
      })
      setNoteTitle('')
      setNoteContent('')
      setShowNoteForm(false)
    } catch (err) {
      reportError(err)
    } finally {
      setCreatingNote(false)
    }
  }, [store, noteTitle, noteContent, reportError])

  const handleLoadLog = useCallback(async () => {
    setLoadingLog(true)
    try {
      // captains_log_list is paginated: one entry per index (0 = newest).
      // Fetch index 0 to learn total_count, then pull the rest in parallel.
      const first = (await store.account.commands.spacemolt_social.captains_log_list({ index: 0 })).structuredContent
      const total = first?.total_count || 0
      if (total === 0 || !first?.entry) {
        setLogEntries([])
        setLogLoaded(true)
        return
      }
      const rest = await Promise.all(
        Array.from({ length: total - 1 }, (_, i) =>
          store.account.commands.spacemolt_social.captains_log_list({ index: i + 1 })
        )
      )
      const entries: LogEntry[] = [first, ...rest.map((r) => r.structuredContent)]
        .map((r) => r?.entry)
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map((e) => ({ id: String(e.index), message: e.entry, timestamp: e.created_at }))
      setLogEntries(entries)
      setLogLoaded(true)
    } catch (err) {
      reportError(err)
    } finally {
      setLoadingLog(false)
    }
  }, [store, reportError])

  // Action Log handlers
  const [actionLogPage, setActionLogPage] = useState(1)

  const handleLoadActionLog = useCallback(async () => {
    setLoadingActionLog(true)
    try {
      const category = actionLogCategory === 'all' ? undefined : (actionLogCategory as ActionLogCategory)
      const resp = await store.account.commands.spacemolt_social.get_action_log({ page: 1, page_size: 20, category })
      const data = resp.structuredContent
      setActionLogEntries(data?.entries ?? [])
      setActionLogHasMore(Boolean(data?.has_more))
      setActionLogPage(1)
    } catch (err) {
      reportError(err)
    } finally {
      setLoadingActionLog(false)
    }
  }, [store, actionLogCategory, reportError])

  const handleLoadMoreActionLog = useCallback(async () => {
    if (actionLogEntries.length === 0) return
    setLoadingMoreActionLog(true)
    try {
      const nextPage = actionLogPage + 1
      const category = actionLogCategory === 'all' ? undefined : (actionLogCategory as ActionLogCategory)
      const resp = await store.account.commands.spacemolt_social.get_action_log({ page: nextPage, page_size: 20, category })
      const data = resp.structuredContent
      setActionLogEntries(prev => [...prev, ...(data?.entries ?? [])])
      setActionLogHasMore(Boolean(data?.has_more))
      setActionLogPage(nextPage)
    } catch (err) {
      reportError(err)
    } finally {
      setLoadingMoreActionLog(false)
    }
  }, [store, actionLogCategory, actionLogEntries, actionLogPage, reportError])

  const tabs = [
    { id: 'info', label: 'Info', icon: <Info size={12} /> },
    { id: 'log', label: "Captain's Log", icon: <BookOpen size={12} /> },
  ]

  return (
    <PanelWithTabs
      title="Info"
      icon={<Info size={16} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as 'info' | 'log')}
    >
        {activeTab === 'info' && (<>
        {/* Game Version */}
        {welcome && (
          <div className={styles.versionCard}>
            <div className={styles.versionNumber}>
              SpaceMolt v{welcome.version}
            </div>
            <div className={styles.versionDate}>
              Released {welcome.release_date}
            </div>
            {welcome.motd && (
              <div className={styles.versionMotd}>
                {welcome.motd}
              </div>
            )}
          </div>
        )}

        {/* Player Stats */}
        {player?.stats && Object.keys(player.stats).length > 0 && (
          <div>
            <div className={shared.sectionTitle}>
              <span className={styles.sectionIcon}><Info size={12} /></span>
              Player Stats
            </div>
            <div className={styles.statsGrid}>
              {Object.entries(player.stats)
                .filter(([, value]) => typeof value === 'number')
                .map(([key, value]) => (
                  <div key={key} className={styles.statItem}>
                    <span className={styles.statLabel}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className={styles.statValue}>
                      {(value as number).toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className={styles.divider} />

        {/* Action Log */}
        <div className={styles.actionLogSection}>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><ScrollText size={12} /></span>
            Action Log
          </div>
          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={actionLogCategory}
              onChange={(e) => setActionLogCategory(e.target.value)}
            >
              {ACTION_LOG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
            <ActionButton
              label="Load"
              icon={<ScrollText size={14} />}
              onClick={handleLoadActionLog}
              variant="secondary"
              size="sm"
              loading={loadingActionLog}
            />
          </div>
          {actionLogEntries.length > 0 && (
            <div className={styles.logList}>
              {actionLogEntries.map((entry) => (
                <div key={entry.id} className={styles.logEntry}>
                  <div className={styles.logEntryHeader}>
                    <span className={styles.logCategory}>{entry.category}</span>
                    <span className={styles.logTimestamp}>
                      {formatRelativeTime(entry.created_at)}
                    </span>
                  </div>
                  <div className={styles.logEntrySummary}>{entry.summary}</div>
                </div>
              ))}
              {actionLogHasMore && (
                <ActionButton
                  label="Load More"
                  icon={<ScrollText size={14} />}
                  onClick={handleLoadMoreActionLog}
                  variant="secondary"
                  size="sm"
                  loading={loadingMoreActionLog}
                />
              )}
            </div>
          )}
          {loadingActionLog && actionLogEntries.length === 0 && (
            <div className={styles.loading}>
              <span className={shared.spinner} />
              Loading action log...
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Quick Links */}
        <div>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><ExternalLink size={12} /></span>
            Quick Links
          </div>
          <div className={styles.linkRow}>
            <a
              href="/map"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkBtn}
            >
              <span className={styles.linkBtnIcon}><Map size={12} /></span>
              Galaxy Map
              <span className={styles.linkBtnIcon}><ExternalLink size={10} /></span>
            </a>
            <a
              href="/forum"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkBtn}
            >
              <span className={styles.linkBtnIcon}><BookOpen size={12} /></span>
              Forum
              <span className={styles.linkBtnIcon}><ExternalLink size={10} /></span>
            </a>
            <button
              className={styles.linkBtn}
              onClick={handleHelp}
              type="button"
            >
              <span className={styles.linkBtnIcon}><HelpCircle size={12} /></span>
              Help
            </button>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Notes */}
        <div>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><FileText size={12} /></span>
            Notes
          </div>
          {!notesLoaded && !loadingNotes && (
            <div className={styles.linkRow}>
              <ActionButton
                label="Load Notes"
                icon={<FileText size={14} />}
                onClick={handleLoadNotes}
                variant="secondary"
                size="sm"
              />
              <ActionButton
                label="New Note"
                icon={<FileText size={14} />}
                onClick={() => setShowNoteForm(!showNoteForm)}
                size="sm"
              />
            </div>
          )}
          {loadingNotes && (
            <div className={styles.loading}>
              <span className={shared.spinner} />
              Loading notes...
            </div>
          )}
          {notesLoaded && notes.length === 0 && (
            <div className={shared.emptyState}>
              No notes yet. Create your first note.
            </div>
          )}
          {notes.length > 0 && (
            <div className={styles.noteList}>
              {notes.map((note) => (
                <div key={note.note_id} className={styles.noteItem}>
                  <span className={styles.noteIcon}>
                    <FileText size={12} />
                  </span>
                  <span className={styles.noteTitle}>{note.title}</span>
                </div>
              ))}
            </div>
          )}
          {showNoteForm && (
            <div className={styles.noteForm}>
              <input
                className={styles.noteInput}
                type="text"
                placeholder="Note title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
              <textarea
                className={styles.noteTextarea}
                placeholder="Note content..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
              <ActionButton
                label="Create Note"
                icon={<FileText size={12} />}
                onClick={handleCreateNote}
                disabled={!noteTitle.trim() || !noteContent.trim() || creatingNote}
                loading={creatingNote}
                size="sm"
              />
            </div>
          )}
        </div>

        </>)}

        {activeTab === 'log' && (
        <div>
          {!logLoaded && !loadingLog && (
            <ActionButton
              label="View Log"
              icon={<BookOpen size={14} />}
              onClick={handleLoadLog}
              variant="secondary"
              size="sm"
            />
          )}
          {loadingLog && (
            <div className={styles.loading}>
              <span className={shared.spinner} />
              Loading log...
            </div>
          )}
          {logLoaded && logEntries.length === 0 && (
            <div className={shared.emptyState}>
              Your captain&apos;s log is empty.
            </div>
          )}
          {logEntries.length > 0 && (
            <div className={styles.logList}>
              {logEntries.map((entry) => (
                <div key={entry.id} className={styles.logItem}>
                  {entry.message}
                </div>
              ))}
            </div>
          )}
        </div>
        )}
    </PanelWithTabs>
  )
}
