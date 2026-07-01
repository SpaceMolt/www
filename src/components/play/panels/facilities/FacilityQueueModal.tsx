'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ListOrdered, ArrowUp, ArrowDown, Trash2, Loader2, User, Globe, RefreshCw } from 'lucide-react'
import { useGame } from '../../GameProvider'
import { Modal, shared } from '../../shared'
import { ProgressBar } from '../../ProgressBar'
import { estimateJobProgress } from '../craftProgress'
import type { Facility, CraftJobView } from '../../types'
import styles from './facilities.module.css'

interface FacilityQueueModalProps {
  facility: Facility
  onClose: () => void
}

export function FacilityQueueModal({ facility, onClose }: FacilityQueueModalProps) {
  const { state, api } = useGame()
  const [jobs, setJobs] = useState<CraftJobView[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const currentTickRef = useRef(state.currentTick)
  currentTickRef.current = state.currentTick

  const refresh = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const data = await api.callStructured<{ jobs?: CraftJobView[] }>(
        'spacemolt_facility', 'job_list', { facility_id: facility.facility_id },
      )
      // Sort by queue position so array index matches the visual/reorder
      // order, and stamp last_sync_tick — this component keeps its own local
      // job state rather than the shared craftJobs slice (crafting_update
      // pushes only reach a job's own orderer, not the facility owner
      // watching someone else's rental job), so it must timestamp its own
      // syncs for estimateJobProgress's interpolation to work.
      const sorted = [...(data?.jobs || [])].sort((a, b) => a.position - b.position)
      setJobs(sorted.map(j => ({ ...j, last_sync_tick: currentTickRef.current })))
    } catch {
      setJobs([])
    }
    setLoading(false)
  }, [api, facility.facility_id])

  useEffect(() => { refresh() }, [refresh])

  const handleReorder = useCallback(async (jobId: string, position: number) => {
    if (!api) return
    setBusyId(jobId)
    try {
      await api.callStructured('spacemolt_facility', 'job_reorder', {
        facility_id: facility.facility_id, job_id: jobId, position,
      })
      await refresh()
    } catch { /* handled by empty state on next refresh */ }
    setBusyId(null)
  }, [api, facility.facility_id, refresh])

  const handleCancel = useCallback(async (jobId: string) => {
    if (!api) return
    setBusyId(jobId)
    try {
      await api.callStructured('spacemolt_facility', 'job_cancel', { job_id: jobId })
      await refresh()
    } catch { /* handled by empty state on next refresh */ }
    setBusyId(null)
  }, [api, refresh])

  return (
    <Modal
      title={`Queue — ${facility.custom_name || facility.name}`}
      icon={<ListOrdered size={14} />}
      onClose={onClose}
      actions={
        <button className={shared.subtleBtn} onClick={refresh} disabled={loading} type="button">
          <RefreshCw size={11} /> Refresh
        </button>
      }
    >
      {loading && jobs === null && (
        <div className={shared.emptyState}><Loader2 size={12} className={shared.spinner} /> Loading queue...</div>
      )}
      {jobs && jobs.length === 0 && (
        <div className={shared.emptyState}>No jobs queued at this facility.</div>
      )}
      {jobs && jobs.map((job, i) => {
        const isSelf = job.orderer === 'self'
        const done = estimateJobProgress(job, state.currentTick, facility.production?.ticks_per_run)
        return (
          <div key={job.job_id} className={styles.typeDetail}>
            <div className={styles.typeHeader}>
              <span className={styles.typeName}>
                {isSelf ? <User size={11} /> : <Globe size={11} />}
                {job.recipe}
              </span>
              <span className={shared.badgeGrey}>{isSelf ? 'you' : job.orderer}</span>
            </div>
            <div className={styles.costRow}>
              <span className={styles.costValue}>{job.runs_remaining} of {job.runs_total} runs left</span>
            </div>
            <ProgressBar value={done} max={Math.max(1, job.runs_total)} size="sm" showText={false} color="cyan" />
            <div className={styles.cardActions}>
              <button
                type="button"
                className={shared.subtleBtn}
                onClick={() => handleReorder(job.job_id, Math.max(1, job.position - 1))}
                disabled={busyId === job.job_id || i === 0}
                title="Move up in queue"
              >
                <ArrowUp size={11} />
              </button>
              <button
                type="button"
                className={shared.subtleBtn}
                onClick={() => handleReorder(job.job_id, job.position + 1)}
                disabled={busyId === job.job_id || i === jobs.length - 1}
                title="Move down in queue"
              >
                <ArrowDown size={11} />
              </button>
              <button
                type="button"
                className={shared.warningBtn}
                onClick={() => handleCancel(job.job_id)}
                disabled={busyId === job.job_id}
                title="Cancel job (refunds unconsumed escrow)"
              >
                {busyId === job.job_id ? <Loader2 size={11} className={shared.spinner} /> : <Trash2 size={11} />}
              </button>
            </div>
          </div>
        )
      })}
    </Modal>
  )
}
