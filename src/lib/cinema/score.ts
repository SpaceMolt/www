import type { CinemaCue, CinemaFilm } from './types'
import { seeded } from './synth'

/** `drop` is not a sound: it clears the music, then dips the effects, before the decisive moment. */
export type Instrument = 'pad' | 'bass' | 'pulse' | 'kick' | 'hat' | 'drum' | 'snare' | 'horn' | 'fanfare' | 'bell' | 'tick' | 'hit' | 'swell' | 'riser' | 'drop'
/** One score event; times in film seconds, pitches as MIDI numbers. */
export interface ScoreNote {
  time: number
  duration: number
  instrument: Instrument
  pitches: number[]
  velocity: number
  pan?: number
  /** Pulse filter opening, 0..1. */
  bright?: number
}
export type Resolution = 'victory' | 'defeat' | 'capture' | 'mutual' | 'stalemate'

const MODES = [[0, 2, 3, 5, 7, 8, 10], [0, 2, 3, 5, 7, 9, 10], [0, 1, 3, 5, 7, 8, 10], [0, 2, 3, 5, 7, 8, 11]]
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
/** [scale degree, beats]; degrees may leave the octave. */
const MOTIFS: [number, number][][] = [
  [[0, 1], [4, 1], [3, .5], [2, .5], [4, 2]],
  [[0, .5], [2, .5], [4, 1], [5, 1], [4, 2]],
  [[4, 1], [3, .5], [4, .5], [7, 2]],
  [[0, 1.5], [1, .5], [2, 1], [-1, 1], [0, 2]],
  [[0, 1], [0, .5], [4, .5], [3, 1], [1, 1], [2, 2]],
  [[0, .75], [2, .25], [4, 1], [6, 1], [4, 2]],
  [[0, 1], [5, 1], [4, .5], [2, .5], [3, 2]],
  [[2, 1], [1, .5], [0, .5], [4, 1.5], [0, .5], [7, 2]],
]
const PROGRESSIONS = [[0, 5, 2, 6], [0, 3, 5, 4], [0, 5, 3, 4], [0, 6, 5, 6], [0, 3, 0, 5], [0, 2, 5, 6]]
/** Sixteenth-step ostinati over chord tones [root, fifth, octave, third]; -1 rests. */
const PATTERNS = [
  [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 3, 2, 1],
  [0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 3, 1, 2],
  [0, -1, 0, 1, -1, 0, 2, -1, 0, -1, 0, 1, 2, 1, 0, -1],
  [0, 0, 0, 0, 1, 1, 1, 1, 3, 3, 3, 3, 1, 1, 2, 2],
  [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 3, 1, 0, 1, 2, 1],
]
const decisive = (cue: CinemaCue) => cue.kind === 'death' || cue.kind === 'knockout' || cue.kind === 'capture'

/** How the story ends for the protagonist's side. */
export function filmResolution(film: CinemaFilm): Resolution {
  const climax = film.cues.find(cue => cue.id === film.story?.climaxCueId)
  if (climax?.kind === 'capture') return 'capture'
  if (!film.ships.some(ship => ship.fate === 'survived' || ship.fate === 'escaped' || ship.fate === 'withdrawn')) return 'mutual'
  const hero = film.ships.find(ship => ship.id === film.story?.protagonistId)
  if (film.outcome === 'victory') return !hero || hero.sideId === film.winningSide ? 'victory' : 'defeat'
  return 'stalemate'
}

/**
 * Composes the whole score in advance from the edited film. Deterministic: the
 * film seed chooses key, mode, tempo, motif, progression and ostinato.
 */
export function composeScore(film: CinemaFilm): ScoreNote[] {
  const r = seeded(film.seed ^ 0x5eed5)
  const pick = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)]
  const mode = pick(MODES), motif = pick(MOTIFS), progression = pick(PROGRESSIONS), patternIndex = Math.floor(r() * PATTERNS.length)
  const setupVoice = pick(['bell', 'horn', 'tick', 'heartbeat', 'cluster'] as const), silentDrop = r() < .5
  const openChord = pick([[0, 7, 12], [0, 3, 7], [0, 2, 7], [0, 1, 7], [0, 5, 10]]), riseIn = r() < .6, liftBy = r() < .5 ? 1 : 2
  let root = 36 + Math.floor(r() * 12)
  const bpm = 92 + Math.floor(r() * 12) * 5
  const beat = 60 / bpm, bar = beat * 4, end = film.duration
  const notes: ScoreNote[] = []
  const note = (time: number, duration: number, instrument: ScoreNote['instrument'], pitches: number[], velocity: number, extra: Partial<ScoreNote> = {}) => {
    if (time >= 0 && time < end + 2 && duration > 0) notes.push({ time, duration, instrument, pitches, velocity, ...extra })
  }
  const degree = (d: number, base: number, scale = mode) => base + 12 * Math.floor(d / 7) + scale[((d % 7) + 7) % 7]
  const triad = (d: number, scale = mode) => [0, 2, 4].map(step => degree(d + step, root, scale))
  /** Pad voicing: chord tones folded into the register above 120 Hz. */
  const voiced = (pitches: number[], low = 55) => pitches.map(p => low + ((p - low) % 12 + 12) % 12).sort((a, b) => a - b)

  const cues = [...film.cues].sort((a, b) => a.time - b.time)
  const climaxCue = cues.find(cue => cue.id === film.story?.climaxCueId) ?? cues.filter(decisive).at(-1)
  const loudest = [...film.shots].sort((a, b) => b.intensity - a.intensity)[0]
  const climax = Math.min(end, climaxCue?.time ?? loudest?.actionTime ?? end * .7)
  const openingRoles = new Set(['geography', 'introduction', 'protagonist', 'opposition', 'arrival'])
  const firstAction = Math.min(
    film.shots.find(shot => shot.role && !openingRoles.has(shot.role))?.start ?? Infinity,
    cues.find(cue => cue.kind === 'weapon' || cue.kind === 'boarding')?.time ?? Infinity,
  )
  const action = Math.max(0, Math.min(Number.isFinite(firstAction) ? firstAction : end * .2, climax - beat))
  let cut = climax - 2 * beat
  if (cut < action + beat) cut = Math.max(action, climax - beat)
  const grid = climax - bar * Math.ceil((climax - action) / bar + 1e-9)
  const resolution = filmResolution(film)
  const heroSide = film.ships.find(ship => ship.id === film.story?.protagonistId)?.sideId
  const side = (id?: string) => film.ships.find(ship => ship.id === id)?.sideId
  const shotIntensity = (t: number) => film.shots.find(shot => t >= shot.start && t < shot.end)?.intensity ?? .1
  const reversal = film.story?.sequences.find(sequence => sequence.kind === 'reversal' && sequence.start < cut)?.start ?? Infinity
  // Long passages get form: eight-bar sections, breakdowns, and a lift into the final third.
  const long = cut - action > 16 * bar
  // The key lifts for the last two bars before the climax and stays up for the ending.
  const preClimax = cut - action >= 3 * bar ? cut - 2 * bar : Infinity
  const lift = (t: number) => (t >= reversal || (long && t >= action + (cut - action) * 2 / 3) ? 2 : 0) + (t >= preClimax - 1e-6 ? liftBy : 0)

  // Reinforcements: one stab per arrival wave, and each wave raises the energy.
  const waves: { time: number; friendly: boolean }[] = []
  for (const cue of cues) if (cue.kind === 'arrival' && (!waves.length || cue.time - waves.at(-1)!.time > bar * .75)) {
    waves.push({ time: cue.time, friendly: film.ships.find(ship => ship.id === (cue.to ?? cue.from))?.sideId === heroSide })
  }
  const reinforcement = (t: number) => Math.min(.12, waves.filter(wave => wave.time <= t && wave.time >= action).length * .04)
  const energy = (t: number) => Math.max(0, Math.min(1, .12 + .38 * Math.min(1, Math.max(0, (t - action) / Math.max(bar, cut - action))) + .45 * shotIntensity(t) + reinforcement(t)))

  // Setup: sparse and ominous. The seed picks the opening chord and gesture.
  if (action > .6) {
    note(.15, action + beat - .15, 'pad', voiced(openChord.map(i => root + i), 45), .45)
    // Each introduced principal gets a leitmotif: the hero's side bright, the other side low.
    const introductions = film.shots.filter(shot => shot.role === 'introduction' && shot.start < action)
    for (const shot of introductions) {
      const hero = side(shot.subject) === heroSide
      if (hero) motif.slice(0, 2).reduce((t, [d, beats]) => { note(t, Math.min(beats * beat, shot.end - t) - .03, 'horn', [degree(d, root + 24)], .5); return t + beats * beat }, shot.start + .1)
      else { note(shot.start + .1, shot.end - shot.start - .2, 'horn', [root + 12, root + 13], .45); if (r() < .5) note(shot.start + .1, .5, 'drum', [], .6) }
    }
    const gestureEnd = introductions[0]?.start ?? action
    if (setupVoice === 'tick' || setupVoice === 'heartbeat') for (let k = Math.ceil((.4 - grid) / beat); grid + k * beat < action - .1; k++) {
      const t = grid + k * beat
      if (setupVoice === 'tick') note(t, .05, 'tick', [root + 60 + (k % 4 ? 0 : 7)], k % 4 ? .5 : .8, { pan: k % 2 ? .3 : -.3 })
      else if (k % 2 === 0) { note(t, .4, 'drum', [], .45); note(t + beat / 3, .4, 'drum', [], .3) }
    } else if (setupVoice === 'cluster') note(.3, action - .3, 'swell', voiced([root, root + 1, root + 7], 60), .35)
    else {
      let t = .5
      for (const [d, beats] of motif.slice(0, 3)) {
        if (t > gestureEnd - .3) break
        if (setupVoice === 'bell') note(t, beats * beat * 2, 'bell', [degree(d, root + 36)], .8, { pan: (r() - .5) * .6 })
        else note(t, beats * beat * 2 - .05, 'horn', [degree(d, root + 12)], .45)
        t += beats * beat * 2
      }
    }
    const rise = Math.min(1.2, action * .5)
    if (riseIn) note(action - rise, rise, 'riser', [root + 24], .55)
  }

  // Tension: harmonic motion per bar, layers entering as the energy climbs.
  let lastMotif = -Infinity
  const motifStatement = (at: number, base: number, velocity: number, until: number, scale = mode, reverse = false) => {
    let t = at
    for (const [d, beats] of reverse ? [...motif].reverse() : motif) {
      if (t >= until - .05) break
      note(t, Math.min(beats * beat, until - t) - .03, 'horn', [degree(d, base, scale)], velocity)
      t += beats * beat
    }
    lastMotif = at
  }
  const onBeat = (t: number) => grid + Math.ceil((t - grid) / beat - 1e-6) * beat
  const statements = [action, ...(film.story?.sequences ?? []).filter(sequence => sequence.kind === 'confrontation' || sequence.kind === 'reversal').map(sequence => sequence.start)]
  for (let barIndex = 0, start = grid; start < cut - 1e-6; barIndex++, start += bar) {
    const section = long ? Math.floor(barIndex / 8) : 0, pattern = PATTERNS[(patternIndex + section) % PATTERNS.length]
    const breakdown = section % 2 === 1 && barIndex % 8 < 4
    const E = Math.min(breakdown ? .3 : 1, energy(start + bar / 2)), chord = triad(progression[(barIndex + section) % progression.length]).map(p => p + lift(start))
    // Layers stack by stage: ostinato, then drums, then brass chords, then taiko and fills.
    const progress = (start - action) / Math.max(bar, cut - action)
    const stage = breakdown ? 0 : Math.max(0, Math.min(3, Math.floor(progress * 4 + (E - .5) * 2)))
    if (stage >= 2 && start >= action - 1e-6) note(start, beat * 1.5, 'horn', voiced(chord, 60), .45 + .25 * E)
    const tones = [chord[0], chord[2] > chord[0] + 7 ? chord[0] + 7 : chord[2], chord[0] + 12, chord[1]]
    const barEnd = Math.min(start + bar, cut)
    if (barEnd > action) note(Math.max(start, action), barEnd - Math.max(start, action), 'pad', voiced(chord), .35 + .4 * E)
    for (let step = 0; step < 16; step++) {
      const t = start + step * beat / 4
      if (t < action - 1e-6 || t >= cut - 1e-6) continue
      const tone = pattern[step]
      if (tone >= 0 && (E >= .5 || step % 2 === 0)) note(t, beat / (E >= .5 ? 4 : 2) * .9, 'pulse', [tones[tone] + 24], .3 + .6 * E, { bright: E, pan: step % 2 ? .35 : -.35 })
      if (step % (E > .6 ? 2 : 4) === 0) note(t, beat / (E > .6 ? 2 : 1) * .9, 'bass', [root + ((chord[0] - root) % 12 + 12) % 12], .4 + .5 * E)
      if (stage >= 1 && step % (stage >= 3 ? 4 : 8) === 0) note(t, .3, 'kick', [], .7 + .3 * E)
      if (stage >= 1 && (step % 4 === 2 || (stage >= 3 && step % 2 === 1))) note(t, step % 4 === 2 ? .12 : .04, 'hat', [], step % 4 === 2 ? .6 : .35, { pan: .25 })
      if (stage >= 3 && (step === 0 || step === 10 || step === 14)) note(t, .5, 'drum', [], step ? .6 : .85, { pan: step === 10 ? -.2 : .1 })
      if (stage >= 3 && barIndex % 4 === 3 && step >= 12) note(t, .1, 'snare', [], .35 + .1 * (step - 12), { pan: .1 })
      if (barEnd >= cut - 1e-6 && t >= cut - 2 * beat && E >= .4) note(t, .1, 'snare', [], .3 + .6 * (1 - (cut - t) / (2 * beat)), { pan: .1 })
    }
  }
  // The motif returns every four bars from the midpoint, and at each confrontation.
  const middle = action + (cut - action) / 2
  for (let t = onBeat(middle); t < cut - bar; t += 4 * bar) statements.push(t)
  for (const at of statements.sort((a, b) => a - b)) {
    const t = onBeat(Math.max(at, action))
    if (t - lastMotif >= 2 * bar && t < cut - bar) motifStatement(t, root + 24 + lift(t), .55 + .3 * energy(t), cut)
  }
  // Story stabs: reinforcements on the next eighth, earlier losses on their own frame.
  // Good news for the hero's side is bright and high, bad news low and dissonant.
  let lastStab = -Infinity
  const stab = (t: number, good: boolean) => {
    if ((t >= cut && t < climax + bar) || t - lastStab < bar) return
    note(t, beat * 1.5, 'horn', good ? voiced(triad(5).map(p => p + 12), 62) : [root + 12, root + 13, root + 19], good ? .7 : .6)
    note(t, .5, 'drum', [], .8)
    lastStab = t
  }
  const events = [
    ...waves.map(wave => ({ time: grid + Math.ceil((wave.time - grid) / (beat / 2) - 1e-6) * beat / 2, good: wave.friendly })),
    ...cues.filter(cue => decisive(cue) && cue !== climaxCue && cue.time > action).map(cue => ({ time: cue.time, good: (cue.kind === 'capture' ? side(cue.from) === heroSide : side(cue.to) !== heroSide) })),
  ].sort((a, b) => a.time - b.time)
  for (const event of events) stab(event.time, event.good)

  // The decisive event: silence or a reverse swell, then a hit and a brass stinger.
  const key = root + lift(climax - 1e-3)
  const climaxChord = triad(resolution === 'defeat' || resolution === 'mutual' ? 0 : 5).map(p => p + key - root)
  const swell = silentDrop ? beat : climax - cut
  if (climax - swell > 0) note(climax - swell, swell, 'swell', voiced(climaxChord, 55), .8)
  note(cut, climax - cut, 'drop', [], 1)
  note(climax, 3, 'hit', [...voiced(climaxChord, 48), climaxChord[0] + 24], 1)
  note(climax, .5, 'drum', [], 1)
  note(climax + .05, bar * 1.5, 'fanfare', voiced(climaxChord, 60), .9)
  // A capture gets its own rising stinger, louder than any arrival.
  for (const cue of cues) if (cue.kind === 'capture') {
    ;[0, 2, 4, 7].forEach((d, k) => note(cue.time + .1 + k * beat / 2, k === 3 ? bar : beat / 2, 'fanfare', [degree(d, key + 24, MAJOR)], .9))
    if (cue !== climaxCue) note(cue.time, 2, 'hit', voiced(triad(0, MAJOR).map(p => p + key - root), 55), .8)
  }

  // Resolution: the band returns on a downbeat, then the ending that fits the outcome.
  const major = resolution === 'victory' || resolution === 'capture'
  const scale = major ? MAJOR : mode
  const back = climax + (end - climax > 3 * bar ? bar : 2 * beat)
  const pattern = PATTERNS[patternIndex]
  const final = Math.max(back, climax + bar * Math.floor((end - 1.5 * bar - climax) / bar))
  // The resolution stays in the lifted key.
  root = key
  const route = { victory: [5, 6], capture: [3, 4], defeat: [3, 5], mutual: [5, 3], stalemate: [5, 3] }[resolution]
  for (let barIndex = 0, start = back; start < final - 1e-6; barIndex++, start += bar) {
    const chord = triad(route[barIndex % 2])
    const E = .85 - .2 * barIndex / Math.max(1, (final - back) / bar)
    note(start, Math.min(bar, final - start), 'pad', voiced(chord), .6)
    for (let step = 0; step < 16; step++) {
      const t = start + step * beat / 4
      if (t >= final) break
      if (pattern[step] >= 0) note(t, beat / 4 * .9, 'pulse', [[chord[0], chord[0] + 7, chord[0] + 12, chord[1]][pattern[step]] + 24], .55 + .3 * E, { bright: E, pan: step % 2 ? .35 : -.35 })
      if (step % 2 === 0) note(t, beat / 2 * .9, 'bass', [root + ((chord[0] - root) % 12 + 12) % 12], .8)
      if (step % 4 === 0) note(t, .3, 'kick', [], .85)
      if (step % 4 === 2) note(t, .12, 'hat', [], .5, { pan: .25 })
      if (step === 0 || step === 10) note(t, .5, 'drum', [], .75)
    }
    if (barIndex === 0) motifStatement(start, root + 24, .8, final, scale, resolution === 'defeat' || resolution === 'mutual')
  }
  // The ending resolves and dies away before the picture ends.
  const tail = Math.max(beat, end - 1.2 - final)
  if (resolution === 'victory') {
    note(final, tail, 'pad', voiced(triad(0, MAJOR).concat(root + 14), 50), .6)
    note(final, Math.min(tail, 2 * bar), 'horn', [root + 24, root + 28, root + 31], .65)
    ;[0, 2, 4, 7].forEach((d, k) => note(final + k * beat / 2, beat, 'bell', [degree(d, root + 48, MAJOR)], .45, { pan: (k - 1.5) * .25 }))
  } else if (resolution === 'capture') {
    note(final, beat * 2, 'pad', voiced([root, root + 5, root + 7]), .55)
    note(final + beat * 2, tail - beat * 2, 'pad', voiced(triad(0, MAJOR)), .6)
    ;[0, 1, 2, 4, 7].forEach((d, k) => note(final + k * beat / 2, k === 4 ? bar : beat / 2, 'horn', [degree(d, root + 24, MAJOR)], .6))
  } else if (resolution === 'defeat') {
    note(final, tail, 'pad', voiced(triad(0), 45), .45)
    ;[4, 3, 2, 0].forEach((d, k) => note(final + k * beat, k === 3 ? bar : beat * .95, 'horn', [degree(d, root + 12)], .45))
  } else if (resolution === 'mutual') {
    note(final, tail, 'pad', voiced([root, root + 7, root + 12], 45), .4)
    for (let k = 0; k < 3; k++) note(final + k * bar / 2, bar / 2, 'bell', [root + 24], .6)
  } else {
    note(final, tail, 'pad', voiced([root, root + 2, root + 7]), .45)
    for (const [k, [d]] of motif.slice(0, 3).entries()) note(final + k * beat, beat, 'bell', [degree(d, root + 36)], .4)
  }
  return notes.sort((a, b) => a.time - b.time)
}
