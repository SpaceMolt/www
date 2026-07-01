import type { CraftJobView } from '../types'

/**
 * Estimate a job's live progress (completed runs, as a float) between server
 * syncs, extrapolating forward using the ever-advancing tick clock.
 *
 * ticksPerRun should be the venue's own per-run duration (e.g.
 * FacilityProduction.ticks_per_run) — NOT derived from eta_ticks/runs_remaining,
 * because eta_ticks includes queue-wait time ahead of this job at a facility,
 * which has nothing to do with how fast a single run actually takes. Dividing
 * by that would badly over/under-estimate the rate while queued and jump
 * abruptly once the job starts running.
 *
 * When ticksPerRun is unknown (undefined/0 — e.g. Station Workshop, whose
 * rate depends on player skills we don't have client-side), this returns the
 * last-synced value with no extrapolation rather than guessing.
 */
export function estimateJobProgress(job: CraftJobView, currentTick: number, ticksPerRun?: number): number {
  const doneAtSync = Math.min(job.runs_done + job.progress, job.runs_total)
  if (job.runs_remaining <= 0 || !ticksPerRun || ticksPerRun <= 0) return doneAtSync

  const syncTick = job.last_sync_tick ?? currentTick
  const ticksElapsed = Math.max(0, currentTick - syncTick)
  return Math.min(job.runs_total, doneAtSync + ticksElapsed / ticksPerRun)
}
