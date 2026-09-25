import { buildAudioSchedule } from './audioSchedule'
import { composeScore, type ScoreNote } from './score'
import { renderCue, renderNote } from './synth'
import type { CinemaFilm } from './types'
import type { CinemaAudioCue } from './audioSchedule'

/** Renders soundtrack events off the main thread, in request order. */
let notes: ScoreNote[] = [], cues = new Map<string, CinemaAudioCue>(), sizes: Record<string, number> = {}, rate = 48000, seed = 0
let queue: string[] = [], pumping = false

function pump() {
  const key = queue.shift()
  if (!key) { pumping = false; return }
  const sound = key[0] === 'n' ? renderNote(notes[Number(key.slice(1))], rate) : (() => {
    const cue = cues.get(key.slice(1))
    return cue && renderCue(cue, rate, sizes[cue.to ?? ''] ?? 0, seed)
  })()
  if (sound) self.postMessage({ key, sound }, { transfer: [sound.l.buffer, sound.r.buffer] })
  else self.postMessage({ key })
  // Yield between renders so a reset after a seek drops stale requests.
  setTimeout(pump, 0)
}

self.onmessage = (event: MessageEvent<{ film?: CinemaFilm; sizes?: Record<string, number>; rate?: number; keys?: string[]; reset?: boolean }>) => {
  const data = event.data
  if (data.film) {
    notes = composeScore(data.film)
    cues = new Map(buildAudioSchedule(data.film.cues, data.film.shots).map(cue => [cue.id, cue]))
    sizes = data.sizes ?? {}; rate = data.rate ?? rate; seed = data.film.seed
  }
  if (data.reset) queue = []
  if (data.keys) queue.push(...data.keys)
  if (!pumping && queue.length) { pumping = true; setTimeout(pump, 0) }
}
