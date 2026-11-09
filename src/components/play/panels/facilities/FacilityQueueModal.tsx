'use client'

import { useState, useCallback, useEffect } from 'react'
import { ListOrdered, ArrowUp, ArrowDown, Trash2, Loader2, User, Globe, RefreshCw, Plus } from 'lucide-react'
import type { BulkJobCancelResponse, FacilityResponse } from '@spacemolt/lib'
import { useAccountStore, useCommandMutation, useCommandQuery, useCurrentTick } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { ConfirmAction, Modal, shared, useAction } from '../../shared'
import { ProgressBar } from '../../ProgressBar'
import { estimateJobProgress } from '../craftProgress'
import { getRecipe, recipesById } from '@/data/catalog'
import { titleCase } from '@/lib/format'
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
  const { busy: busyId, run } = useAction()
  const [recipeId, setRecipeId] = useState(facility.recipe_id ?? '')
  const [items, setItems] = useState('1')
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)

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
  // crafting_update reaches each job's orderer, so it covers your own jobs. Other pilots'
  // rental jobs on your facility get no push to you; poll only while one is queued.
  const store = useAccountStore()
  useEffect(() => store.account.on('crafting_update', () => refetch()), [store, refetch])
  const hasOthersJobs = jobs?.some((j) => j.orderer !== 'self') ?? false
  useEffect(() => {
    if (!hasOthersJobs) return
    const timer = setInterval(refetch, 10_000)
    return () => clearInterval(timer)
  }, [hasOthersJobs, refetch])

  const handleReorder = useCallback(async (jobId: string, position: number) => {
    const ok = await run(jobId, () => mutate(
      (c) => c.spacemolt_facility.job_reorder({ facility_id: facility.facility_id, job_id: jobId, position }),
      { label: 'facility_job_reorder' },
    ))
    if (ok) refetch()
  }, [mutate, facility.facility_id, refetch, run])

  const handleCancel = useCallback(async (jobId: string) => {
    if (await run(jobId, () => mutate((c) => c.spacemolt_facility.job_cancel({ job_id: jobId }), { label: 'facility_job_cancel' }))) refetch()
  }, [mutate, refetch, run])

  // job_add's quantity counts output items (the server rounds up to whole runs), as in CraftingPanel.
  const itemCount = Number(items)
  const perRun = getRecipe(recipeId.trim())?.outputs?.[0]?.quantity ?? 1
  const handleAdd = useCallback(async () => {
    const ok = await run('add', () => mutate(
      (c) => c.spacemolt_facility.job_add({ facility_id: facility.facility_id, recipe_id: recipeId.trim(), quantity: itemCount, direction }),
      { label: 'facility_job_add' },
    ))
    if (ok) refetch()
  }, [mutate, facility.facility_id, recipeId, itemCount, direction, refetch, run])

  const handleCancelSelected = useCallback(async () => {
    setConfirmBulk(false)
    await run('bulk', async () => {
      const result = await mutate(
        (c) => c.spacemolt_facility.job_cancel({ job_ids: [...selected] }),
        { label: 'facility_job_cancel' },
      )
      const details = result.delta.details as BulkJobCancelResponse | undefined
      if (details?.summary.failed) {
        const reasons = details.results.filter((r) => !r.success).map((r) => r.error ?? 'failed').join('; ')
        uiStore.dispatch({ type: 'toast', kind: 'danger', text: `Could not cancel ${details.summary.failed} jobs: ${reasons}` })
      }
      const cancelled = selected.size - (details?.summary.failed ?? 0)
      if (cancelled > 0) uiStore.dispatch({ type: 'toast', kind: 'success', text: `Cancelled ${cancelled} job${cancelled === 1 ? '' : 's'}` })
      setSelected(new Set())
      refetch()
    })
  }, [mutate, selected, uiStore, refetch, run])

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
        {selected.size > 0 && (confirmBulk ? (
          <ConfirmAction
            message={`Cancel ${selected.size} job${selected.size === 1 ? '' : 's'}? Unconsumed escrow is refunded.`}
            onConfirm={handleCancelSelected}
            onCancel={() => setConfirmBulk(false)}
          />
        ) : (
          <button className={shared.warningBtn} onClick={() => setConfirmBulk(true)} disabled={busyId !== null} type="button">
            <Trash2 size={11} /> Cancel {selected.size}
          </button>
        ))}
        <button className={shared.subtleBtn} onClick={refetch} disabled={loading} type="button">
          <RefreshCw size={11} /> Refresh
        </button>
      </>}
    >
      {facility.under_construction ? (
        <div className={shared.emptyState}>This facility is under construction. Queue jobs once it is built.</div>
      ) : <div className={styles.cardActions}>
        {facility.recipe_id ? (
          <span className={styles.costValue}>{getRecipe(facility.recipe_id)?.name ?? titleCase(facility.recipe_id)}</span>
        ) : (
          <>
            <input
              className={shared.textInput}
              list="facility-queue-recipes"
              placeholder="Recipe"
              aria-label="Recipe"
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              title={getRecipe(recipeId.trim())?.name}
              style={{ width: '10rem' }}
            />
            <datalist id="facility-queue-recipes">
              {Object.values(recipesById).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </datalist>
          </>
        )}
        <input
          className={shared.textInput}
          type="number"
          min={1}
          step={1}
          value={items}
          onChange={(e) => setItems(e.target.value)}
          aria-label="Items"
          title={`Items to make; one run makes ${perRun}`}
          style={{ width: '4.5rem' }}
        />
        {perRun > 1 && <span className={styles.costValue}>{perRun} per run</span>}
        <select
          className={shared.selectInput}
          value={direction}
          onChange={(e) => setDirection(e.target.value === 'reverse' ? 'reverse' : 'forward')}
          aria-label="Direction"
        >
          <option value="forward">Craft</option>
          <option value="reverse">Recycle</option>
        </select>
        <button
          className={shared.confirmBtn}
          onClick={handleAdd}
          disabled={busyId === 'add' || !recipeId.trim() || !Number.isInteger(itemCount) || itemCount < 1}
          type="button"
          title="Queue items on this facility. Inputs and labor are escrowed now."
        >
          {busyId === 'add' ? <Loader2 size={11} className={shared.spinner} /> : <Plus size={11} />} Add job
        </button>
      </div>}
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
