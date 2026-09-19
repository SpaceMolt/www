import type { CinemaCue } from './types'

export interface CinemaEffectFocus {
  subjectId?: string
  causeCueId?: string
  eventCueId?: string
}

const consequence = (cue: CinemaCue) => ['death', 'knockout', 'capture'].includes(cue.kind)

function priority(cue: CinemaCue, focus: CinemaEffectFocus): number {
  const subject = !!focus.subjectId && (cue.from === focus.subjectId || cue.to === focus.subjectId)
  if (focus.eventCueId && cue.id === focus.eventCueId) return 7
  if (consequence(cue) && subject) return 6
  if (focus.causeCueId && cue.id === focus.causeCueId) return 5
  if (focus.causeCueId && cue.parentId === focus.causeCueId) return 4
  if (subject) return 3
  if (consequence(cue)) return 2
  return 0
}

/** Spend bounded pools on the filmed action before background activity.
 * Consequences remain ahead of ordinary volleys, while a busy background loss
 * cannot consume the foreground cause's entire pool. Collateral follows its gun.
 */
export function prioritizeCinemaEffects(cues: readonly CinemaCue[], focus: CinemaEffectFocus): CinemaCue[] {
  return [...cues].sort((a, b) => priority(b, focus) - priority(a, focus) || a.time - b.time || a.id.localeCompare(b.id))
}

/** Pick once per frame; processing another casualty must not move this light.
 * Filtering before ranking lets an expired story event yield to a fresh loss.
 */
export function selectCinemaPulseCue(cues: readonly CinemaCue[], time: number, focus: CinemaEffectFocus): CinemaCue | undefined {
  const eligible = cues.filter(cue => consequence(cue) && cue.to && time >= cue.time && time < cue.time + 1.5)
  return eligible.sort((a, b) => priority(b, focus) - priority(a, focus) || b.intensity - a.intensity || b.time - a.time || a.id.localeCompare(b.id))[0]
}
