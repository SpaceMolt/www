import type { CinemaCue } from './types'

/** Half-open range; a cue crossing a frame boundary is emitted exactly once. */
export function cueRange(cues: readonly CinemaCue[], from: number, to: number): readonly CinemaCue[] {
  const lower = (time: number) => {
    let left = 0, right = cues.length
    while (left < right) { const mid = (left + right) >>> 1; if (cues[mid].time < time) left = mid + 1; else right = mid }
    return left
  }
  return cues.slice(lower(from), lower(to))
}

/** Collateral lands with its parent volley; a long flight still gets its full impact. */
export function cueLifetime(cue: CinemaCue): number {
  if(cue.kind === 'weapon') return Math.max(0.015,cue.duration) + 1.2
  return Math.max(cue.duration,cue.kind === 'death' ? 7 : 2.2)
}
export function weaponImpactAge(cue: CinemaCue, time: number): number {
  return time-cue.time-Math.max(0.015,cue.duration)
}
