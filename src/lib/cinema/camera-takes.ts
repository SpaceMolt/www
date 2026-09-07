import type { CinemaSequence, CinemaShot } from './types'

export interface CameraTake { id: string; start: number; end: number }

/** Adjacent exchanges may share a take only while the ordered firing pair stays
 * the same. A strategic master explicitly breaks this continuity. */
export function buildCameraTakes(sequences: readonly CinemaSequence[], shots: readonly CinemaShot[]): Map<string, CameraTake> {
  const takes = new Map<string, CameraTake>()
  let previous: CinemaSequence | undefined
  let take: CameraTake | undefined
  for (const sequence of [...sequences].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
    const uninterrupted = previous && take && sequence.attacker && sequence.defender &&
      sequence.attacker === previous.attacker && sequence.defender === previous.defender &&
      sequence.start <= previous.end + .001 &&
      !shots.some(shot => shot.battlefield && shot.start < sequence.end && shot.end > previous!.start)
    if (uninterrupted) take!.end = Math.max(take!.end, sequence.end)
    else take = { id: sequence.id, start: sequence.start, end: sequence.end }
    takes.set(sequence.id, take!)
    previous = sequence
  }
  return takes
}
