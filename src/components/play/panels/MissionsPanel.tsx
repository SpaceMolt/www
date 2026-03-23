'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Target,
  ChevronDown,
  ChevronRight,
  Award,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react'
import { useGame } from '../GameProvider'
import { Credits, PanelWithTabs, shared } from '../shared'
import type { Mission } from '@/lib/gameTypes'
import styles from './MissionsPanel.module.css'

interface ActiveMissionObjective {
  type: string
  description: string
  current: number
  required: number
  completed: boolean
  item_id?: string
  item_name?: string
  target_base?: string
  target_base_name?: string
  system_id?: string
  system_name?: string
  in_cargo?: number
  in_storage?: number
}

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

  // Completion modal
  const [completionResult, setCompletionResult] = useState<Record<string, unknown> | null>(null)

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

  const handleLoadAvailable = useCallback(async () => {
    setLoadingAvailable(true)
    try {
      const resp = await sendCommand('get_missions')
      const missions = (resp.missions || []) as Mission[]
      setAvailableMissions(missions)
      setAvailableLoaded(true)
    } finally {
      setLoadingAvailable(false)
    }
  }, [sendCommand])

  const handleLoadActive = useCallback(async () => {
    setLoadingActive(true)
    try {
      const resp = await sendCommand('get_active_missions')
      // v2 returns { missions: { active: [...], max_missions: N } }
      const missionsData = resp.missions as Record<string, unknown> | unknown[] | undefined
      const missions = Array.isArray(missionsData)
        ? missionsData as Mission[]
        : ((missionsData as Record<string, unknown>)?.active || []) as Mission[]
      setActiveMissions(missions)
      setActiveLoaded(true)
    } finally {
      setLoadingActive(false)
    }
  }, [sendCommand])

  const handleLoadCompleted = useCallback(async () => {
    setLoadingCompleted(true)
    try {
      const resp = await sendCommand('completed_missions')
      const missions = (resp.missions || []) as CompletedMission[]
      setCompletedMissions(missions)
      setCompletedMissionsTotal((resp.total as number) || missions.length)
      setCompletedLoaded(true)
    } finally {
      setLoadingCompleted(false)
    }
  }, [sendCommand])

  // Load data when switching tabs — track last loaded tab to avoid re-fetching
  const lastLoadedTabRef = useRef<string>('')
  useEffect(() => {
    if (lastLoadedTabRef.current === activeTab) return
    lastLoadedTabRef.current = activeTab
    if (activeTab === 'available') handleLoadAvailable()
    if (activeTab === 'active') handleLoadActive()
    if (activeTab === 'completed') handleLoadCompleted()
  }, [activeTab, handleLoadAvailable, handleLoadActive, handleLoadCompleted])

  const handleAcceptMission = useCallback(async (missionId: string) => {
    await sendCommand('accept_mission', { mission_id: missionId })
    // Refresh both available and active missions after accepting
    const [availResp, activeResp] = await Promise.all([
      sendCommand('get_missions'),
      sendCommand('get_active_missions'),
    ])
    setAvailableMissions((availResp.missions || []) as Mission[])
    const activeMissionsData = activeResp.missions as Record<string, unknown> | unknown[] | undefined
    const activeMissionsList = Array.isArray(activeMissionsData)
      ? activeMissionsData as Mission[]
      : ((activeMissionsData as Record<string, unknown>)?.active || []) as Mission[]
    setActiveMissions(activeMissionsList)
  }, [sendCommand])

  const handleCompleteMission = useCallback(async (missionId: string) => {
    const result = await sendCommand('complete_mission', { mission_id: missionId })
    setCompletionResult(result)
    // Refresh active and completed missions
    const [activeResp, completedResp] = await Promise.all([
      sendCommand('get_active_missions'),
      sendCommand('completed_missions'),
    ])
    const activeMissionsData = activeResp.missions as Record<string, unknown> | unknown[] | undefined
    setActiveMissions(Array.isArray(activeMissionsData)
      ? activeMissionsData as Mission[]
      : ((activeMissionsData as Record<string, unknown>)?.active || []) as Mission[])
    setCompletedMissions((completedResp.missions || []) as CompletedMission[])
    setCompletedMissionsTotal((completedResp.total as number) || 0)
  }, [sendCommand])

  const handleAbandonMission = useCallback(async (missionId: string) => {
    await sendCommand('abandon_mission', { mission_id: missionId })
    // Refresh active missions after abandoning
    const resp = await sendCommand('get_active_missions')
    const missionsData = resp.missions as Record<string, unknown> | unknown[] | undefined
    const missions = Array.isArray(missionsData)
      ? missionsData as Mission[]
      : ((missionsData as Record<string, unknown>)?.active || []) as Mission[]
    setActiveMissions(missions)
    setActiveLoaded(true)
  }, [sendCommand])

  const handleViewCompletedMission = useCallback(async (templateId: string) => {
    setLoadingMissionDetail(true)
    try {
      const resp = await sendCommand('view_completed_mission', { template_id: templateId })
      setSelectedCompletedMission(resp as unknown as CompletedMissionDetail)
    } finally {
      setLoadingMissionDetail(false)
    }
  }, [sendCommand])

  const renderObjective = (obj: ActiveMissionObjective, index: number, showProgress: boolean) => (
    <div key={index} className={`${styles.objectiveItem} ${obj.completed ? styles.objectiveItemDone : ''}`}>
      {showProgress && obj.completed ? (
        <span className={styles.objectiveComplete}>
          <Check size={12} />
        </span>
      ) : showProgress ? (
        <span className={styles.objectiveProgress}>
          {obj.current}/{obj.required}
        </span>
      ) : null}
      <span className={styles.objectiveDesc}>{obj.description}</span>
      {obj.item_name && obj.required > 0 && (
        <span className={styles.objectiveMeta}>{obj.item_name} x{obj.required}</span>
      )}
      {obj.target_base_name && (
        <span className={styles.objectiveMeta}>@ {obj.target_base_name}</span>
      )}
      {obj.system_name && (
        <span className={styles.objectiveMeta}>[{obj.system_name}]</span>
      )}
      {showProgress && obj.in_cargo != null && obj.in_cargo > 0 && (
        <span className={styles.objectiveMeta}>Cargo: {obj.in_cargo}</span>
      )}
      {showProgress && obj.in_storage != null && obj.in_storage > 0 && (
        <span className={styles.objectiveMeta}>Storage: {obj.in_storage}</span>
      )}
    </div>
  )

  const renderRewards = (rewards?: Record<string, unknown>) => {
    if (!rewards) return null
    const credits = rewards.credits as number | undefined
    const items = rewards.items as Record<string, number> | undefined
    const skillXp = rewards.skill_xp as Record<string, number> | undefined
    const hasContent = (credits && credits > 0) || (items && Object.keys(items).length > 0) || (skillXp && Object.keys(skillXp).length > 0)
    if (!hasContent) return null
    return (
      <div className={styles.rewardRow}>
        <span className={styles.rewardIcon}><Award size={12} /></span>
        {credits != null && credits > 0 && (
          <span className={styles.rewardCredits}><Credits amount={credits} /></span>
        )}
        {items && Object.keys(items).length > 0 && (
          <span className={styles.rewardItems}>
            + {Object.entries(items).map(([itemId, qty]) => `${itemId} x${qty}`).join(', ')}
          </span>
        )}
        {skillXp && Object.keys(skillXp).length > 0 && (
          <span className={styles.rewardItems}>
            + {Object.entries(skillXp).map(([skill, xp]) => `${skill.replace(/_/g, ' ')} +${xp}XP`).join(', ')}
          </span>
        )}
      </div>
    )
  }

  const tabs = [
    { id: 'available', label: 'Available', icon: <Target size={13} /> },
    { id: 'active', label: 'Active', icon: <AlertTriangle size={13} /> },
    { id: 'completed', label: 'Completed', icon: <Award size={13} /> },
  ]

  return (
    <>
    <PanelWithTabs
      title="Missions"
      icon={<Target size={16} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
        {/* Available Missions Tab */}
        {activeTab === 'available' && (
          <>
            {loadingAvailable && availableMissions.length === 0 && (
              <div className={styles.loading}>
                <span className={shared.spinner} />
                Loading available missions...
              </div>
            )}
            {availableLoaded && availableMissions.length === 0 && !loadingAvailable && (
              <div className={shared.emptyState}>
                No missions available at this location.
              </div>
            )}
            {availableMissions.length > 0 && (
              <div className={styles.missionList}>
                {availableMissions.map((m) => {
                  const mr = m as unknown as Record<string, unknown>
                  const isExpanded = expandedMissions.has(m.mission_id)
                  const giver = mr.giver as { name: string; title: string } | undefined
                  const objectives = (mr.objectives || m.objectives || []) as ActiveMissionObjective[]
                  const rewards = (mr.rewards || m.rewards) as Record<string, unknown> | undefined
                  const dialog = mr.dialog as { offer?: string } | undefined

                  return (
                    <div key={m.mission_id} className={styles.missionItem}>
                      <div
                        className={styles.missionHeader}
                        onClick={() => toggleExpanded(m.mission_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span className={styles.missionTitle}>{m.title}</span>
                        </div>
                        <span className={styles.missionDifficulty}>{m.difficulty}</span>
                      </div>

                      {giver && (
                        <div className={styles.missionMeta}>
                          <span>{giver.name}, {giver.title}</span>
                        </div>
                      )}

                      <div className={styles.missionDesc}>{m.description}</div>

                      {isExpanded && dialog?.offer && (
                        <div className={styles.missionDialog}>
                          &ldquo;{dialog.offer}&rdquo;
                        </div>
                      )}

                      {renderRewards(rewards)}

                      {objectives.length > 0 && (
                        <div className={styles.objectiveList}>
                          {objectives.map((obj, i) => renderObjective(obj, i, false))}
                        </div>
                      )}

                      <button
                        className={styles.acceptBtn}
                        onClick={() => handleAcceptMission(m.mission_id)}
                        type="button"
                      >
                        <Check size={12} />
                        Accept Mission
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
            {loadingActive && activeMissions.length === 0 && (
              <div className={styles.loading}>
                <span className={shared.spinner} />
                Loading active missions...
              </div>
            )}
            {activeLoaded && activeMissions.length === 0 && !loadingActive && (
              <div className={shared.emptyState}>
                No active missions. Accept a mission to get started.
              </div>
            )}
            {activeMissions.length > 0 && (
              <div className={styles.missionList}>
                {activeMissions.map((m) => {
                  const mr = m as unknown as Record<string, unknown>
                  const isExpanded = expandedMissions.has(m.mission_id)
                  const percentComplete = (mr.percent_complete as number) ?? 0
                  const objectives = (mr.objectives || m.objectives || []) as ActiveMissionObjective[]
                  const isCompletable = percentComplete >= 100 || objectives.every((obj) => obj.completed)
                  const giver = mr.giver as { name: string; title: string } | undefined
                  const expiresInTicks = mr.expires_in_ticks as number | undefined
                  const issuingBase = mr.issuing_base as string | undefined
                  const issuingSystemName = mr.issuing_system_name as string | undefined
                  const rewards = (mr.rewards || m.rewards) as Record<string, unknown> | undefined

                  return (
                    <div key={m.mission_id} className={`${styles.missionItem} ${isCompletable ? styles.missionItemReady : ''}`}>
                      <div
                        className={styles.missionHeader}
                        onClick={() => toggleExpanded(m.mission_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span className={styles.missionTitle}>{m.title}</span>
                        </div>
                        <span className={styles.missionStatusBadge} data-status={isCompletable ? 'completable' : 'active'}>
                          {isCompletable ? 'Ready' : `${Math.round(percentComplete)}%`}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className={styles.progressTrack}>
                        <div
                          className={`${styles.progressFill} ${isCompletable ? styles.progressFillReady : ''}`}
                          style={{ width: `${Math.min(100, percentComplete)}%` }}
                        />
                      </div>

                      {/* Giver + location */}
                      {(giver || issuingBase) && (
                        <div className={styles.missionMeta}>
                          {giver && <span>{giver.name}, {giver.title}</span>}
                          {issuingBase && <span className={styles.metaSep}>{issuingBase}{issuingSystemName ? ` (${issuingSystemName})` : ''}</span>}
                        </div>
                      )}

                      {isExpanded && (
                        <div className={styles.missionDesc}>{m.description}</div>
                      )}

                      {/* Objectives */}
                      {objectives.length > 0 && (
                        <div className={styles.objectiveList}>
                          {objectives.map((obj, i) => renderObjective(obj, i, true))}
                        </div>
                      )}

                      {/* Rewards */}
                      {isExpanded && renderRewards(rewards)}

                      {/* Expiration */}
                      {isExpanded && expiresInTicks != null && expiresInTicks > 0 && (
                        <div className={styles.expiresIn}>
                          Expires in {Math.floor(expiresInTicks * 10 / 3600)}h {Math.floor((expiresInTicks * 10 % 3600) / 60)}m
                        </div>
                      )}

                      {/* Complete button */}
                      {isCompletable && (
                        <button
                          className={styles.completeBtn}
                          onClick={() => handleCompleteMission(m.mission_id)}
                          type="button"
                        >
                          <Check size={12} />
                          Complete Mission
                        </button>
                      )}

                      {/* Abandon (expanded only) */}
                      {isExpanded && (
                        <button
                          className={styles.abandonBtn}
                          onClick={() => handleAbandonMission(m.mission_id)}
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
            {loadingCompleted && completedMissions.length === 0 && (
              <div className={styles.loading}>
                <span className={shared.spinner} />
                Loading completed missions...
              </div>
            )}
            {completedLoaded && completedMissions.length === 0 && !loadingCompleted && (
              <div className={shared.emptyState}>
                No completed missions yet.
              </div>
            )}

            {/* Completed mission list */}
            {completedMissions.length > 0 && !selectedCompletedMission && (
              <div className={styles.missionList}>
                <div className={shared.sectionTitle}>
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
                <span className={shared.spinner} />
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
                    <Credits amount={selectedCompletedMission.rewards.credits} />
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
    </PanelWithTabs>
      {/* Mission Completion Modal */}
      {completionResult && (
        <div className={styles.completionOverlay}>
          <div className={styles.completionModal}>
            <div className={styles.completionHeader}>
              <Award size={20} className={styles.completionIcon} />
              <span className={styles.completionTitle}>Mission Complete</span>
            </div>
            <div className={styles.completionMissionTitle}>
              {completionResult.title as string}
            </div>
            {!!completionResult.message && (
              <div className={styles.completionDialog}>
                {completionResult.message as string}
              </div>
            )}
            <div className={styles.completionRewards}>
              <div className={styles.completionRewardsLabel}>Rewards</div>
              {(completionResult.credits_earned as number) > 0 && (
                <div className={styles.completionRewardRow}>
                  <Credits amount={completionResult.credits_earned as number} />
                </div>
              )}
              {!!completionResult.items_received && Object.keys(completionResult.items_received as Record<string, number>).length > 0 && (
                <div className={styles.completionRewardRow}>
                  {Object.entries(completionResult.items_received as Record<string, number>).map(([itemId, qty]) => (
                    <span key={itemId}>{itemId.replace(/_/g, ' ')} x{qty}</span>
                  ))}
                </div>
              )}
              {!!completionResult.skill_xp_gained && Object.keys(completionResult.skill_xp_gained as Record<string, number>).length > 0 && (
                <div className={styles.completionRewardRow}>
                  {Object.entries(completionResult.skill_xp_gained as Record<string, number>).map(([skill, xp]) => (
                    <span key={skill} className={styles.completionXp}>+{xp} {skill.replace(/_/g, ' ')} XP</span>
                  ))}
                </div>
              )}
            </div>
            {!!completionResult.chain_next && (
              <div className={styles.completionChain}>
                A new mission is available...
              </div>
            )}
            <button
              className={styles.completionOk}
              onClick={() => setCompletionResult(null)}
              type="button"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  )
}
