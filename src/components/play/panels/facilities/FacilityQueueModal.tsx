'use client'

import { useState, useCallback } from 'react'
import { ListOrdered, ArrowUp, ArrowDown, Trash2, Loader2, User, Globe, RefreshCw } from 'lucide-react'
import type { BulkJobCancelResponse, FacilityResponse } from '@spacemolt/lib'
import { useCommandMutation, useCommandQuery, useCurrentTick } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Modal, errorMessage, shared } from '../../shared'
import { ProgressBar } from '../../ProgressBar'
import { estimateJobProgress } from '../craftProgress'
import type { Facility, CraftJobView } from '../../types'
import styles from './facilities.module.css'

// `{ jobs: unknown }` uniquely identifies the job-list variant within the
// FacilityResponse union (see UpgradeModal.tsx for the discriminator pattern).
type FacilityJobListResponse = Extract<FacilityResponse, { jobs: unknown }>

interface FacilityQueueModalProps {
  facility: Facility
  onClose: () => void
}

export function FacilityQueueModal({ facility, onClose }: FacilityQueueModalProps) {
  const currentTick = useCurrentTick()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
    uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
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

  const handleCancelSelected = useCallback(async () => {
    setBusyId('bulk')
    try {
      const result = await mutate(
        (c) => c.spacemolt_facility.job_cancel({ job_ids: [...selected] }),
        { label: 'facility_job_cancel' },
      )
      const details = result.delta.details as BulkJobCancelResponse | undefined
      if (details?.summary.failed) {
        const reasons = details.results.filter((r) => !r.success).map((r) => r.error ?? 'failed').join('; ')
        uiStore.dispatch({ type: 'toast', kind: 'danger', text: `Could not cancel ${details.summary.failed} jobs: ${reasons}` })
      }
      setSelected(new Set())
      refetch()
    } catch (err) {
      reportError(err)
    }
    setBusyId(null)
  }, [mutate, selected, uiStore, refetch, reportError])

  const toggle = (jobId: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(jobId)) next.delete(jobId)
    else next.add(jobId)
    return next
  })

  return (
    <Modal
      title={`Queue — ${facility.custom_name || facility.name}`}
      icon={<ListOrdered size={14} />}
      onClose={onClose}
      actions={<>
        {selected.size > 0 && (
          <button className={shared.warningBtn} onClick={handleCancelSelected} disabled={busyId !== null} type="button">
            <Trash2 size={11} /> Cancel {selected.size}
          </button>
        )}
        <button className={shared.subtleBtn} onClick={refetch} disabled={loading} type="button">
          <RefreshCw size={11} /> Refresh
        </button>
      </>}
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
                <input
                  type="checkbox"
                  checked={selected.has(job.job_id)}
                  onChange={() => toggle(job.job_id)}
                  aria-label={`Select ${job.recipe}`}
                />
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
