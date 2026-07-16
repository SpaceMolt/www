'use client'

import { useCallback, useState } from 'react'
import {
  Target,
  ChevronDown,
  ChevronRight,
  Award,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react'
import { SpacemoltError } from '@spacemolt/lib'
import type { CompleteMissionResponse, CompletedMissionsResponse, GameState, GetMissionsResponse, ViewCompletedMissionResponse } from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, useCommandQuery, useMissions } from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { Credits, PanelWithTabs, shared } from '../shared'
import { BugReportButton } from '../BugReportButton'
import { buildMissionContext } from '../bugReportContext'
import type { Mission } from '../types'
import styles from './MissionsPanel.module.css'

type AvailableMission = GetMissionsResponse['missions'][number]
type ActiveMissionEntry = NonNullable<NonNullable<GameState['missions']>['active']>[number]
type CompletedMission = CompletedMissionsResponse['missions'][number]

interface ObjectiveView {
  type: string
  description: string
  current: number
  required: number
  completed: boolean
  item_name?: string
  target_base_name?: string
  system_name?: string
  in_cargo?: number
  in_storage?: number
}

interface RewardsView {
  credits?: number
  items?: Record<string, number>
  skill_xp?: Record<string, number>
}

function toAvailableObjective(o: NonNullable<AvailableMission['objectives']>[number]): ObjectiveView {
  return {
    type: o.type,
    description: o.description,
    current: 0,
    required: o.quantity ?? 0,
    completed: false,
    target_base_name: o.target_base_name,
    system_name: o.system_name,
  }
}

function toActiveObjective(o: NonNullable<ActiveMissionEntry['objectives']>[number]): ObjectiveView {
  return {
    type: o.type ?? '',
    description: o.description ?? '',
    current: o.current ?? 0,
    required: o.required ?? 0,
    completed: Boolean(o.completed),
    item_name: o.item_name,
    target_base_name: o.target_base_name,
    system_name: o.system_name,
    in_cargo: o.in_cargo,
    in_storage: o.in_storage,
  }
}

function toMissionContext(m: ActiveMissionEntry): Mission {
  const context = {
    mission_id: m.mission_id ?? '',
    title: m.title ?? '',
    description: m.description ?? '',
    difficulty: m.difficulty ?? 0,
    expires_in_ticks: m.expires_in_ticks ?? 0,
    type: m.type ?? '',
    percent_complete: m.percent_complete,
    rewards: {
      credits: m.rewards?.credits ?? 0,
      items: m.rewards?.items,
      pirate_rep: m.rewards?.pirate_rep,
      reputation: m.rewards?.reputation,
      skill_xp: m.rewards?.skill_xp,
    },
    objectives: m.objectives?.map((o) => ({
      description: o.description ?? '',
      type: o.type ?? '',
      item_id: o.item_id,
      quantity: o.required,
      system_id: o.system_id,
      system_name: o.system_name,
      target_base_name: o.target_base_name,
    })),
  }
  return context
}

function errorMessage(err: unknown): string {
  if (err instanceof SpacemoltError) return err.message
  if (err instanceof Error) return err.message
  return 'Action failed'
}

type TabId = 'available' | 'active' | 'completed'

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
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const [activeTab, setActiveTab] = useState<TabId>('available')

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorMessage(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
      uiStore.dispatch({ type: 'event', kind: 'danger', text })
    },
    [uiStore],
  )

  // Completion modal
  const [completionResult, setCompletionResult] = useState<CompleteMissionResponse | null>(null)

  // Available missions — lazily loaded per-tab
  const availableQuery = useCommandQuery(
    async (account) => (await account.commands.spacemolt.get_missions()).structuredContent,
    [],
    { enabled: activeTab === 'available' },
  )
  const availableMissions = availableQuery.data?.missions ?? []

  // Active missions — live section, kept current by mutation deltas
  const missionsSection = useMissions()
  const activeMissions = missionsSection?.active ?? []
  const activeLoaded = missionsSection !== undefined

  // Completed missions
  const completedQuery = useCommandQuery(
    async (account) => (await account.commands.spacemolt.completed_missions()).structuredContent,
    [],
    { enabled: activeTab === 'completed' },
  )
  const completedMissions: CompletedMission[] = completedQuery.data?.missions ?? []
  const completedMissionsTotal = completedQuery.data?.total_count ?? completedMissions.length

  const [selectedCompletedMission, setSelectedCompletedMission] = useState<ViewCompletedMissionResponse | null>(null)
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

  const handleAcceptMission = useCallback(async (missionId: string) => {
    try {
      const result = await mutate((c) => c.spacemolt.accept_mission({ id: missionId }), { label: 'accept_mission' })
      const details = result.delta.details
      uiStore.dispatch({
        type: 'event',
        kind: 'success',
        text: details?.message || `Mission accepted: ${details?.title || 'mission'}`,
      })
      availableQuery.refetch()
    } catch (err) {
      reportError(err)
    }
  }, [mutate, uiStore, availableQuery, reportError])

  const handleCompleteMission = useCallback(async (missionId: string) => {
    try {
      const result = await mutate((c) => c.spacemolt.complete_mission({ id: missionId }), { label: 'complete_mission' })
      if (result.delta.details) setCompletionResult(result.delta.details)
      completedQuery.refetch()
    } catch (err) {
      reportError(err)
    }
  }, [mutate, completedQuery, reportError])

  const handleAbandonMission = useCallback(async (missionId: string) => {
    try {
      const result = await mutate((c) => c.spacemolt.abandon_mission({ id: missionId }), { label: 'abandon_mission' })
      uiStore.dispatch({ type: 'event', kind: 'info', text: result.delta.details?.message || 'Mission abandoned' })
    } catch (err) {
      reportError(err)
    }
  }, [mutate, uiStore, reportError])

  const handleViewCompletedMission = useCallback(async (templateId: string) => {
    setLoadingMissionDetail(true)
    try {
      const resp = await store.account.commands.spacemolt.view_completed_mission({ id: templateId })
      setSelectedCompletedMission(resp.structuredContent ?? null)
    } catch (err) {
      reportError(err)
    } finally {
      setLoadingMissionDetail(false)
    }
  }, [store, reportError])

  const renderObjective = (obj: ObjectiveView, index: number, showProgress: boolean) => (
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

  const renderRewards = (rewards?: RewardsView) => {
    if (!rewards) return null
    const { credits, items, skill_xp: skillXp } = rewards
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
            {availableQuery.loading && availableMissions.length === 0 && (
              <div className={styles.loading}>
                <span className={shared.spinner} />
                Loading available missions...
              </div>
            )}
            {availableQuery.data && availableMissions.length === 0 && !availableQuery.loading && (
              <div className={shared.emptyState}>
                No missions available at this location.
              </div>
            )}
            {availableMissions.length > 0 && (
              <div className={styles.missionList}>
                {availableMissions.map((m) => {
                  const isExpanded = expandedMissions.has(m.mission_id)
                  const objectives = (m.objectives || []).map(toAvailableObjective)

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
                        <BugReportButton contextType="mission" entityName={m.title} entityContext={buildMissionContext(m)} />
                      </div>

                      {m.giver && (
                        <div className={styles.missionMeta}>
                          <span>{m.giver.name}, {m.giver.title}</span>
                        </div>
                      )}

                      <div className={styles.missionDesc}>{m.description}</div>

                      {isExpanded && m.dialog?.offer && (
                        <div className={styles.missionDialog}>
                          &ldquo;{m.dialog.offer}&rdquo;
                        </div>
                      )}

                      {renderRewards(m.rewards)}

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
            {!activeLoaded && (
              <div className={styles.loading}>
                <span className={shared.spinner} />
                Loading active missions...
              </div>
            )}
            {activeLoaded && activeMissions.length === 0 && (
              <div className={shared.emptyState}>
                No active missions. Accept a mission to get started.
              </div>
            )}
            {activeMissions.length > 0 && (
              <div className={styles.missionList}>
                {activeMissions.map((m, idx) => {
                  const missionId = m.mission_id ?? `active-${idx}`
                  const isExpanded = expandedMissions.has(missionId)
                  const percentComplete = m.percent_complete ?? 0
                  const objectives = (m.objectives || []).map(toActiveObjective)
                  const isCompletable = percentComplete >= 100 || objectives.every((obj) => obj.completed)

                  return (
                    <div key={missionId} className={`${styles.missionItem} ${isCompletable ? styles.missionItemReady : ''}`}>
                      <div
                        className={styles.missionHeader}
                        onClick={() => toggleExpanded(missionId)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span className={styles.missionTitle}>{m.title}</span>
                        </div>
                        <span className={styles.missionStatusBadge} data-status={isCompletable ? 'completable' : 'active'}>
                          {isCompletable ? 'Ready' : `${Math.round(percentComplete)}%`}
                        </span>
                        <BugReportButton contextType="mission" entityName={m.title ?? 'mission'} entityContext={buildMissionContext(toMissionContext(m))} />
                      </div>

                      {/* Progress bar */}
                      <div className={styles.progressTrack}>
                        <div
                          className={`${styles.progressFill} ${isCompletable ? styles.progressFillReady : ''}`}
                          style={{ width: `${Math.min(100, percentComplete)}%` }}
                        />
                      </div>

                      {/* Giver + location */}
                      {(m.giver || m.issuing_base) && (
                        <div className={styles.missionMeta}>
                          {m.giver && <span>{m.giver.name}, {m.giver.title}</span>}
                          {m.issuing_base && <span className={styles.metaSep}>{m.issuing_base}{m.issuing_system_name ? ` (${m.issuing_system_name})` : ''}</span>}
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
                      {isExpanded && renderRewards(m.rewards)}

                      {/* Expiration */}
                      {isExpanded && m.expires_in_ticks != null && m.expires_in_ticks > 0 && (
                        <div className={styles.expiresIn}>
                          Expires in {Math.floor(m.expires_in_ticks * 10 / 3600)}h {Math.floor((m.expires_in_ticks * 10 % 3600) / 60)}m
                        </div>
                      )}

                      {/* Complete button */}
                      {isCompletable && (
                        <button
                          className={styles.completeBtn}
                          onClick={() => handleCompleteMission(missionId)}
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
                          onClick={() => handleAbandonMission(missionId)}
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
            {completedQuery.loading && completedMissions.length === 0 && (
              <div className={styles.loading}>
                <span className={shared.spinner} />
                Loading completed missions...
              </div>
            )}
            {completedQuery.data && completedMissions.length === 0 && !completedQuery.loading && (
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
                      {m.giver ? `${m.giver.name} -- ${m.giver.title}` : ''}
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
                  Given by: {selectedCompletedMission.giver ? `${selectedCompletedMission.giver.name} -- ${selectedCompletedMission.giver.title}` : 'unknown'}
                </div>
                <div className={styles.completionTime}>
                  Completed {formatRelativeTime(selectedCompletedMission.completion_time)}
                </div>

                {selectedCompletedMission.objectives && selectedCompletedMission.objectives.length > 0 && (
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
                  {selectedCompletedMission.rewards.items && Object.keys(selectedCompletedMission.rewards.items).length > 0 && (
                    <div className={styles.missionDesc}>
                      Items: {Object.entries(selectedCompletedMission.rewards.items).map(
                        ([itemId, qty]) => `${itemId} x${qty}`
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
              {completionResult.title}
            </div>
            {completionResult.message && (
              <div className={styles.completionDialog}>
                {completionResult.message}
              </div>
            )}
            <div className={styles.completionRewards}>
              <div className={styles.completionRewardsLabel}>Rewards</div>
              {completionResult.credits_earned > 0 && (
                <div className={styles.completionRewardRow}>
                  <Credits amount={completionResult.credits_earned} />
                </div>
              )}
              {completionResult.items_received && Object.keys(completionResult.items_received).length > 0 && (
                <div className={styles.completionRewardRow}>
                  {Object.entries(completionResult.items_received).map(([itemId, qty]) => (
                    <span key={itemId}>{itemId.replace(/_/g, ' ')} x{qty}</span>
                  ))}
                </div>
              )}
              {completionResult.skill_xp_gained && Object.keys(completionResult.skill_xp_gained).length > 0 && (
                <div className={styles.completionRewardRow}>
                  {Object.entries(completionResult.skill_xp_gained).map(([skill, xp]) => (
                    <span key={skill} className={styles.completionXp}>+{xp} {skill.replace(/_/g, ' ')} XP</span>
                  ))}
                </div>
              )}
            </div>
            {completionResult.chain_next && (
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
