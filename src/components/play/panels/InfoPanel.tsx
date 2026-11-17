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
import { useAccountStore, usePlayer } from '@/lib/spacemolt'
import { formatStatValue } from '@/lib/format'
import { usePlay } from '../PlayProvider'
import { ActionButton } from '../ActionButton'
import { PanelWithTabs, shared, errorMessage } from '../shared'
import styles from './InfoPanel.module.css'
import { NotesTab } from './info/NotesTab'
import { CaptainsLogTab } from './info/CaptainsLogTab'
import { ActionLogTab } from './info/ActionLogTab'
import { INTERNAL_STAT, PilotTab } from './info/PilotTab'
import { EmpireTab } from './info/EmpireTab'
import { EmpireTab as CitizenshipTab } from './crew/EmpireTab'
import { ReleaseNotes } from './info/ReleaseNotes'
import { FactionAchievements } from './info/FactionAchievements'

type InfoTab = 'info' | 'notes' | 'log' | 'actions' | 'pilots' | 'empire'

const TABS: Array<{ id: InfoTab; label: string; icon: ReactNode }> = [
  { id: 'info', label: 'Info', icon: <Info size={12} /> },
  { id: 'notes', label: 'Notes', icon: <FileText size={12} /> },
  { id: 'log', label: 'Log', icon: <BookOpen size={12} /> },
  { id: 'actions', label: 'Action Log', icon: <ScrollText size={12} /> },
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
                .filter(([key, value]) => typeof value === 'number' && !INTERNAL_STAT.test(key))
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
        {player?.faction_id && (
          <>
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
          </>
        )}

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
        {activeTab === 'actions' && <ActionLogTab />}
        {activeTab === 'pilots' && <PilotTab />}
        {activeTab === 'empire' && <><EmpireTab /><CitizenshipTab /></>}
    </PanelWithTabs>
  )
}
