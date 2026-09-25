import type { CinemaAudioCue } from './audioSchedule'
import type { ScoreNote } from './score'
import { resolveWeaponFamily, type CinemaWeaponFamily } from './weapons'

/** Pure sample synthesis for the cinema soundtrack: no Web Audio, no samples. */
export interface Sound {
  rate: number
  l: Float32Array
  r: Float32Array
  /** Seconds into the buffer where the visible event lands. */
  lead: number
  /** Reverb send levels (short room, long hall). */
  short: number
  long: number
  /** Music duck: linear level, hold and release seconds. */
  duck?: [number, number, number]
}

export type Rng = () => number
export const seeded = (seed: number): Rng => { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 }
export function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return h >>> 0
}
const TAU = Math.PI * 2
const db = (value: number) => 10 ** (value / 20)
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, Number.isFinite(value) ? value : low))
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
const ad = (t: number, attack: number, decay: number) => t < attack ? t / attack : Math.exp(-(t - attack) / decay)
const glide = (f0: number, f1: number, time: number) => { const k = Math.log(f1 / f0) / time; return (t: number) => f0 * Math.exp(k * Math.min(t, time)) }

function blank(rate: number, seconds: number, lead = 0): Sound {
  const n = Math.max(1, Math.ceil(seconds * rate))
  return { rate, l: new Float32Array(n), r: new Float32Array(n), lead, short: 0, long: 0 }
}

/** Adds a mono layer with an equal-power pan. */
function add(o: Sound, start: number, dur: number, pan: number, gain: number, fn: (t: number) => number) {
  const s0 = Math.max(0, Math.round(start * o.rate)), n = Math.min(o.l.length - s0, Math.round(dur * o.rate))
  const angle = (clamp(pan, -1, 1) + 1) * Math.PI / 4, gl = Math.cos(angle) * Math.SQRT2 * gain, gr = Math.sin(angle) * Math.SQRT2 * gain
  for (let i = 0; i < n; i++) { const v = fn(i / o.rate); o.l[s0 + i] += v * gl; o.r[s0 + i] += v * gr }
}

/** Chamberlin state-variable filter; mode 0 low, 1 band, 2 high. */
function svf(rate: number) {
  let low = 0, band = 0
  return (x: number, cutoff: number, damp: number, mode: 0 | 1 | 2) => {
    const w = Math.PI * Math.max(20, Math.min(cutoff, rate / 6.5)) / rate, f = 2 * w * (1 - w * w / 6)
    low += f * band
    const high = x - low - damp * band
    band += f * high
    return mode === 0 ? low : mode === 1 ? band : high
  }
}
/** Phase accumulator; `wave` maps phase (0..1) and phase step to a sample. */
function osc(rate: number, freq: (t: number) => number, wave: (phase: number, step: number) => number = p => Math.sin(TAU * p), phase = 0) {
  return (t: number) => { const step = freq(t) / rate; phase = (phase + step) % 1; return wave(phase, step) }
}
/** Band-limited sawtooth (polyBLEP). */
function saw(p: number, dt: number) {
  let v = 2 * p - 1
  if (p < dt) { const x = p / dt; v -= x + x - x * x - 1 } else if (p > 1 - dt) { const x = (p - 1) / dt; v -= x * x + x + x + 1 }
  return v
}
const square = (p: number, dt: number) => saw(p, dt) - saw((p + .5) % 1, dt)
const noise = (r: Rng) => () => r() * 2 - 1
function brown(r: Rng) { let b = 0; return () => (b = (b + .04 * (r() * 2 - 1)) / 1.04) * 3.2 }

/** Inharmonic metal: shield rings, clanks, debris pings. */
function ring(o: Sound, start: number, f: number, ratios: number[], decay: number, pan: number, gain: number, r: Rng) {
  ratios.forEach((ratio, i) => {
    const d = decay / (1 + i * .7), freq = f * ratio * (1 + (r() - .5) * .01), p = r()
    const tone = osc(o.rate, () => freq, x => Math.sin(TAU * x), p)
    add(o, start, Math.min(d * 6, 6), pan + (r() - .5) * .4, gain / (1 + i * .45), t => tone(t) * Math.min(1, t / .0015) * Math.exp(-t / d))
  })
}

function thump(o: Sound, start: number, f0: number, f1: number, sweep: number, decay: number, gain: number) {
  const tone = osc(o.rate, glide(f0, f1, sweep))
  add(o, start, decay * 6, 0, gain, t => tone(t) * Math.min(1, t / .002) * Math.exp(-t / decay))
}
function burst(o: Sound, start: number, dur: number, pan: number, gain: number, r: Rng, cutoff: (t: number) => number, mode: 0 | 1 | 2, env: (t: number) => number, damp = 1) {
  const n = noise(r), f = svf(o.rate)
  add(o, start, dur, pan, gain, t => f(n(), cutoff(t), damp, mode) * env(t))
}
/** A waveshaped hull crunch: filtered noise folded through tanh. */
function crunch(o: Sound, start: number, dur: number, center: number, pan: number, gain: number, r: Rng) {
  const n = noise(r), f = svf(o.rate)
  add(o, start, dur, pan, gain, t => Math.tanh(3.5 * f(n(), center * (1 - t / dur * .4), .8, 1)) * ad(t, .002, dur / 4))
}
/** Saturated sub: harmonics keep the weight audible on small speakers. */
function sub(o: Sound, start: number, f0: number, f1: number, sweep: number, decay: number, gain: number, drive = 2.5) {
  const tone = osc(o.rate, glide(f0, f1, sweep)), k = Math.tanh(drive)
  add(o, start, decay * 6, 0, gain, t => Math.tanh(drive * tone(t) * Math.min(1, t / .003) * Math.exp(-t / decay)) / k)
}
/** Fireball: saturated mid-band noise, 300 Hz-3 kHz, falling in pitch as it burns out. */
function fireball(o: Sound, start: number, len: number, pan: number, gain: number, r: Rng) {
  const n = noise(r), f = svf(o.rate), center = 700 + r() * 1100
  add(o, start, len * 1.5, pan, gain, t => Math.tanh(2.2 * f(n(), center * (.35 + 1.4 * Math.exp(-t * 2.5 / len)), .75, 1)) * ad(t, .004, len / 3.5))
}
/** Debris crackle: sparse clicks, 2-8 kHz, thinning out. */
function crackle(o: Sound, start: number, len: number, pan: number, gain: number, r: Rng, density = .05) {
  const f = svf(o.rate)
  add(o, start, len, pan, gain, t => f(r() < density * Math.exp(-t * 2.5 / len) ? r() * 6 - 3 : 0, 4500, .5, 2))
}

function lowpassAll(o: Sound, cutoff: number) {
  const a = 1 - Math.exp(-TAU * cutoff / o.rate)
  for (const ch of [o.l, o.r]) { let y = 0; for (let i = 0; i < ch.length; i++) ch[i] = y += a * (ch[i] - y) }
}
function scale(o: Sound, gain: number) { for (let i = 0; i < o.l.length; i++) { o.l[i] *= gain; o.r[i] *= gain } }

const explosive = new Set<CinemaWeaponFamily>(['missile', 'torpedo', 'plasma', 'mine', 'smartbomb', 'flak'])

/** Weapon discharge, one call per shot; each shot is seeded so repeats differ. */
function release(family: CinemaWeaponFamily, cue: CinemaAudioCue, rate: number, r: Rng): Sound {
  const o = launch(family, cue, rate, r)
  if (cue.audioPhase !== 'charge') {
    // Every shot: a noise crack, the family's body, a noise tail and a small thump.
    const level = db((r() - .5) * 3), tail = .08 + r() * .14, tailCut = 2000 + r() * 2500
    burst(o, 0, .008, (r() - .5) * .3, .3 * level, r, () => 7000, 2, t => ad(t, .0003, .0012 + r() * .0015))
    burst(o, .002, tail * 5, 0, .14 * level, r, t => tailCut * Math.exp(-t * 3) + 500, 1, t => ad(t, .003, tail), .6)
    thump(o, 0, 120 * (.9 + .2 * r()), 65, .04, .04, .12 * level)
    o.duck = [db(-3), .06, .3]
  }
  scale(o, prominence(cue))
  return o
}
function launch(family: CinemaWeaponFamily, cue: CinemaAudioCue, rate: number, r: Rng): Sound {
  const pitch = 1 + (r() - .5) * .12, cut = 1 + (r() - .5) * .3
  let level = db(-1 + (r() - .5) * 4) * (cue.critical ? 1.2 : 1)
  const j = (range: number) => (r() - .5) * range
  switch (family) {
    case 'laser': {
      const o = blank(rate, .45)
      const shots = r() < .35 ? 2 : 1
      for (let s = 0; s < shots; s++) {
        const t0 = s * (.07 + r() * .04), f0 = (1300 + r() * 900) * pitch, f1 = f0 * (.35 + .3 * r())
        const a = osc(rate, glide(f0, f1, .07 + r() * .05), square), b = osc(rate, glide(f0 * 1.012, f1 * 1.02, .08 + r() * .05), saw), bp = svf(rate)
        add(o, t0, .22, j(.3), .22 * level, t => bp(a(t) * .6 + b(t) * .5, glide(2600 * cut, 700, .14)(t), .5, 1) * ad(t, .002, .05))
        burst(o, t0, .03, 0, .08 * level, r, () => 6000, 2, t => ad(t, .001, .006))
      }
      o.short = .25; o.long = .08
      return o
    }
    case 'beam': {
      const len = clamp(cue.duration, .4, 3), o = blank(rate, len + .3)
      const f = 110 * pitch, trem = 6 + r() * 3
      const a = osc(rate, () => f, saw), b = osc(rate, () => f * 1.009, saw), c = osc(rate, t => 1750 * pitch + 60 * Math.sin(TAU * 3 * t)), lp = svf(rate)
      const env = (t: number) => Math.min(1, t / .05) * Math.min(1, Math.max(0, len + .15 - t) / .15)
      add(o, 0, len + .3, -.3, .16 * level, t => lp(a(t), 1800 * cut, .6, 0) * env(t) * (.75 + .25 * Math.sin(TAU * trem * t)))
      add(o, 0, len + .3, .3, .16 * level, t => lp(b(t), 1800 * cut, .6, 0) * env(t) * (.75 + .25 * Math.sin(TAU * trem * t + 1)))
      add(o, 0, len + .3, 0, .035 * level, t => c(t) * env(t))
      burst(o, 0, .08, 0, .12 * level, r, () => 3500, 1, t => ad(t, .002, .02))
      o.short = .2; o.long = .1
      return o
    }
    case 'railgun': {
      if (cue.audioPhase === 'charge') {
        const len = clamp(cue.duration, .1, 3), o = blank(rate, len + .05)
        const whine = osc(rate, glide(180 * pitch, 2400 * pitch, len)), hum = osc(rate, glide(60, 120, len), saw)
        add(o, 0, len, 0, .12 * level, t => (whine(t) * .8 + hum(t) * .25) * (t / len) ** 1.5 * (1 + .3 * Math.sin(TAU * (8 + 30 * t / len) * t)))
        o.short = .15; o.long = .05
        return o
      }
      const o = blank(rate, 1.6)
      level *= .6
      burst(o, 0, .008, 0, .3 * level, r, () => 7000, 2, t => ad(t, .0003, .002))
      const zing = osc(rate, glide(3200 * pitch, 260, .08))
      add(o, 0, .3, 0, .18 * level, t => zing(t) * ad(t, .001, .05))
      thump(o, 0, 120, 70, .08, .08, .15 * level)
      burst(o, 0, 1.4, 0, .22 * level, r, t => 5000 * cut * Math.exp(-t * 3) + 200, 0, t => ad(t, .003, .35))
      o.short = .3; o.long = .25
      return o
    }
    case 'autocannon': case 'kinetic': case 'flak': {
      const rounds = family === 'autocannon' ? 3 + Math.floor(r() * 5) : family === 'flak' ? 2 + Math.floor(r() * 2) : 1
      const gap = family === 'flak' ? .16 + r() * .06 : .07 + r() * .04
      const o = blank(rate, rounds * gap + .7)
      for (let k = 0; k < rounds; k++) {
        const t0 = k * gap + j(.012), g = level * db(j(3))
        burst(o, t0, .06, j(.2), .3 * g, r, () => (1500 + r() * 900) * cut, 1, t => ad(t, .0008, .012 + r() * .01), .9)
        thump(o, t0, 160 * pitch, 95, .03, .04, .15 * g)
        if (family === 'flak') burst(o, t0 + .22 + r() * .08, .4, j(.8), .25 * g, r, t => 2400 * Math.exp(-t * 6) + 250, 0, t => ad(t, .002, .07))
        if (family === 'kinetic') ring(o, t0, 420 * pitch, [1, 2.4, 4.1], .08, 0, .05 * g, r)
      }
      o.short = .35; o.long = .1
      return o
    }
    case 'plasma': case 'disruptor': {
      const o = blank(rate, .8)
      const fc = (family === 'plasma' ? 190 : 420) * pitch, ratio = family === 'plasma' ? 3 : 3.5
      const mod = osc(rate, () => fc * ratio)
      let ph = 0
      add(o, 0, .6, 0, .2 * level, t => { const idx = 7 * Math.exp(-t * 9) + .8; ph = (ph + fc * (1 + idx * mod(t) * .5) / rate) % 1; return Math.sin(TAU * ph) * ad(t, .004, .12) })
      const n = noise(r), rm = osc(rate, () => 930 * pitch), bp = svf(rate)
      add(o, 0, .35, 0, .12 * level, t => bp(n() * rm(t), 2600 * cut, .7, 1) * ad(t, .001, .05) * (r() < .08 ? 3 : 1))
      if (family === 'disruptor') { const buzz = osc(rate, () => 58, square); add(o, .02, .3, 0, .06 * level, t => buzz(t) * ad(t, .01, .07)) }
      o.short = .25; o.long = .15
      return o
    }
    case 'missile': case 'torpedo': {
      const heavy = family === 'torpedo', o = blank(rate, heavy ? 1.6 : 1.2)
      thump(o, 0, heavy ? 100 : 140, 70, .08, .08, .18 * level)
      burst(o, 0, heavy ? 1.4 : 1.0, 0, .3 * level, r, t => (400 + 2600 * Math.min(1, t / .35)) * cut, 0, t => Math.min(1, t / .06) * Math.exp(-t / (heavy ? .45 : .3)))
      const dop = osc(rate, glide(820 * pitch, 520 * pitch, heavy ? 1 : .7), saw), lp = svf(rate)
      add(o, .02, heavy ? 1.2 : .9, 0, .05 * level, t => lp(dop(t), 1500, .7, 0) * Math.min(1, t / .05) * Math.exp(-t / .3))
      o.short = .2; o.long = .2
      return o
    }
    case 'mine': {
      const o = blank(rate, .7)
      thump(o, 0, 130, 75, .05, .05, .18 * level)
      ring(o, 0, 300 * pitch, [1, 2.7], .06, 0, .1 * level, r)
      for (const t0 of [.2, .38]) { const b = osc(rate, () => 1250 * pitch); add(o, t0, .06, 0, .06 * level, t => b(t) * ad(t, .003, .02)) }
      o.short = .3
      return o
    }
    case 'smartbomb': {
      const o = blank(rate, 2.2)
      level *= .7
      const up = osc(rate, glide(200, 1600, .15))
      add(o, 0, .16, 0, .12 * level, t => up(t) * (t / .16) ** 2)
      burst(o, .15, 1.8, 0, .28 * level, r, t => 3500 * Math.exp(-t * 2.5) + 150, 0, t => ad(t, .004, .4))
      thump(o, .15, 90, 35, .4, .35, .3 * level)
      ring(o, .15, 240 * pitch, [1, 2.76, 5.4], .5, 0, .06 * level, r)
      o.lead = .15; o.short = .2; o.long = .35
      return o
    }
    case 'exotic': default: {
      const o = blank(rate, 1.3)
      const a = osc(rate, glide(70 * pitch, 260 * pitch, .9)), b = osc(rate, glide(1100 * pitch, 330, .9))
      add(o, 0, 1.1, 0, .18 * level, t => (a(t) * .6 + b(t) * .3 * Math.sin(TAU * 11 * t)) * ad(t, .09, .35))
      o.short = .15; o.long = .3
      return o
    }
  }
}

/** Routine fire sits back; the story's featured exchanges play at full level. */
const prominence = (cue: CinemaAudioCue) => db(-8 * (1 - clamp((cue.intensity - .2) / .5, 0, 1)))

/** Damage 0..1 on a log scale: a graze is quiet, a heavy blow is loud. */
const weight = (damage: number) => clamp(Math.log1p(Math.max(0, damage)) / Math.log1p(120), 0, 1)

function impact(cue: CinemaAudioCue, family: CinemaWeaponFamily, rate: number, r: Rng): Sound {
  const o = hit(cue, family, rate, r)
  scale(o, prominence(cue))
  return o
}
function hit(cue: CinemaAudioCue, family: CinemaWeaponFamily, rate: number, r: Rng): Sound {
  const pitch = 1 + (r() - .5) * .12
  if (cue.audioPhase === 'miss') {
    const o = blank(rate, .45), level = db(-3 + (r() - .5) * 4)
    burst(o, 0, .42, (r() - .5) * 1.4, .09 * level, r, glide(2800 * pitch, 650, .35), 1, t => Math.sin(Math.PI * Math.min(1, t / .4)) ** 2, .45)
    o.short = .1
    return o
  }
  if (cue.audioPhase === 'shield-impact') {
    const w = weight(cue.shieldDamage ?? 0), o = blank(rate, 1.2), g = .35 + .65 * w
    ring(o, 0, (380 + r() * 260) * pitch, [1, 2.76, 5.4], .16 + .14 * w, 0, .16 * g, r)
    burst(o, 0, .35, 0, .16 * g, r, () => 5200, 2, t => Math.min(1, t / .03) * Math.exp(-t / .07))
    const sweep = osc(rate, glide(1400 * pitch, 500, .25))
    add(o, 0, .3, 0, .05 * g, t => sweep(t) * ad(t, .004, .08))
    o.short = .3; o.long = .12
    o.duck = [db(-4), .08, .4]
    return o
  }
  const w = weight(cue.hullDamage ?? 0), big = explosive.has(family), g = .4 + .6 * w
  const o = blank(rate, big ? 1.6 : 1.1)
  crunch(o, 0, big ? .32 : .18, 200 + r() * 600, (r() - .5) * .3, .32 * g, r)
  thump(o, 0, 90 * pitch, 50, .1, big ? .14 : .07, .3 * g)
  if (big) burst(o, 0, 1.3, 0, .32 * g, r, t => 2200 * Math.exp(-t * 2) + 180, 0, t => ad(t, .004, .22))
  for (let k = 0; k < 2; k++) {
    const f = 300 + r() * 600, c = osc(rate, glide(f, f * (.85 + r() * .1), .5))
    add(o, .03 + r() * .05, .6, (r() - .5), .03 * g, t => c(t) * Math.sin(Math.PI * Math.min(1, t / .5)) * (.7 + .3 * Math.sin(TAU * 23 * t)))
  }
  o.short = .35; o.long = big ? .25 : .12
  o.duck = [db(-5), .12, .5]
  return o
}

/** Ship loss in stages; size 0 (fighter) to 1 (capital/station). */
function death(size: number, rate: number, r: Rng): Sound {
  // Three shapes: one blast, a blast and a secondary, or a rolling chain.
  const shape = Math.floor(r() * 3), len = 3 + size * 2 + (shape === 2 ? .8 : 0), lead = .07, o = blank(rate, len + .2, lead)
  const g = .38 + .16 * size
  burst(o, 0, lead, 0, .12 * g, r, t => 800 + 6000 * t / lead, 2, t => (t / lead) ** 3)
  burst(o, lead, .02, 0, .45 * g, r, () => 7000, 2, t => ad(t, .0002, .004))
  sub(o, lead, (70 - size * 15) * (.85 + .3 * r()), 26 + r() * 8, (.9 + size * .8) * (.8 + .4 * r()), (.45 + size * .5) * (.8 + .4 * r()), .6 * g, 2 + r() * 2)
  fireball(o, lead, (.8 + .8 * size) * (.8 + .5 * r()), (r() - .5) * .4, 1.1 * g, r)
  const body = brown(r), bodyLp = svf(rate), bodyLen = (1.4 + size * 1.4) * (shape === 0 ? .5 + .4 * r() : .8 + .6 * r()), pitch = .8 + r() * .4
  add(o, lead, bodyLen * 1.6, (r() - .5) * .3, .55 * g, t => bodyLp(body(), 3000 * pitch * Math.exp(-t * 2.2 / bodyLen) + 180, .9, 0) * ad(t, .006, bodyLen / 3))
  const blasts = shape === 0 ? 0 : shape === 1 ? 1 : 2 + Math.floor(r() * 3)
  for (let k = 0, t2 = lead; k < blasts; k++) {
    t2 += .2 + r() * (shape === 2 ? .35 : .5)
    const pan = (r() - .5) * 1.2, h = g * (.5 + .4 * r())
    sub(o, t2, 55 + r() * 25, 30, .4, .25, .5 * h)
    fireball(o, t2, .5 + r() * .6, pan, 1.4 * h, r)
    burst(o, t2, .01, pan, .3 * h, r, () => 6000, 2, t => ad(t, .0003, .002))
  }
  crackle(o, lead + .05, 1.2 + size + r(), -.6, .35 * g, r, .03 + .04 * r())
  crackle(o, lead + .08, 1.2 + size + r(), .6, .35 * g, r, .03 + .04 * r())
  const debris = Math.round(15 + 20 * size * r() + 10 * r())
  for (let k = 0; k < debris; k++) {
    const t0 = lead + .1 + (len - .6) * r() ** 1.8, level = .04 * (1 - (t0 - lead) / len) + .01, pan = (r() - .5) * 1.8
    if (r() < .5) ring(o, t0, 1200 + r() * 4800, [1, 2.3], .02 + r() * .05, pan, level * .5, r)
    else burst(o, t0, .03, pan, level * 1.4, r, () => 2500 + r() * 3000, 1, t => ad(t, .0005, .006))
  }
  o.short = .25; o.long = .45
  o.duck = [db(-10), 1, 1.5]
  return o
}

function knockout(rate: number, r: Rng): Sound {
  // An arc discharge, a mains buzz collapsing, relay clunks, and a groan as the hull goes dark.
  const o = blank(rate, 2.4), arc = 2500 + r() * 2000, mains = 50 + r() * 20
  crackle(o, 0, .5 + r() * .4, -.3, .1, r, .08)
  crackle(o, .01, .5 + r() * .4, .3, .1, r, .08)
  const n = noise(r), bp = svf(rate), buzz = osc(rate, glide(mains * 2, mains * 1.2, 1), square)
  add(o, 0, 1.2, 0, .18, t => bp(n() * (buzz(t) > 0 ? 1 : .2), arc * (1 - .5 * Math.min(1, t)), .5, 1) * ad(t, .004, .3))
  const dark = svf(rate), fade = 1.5 + r() * 3
  add(o, .05, 1.6, 0, .25, t => dark(n(), 3000 * Math.exp(-t * fade) + 120, .8, 0) * ad(t, .01, 1 / fade))
  // Sometimes the hull arcs again before it goes dark.
  if (r() < .6) { const t2 = .35 + r() * .7; crackle(o, t2, .2 + r() * .3, (r() - .5), .12, r, .1); sub(o, t2, 70, 40, .1, .12, .25); fireball(o, t2, .3, 0, .2, r) }
  if (r() < .7) for (const d of [-4, 4]) {
    const f = 110 + r() * 60, groan = osc(rate, glide(f * 2 ** (d / 1200), f * .78, 1.2), saw), lp = svf(rate)
    add(o, .1, 1.6, d / 8, .07, t => Math.tanh(2 * lp(groan(t), 900, .7, 0)) * ad(t, .08, .5))
  }
  const clunks = 1 + Math.floor(r() * 2)
  for (let k = 0; k < clunks; k++) { const t0 = .3 + r() * .6; thump(o, t0, 100 + r() * 40, 55, .05, .07, .3); ring(o, t0, 260 + r() * 200, [1, 2.4, 3.9], .06, (r() - .5), .08, r) }
  sub(o, 0, 80, 40, .15, .15, .3)
  fireball(o, 0, .4 + r() * .3, (r() - .5) * .4, .3, r)
  o.short = .3; o.long = .35
  o.duck = [db(-8), .8, 1.2]
  return o
}

/** One small, far loss in a mass cascade: pitch, pan and distance of its own. */
function pop(kind: string, rate: number, r: Rng): Sound {
  const o = blank(rate, .7), pan = (r() - .5) * 1.8, pitch = .6 + r() * .9
  burst(o, 0, .01, pan, .6, r, () => 3000 + r() * 4000, 2, t => ad(t, .0003, .002))
  if (kind === 'knockout') {
    crackle(o, 0, .12 + r() * .12, pan, .35, r, .1)
    const zap = osc(rate, glide(1200 * pitch, 350 * pitch, .1))
    add(o, 0, .12, pan, .07, t => zap(t) * ad(t, .002, .03))
  } else fireball(o, 0, .2 + r() * .2, pan, .45, r)
  thump(o, 0, 140 * pitch, 70 * pitch, .05, .05, .2)
  lowpassAll(o, 1500 + r() * 5000)
  scale(o, db(-5 - r() * 8))
  o.short = .2; o.long = .2
  return o
}

function boarding(phase: CinemaAudioCue['boardingPhase'], step: number, rate: number, r: Rng): Sound {
  const o = blank(rate, 1.6), f = (170 + r() * 40) * 2 ** (Math.min(step, 8) / 12)
  const clank = (t0: number, pitch: number, pan: number, gain: number) => {
    ring(o, t0, pitch, [1, 2.31, 3.93, 5.1], .12, pan, .3 * gain, r)
    thump(o, t0, 110, 60, .05, .08, .4 * gain)
    burst(o, t0, .05, pan, .25 * gain, r, () => 3500, 1, t => ad(t, .0005, .01))
  }
  if (phase === 'approach' || phase === undefined) {
    burst(o, 0, .8, 0, .22, r, () => 1600, 0, t => Math.sin(Math.PI * Math.min(1, t / .8)))
    clank(.7, f, 0, 1)
  } else if (phase === 'breach') {
    for (let k = 0; k < 3; k++) clank(k * .17, f * (1 + k * .12), (k - 1) * .3, .9)
    burst(o, .5, .9, 0, .18, r, () => 4500, 2, t => ad(t, .02, .3))
  } else if (phase === 'assault') {
    for (let k = 0; k < 3; k++) { thump(o, k * (.13 + r() * .08), 95, 50, .05, .09, .4); burst(o, k * .15, .1, (r() - .5), .2, r, () => 700, 0, t => ad(t, .002, .03)) }
  } else {
    clank(0, f * 1.3, 0, .8)
    burst(o, .05, .8, 0, .18, r, t => 3000 - 2000 * t, 1, t => ad(t, .02, .25))
  }
  o.short = .4; o.long = .12
  return o
}

function capture(rate: number, r: Rng): Sound {
  // Magnetic clamps bite, the hull rings, pressure equalizes.
  const o = blank(rate, 2.2)
  for (const [k, t0] of [0, .12 + r() * .06].entries()) { sub(o, t0, 85 - k * 10, 42, .15, .22, .3); ring(o, t0, (130 + r() * 30) * (1 + k * .19), [1, 2.31, 3.93, 5.1, 6.7], .3, (k - .5) * .6, .12, r) }
  burst(o, 0, .012, 0, .3, r, () => 6500, 2, t => ad(t, .0003, .003))
  burst(o, .25, 1.4, 0, .18, r, t => 5000 - 2500 * t, 2, t => ad(t, .05, .4))
  o.short = .4; o.long = .4
  o.duck = [db(-6), .3, 1]
  return o
}

function arrival(rate: number, r: Rng, wave: number, order: number): Sound {
  // The riser is one of three kinds; a bigger wave lands harder, later waves are briefer.
  const lead = .6, size = Math.min(1, Math.log2(wave) / 3), brief = order > 2 ? .6 : 1, o = blank(rate, lead + 1.6 * brief)
  const pitch = 1 + (r() - .5) * .3, kind = Math.floor(r() * 3), g = db(-1.5 * Math.min(order, 4)) * (.8 + .4 * size)
  if (kind === 0) { const rise = osc(rate, glide(180 * pitch, 1500 * pitch, lead)); add(o, 0, lead, 0, .16 * g, t => rise(t) * (t / lead) ** 2) }
  if (kind === 2) for (const m of [1, 1.5, 2.02]) { const rise = osc(rate, glide(400 * pitch * m, 1200 * pitch * m, lead)); add(o, 0, lead, (m - 1.5), .05 * g, t => rise(t) * (t / lead) ** 3) }
  burst(o, 0, lead, 0, (kind === 1 ? .45 : .3) * g, r, glide(300 * pitch, 5000, lead), 1, t => (t / lead) ** 2.5, .5)
  sub(o, lead, (80 + r() * 40) * (1 - .2 * size), 40, .25, .2 + .15 * size, .45 * g)
  burst(o, lead, 1.2 * brief, 0, .35 * g, r, t => 3500 * Math.exp(-t * 3) + 200, 0, t => ad(t, .004, .2 * brief))
  ring(o, lead, 700 * pitch, [1, 1.5, 2.02], .5 * brief, 0, .03 * g, r)
  o.short = .2; o.long = .4
  return o
}

function accent(kind: string, rate: number, r: Rng): Sound {
  const o = blank(rate, 1.5)
  if (kind === 'escape') {
    const d = osc(rate, glide(900, 250, 1)), lp = svf(rate)
    add(o, 0, 1.2, 0, .08, t => d(t) * ad(t, .05, .4))
    burst(o, 0, 1.2, 0, .2, r, glide(3500, 300, 1), 0, t => ad(t, .04, .35))
  } else if (kind === 'repair') {
    for (const [k, f] of [660, 990].entries()) { const c = osc(rate, () => f); add(o, k * .12, .8, 0, .05, t => c(t) * ad(t, .01, .25)) }
  } else if (kind === 'drain') {
    const w = osc(rate, glide(600, 90, .9)); add(o, 0, 1, 0, .08, t => w(t) * (1 + .5 * Math.sin(TAU * 9 * t)) * ad(t, .08, .3))
  } else if (kind === 'cloak') {
    const s = osc(rate, glide(2200, 400, 1)); add(o, 0, 1.2, 0, .05, t => s(t) * ad(t, .05, .35))
  } else if (kind === 'contact') {
    burst(o, 0, .2, 0, .3, r, () => 3000, 1, t => ad(t, .001, .03) * (r() < .3 ? 1 : .2))
  } else {
    for (let k = 0; k < 3; k++) burst(o, k * .09, .08, 0, .25, r, () => 2400, 1, t => ad(t, .001, .02))
  }
  o.short = .2; o.long = .1
  return o
}

/** Renders one scheduled cue. `size` is hull scale 0..1; distant cues are duller and quieter. */
export function renderCue(cue: CinemaAudioCue, rate: number, size = 0, seed = 0): Sound | undefined {
  const r = seeded(hashString(cue.id) ^ seed)
  const weapon = cue.kind === 'weapon'
  const family = cue.weaponFamily ?? resolveWeaponFamily(cue.weaponName, cue.damageType)
  const contact = weapon && (cue.audioPhase === 'contact' || cue.secondaryKind === 'retaliation' || /galvanic hull grid/i.test(cue.weaponName ?? ''))
  const o = contact ? accent('contact', rate, r)
    : weapon ? (cue.audioPhase === 'impact' || cue.audioPhase === 'shield-impact' || cue.audioPhase === 'miss' ? impact(cue, family, rate, r) : release(family, cue, rate, r))
    : cue.audioCascade ? pop(cue.kind, rate, r)
    : cue.kind === 'death' ? death(Math.max(size, (cue.audioMass ?? 1) >= 8 ? .9 : 0), rate, r)
    : cue.kind === 'knockout' ? knockout(rate, r)
    : cue.kind === 'capture' ? capture(rate, r)
    : cue.kind === 'boarding' ? boarding(cue.boardingPhase, cue.audioStep ?? 0, rate, r)
    : cue.kind === 'arrival' ? arrival(rate, r, cue.audioMass ?? 1, cue.audioStep ?? 0)
    : cue.kind === 'burn' ? undefined
    : accent(cue.kind, rate, r)
  if (!o) return
  if ((cue.audioMass ?? 1) > 1 && (cue.kind === 'death' || cue.kind === 'knockout')) {
    // Many losses at once: a bigger, wider blow and a rolling tail sized by the count.
    const extra = Math.min(1, Math.log2(cue.audioMass!) / 6), roll = brown(r), lp = svf(rate), len = Math.min(3, o.l.length / rate - .3)
    sub(o, o.lead, 60, 28, 1.2, .8, .5 * extra, 3)
    fireball(o, o.lead, 1.4, -.5, .35 * extra, r); fireball(o, o.lead + .03, 1.4, .5, .35 * extra, r)
    add(o, .25, len, 0, .4 * extra, t => lp(roll(), 900, 1, 0) * Math.sin(Math.PI * Math.min(1, t / len)) * (.6 + .4 * Math.sin(TAU * 2.3 * t)))
  }
  if (cue.audioDistant && !cue.audioCascade) {
    lowpassAll(o, 1400)
    scale(o, db(cue.kind === 'death' || cue.kind === 'knockout' ? -7 : -9))
    o.long = Math.min(.8, o.long * 1.8 + .1); o.short *= .5
    if (o.duck) o.duck = [Math.sqrt(o.duck[0]), o.duck[1], o.duck[2]]
  }
  return o
}

// ---- Score instruments -------------------------------------------------------

/** Renders one score event. Notes are band-limited and wide; the low end stays mono. */
export function renderNote(note: ScoreNote, fullRate: number): Sound {
  // Tonal parts carry nothing above a quarter of the output rate; render them at half.
  const rate = note.instrument === 'hat' || note.instrument === 'snare' || note.instrument === 'tick' ? fullRate : fullRate / 2
  const r = seeded(hashString(`${note.instrument}:${note.time.toFixed(3)}:${note.pitches.join(',')}`))
  const v = clamp(note.velocity, 0, 1), dur = Math.max(.02, note.duration), pan = note.pan ?? 0
  switch (note.instrument) {
    case 'pad': {
      const rel = 1.4, o = blank(rate, dur + rel), attack = Math.min(dur * .5, .4 + (1 - v) * .9)
      const env = (t: number) => Math.min(1, t / attack) * (t < dur ? 1 : Math.exp(-(t - dur) / (rel / 3)))
      for (const d of [-1, 1]) {
        const voices = note.pitches.map((m, i) => { const f = hz(m) * 2 ** (d * 6 / 1200), rate2 = .3 + i * .07; return osc(rate, t => f * (1 + .002 * Math.sin(TAU * rate2 * t)), saw, r()) })
        const lp = svf(rate)
        let hp = 0
        add(o, 0, dur + rel, d * .6, .05 * v, t => {
          let x = 0
          for (const voice of voices) x += voice(t)
          x = lp(x, 450 + 1500 * v + 250 * Math.sin(TAU * .15 * t), .8, 0)
          hp += (x - hp) * (TAU * 120 / rate)
          return (x - hp) * env(t)
        })
      }
      return o
    }
    case 'bass': {
      const o = blank(rate, dur + .2), f = hz(note.pitches[0]), a = osc(rate, () => f, saw), s = osc(rate, () => f), lp = svf(rate)
      add(o, 0, dur + .2, 0, .22 * v, t => (lp(a(t), 180 + 900 * v * Math.exp(-t * 14), .6, 0) + .2 * s(t)) * .75 * Math.min(1, t / .004) * (t < dur ? Math.exp(-t * 2) : Math.exp(-dur * 2 - (t - dur) * 30)))
      return o
    }
    case 'pulse': {
      const o = blank(rate, dur + .1), f = hz(note.pitches[0]), a = osc(rate, () => f, saw), b = osc(rate, () => f * 1.004, square), lp = svf(rate)
      const bright = note.bright ?? v
      add(o, 0, dur + .1, pan, .13 * v, t => lp(a(t) * .7 + b(t) * .3, 300 + 3700 * bright * (.35 + .65 * Math.exp(-t * 25)), .5, 0) * Math.min(1, t / .003) * Math.exp(-t / Math.max(.05, dur * .8)))
      return o
    }
    case 'kick': {
      const o = blank(rate, .45)
      thump(o, 0, 150, 45, .08, .12, .4 * v)
      burst(o, 0, .01, 0, .2 * v, r, () => 4000, 1, t => ad(t, .0003, .002))
      return o
    }
    case 'hat': {
      const o = blank(rate, .2)
      burst(o, 0, .18, pan, .1 * v, r, () => 7000, 2, t => ad(t, .0008, dur > .1 ? .05 : .014), .9)
      return o
    }
    case 'drum': {
      const o = blank(rate, 1.2)
      thump(o, 0, 115, 62, .12, .28, .55 * v)
      burst(o, 0, .08, pan, .22 * v, r, () => 380, 1, t => ad(t, .002, .03))
      o.long = .35
      return o
    }
    case 'snare': {
      const o = blank(rate, .4)
      burst(o, 0, .3, pan, .22 * v, r, () => 2400, 1, t => ad(t, .001, .07), .7)
      thump(o, 0, 220, 170, .03, .04, .15 * v)
      o.short = .3
      return o
    }
    case 'horn': case 'fanfare': {
      const rel = .35, o = blank(rate, dur + rel)
      const env = (t: number) => Math.min(1, t / .06) * (t < dur ? 1 - .15 * Math.min(1, t) : Math.exp(-(t - dur) / (rel / 3)) * .85)
      for (const d of [-7, 7]) {
        const voices = note.pitches.flatMap(m => [d, 0].map(c => osc(rate, t => hz(m) * 2 ** (c / 1200) * (1 + .004 * Math.sin(TAU * 5.2 * t) * Math.min(1, Math.max(0, t - .3) * 2)), saw, r())))
        const lp = svf(rate)
        add(o, 0, dur + rel, d / 14, .06 * v, t => {
          let x = 0
          for (const voice of voices) x += voice(t)
          return lp(x, 250 + (500 + 2300 * v) * Math.min(1, t / .12) * (t < dur ? 1 : .6), .7, 0) * env(t)
        })
      }
      o.long = .5
      return o
    }
    case 'bell': {
      const o = blank(rate, dur + 2.5)
      note.pitches.forEach(m => {
        const f = hz(m), mod = osc(rate, () => f * 3.5)
        let ph = r()
        add(o, 0, dur + 2.5, pan, .08 * v, t => { ph = (ph + f * (1 + 2.5 * Math.exp(-t * 4) * mod(t) * .3) / rate) % 1; return Math.sin(TAU * ph) * ad(t, .002, .9) })
      })
      o.long = .7
      return o
    }
    case 'tick': {
      const o = blank(rate, .1), c = osc(rate, () => hz(note.pitches[0]))
      add(o, 0, .08, pan, .05 * v, t => c(t) * ad(t, .001, .012))
      o.short = .4
      return o
    }
    case 'hit': {
      const o = blank(rate, 3.5)
      for (const d of [-9, 9]) {
        const voices = note.pitches.flatMap(m => [d, 0].map(c => osc(rate, () => hz(m) * 2 ** (c / 1200), saw, r()))), lp = svf(rate)
        add(o, 0, 3, d / 12, .07 * v, t => {
          let x = 0
          for (const voice of voices) x += voice(t)
          return lp(x, 300 + 3500 * Math.exp(-t * 2.5), .7, 0) * ad(t, .004, .7)
        })
      }
      thump(o, 0, 100, 40, .25, .45, .7 * v)
      burst(o, 0, 2.5, 0, .3 * v, r, t => 5000 * Math.exp(-t * 3) + 300, 0, t => ad(t, .002, .4))
      o.long = .6
      return o
    }
    case 'swell': {
      const o = blank(rate, dur + .02)
      burst(o, 0, dur, 0, .25 * v, r, t => 1500 + 6000 * (t / dur), 2, t => (t / dur) ** 3, .8)
      const voices = note.pitches.map(m => osc(rate, () => hz(m), saw, r())), lp = svf(rate)
      add(o, 0, dur, 0, .06 * v, t => { let x = 0; for (const voice of voices) x += voice(t); return lp(x, 300 + 3000 * (t / dur) ** 2, .7, 0) * (t / dur) ** 2.5 })
      o.long = .5
      return o
    }
    case 'riser': default: {
      const o = blank(rate, dur + .05)
      burst(o, 0, dur, 0, .14 * v, r, glide(300, 5000, dur), 1, t => (t / dur) ** 2, .45)
      const s = osc(rate, glide(hz(note.pitches[0] ?? 60), hz((note.pitches[0] ?? 60) + 12), dur))
      add(o, 0, dur, 0, .03 * v, t => s(t) * (t / dur) ** 2)
      o.long = .4
      return o
    }
  }
}

/** Synthetic stereo hall: decorrelated noise with an exponential, darkening decay. */
export function impulseResponse(rate: number, seconds: number, seed: number): [Float32Array, Float32Array] {
  const r = seeded(seed), n = Math.ceil(rate * seconds)
  return [0, 1].map(() => {
    const ch = new Float32Array(n)
    let y = 0
    for (let i = 0; i < n; i++) {
      const t = i / rate, a = Math.exp(-TAU * (9000 * Math.exp(-t * 2.5 / seconds) + 500) / rate)
      y = y * a + (r() * 2 - 1) * (1 - a)
      ch[i] = y * Math.exp(-6.9 * t / seconds) * Math.min(1, t / .01)
    }
    // Unit energy: the send level alone sets how wet a sound is.
    const norm = 1 / Math.sqrt(ch.reduce((sum, v) => sum + v * v, 0) || 1)
    return ch.map(v => v * norm)
  }) as [Float32Array, Float32Array]
}
