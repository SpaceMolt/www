import type { CommissionStatusResponse } from '@spacemolt/lib'

type CommissionEntry = CommissionStatusResponse['commissions'][number]

/**
 * Percent built (0-100) for a commission in the `building` state. The current
 * tick only advances on server traffic, so it never reads earlier than the
 * point the server's `ticks_remaining` implies.
 */
export function buildProgressPct(
  c: Pick<CommissionEntry, 'build_start_tick' | 'build_complete_tick' | 'ticks_remaining'>,
  currentTick: number,
): number {
  const start = c.build_start_tick ?? 0
  const end = c.build_complete_tick ?? 0
  if (end <= start) return 0
  const now = Math.max(currentTick, end - (c.ticks_remaining ?? 0))
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
}
