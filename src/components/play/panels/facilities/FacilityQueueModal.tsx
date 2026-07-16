'use client'

import { useState, useCallback } from 'react'
import { ListOrdered, ArrowUp, ArrowDown, Trash2, Loader2, User, Globe, RefreshCw } from 'lucide-react'
import type { FacilityResponse } from '@spacemolt/lib'
import { useCommandMutation, useCommandQuery, useCurrentTick } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Modal, shared } from '../../shared'
import { ProgressBar } from '../../ProgressBar'
import { estimateJobProgress } from '../craftProgress'
import type { Facility, CraftJobView } from '../../types'
import styles from './facilities.module.css'

// `{ jobs: unknown }` uniquely identifies the job-list variant within the
// FacilityResponse union (see UpgradeModal.tsx for the discriminator pattern).
type FacilityJobListResponse = Extract<FacilityResponse, { jobs: unknown }>

const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err))

interface FacilityQueueModalProps {
  facility: Facility
  onClose: () => void
}

export function FacilityQueueModal({ facility, onClose }: FacilityQueueModalProps) {
  const currentTick = useCurrentTick()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const [busyId, setBusyId] = useState<string | null>(null)

  // This component keeps its own local job state rather than the shared
  // craftJobs slice (crafting_update pushes only reach a job's own orderer,
  // not the facility owner watching someone else's rental job), so it must
  // timestamp its own syncs for estimateJobProgress's interpolation to work.
  const { data: rawJobs, loading, error, refetch } = useCommandQuery(
    async (account) => {
      const resp = await account.commands.spacemolt_facility.job_list({ facility_id: facility.facility_id })
      const data = resp.structuredContent as FacilityJobListResponse | undefined
      // Sort by queue position so array index matches the visual/reorder order.
      const sorted = [...(data?.jobs ?? [])].sort((a, b) => a.position - b.position)
      return sorted.map((j): CraftJobView => ({ ...j, last_sync_tick: account.currentTick }))
    },
    [facility.facility_id],
  )
  const jobs = rawJobs ?? (error ? [] : null)

  const reportError = useCallback((err: unknown) => {
    uiStore.dispatch({ type: 'toast', kind: 'danger', text: describeError(err) })
  }, [uiStore])

  const handleReorder = useCallback(async (jobId: string, position: number) => {
    setBusyId(jobId)
    try {
      await mutate(
        (c) => c.spacemolt_facility.job_reorder({ facility_id: facility.facility_id, job_id: jobId, position }),
        { label: 'facility_job_reorder' },
      )
      refetch()
    } catch (err) {
      reportError(err)
    }
    setBusyId(null)
  }, [mutate, facility.facility_id, refetch, reportError])

  const handleCancel = useCallback(async (jobId: string) => {
    setBusyId(jobId)
    try {
      await mutate((c) => c.spacemolt_facility.job_cancel({ job_id: jobId }), { label: 'facility_job_cancel' })
      refetch()
    } catch (err) {
      reportError(err)
    }
    setBusyId(null)
  }, [mutate, refetch, reportError])

  return (
    <Modal
      title={`Queue — ${facility.custom_name || facility.name}`}
      icon={<ListOrdered size={14} />}
      onClose={onClose}
      actions={
        <button className={shared.subtleBtn} onClick={refetch} disabled={loading} type="button">
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
        const done = estimateJobProgress(job, currentTick, facility.production?.ticks_per_run)
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
