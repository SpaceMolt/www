'use client'

import { useState, useCallback, type ReactNode } from 'react'
import {
  Info,
  Map,
  BookOpen,
  FileText,
  HelpCircle,
  ExternalLink,
  ScrollText,
  User,
  Landmark,
  Trophy,
} from 'lucide-react'
import type { Commands, GetActionLogResponse } from '@spacemolt/lib'
import { useAccountStore, usePlayer } from '@/lib/spacemolt'
import { formatStatValue, timeAgoOrDate, titleCase } from '@/lib/format'
import { usePlay } from '../PlayProvider'
import { ActionButton } from '../ActionButton'
import { PanelWithTabs, shared, errorMessage } from '../shared'
import styles from './InfoPanel.module.css'
import { NotesTab } from './info/NotesTab'
import { CaptainsLogTab } from './info/CaptainsLogTab'
import { PilotTab } from './info/PilotTab'
import { EmpireTab } from './info/EmpireTab'
import { EmpireTab as CitizenshipTab } from './crew/EmpireTab'
import { ReleaseNotes } from './info/ReleaseNotes'
import { FactionAchievements } from './info/FactionAchievements'

type ActionLogEntry = GetActionLogResponse['entries'][number]
type ActionLogCategory = NonNullable<Parameters<Commands['spacemolt_social']['get_action_log']>[0]>['category']

const ACTION_LOG_CATEGORIES: Array<'all' | NonNullable<ActionLogCategory>> = [
  'all', 'combat', 'trading', 'ship', 'crafting', 'faction', 'mission', 'skill', 'salvage', 'storage',
  'achievement', 'mining', 'navigation', 'exploration', 'reputation', 'drone', 'session', 'other',
]
const ACTION_LOG_PAGE_SIZE = 20

type InfoTab = 'info' | 'notes' | 'log' | 'pilots' | 'empire'

const TABS: Array<{ id: InfoTab; label: string; icon: ReactNode }> = [
  { id: 'info', label: 'Info', icon: <Info size={12} /> },
  { id: 'notes', label: 'Notes', icon: <FileText size={12} /> },
  { id: 'log', label: 'Log', icon: <BookOpen size={12} /> },
  { id: 'pilots', label: 'Pilots', icon: <User size={12} /> },
  { id: 'empire', label: 'Empire', icon: <Landmark size={12} /> },
]

export function InfoPanel() {
  const store = useAccountStore()
  const { uiStore } = usePlay()
  const player = usePlayer()
  const welcome = store.account.welcome

  const [activeTab, setActiveTab] = useState<InfoTab>('info')
  const [showReleases, setShowReleases] = useState(false)
  const [showFactionAchievements, setShowFactionAchievements] = useState(false)

  // Action Log state
  const [actionLogCategory, setActionLogCategory] = useState<(typeof ACTION_LOG_CATEGORIES)[number]>('all')
  const [actionLogEventType, setActionLogEventType] = useState('')
  const [actionLogEntries, setActionLogEntries] = useState<ActionLogEntry[]>([])
  const [actionLogHasMore, setActionLogHasMore] = useState(false)
  const [actionLogPage, setActionLogPage] = useState(1)
  const [loadingActionLog, setLoadingActionLog] = useState(false)

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

  // page 1 replaces the list (new filter); later pages append
  const loadActionLog = useCallback(async (page: number) => {
    setLoadingActionLog(true)
    try {
      const resp = await store.account.commands.spacemolt_social.get_action_log({
        page,
        page_size: ACTION_LOG_PAGE_SIZE,
        category: actionLogCategory === 'all' ? undefined : actionLogCategory,
        event_type: actionLogEventType.trim() || undefined,
      })
      const entries = resp.structuredContent?.entries ?? []
      setActionLogEntries(prev => (page === 1 ? entries : [...prev, ...entries]))
      setActionLogHasMore(Boolean(resp.structuredContent?.has_more))
      setActionLogPage(page)
    } catch (err) {
      reportError(err)
    } finally {
      setLoadingActionLog(false)
    }
  }, [store, actionLogCategory, actionLogEventType, reportError])

  return (
    <PanelWithTabs
      title="Info"
      icon={<Info size={16} />}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as InfoTab)}
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
            <button type="button" className={shared.subtleBtn} onClick={() => setShowReleases(!showReleases)}>
              {showReleases ? 'Hide release notes' : 'Release notes'}
            </button>
          </div>
        )}
        {showReleases && <ReleaseNotes />}

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
                      {formatStatValue(key, value as number)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Faction Achievements */}
        <div className={styles.actionLogSection}>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><Trophy size={12} /></span>
            Faction Achievements
          </div>
          {showFactionAchievements ? <FactionAchievements /> : (
            <ActionButton
              label="Load"
              icon={<Trophy size={14} />}
              onClick={() => setShowFactionAchievements(true)}
              variant="secondary"
              size="sm"
            />
          )}
        </div>

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
              onChange={(e) => setActionLogCategory(e.target.value as typeof actionLogCategory)}
            >
              {ACTION_LOG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {titleCase(cat)}
                </option>
              ))}
            </select>
            <input
              className={styles.noteInput}
              style={{ flex: 1, minWidth: 0 }}
              type="text"
              placeholder="Event type, e.g. tax.prepaid"
              value={actionLogEventType}
              onChange={(e) => setActionLogEventType(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadActionLog(1)}
            />
            <ActionButton
              label="Load"
              icon={<ScrollText size={14} />}
              onClick={() => loadActionLog(1)}
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
                    <span className={styles.logCategory} title={entry.event_type}>{entry.category}</span>
                    <span className={styles.logTimestamp}>
                      {timeAgoOrDate(entry.created_at)}
                    </span>
                  </div>
                  <div className={styles.logEntrySummary}>{entry.summary}</div>
                </div>
              ))}
              {actionLogHasMore && (
                <ActionButton
                  label="Load More"
                  icon={<ScrollText size={14} />}
                  onClick={() => loadActionLog(actionLogPage + 1)}
                  variant="secondary"
                  size="sm"
                  loading={loadingActionLog}
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

        </>)}

        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'log' && <CaptainsLogTab />}
        {activeTab === 'pilots' && <PilotTab />}
        {activeTab === 'empire' && <><EmpireTab /><CitizenshipTab /></>}
    </PanelWithTabs>
  )
}
