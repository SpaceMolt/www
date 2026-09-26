import { describe, expect, it } from 'bun:test'
import { ARRIVAL_LEAD, audioCueRange, buildAudioSchedule } from './audioSchedule'
import type { CinemaCue, CinemaShot } from './types'

const weapon: CinemaCue = { id: 'gun', time: 10, duration: 2.8, tick: 4, kind: 'weapon', from: 'a', to: 'b', hit: true, hullDamage: 12, shieldDamage: 0, intensity: .7, weaponFamily: 'missile' }

describe('cinema audio choreography', () => {
  it('places a long missile flight release and hull impact at their visible events, panned to each endpoint', () => {
    const schedule = buildAudioSchedule([weapon])
    expect(schedule.map(cue => [cue.audioPhase, cue.time, cue.audioActorId])).toEqual([
      ['release', 10, 'a'], ['impact', 12.8, 'b'],
    ])
  })

  it('separates the railgun charge from the visible halfway release and terminal impact', () => {
    const schedule = buildAudioSchedule([{ ...weapon, weaponFamily: 'railgun' }])
    expect(schedule.map(cue => [cue.audioPhase, cue.time])).toEqual([
      ['charge', 10], ['release', 11.4], ['impact', 12.8],
    ])
    expect(schedule[0].duration).toBeCloseTo(1.4)
  })

  it('gives absorbed/shield hits an impact and a miss a passing whoosh at the target', () => {
    expect(buildAudioSchedule([{ ...weapon, hit: false }]).map(cue => [cue.audioPhase, cue.audioActorId])).toEqual([['release', 'a'], ['miss', 'b']])
    for (const shieldDamage of [0, 20]) {
      expect(buildAudioSchedule([{ ...weapon, hullDamage: 0, shieldDamage }]).at(-1)?.audioPhase).toBe('shield-impact')
    }
  })

  it('emits one contact discharge at impact and never adds a second release or hit', () => {
    const schedule = buildAudioSchedule([{ ...weapon, weaponName: 'Galvanic Hull Grid' }])
    expect(schedule.map(cue => [cue.audioPhase, cue.time])).toEqual([['contact', 12.8]])
    expect(buildAudioSchedule([{ ...weapon, secondaryKind: 'retaliation', hit: false }])).toHaveLength(0)
  })

  it('lets a simultaneous death own the final boom and bounds a six-gun volley to one victim impact', () => {
    const guns = Array.from({ length: 6 }, (_, index) => ({ ...weapon, id: `gun:${index}`, weaponFamily: index ? 'laser' as const : 'torpedo' as const }))
    const schedule = buildAudioSchedule(guns)
    expect(schedule.filter(cue => cue.audioPhase === 'impact')).toHaveLength(1)
    expect(schedule.find(cue => cue.audioPhase === 'impact')?.weaponFamily).toBe('torpedo')
    // A loss within 0.3 s owns the boom; one a second later leaves the hit audible.
    const death: CinemaCue = { id: 'loss', kind: 'death', time: 13.0, duration: 3.5, tick: 4, to: 'b', intensity: 1 }
    expect(buildAudioSchedule([...guns, death]).filter(cue => cue.audioPhase === 'impact')).toHaveLength(0)
    expect(buildAudioSchedule([...guns, { ...death, time: 13.9 }]).filter(cue => cue.audioPhase === 'impact')).toHaveLength(1)
    expect(buildAudioSchedule([...guns, death]).filter(cue => cue.kind === 'death')).toHaveLength(1)
    expect(buildAudioSchedule([{ ...weapon, parentId: 'other' }])).toHaveLength(0)
  })

  it('keeps source records immutable and emits charge/release/impact once across playback frame boundaries', () => {
    const source = { ...weapon, weaponFamily: 'railgun' as const }
    const before = JSON.stringify(source)
    const schedule = buildAudioSchedule([source])
    const emitted = [...audioCueRange(schedule, 0, 10), ...audioCueRange(schedule, 10, 11.4), ...audioCueRange(schedule, 11.4, 12.8), ...audioCueRange(schedule, 12.8, 14)]
    expect(emitted.map(cue => cue.audioPhase)).toEqual(['charge', 'release', 'impact'])
    expect(new Set(emitted.map(cue => cue.id)).size).toBe(3)
    expect(JSON.stringify(source)).toBe(before)
  })

  it('staggers simultaneous losses; a mass loss is one blow, wide detonations, then a rain of pops', () => {
    const losses: CinemaCue[] = Array.from({ length: 100 }, (_, i) => ({ id: `ko:${i}`, kind: 'knockout', time: 5, duration: 1, tick: 3, to: `s${i}`, intensity: 1 }))
    const schedule = buildAudioSchedule(losses)
    expect(schedule[0].audioMass).toBe(100)
    const detonations = schedule.filter(cue => cue.audioCascade === 'detonation'), pops = schedule.filter(cue => cue.audioCascade === 'pop')
    expect(detonations).toHaveLength(19)
    expect(detonations.every(cue => cue.time > 5.1 && cue.time < 7)).toBe(true)
    expect(pops).toHaveLength(30)
    expect(pops.every(cue => cue.audioDistant && cue.time > 6.8)).toBe(true)
    expect(Math.max(...pops.map(cue => cue.time)) - 5).toBeLessThan(6)
    const small = buildAudioSchedule(losses.slice(0, 8)).filter(cue => cue.audioCascade === 'detonation')
    expect(small.length).toBeLessThan(detonations.length)
    const pair = buildAudioSchedule(losses.slice(0, 2))
    expect(pair[1].time - pair[0].time).toBeGreaterThanOrEqual(.15)
    expect(pair[1].time - pair[0].time).toBeLessThanOrEqual(.3)
    expect(pair.some(cue => cue.audioCascade)).toBe(false)
  })

  it('hears the shot\'s featured ships up close and keeps a massed battle to a few transients per moment', () => {
    const shots: CinemaShot[] = [{ start: 0, end: 20, kind: 'broadside', intensity: .5, subject: 'a', target: 'b' }]
    const volley = Array.from({ length: 30 }, (_, i): CinemaCue => ({ ...weapon, id: `v${i}`, from: i % 2 ? 'a' : `x${i}`, to: i % 2 ? 'b' : `y${i}`, weaponFamily: 'laser', hit: false }))
    const schedule = buildAudioSchedule(volley, shots)
    const near = schedule.filter(cue => cue.audioPhase === 'release' && !cue.audioDistant)
    const far = schedule.filter(cue => cue.audioPhase === 'release' && cue.audioDistant)
    expect(near.every(cue => cue.from === 'a')).toBe(true)
    expect(near.length).toBeLessThanOrEqual(3)
    expect(far.length).toBeLessThanOrEqual(1)
    expect(schedule.filter(cue => cue.audioPhase === 'miss').length).toBeLessThanOrEqual(1)
  })

  it('starts a warp-in riser before the arrival and climbs grapple pitch through one boarding operation', () => {
    expect(buildAudioSchedule([{ id: 'w', kind: 'arrival', time: 4, duration: 1, tick: 1, to: 'c', intensity: .5 }])[0].time).toBeCloseTo(4 - ARRIVAL_LEAD)
    const waves = buildAudioSchedule([4, 4, 4, 9].map((time, i): CinemaCue => ({ id: `w${i}`, kind: 'arrival', time, duration: 1, tick: 1, to: `c${i}`, intensity: .5 })))
    expect(waves.map(cue => [cue.audioMass ?? 1, cue.audioStep])).toEqual([[3, 0], [1, 1]])
    const boarding = [1, 2, 3].map((time): CinemaCue => ({ id: `b${time}`, kind: 'boarding', time, duration: 1, tick: time, from: 'a', to: 'b', operationId: 'op', boardingPhase: 'approach', intensity: .5 }))
    expect(buildAudioSchedule(boarding).map(cue => cue.audioStep)).toEqual([0, 1, 2])
  })
})
