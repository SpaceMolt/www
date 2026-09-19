import { describe, expect, test } from 'bun:test'
import type { CinemaCue } from './types'
import { prioritizeCinemaEffects, selectCinemaPulseCue } from './effectPriority'

const cue = (id: string, fields: Partial<CinemaCue> = {}): CinemaCue => ({
  id, kind: 'weapon', from: 'background', to: 'enemy', time: 10, duration: 1,
  tick: 1, intensity: .5, ...fields,
})

describe('cinema effect budgets', () => {
  test('the filmed attack survives a crowded low-quality beam budget', () => {
    // Two exotic volleys can consume all 48 low-tier line slots before the hero fires.
    const background = Array.from({ length: 10 }, (_, i) => cue(`background-${i}`, { weaponFamily: 'exotic' }))
    const cause = cue('cause', { from: 'hero' })
    const ordered = prioritizeCinemaEffects([...background, cause], { subjectId: 'hero', causeCueId: 'cause' })
    expect(ordered[0]).toBe(cause)
    expect(ordered.slice(0, 2)).toContain(cause)
  })

  test('both incoming and outgoing subject effects precede unrelated volleys', () => {
    const incoming = cue('incoming', { to: 'hero' })
    const outgoing = cue('outgoing', { from: 'hero' })
    const background = cue('background')
    const ordered = prioritizeCinemaEffects([background, incoming, outgoing], { subjectId: 'hero' })
    expect(new Set(ordered.slice(0, 2))).toEqual(new Set([incoming, outgoing]))
  })

  test('featured consequences and their causes retain precedence over background casualties', () => {
    const death = cue('background-death', { kind: 'death' })
    const cause = cue('cause')
    const consequence = cue('event', { kind: 'knockout', to: 'hero' })
    const collateral = cue('collateral', { parentId: 'cause' })
    const ordinary = cue('ordinary')
    const context = { subjectId: 'hero', causeCueId: 'cause', eventCueId: 'event' }
    const ordered = prioritizeCinemaEffects([ordinary, death, collateral, cause, consequence], context)
    expect(ordered[0]).toBe(consequence)
    expect(ordered.indexOf(cause)).toBeLessThan(ordered.indexOf(collateral))
    expect(ordered.indexOf(collateral)).toBeLessThan(ordered.indexOf(death))
    expect(ordered.indexOf(death)).toBeLessThan(ordered.indexOf(ordinary))
  })

  test('priority is deterministic without reordering the caller timeline', () => {
    const input = [cue('b'), cue('a')]
    const before = [...input]
    const forward = prioritizeCinemaEffects(input, {})
    expect(input).toEqual(before)
    expect(forward.map(c => c.id)).toEqual(prioritizeCinemaEffects([...input].reverse(), {}).map(c => c.id))
  })
})

describe('cinema casualty lighting', () => {
  test('a later background casualty cannot replace the featured explosion light', () => {
    const hero = cue('hero-death', { kind: 'death', to: 'hero' })
    const background = cue('background-death', { kind: 'death', intensity: 1 })
    for (const input of [[hero, background], [background, hero]]) {
      expect(selectCinemaPulseCue(input, 10.3, { subjectId: 'hero' })).toBe(hero)
    }
  })

  test('the active story consequence wins even when its camera subject is the attacker', () => {
    const attacker = cue('attacker-death', { kind: 'death', to: 'hero' })
    const event = cue('event', { kind: 'capture', to: 'opponent' })
    expect(selectCinemaPulseCue([event, attacker], 10.3, { subjectId: 'hero', eventCueId: 'event' })).toBe(event)
  })

  test('only casualties within the light lifetime and with a destination qualify', () => {
    const recent = cue('recent', { kind: 'knockout', time: 10.5 })
    const others = [cue('old', { kind: 'death', time: 9 }), cue('future', { kind: 'death', time: 12 }),
      cue('missing-target', { kind: 'death', to: undefined }), cue('ordinary')]
    expect(selectCinemaPulseCue([...others, recent], 11, {})).toBe(recent)
    expect(selectCinemaPulseCue([recent], 10.49, {})).toBeUndefined()
    expect(selectCinemaPulseCue([recent], 12, {})).toBeUndefined()
    expect(selectCinemaPulseCue(others, 11, {})).toBeUndefined()
  })
})
