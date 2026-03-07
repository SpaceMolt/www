'use client'

import { useState, useCallback } from 'react'
import {
  Target,
  ChevronDown,
  ChevronRight,
  Award,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import type { Mission, MissionObjective } from '../types'
import styles from './MissionsPanel.module.css'

type TabId = 'available' | 'active' | 'completed'

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

export function MissionsPanel() {
  const { state, sendCommand } = useGame()
  const [activeTab, setActiveTab] = useState<TabId>('available')

  // Available missions state
  const [availableMissions, setAvailableMissions] = useState<Mission[]>([])
  const [availableLoaded, setAvailableLoaded] = useState(false)
  const [loadingAvailable, setLoadingAvailable] = useState(false)

  // Active missions state
  const [activeMissions, setActiveMissions] = useState<Mission[]>([])
  const [activeLoaded, setActiveLoaded] = useState(false)
  const [loadingActive, setLoadingActive] = useState(false)

  // Completed missions state
  const [completedMissions, setCompletedMissions] = useState<CompletedMission[]>([])
  const [completedMissionsTotal, setCompletedMissionsTotal] = useState(0)
  const [completedLoaded, setCompletedLoaded] = useState(false)
  const [loadingCompleted, setLoadingCompleted] = useState(false)
  const [selectedCompletedMission, setSelectedCompletedMission] = useState<CompletedMissionDetail | null>(null)
  const [loadingMissionDetail, setLoadingMissionDetail] = useState(false)

  // Expanded mission tracking
  const [expandedMissions, setExpandedMissions] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback((id: string) => {
    setExpandedMissions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleLoadAvailable = useCallback(() => {
    setLoadingAvailable(true)
    sendCommand('get_missions')
    setTimeout(() => {
      setLoadingAvailable(false)
      setAvailableLoaded(true)
    }, 3000)
  }, [sendCommand])

  const handleLoadActive = useCallback(() => {
    setLoadingActive(true)
    sendCommand('get_active_missions')
    setTimeout(() => {
      setLoadingActive(false)
      setActiveLoaded(true)
    }, 3000)
  }, [sendCommand])

  const handleLoadCompleted = useCallback(() => {
    setLoadingCompleted(true)
    sendCommand('completed_missions')
    setTimeout(() => {
      setLoadingCompleted(false)
      setCompletedLoaded(true)
    }, 3000)
  }, [sendCommand])

  const handleAcceptMission = useCallback((missionId: string) => {
    sendCommand('accept_mission', { mission_id: missionId })
  }, [sendCommand])

  const handleAbandonMission = useCallback((missionId: string) => {
    sendCommand('abandon_mission', { mission_id: missionId })
  }, [sendCommand])

  const handleViewCompletedMission = useCallback((templateId: string) => {
    setLoadingMissionDetail(true)
    sendCommand('view_completed_mission', { template_id: templateId })
    setTimeout(() => {
      setLoadingMissionDetail(false)
    }, 3000)
  }, [sendCommand])

  const renderObjective = (obj: MissionObjective, index: number, showProgress: boolean) => (
    <div key={index} className={styles.objectiveItem}>
      {showProgress && obj.completed ? (
        <span className={styles.objectiveComplete}>
          <Check size={12} />
        </span>
      ) : showProgress ? (
        <span className={styles.objectiveProgress}>
          {obj.current}/{obj.target}
        </span>
      ) : null}
      <span className={styles.objectiveDesc}>{obj.description}</span>
      {obj.system_name && (
        <span className={styles.objectiveMeta}> [{obj.system_name}]</span>
      )}
      {obj.target_base_name && (
        <span className={styles.objectiveMeta}> @ {obj.target_base_name}</span>
      )}
      {obj.item_id && obj.quantity && (
        <span className={styles.objectiveMeta}> ({obj.item_id} x{obj.quantity})</span>
      )}
    </div>
  )

  const renderRewards = (credits: number, items?: { item_id: string; quantity: number }[]) => (
    <div className={styles.rewardRow}>
      <span className={styles.rewardIcon}><Award size={12} /></span>
      <span className={styles.rewardCredits}>{credits.toLocaleString()} credits</span>
      {items && items.length > 0 && (
        <span className={styles.rewardItems}>
          + {items.map((item) => `${item.item_id} x${item.quantity}`).join(', ')}
        </span>
      )}
    </div>
  )

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}><Target size={16} /></span>
          Missions
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'available' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('available')}
          type="button"
        >
          <Target size={13} />
          Available
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'active' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('active')}
          type="button"
        >
          <AlertTriangle size={13} />
          Active
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'completed' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('completed')}
          type="button"
        >
          <Award size={13} />
          Completed
        </button>
      </div>

      <div className={styles.content}>
        {/* Available Missions Tab */}
        {activeTab === 'available' && (
          <>
            <ActionButton
              label="Load Available Missions"
              icon={<RefreshCw size={14} />}
              onClick={handleLoadAvailable}
              variant="secondary"
              size="sm"
              loading={loadingAvailable}
            />
            {loadingAvailable && availableMissions.length === 0 && (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                Loading available missions...
              </div>
            )}
            {availableLoaded && availableMissions.length === 0 && !loadingAvailable && (
              <div className={styles.emptyState}>
                No missions available at this location.
              </div>
            )}
            {availableMissions.length > 0 && (
              <div className={styles.missionList}>
                {availableMissions.map((m) => {
                  const isExpanded = expandedMissions.has(m.id)
                  return (
                    <div key={m.id} className={styles.missionItem}>
                      <div
                        className={styles.missionHeader}
                        onClick={() => toggleExpanded(m.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span className={styles.missionTitle}>{m.title}</span>
                        </div>
                        <span className={styles.missionDifficulty}>{m.difficulty}</span>
                      </div>
                      <div className={styles.missionDesc}>{m.description}</div>
                      {renderRewards(m.reward_credits, m.reward_items)}
                      {isExpanded && m.objectives && m.objectives.length > 0 && (
                        <div className={styles.objectiveList}>
                          {m.objectives.map((obj, i) => renderObjective(obj, i, false))}
                        </div>
                      )}
                      <button
                        className={styles.acceptBtn}
                        onClick={() => handleAcceptMission(m.id)}
                        type="button"
                      >
                        <Check size={12} />
                        Accept
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Active Missions Tab */}
        {activeTab === 'active' && (
          <>
            <ActionButton
              label="Load Active Missions"
              icon={<RefreshCw size={14} />}
              onClick={handleLoadActive}
              variant="secondary"
              size="sm"
              loading={loadingActive}
            />
            {loadingActive && activeMissions.length === 0 && (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                Loading active missions...
              </div>
            )}
            {activeLoaded && activeMissions.length === 0 && !loadingActive && (
              <div className={styles.emptyState}>
                No active missions. Accept a mission to get started.
              </div>
            )}
            {activeMissions.length > 0 && (
              <div className={styles.missionList}>
                {activeMissions.map((m) => {
                  const isExpanded = expandedMissions.has(m.id)
                  return (
                    <div key={m.id} className={styles.missionItem}>
                      <div
                        className={styles.missionHeader}
                        onClick={() => toggleExpanded(m.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span className={styles.missionTitle}>{m.title}</span>
                        </div>
                        <span className={styles.missionStatusBadge} data-status="active">Active</span>
                      </div>
                      <div className={styles.missionDesc}>{m.description}</div>
                      <div className={styles.missionDifficulty}>{m.difficulty}</div>
                      {renderRewards(m.reward_credits, m.reward_items)}
                      {m.objectives && m.objectives.length > 0 && (
                        <div className={styles.objectiveList}>
                          {m.objectives.map((obj, i) => renderObjective(obj, i, true))}
                        </div>
                      )}
                      {isExpanded && (
                        <button
                          className={styles.abandonBtn}
                          onClick={() => handleAbandonMission(m.id)}
                          type="button"
                        >
                          <X size={12} />
                          Abandon
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Completed Missions Tab */}
        {activeTab === 'completed' && (
          <>
            <ActionButton
              label="Load Completed Missions"
              icon={<RefreshCw size={14} />}
              onClick={handleLoadCompleted}
              variant="secondary"
              size="sm"
              loading={loadingCompleted}
            />
            {loadingCompleted && completedMissions.length === 0 && (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                Loading completed missions...
              </div>
            )}
            {completedLoaded && completedMissions.length === 0 && !loadingCompleted && (
              <div className={styles.emptyState}>
                No completed missions yet.
              </div>
            )}

            {/* Completed mission list */}
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
                    <div className={styles.completionTime}>
                      Completed {formatRelativeTime(m.completion_time)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed mission detail */}
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
                  <span className={styles.missionStatusBadge} data-status="completed">Completed</span>
                </div>
                <div className={styles.missionDifficulty}>{selectedCompletedMission.difficulty}</div>
                <div className={styles.missionDesc}>
                  {selectedCompletedMission.description}
                </div>
                <div className={styles.missionDesc}>
                  Given by: {selectedCompletedMission.giver.name} -- {selectedCompletedMission.giver.title}
                </div>
                <div className={styles.completionTime}>
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
          </>
        )}
      </div>
    </div>
  )
}
