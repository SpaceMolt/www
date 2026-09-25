import { describe, expect, it } from 'bun:test'
import { impulseResponse, renderCue, renderNote, type Sound } from './synth'
import type { CinemaAudioCue } from './audioSchedule'
import type { Instrument } from './score'

const rate = 32000
const rms = (s: Sound, from = 0, to = s.l.length / s.rate) => {
  let e = 0, n = 0
  for (let i = Math.round(from * s.rate); i < Math.min(s.l.length, to * s.rate); i++, n++) e += (s.l[i] ** 2 + s.r[i] ** 2) / 2
  return 10 * Math.log10(e / Math.max(1, n) + 1e-12)
}
const peak = (s: Sound) => s.l.reduce((m, v, i) => Math.max(m, Math.abs(v), Math.abs(s.r[i])), 0)
/** Zero-crossing rate as a cheap brightness measure. */
const brightness = (s: Sound) => { let z = 0; for (let i = 1; i < s.l.length; i++) if ((s.l[i] > 0) !== (s.l[i - 1] > 0)) z++; return z / s.l.length }
const corr = (a: Float32Array, b: Float32Array) => {
  const n = Math.min(a.length, b.length); let ab = 0, aa = 0, bb = 0
  for (let i = 0; i < n; i++) { ab += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2 }
  return ab / Math.sqrt(aa * bb)
}
const cue = (fields: Partial<CinemaAudioCue>): CinemaAudioCue => ({ id: 'c', time: 0, duration: .5, tick: 1, kind: 'weapon', from: 'a', to: 'b', hit: true, intensity: .7, ...fields })

describe('cinema synthesis', () => {
  it('is deterministic per cue and varies between shots of the same weapon', () => {
    const a = renderCue(cue({ weaponFamily: 'autocannon', audioPhase: 'release' }), rate)!
    expect(renderCue(cue({ weaponFamily: 'autocannon', audioPhase: 'release' }), rate)!.l).toEqual(a.l)
    const b = renderCue(cue({ id: 'other', weaponFamily: 'autocannon', audioPhase: 'release' }), rate)!
    expect(Math.abs(corr(a.l, b.l))).toBeLessThan(.6)
  })

  it('gives every weapon family a distinct, bounded, audible launch', () => {
    const families = ['laser', 'beam', 'railgun', 'autocannon', 'flak', 'plasma', 'missile', 'torpedo', 'disruptor', 'exotic', 'mine', 'kinetic', 'smartbomb'] as const
    const sounds = families.map(weaponFamily => renderCue(cue({ weaponFamily, audioPhase: 'release' }), rate)!)
    for (const s of sounds) { expect(peak(s)).toBeLessThan(1.5); expect(rms(s)).toBeGreaterThan(-60) }
    for (let i = 0; i < sounds.length; i++) for (let j = i + 1; j < sounds.length; j++) expect(Math.abs(corr(sounds[i].l, sounds[j].l))).toBeLessThan(.8)
    expect(renderCue(cue({ weaponFamily: 'beam', audioPhase: 'release', duration: 2.5 }), rate)!.l.length / rate).toBeGreaterThan(2.5)
  })

  it('separates shield, hull and miss, scales hits by damage, and plays the shot\'s subject and target hot', () => {
    const hull = renderCue(cue({ audioPhase: 'impact', hullDamage: 30 }), rate)!
    const shield = renderCue(cue({ audioPhase: 'shield-impact', shieldDamage: 30 }), rate)!
    const miss = renderCue(cue({ audioPhase: 'miss' }), rate)!
    expect(brightness(shield)).toBeGreaterThan(brightness(hull) * 1.3)
    expect(rms(miss, 0, .4)).toBeLessThan(rms(hull, 0, .4) - 10)
    expect(rms(renderCue(cue({ audioPhase: 'impact', hullDamage: 120 }), rate)!, 0, .3)).toBeGreaterThan(rms(renderCue(cue({ audioPhase: 'impact', hullDamage: 3 }), rate)!, 0, .3) + 4)
    const hot = renderCue(cue({ weaponFamily: 'laser', audioPhase: 'release', audioHot: true }), rate)!
    const warm = renderCue(cue({ weaponFamily: 'laser', audioPhase: 'release' }), rate)!
    expect(rms(hot)).toBeGreaterThan(rms(warm) + 5)
    const heavy = renderCue(cue({ weaponFamily: 'railgun', audioPhase: 'release', audioHot: true }), rate)!
    expect(rms(heavy, 0, .3)).toBeGreaterThan(rms(hot, 0, .3))
  })

  it('makes every ship loss different, longer and heavier on bigger hulls, with a pre-roll before the blast', () => {
    const deaths = [0, 1, 2, 3, 4].map(i => renderCue(cue({ id: `loss:${i}`, kind: 'death' }), rate, .3)!)
    for (let i = 0; i < deaths.length; i++) for (let j = i + 1; j < deaths.length; j++) expect(Math.abs(corr(deaths[i].l, deaths[j].l))).toBeLessThan(.5)
    const small = renderCue(cue({ kind: 'death' }), rate, 0)!, big = renderCue(cue({ kind: 'death' }), rate, 1)!
    expect(big.l.length).toBeGreaterThan(small.l.length * 1.4)
    expect(rms(big, .5, 2.5)).toBeGreaterThan(rms(small, .5, 2.5))
    expect(small.lead).toBeGreaterThan(0)
    expect(peak(big)).toBeLessThan(2.5)
    const cascade = renderCue(cue({ kind: 'death', audioMass: 40 }), rate, 0)!
    expect(rms(cascade, 1, 3)).toBeGreaterThan(rms(small, 1, 3) + 3)
  })

  it('renders distant events quieter and duller', () => {
    const near = renderCue(cue({ kind: 'death' }), rate)!, far = renderCue(cue({ kind: 'death', audioDistant: true }), rate)!
    expect(rms(far, 0, 1.5)).toBeLessThan(rms(near, 0, 1.5) - 2)
    expect(far.l.length).toBeLessThan(near.l.length)
    expect(brightness(far)).toBeLessThan(brightness(near))
  })

  it('gives knockouts, captures, boarding and arrivals their own sounds', () => {
    const kinds = [cue({ kind: 'knockout' }), cue({ kind: 'capture' }), cue({ kind: 'boarding', boardingPhase: 'breach' }), cue({ kind: 'arrival' }), cue({ kind: 'escape' })]
    const sounds = kinds.map(k => renderCue(k, rate)!)
    for (const s of sounds) expect(rms(s)).toBeGreaterThan(-45)
    for (let i = 0; i < sounds.length; i++) for (let j = i + 1; j < sounds.length; j++) expect(Math.abs(corr(sounds[i].l, sounds[j].l))).toBeLessThan(.5)
    expect(renderCue(cue({ kind: 'burn' }), rate)).toBeUndefined()
  })

  it('renders every score instrument finite and bounded, and a unit-energy reverb', () => {
    for (const instrument of ['pad', 'bass', 'pulse', 'kick', 'hat', 'drum', 'snare', 'horn', 'lead', 'fanfare', 'bell', 'tick', 'hit', 'swell', 'riser'] as Instrument[]) {
      const s = renderNote({ time: 0, duration: .8, instrument, pitches: [55, 62, 67], velocity: .8 }, rate)
      expect(peak(s)).toBeLessThan(1.5)
      expect(Number.isFinite(rms(s))).toBe(true)
      expect(rms(s)).toBeGreaterThan(-70)
    }
    const [l, r] = impulseResponse(rate, 1, 3)
    expect(l.reduce((sum, v) => sum + v * v, 0)).toBeCloseTo(1, 3)
    expect(Math.abs(corr(l, r))).toBeLessThan(.2)
  })

  it('varies the loudness contour of repeated losses and arrivals, and shortens later waves', () => {
    const contour = (s: Sound) => Array.from({ length: 15 }, (_, k) => rms(s, k * .1, k * .1 + .1))
    const pearson = (a: number[], b: number[]) => { const m = (x: number[]) => x.reduce((p, v) => p + v, 0) / x.length, ma = m(a), mb = m(b); let ab = 0, aa = 0, bb = 0; a.forEach((v, i) => { ab += (v - ma) * (b[i] - mb); aa += (v - ma) ** 2; bb += (b[i] - mb) ** 2 }); return ab / Math.sqrt(aa * bb) }
    for (const kind of ['death', 'knockout'] as const) {
      const shapes = [0, 1, 2, 3, 4, 5].map(i => contour(renderCue(cue({ id: `${kind}:${i}`, kind }), rate, .3)!))
      const cors = shapes.flatMap((a, i) => shapes.slice(i + 1).map(b => pearson(a, b)))
      expect(Math.min(...cors)).toBeLessThan(.9)
    }
    const first = renderCue(cue({ kind: 'arrival', audioStep: 0, audioMass: 4 }), rate)!, late = renderCue(cue({ kind: 'arrival', audioStep: 5 }), rate)!
    expect(late.l.length).toBeLessThan(first.l.length)
    expect(rms(late)).toBeLessThan(rms(first) - 3)
  })

  it('builds weapon launches from noise as well as tone, and a mass loss from many small pops', () => {
    const flatness = (s: Sound) => { const n = Math.round(.1 * s.rate), x = Array.from(s.l.slice(0, n)); let lin = 0, log = 0; const bins = 64; for (let k = 1; k <= bins; k++) { let re = 0, im = 0; x.forEach((v, i) => { re += v * Math.cos(Math.PI * k * i / bins); im += v * Math.sin(Math.PI * k * i / bins) }); const p = re * re + im * im + 1e-12; lin += p; log += Math.log(p) } return Math.exp(log / bins) / (lin / bins) }
    expect(flatness(renderCue(cue({ weaponFamily: 'laser', audioPhase: 'release' }), rate)!)).toBeGreaterThan(.01)
    const pops = [0, 1, 2].map(i => renderCue(cue({ id: `p${i}`, kind: 'knockout', audioCascade: 'pop', audioDistant: true }), rate)!)
    for (const p of pops) expect(p.l.length / rate).toBeLessThan(1)
    expect(Math.abs(corr(pops[0].l, pops[1].l))).toBeLessThan(.5)
    const lead = renderCue(cue({ kind: 'knockout', audioMass: 100 }), rate)!, single = renderCue(cue({ kind: 'knockout' }), rate)!
    expect(rms(lead, 0, 1)).toBeGreaterThan(rms(single, 0, 1) + 3)
  })
})
