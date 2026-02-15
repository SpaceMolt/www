'use client'

import { useState, useCallback } from 'react'
import {
  Info,
  Map,
  BookOpen,
  FileText,
  Target,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import type { Mission } from '../types'
import styles from './InfoPanel.module.css'

interface Note {
  id: string
  title: string
  content: string
}

interface LogEntry {
  id: string
  message: string
  timestamp: string
}

export function InfoPanel() {
  const { state, sendCommand } = useGame()
  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [missions, setMissions] = useState<Mission[]>([])
  const [missionsLoaded, setMissionsLoaded] = useState(false)
  const [loadingMissions, setLoadingMissions] = useState(false)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [logLoaded, setLogLoaded] = useState(false)
  const [loadingLog, setLoadingLog] = useState(false)

  // Create note form
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [creatingNote, setCreatingNote] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)

  const handleHelp = useCallback(() => {
    sendCommand('help')
  }, [sendCommand])

  const handleLoadNotes = useCallback(() => {
    setLoadingNotes(true)
    sendCommand('get_notes')
    setTimeout(() => {
      setLoadingNotes(false)
      setNotesLoaded(true)
    }, 3000)
  }, [sendCommand])

  const handleCreateNote = useCallback(() => {
    if (!noteTitle.trim() || !noteContent.trim()) return
    setCreatingNote(true)
    sendCommand('create_note', {
      title: noteTitle.trim(),
      content: noteContent.trim(),
    })
    setNoteTitle('')
    setNoteContent('')
    setShowNoteForm(false)
    setTimeout(() => setCreatingNote(false), 2000)
  }, [sendCommand, noteTitle, noteContent])

  const handleLoadMissions = useCallback(() => {
    setLoadingMissions(true)
    sendCommand('get_missions')
    setTimeout(() => {
      setLoadingMissions(false)
      setMissionsLoaded(true)
    }, 3000)
  }, [sendCommand])

  const handleLoadActiveMissions = useCallback(() => {
    sendCommand('get_active_missions')
  }, [sendCommand])

  const handleLoadLog = useCallback(() => {
    setLoadingLog(true)
    sendCommand('captains_log_list')
    setTimeout(() => {
      setLoadingLog(false)
      setLogLoaded(true)
    }, 3000)
  }, [sendCommand])

  const player = state.player
  const welcome = state.welcome

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}><Info size={16} /></span>
          Info
        </div>
      </div>

      <div className={styles.content}>
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
            <div className={styles.sectionTitle}>
              <span className={styles.sectionIcon}><Info size={12} /></span>
              Player Stats
            </div>
            <div className={styles.statsGrid}>
              {Object.entries(player.stats).map(([key, value]) => (
                <div key={key} className={styles.statItem}>
                  <span className={styles.statLabel}>
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className={styles.statValue}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.divider} />

        {/* Quick Links */}
        <div>
          <div className={styles.sectionTitle}>
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
          <div className={styles.sectionTitle}>
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
              <span className={styles.spinner} />
              Loading notes...
            </div>
          )}
          {notesLoaded && notes.length === 0 && (
            <div className={styles.emptyState}>
              No notes yet. Create your first note.
            </div>
          )}
          {notes.length > 0 && (
            <div className={styles.noteList}>
              {notes.map((note) => (
                <div key={note.id} className={styles.noteItem}>
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

        <div className={styles.divider} />

        {/* Missions */}
        <div>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><Target size={12} /></span>
            Missions
          </div>
          {!missionsLoaded && !loadingMissions && (
            <div className={styles.linkRow}>
              <ActionButton
                label="Available Missions"
                icon={<Target size={14} />}
                onClick={handleLoadMissions}
                variant="secondary"
                size="sm"
              />
              <ActionButton
                label="Active Missions"
                icon={<Target size={14} />}
                onClick={handleLoadActiveMissions}
                size="sm"
              />
            </div>
          )}
          {loadingMissions && (
            <div className={styles.loading}>
              <span className={styles.spinner} />
              Loading missions...
            </div>
          )}
          {missionsLoaded && missions.length === 0 && (
            <div className={styles.emptyState}>
              No missions available at this location.
            </div>
          )}
          {missions.length > 0 && (
            <div className={styles.missionList}>
              {missions.map((m) => (
                <div key={m.id} className={styles.missionItem}>
                  <div className={styles.missionHeader}>
                    <span className={styles.missionTitle}>{m.title}</span>
                    <span className={styles.missionDifficulty}>{m.difficulty}</span>
                  </div>
                  <div className={styles.missionDesc}>{m.description}</div>
                  <div className={styles.missionReward}>
                    Reward: {m.reward_credits.toLocaleString()} credits
                    {m.reward_items && m.reward_items.length > 0 && ' + items'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Captain's Log */}
        <div>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><BookOpen size={12} /></span>
            Captain&apos;s Log
          </div>
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
              <span className={styles.spinner} />
              Loading log...
            </div>
          )}
          {logLoaded && logEntries.length === 0 && (
            <div className={styles.emptyState}>
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
      </div>
    </div>
  )
}
