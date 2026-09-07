import { describe, expect, it } from 'bun:test'
import { audioCueRange, buildAudioSchedule } from './audioSchedule'
import type { CinemaCue } from './types'

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

  it('gives absorbed/shield hits an impact but does not invent a hit for misses', () => {
    expect(buildAudioSchedule([{ ...weapon, hit: false }]).map(cue => cue.audioPhase)).toEqual(['release'])
    for (const shieldDamage of [0, 20]) {
      expect(buildAudioSchedule([{ ...weapon, hullDamage: 0, shieldDamage }]).at(-1)?.audioPhase).toBe('shield-impact')
    }
  })

  it('emits one contact discharge at impact and never adds a second release or hit', () => {
    const schedule = buildAudioSchedule([{ ...weapon, weaponName: 'Galvanic Hull Grid' }])
    expect(schedule.map(cue => [cue.audioPhase, cue.time])).toEqual([['contact', 12.8]])
    expect(buildAudioSchedule([{ ...weapon, secondaryKind: 'retaliation', hit: false }])).toHaveLength(0)
  })

  it('lets a nearby death own the final boom and bounds a six-gun volley to one victim impact', () => {
    const guns = Array.from({ length: 6 }, (_, index) => ({ ...weapon, id: `gun:${index}`, weaponFamily: index ? 'laser' as const : 'torpedo' as const }))
    const schedule = buildAudioSchedule(guns)
    expect(schedule.filter(cue => cue.audioPhase === 'impact')).toHaveLength(1)
    expect(schedule.find(cue => cue.audioPhase === 'impact')?.weaponFamily).toBe('torpedo')
    const death: CinemaCue = { id: 'loss', kind: 'death', time: 13.2, duration: 3.5, tick: 4, to: 'b', intensity: 1 }
    expect(buildAudioSchedule([...guns, death]).filter(cue => cue.audioPhase === 'impact')).toHaveLength(0)
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
})
