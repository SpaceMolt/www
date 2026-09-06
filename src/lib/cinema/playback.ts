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

/** Only the nearby consequences of a long clustered shot belong in its frame. */
export function impactFocusIds(cues: readonly CinemaCue[], time: number): string[] {
  return [...new Set(cueRange(cues, time - 2.4, time + 1.40001)
    .filter(cue => ['death', 'knockout', 'capture'].includes(cue.kind))
    .flatMap(cue => cue.to ? [cue.to] : []))]
}

interface FocusBeat { cue: CinemaCue; start: number }
const focusScheduleCache = new WeakMap<readonly CinemaCue[], FocusBeat[]>()

function focusSchedule(cues: readonly CinemaCue[]): FocusBeat[] {
  const cached = focusScheduleCache.get(cues)
  if (cached) return cached
  const losses = cues.filter(cue => cue.to && ['death', 'knockout', 'capture'].includes(cue.kind))
    .sort((a, b) => a.time - b.time || b.intensity - a.intensity || a.id.localeCompare(b.id))
  const schedule: FocusBeat[] = []
  let pending: CinemaCue | undefined
  const append = (cue: CinemaCue) => {
    const previous = schedule.at(-1)
    schedule.push({ cue, start: Math.max(cue.time - 1.4, previous ? previous.cue.time + 1.5 : -Infinity) })
  }
  for (let index = 0; index < losses.length; index++) {
    const candidate = losses[index]
    // Simultaneous casualties remain secondary candidates, while the strongest
    // one gives the camera a stable anchor for the group.
    if (index > 0 && candidate.time === losses[index - 1].time) continue
    const previous = schedule.at(-1)
    if (!previous) { append(candidate); continue }
    if (candidate.time < previous.cue.time + 1.5) {
      pending = candidate
      continue
    }
    // Cover the tail of a rapid cascade before a genuinely distant next event.
    if (pending && candidate.time - 1.4 > previous.cue.time + 2.4) append(pending)
    pending = undefined
    append(candidate)
  }
  if (pending) append(pending)
  focusScheduleCache.set(cues, schedule)
  return schedule
}

/**
 * Stateless seeking through a precomputed editorial hold: primary first, then
 * nearby-in-time candidates. The scene applies its spatial neighborhood to the
 * remaining IDs. Compiled cue arrays are immutable for the life of a film.
 */
export function selectImpactFocus(cues: readonly CinemaCue[], time: number): string[] {
  const schedule = focusSchedule(cues)
  let low = 0, high = schedule.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (schedule[middle].start <= time) low = middle + 1
    else high = middle
  }
  const primary = schedule[low - 1]?.cue
  if (!primary?.to || time > primary.time + 2.4) return []
  const others = cueRange(cues, time - 2.4, time + 1.40001)
    .filter(cue => cue.to && ['death', 'knockout', 'capture'].includes(cue.kind))
    .sort((a, b) => Math.abs(a.time - primary.time) - Math.abs(b.time - primary.time) ||
      b.intensity - a.intensity || a.id.localeCompare(b.id))
  return [...new Set([primary.to, ...others.flatMap(cue => cue.to ? [cue.to] : [])])]
}
