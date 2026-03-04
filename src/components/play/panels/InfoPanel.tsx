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
  ScrollText,
  Award,
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

interface ActionLogEntry {
  id: string
  category: string
  event_type: string
  summary: string
  created_at: string
  data?: Record<string, unknown>
}

interface CompletedMission {
  template_id: string
  title: string
  type: string
  difficulty: string
  completion_time: string
  giver: { name: string; title: string }
}

interface CompletedMissionDetail {
  template_id: string
  title: string
  type: string
  description: string
  difficulty: string
  completion_time: string
  objectives: { type: string; description: string }[]
  rewards: { credits: number; items?: { item_id: string; quantity: number }[]; skill_xp?: Record<string, number> }
  dialog: { offer: string; accept: string; decline: string; complete: string }
  giver: { name: string; title: string }
}

const ACTION_LOG_CATEGORIES = [
  'all', 'combat', 'trading', 'crafting', 'ship', 'faction', 'mission', 'skill', 'salvage', 'mining',
] as const

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

  // Action Log state
  const [actionLogCategory, setActionLogCategory] = useState<string>('all')
  const [actionLogEntries, setActionLogEntries] = useState<ActionLogEntry[]>([])
  const [actionLogHasMore, setActionLogHasMore] = useState(false)
  const [loadingActionLog, setLoadingActionLog] = useState(false)
  const [loadingMoreActionLog, setLoadingMoreActionLog] = useState(false)

  // Completed Missions state
  const [completedMissions, setCompletedMissions] = useState<CompletedMission[]>([])
  const [completedMissionsTotal, setCompletedMissionsTotal] = useState(0)
  const [loadingCompletedMissions, setLoadingCompletedMissions] = useState(false)
  const [completedMissionsLoaded, setCompletedMissionsLoaded] = useState(false)
  const [selectedCompletedMission, setSelectedCompletedMission] = useState<CompletedMissionDetail | null>(null)
  const [loadingMissionDetail, setLoadingMissionDetail] = useState(false)

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

  // Action Log handlers
  const handleLoadActionLog = useCallback(() => {
    setLoadingActionLog(true)
    const params: Record<string, unknown> = { limit: 20 }
    if (actionLogCategory !== 'all') {
      params.category = actionLogCategory
    }
    sendCommand('get_action_log', params)
    setTimeout(() => {
      setLoadingActionLog(false)
    }, 3000)
  }, [sendCommand, actionLogCategory])

  const handleLoadMoreActionLog = useCallback(() => {
    if (actionLogEntries.length === 0) return
    setLoadingMoreActionLog(true)
    const lastEntry = actionLogEntries[actionLogEntries.length - 1]
    const params: Record<string, unknown> = { limit: 20, before: lastEntry.created_at }
    if (actionLogCategory !== 'all') {
      params.category = actionLogCategory
    }
    sendCommand('get_action_log', params)
    setTimeout(() => {
      setLoadingMoreActionLog(false)
    }, 3000)
  }, [sendCommand, actionLogCategory, actionLogEntries])

  // Completed Missions handlers
  const handleLoadCompletedMissions = useCallback(() => {
    setLoadingCompletedMissions(true)
    sendCommand('completed_missions')
    setTimeout(() => {
      setLoadingCompletedMissions(false)
      setCompletedMissionsLoaded(true)
    }, 3000)
  }, [sendCommand])

  const handleViewCompletedMission = useCallback((templateId: string) => {
    setLoadingMissionDetail(true)
    sendCommand('view_completed_mission', { template_id: templateId })
    setTimeout(() => {
      setLoadingMissionDetail(false)
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

        {/* Action Log */}
        <div className={styles.actionLogSection}>
          <div className={styles.sectionTitle}>
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
              <span className={styles.spinner} />
              Loading action log...
            </div>
          )}
        </div>

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
              <ActionButton
                label="Completed"
                icon={<Award size={14} />}
                onClick={handleLoadCompletedMissions}
                variant="secondary"
                size="sm"
                loading={loadingCompletedMissions}
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

          {/* Completed Missions */}
          {loadingCompletedMissions && (
            <div className={styles.loading}>
              <span className={styles.spinner} />
              Loading completed missions...
            </div>
          )}
          {completedMissionsLoaded && completedMissions.length === 0 && !loadingCompletedMissions && (
            <div className={styles.emptyState}>
              No completed missions yet.
            </div>
          )}
          {completedMissions.length > 0 && !selectedCompletedMission && (
            <div className={styles.missionList}>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Award size={12} /></span>
                Completed ({completedMissionsTotal})
              </div>
              {completedMissions.map((m) => (
                <div
                  key={m.template_id}
                  className={styles.completedMissionItem}
                  onClick={() => handleViewCompletedMission(m.template_id)}
                >
                  <div className={styles.missionHeader}>
                    <span className={styles.missionTitle}>{m.title}</span>
                    <span className={styles.missionDifficulty}>{m.difficulty}</span>
                  </div>
                  <div className={styles.missionDesc}>
                    {m.giver.name} -- {m.giver.title}
                  </div>
                  <div className={styles.logTimestamp}>
                    Completed {formatRelativeTime(m.completion_time)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Mission Detail */}
          {loadingMissionDetail && (
            <div className={styles.loading}>
              <span className={styles.spinner} />
              Loading mission details...
            </div>
          )}
          {selectedCompletedMission && !loadingMissionDetail && (
            <div className={styles.missionDetail}>
              <button
                className={styles.linkBtn}
                onClick={() => setSelectedCompletedMission(null)}
                type="button"
              >
                Back to list
              </button>
              <div className={styles.missionHeader}>
                <span className={styles.missionTitle}>{selectedCompletedMission.title}</span>
                <span className={styles.missionDifficulty}>{selectedCompletedMission.difficulty}</span>
              </div>
              <div className={styles.missionDesc}>
                {selectedCompletedMission.description}
              </div>
              <div className={styles.missionDesc}>
                Given by: {selectedCompletedMission.giver.name} -- {selectedCompletedMission.giver.title}
              </div>
              <div className={styles.logTimestamp}>
                Completed {formatRelativeTime(selectedCompletedMission.completion_time)}
              </div>

              {selectedCompletedMission.objectives.length > 0 && (
                <div className={styles.missionDetailSection}>
                  <div className={styles.missionDetailLabel}>Objectives</div>
                  {selectedCompletedMission.objectives.map((obj, i) => (
                    <div key={i} className={styles.missionDesc}>
                      - {obj.description}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.missionDetailSection}>
                <div className={styles.missionDetailLabel}>Rewards</div>
                <div className={styles.missionReward}>
                  {selectedCompletedMission.rewards.credits.toLocaleString()} credits
                </div>
                {selectedCompletedMission.rewards.items && selectedCompletedMission.rewards.items.length > 0 && (
                  <div className={styles.missionDesc}>
                    Items: {selectedCompletedMission.rewards.items.map(
                      (item) => `${item.item_id} x${item.quantity}`
                    ).join(', ')}
                  </div>
                )}
                {selectedCompletedMission.rewards.skill_xp && Object.keys(selectedCompletedMission.rewards.skill_xp).length > 0 && (
                  <div className={styles.missionDesc}>
                    Skill XP: {Object.entries(selectedCompletedMission.rewards.skill_xp).map(
                      ([skill, xp]) => `${skill.replace(/_/g, ' ')} +${xp}`
                    ).join(', ')}
                  </div>
                )}
              </div>

              {selectedCompletedMission.dialog && (
                <div className={styles.missionDetailSection}>
                  <div className={styles.missionDetailLabel}>Dialog</div>
                  {selectedCompletedMission.dialog.offer && (
                    <div className={styles.missionDesc}>
                      <strong>Offer:</strong> {selectedCompletedMission.dialog.offer}
                    </div>
                  )}
                  {selectedCompletedMission.dialog.complete && (
                    <div className={styles.missionDesc}>
                      <strong>Complete:</strong> {selectedCompletedMission.dialog.complete}
                    </div>
                  )}
                </div>
              )}
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
