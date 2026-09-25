import { describe, expect, it } from 'bun:test'
import { composeScore, filmResolution } from './score'
import type { CinemaFilm } from './types'

const ship = (id: string, sideId: number, fate: CinemaFilm['ships'][number]['fate']) =>
  ({ id, playerId: id, name: id, shipClass: 'x', kind: 'ship', sideId, sideIndex: 0, start: 0, end: 20, fate, health: [] })
const film = (overrides: Partial<CinemaFilm> = {}): CinemaFilm => ({
  version: 1, battleId: 'b', seed: 7, duration: 20, arena: false, outcome: 'victory', winningSide: 2, systemName: 's',
  ships: [ship('hero', 2, 'survived'), ship('foe', 1, 'destroyed')],
  shots: [
    { start: 0, end: 2.5, kind: 'reveal', role: 'geography', intensity: .12 },
    { start: 2.5, end: 9, kind: 'broadside', role: 'fire', intensity: .5, subject: 'hero', target: 'foe' },
    { start: 9, end: 14, kind: 'impact', role: 'impact', intensity: 1, subject: 'foe', target: 'hero' },
    { start: 14, end: 20, kind: 'aftermath', role: 'resolution', intensity: .12 },
  ],
  story: { protagonistId: 'hero', adversaryId: 'foe', climaxCueId: 'loss', sequences: [
    { id: 's0', start: 2.5, end: 9, kind: 'confrontation', actionTime: 3, impactTime: 3.5 },
    { id: 's1', start: 9, end: 14, kind: 'climax', actionTime: 9.5, impactTime: 11 },
  ] },
  cues: [
    { id: 'gun', time: 3, duration: .5, tick: 1, kind: 'weapon', from: 'hero', to: 'foe', hit: true, hullDamage: 10, intensity: .5 },
    { id: 'loss', time: 11, duration: 3, tick: 2, kind: 'death', to: 'foe', intensity: 1 },
  ],
  segments: [],
  ...overrides,
})

describe('cinema score', () => {
  it('is a pure function of the film, and different seeds choose different keys, tempi and motifs', () => {
    expect(composeScore(film())).toEqual(composeScore(film()))
    const openings = new Set<string>()
    for (let seed = 0; seed < 12; seed++) {
      const notes = composeScore(film({ seed: seed * 7919 }))
      openings.add(JSON.stringify(notes.filter(note => note.instrument === 'pulse').slice(0, 6).map(note => [note.pitches, note.time.toFixed(2)])))
    }
    expect(openings.size).toBeGreaterThanOrEqual(10)
  })

  it('keeps the setup sparse: no percussion or ostinato before the first action', () => {
    const notes = composeScore(film())
    expect(notes.filter(note => note.time < 2.4 && ['kick', 'drum', 'pulse', 'hat', 'snare', 'bass'].includes(note.instrument))).toHaveLength(0)
    expect(notes.some(note => note.time < 2.5 && note.instrument === 'pad')).toBe(true)
  })

  it('builds toward the climax, clears the music before it, and lands a hit on the decisive event', () => {
    const notes = composeScore(film())
    const hit = notes.find(note => note.instrument === 'hit')!
    expect(hit.time).toBeCloseTo(11)
    const drop = notes.find(note => note.instrument === 'drop')!
    expect(drop.time + drop.duration).toBeCloseTo(11)
    const band = ['pulse', 'kick', 'drum', 'hat', 'bass', 'pad', 'horn']
    expect(notes.filter(note => band.includes(note.instrument) && note.time >= drop.time - 1e-6 && note.time < 11)).toHaveLength(0)
    const early = notes.filter(note => note.time >= 2.5 && note.time < 6 && ['kick', 'drum', 'hat'].includes(note.instrument)).length
    const late = notes.filter(note => note.time >= 6 && note.time < drop.time && ['kick', 'drum', 'hat'].includes(note.instrument)).length
    expect(late / Math.max(1, drop.time - 6)).toBeGreaterThan(early / 3.5)
    expect(Math.max(...notes.map(note => note.time))).toBeLessThan(22.4)
  })

  it('resolves to fit the outcome', () => {
    const final = (f: CinemaFilm) => { const notes = composeScore(f); return notes.filter(note => note.instrument === 'pad').at(-1)! }
    const third = (f: CinemaFilm) => { const pad = final(f), low = Math.min(...pad.pitches); return pad.pitches.map(p => (p - low) % 12) }
    expect(filmResolution(film())).toBe('victory')
    expect(filmResolution(film({ winningSide: 1 }))).toBe('defeat')
    expect(filmResolution(film({ ships: [ship('hero', 2, 'destroyed'), ship('foe', 1, 'destroyed')] }))).toBe('mutual')
    expect(filmResolution(film({ outcome: 'stalemate' }))).toBe('stalemate')
    const captured = film({ cues: [...film().cues.slice(0, 1), { id: 'loss', time: 11, duration: 1, tick: 2, kind: 'capture', from: 'hero', to: 'foe', intensity: 1 }] })
    expect(filmResolution(captured)).toBe('capture')
    // A major tonic ends a victory; a defeat stays minor.
    expect(third(film()).some(interval => interval === 4)).toBe(true)
    expect(third(film({ winningSide: 1 })).some(interval => interval === 4)).toBe(false)
    expect(composeScore(captured).filter(note => note.instrument === 'horn' && note.time > 12).length).toBeGreaterThanOrEqual(5)
  })

  it('answers each reinforcement wave with a stab on the beat', () => {
    const base = film()
    const arrival = film({ ships: [...base.ships, ship('ally', 2, 'survived')], cues: [...base.cues, { id: 'warp', time: 6, duration: 1, tick: 1, kind: 'arrival', to: 'ally', intensity: .5 }] })
    const extra = composeScore(arrival).filter(note => note.instrument === 'horn' && note.time >= 6 && note.time < 6.6)
    expect(extra.length).toBeGreaterThan(0)
  })

  it('introduces each principal with a leitmotif before the first shot is fired', () => {
    const base = film()
    const intro = film({ shots: [
      { start: 0, end: 1.4, kind: 'reveal', role: 'geography', intensity: .12 },
      { start: 1.4, end: 2.5, kind: 'tracking', role: 'introduction', intensity: .2, subject: 'hero' },
      { start: 2.5, end: 3.6, kind: 'tracking', role: 'introduction', intensity: .2, subject: 'foe' },
      ...base.shots.slice(1).map(shot => ({ ...shot, start: Math.max(3.6, shot.start) })),
    ], cues: base.cues.map(cue => cue.kind === 'weapon' ? { ...cue, time: 3.8 } : cue) })
    const notes = composeScore(intro)
    expect(notes.some(note => note.instrument === 'horn' && note.time >= 1.4 && note.time < 2.5)).toBe(true)
    expect(notes.some(note => note.instrument === 'horn' && note.time >= 2.5 && note.time < 3.6 && note.pitches.length === 2)).toBe(true)
    expect(notes.filter(note => note.instrument === 'pulse' && note.time < 3.55)).toHaveLength(0)
  })

  it('develops a long battle in sections instead of looping one texture', () => {
    const base = film()
    const long = film({ duration: 130, shots: [base.shots[0], { ...base.shots[1], end: 120 }, { ...base.shots[3], start: 120, end: 130 }],
      cues: [base.cues[0], { ...base.cues[1], time: 118 }] })
    const notes = composeScore(long).filter(note => note.time > 3 && note.time < 110)
    // Breakdowns: stretches of several seconds with the drums out.
    const kicks = notes.filter(note => note.instrument === 'kick').map(note => note.time)
    expect(Math.max(...kicks.slice(1).map((time, i) => time - kicks[i]))).toBeGreaterThan(5)
    const shapes = new Set<string>()
    for (let start = 5; start < 105; start += 16) shapes.add(JSON.stringify(notes.filter(note => note.instrument === 'pulse' && note.time >= start && note.time < start + 4).map(note => note.pitches[0] - notes.find(n => n.instrument === 'pulse' && n.time >= start)!.pitches[0])))
    expect(shapes.size).toBeGreaterThanOrEqual(3)
  })
})
