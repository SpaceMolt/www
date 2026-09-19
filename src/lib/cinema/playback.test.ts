import { describe, expect, test } from 'bun:test'
import { cueRange, cueLifetime, weaponImpactAge, impactFocusIds, selectImpactFocus } from './playback'
import type { CinemaCue } from './types'
const cue = (time: number): CinemaCue => ({ id: String(time), time, kind: 'weapon', tick: 0, intensity: 1, duration: 1 })
describe('cinema frame cue ranges', () => {
  test('emits simultaneous events once across exact boundaries', () => {
    const cues = [cue(0), cue(1), cue(1), cue(2)]
    expect(cueRange(cues, 0, 1).length).toBe(1)
    expect(cueRange(cues, 1, 2).length).toBe(2)
    expect(cueRange(cues, 2, 3).length).toBe(1)
  })
  test('reconstructs active effects after seeking without replaying old audio', () => {
    const cues = Array.from({ length: 20000 }, (_, i) => cue(i / 10))
    expect(cueRange(cues, 990, 1000).length).toBe(100)
    expect(cueRange(cues, 1000, 1000).length).toBe(0)
    expect(cueRange(cues, 1000, 1000.1).map(c => c.time)).toEqual([1000])
  })
})

test('collateral waits for parent arrival and long flights retain impact time', () => {
  const primary = { ...cue(10), duration: 3 }
  const secondary = { ...primary, parentId: primary.id }
  expect(weaponImpactAge(secondary,11)).toBe(-2)
  expect(weaponImpactAge(secondary,13.5)).toBe(.5)
  expect(weaponImpactAge(primary,13.5)).toBe(.5)
  expect(cueLifetime(primary)).toBe(4.2)
})

test('impact framing follows every simultaneous loss without retaining old victims', () => {
  const cues: CinemaCue[] = [
    { ...cue(5), kind: 'death', to: 'a' },
    { ...cue(5), kind: 'knockout', to: 'b' },
    { ...cue(9), kind: 'death', to: 'c' },
  ]
  expect(impactFocusIds(cues, 4)).toEqual(['a', 'b'])
  expect(impactFocusIds(cues, 7)).toEqual(['a', 'b'])
  expect(impactFocusIds(cues, 9)).toEqual(['c'])
})

describe('held impact focus', () => {
  const loss = (time: number, to: string, intensity = 1): CinemaCue => ({ ...cue(time), id:to, kind:'death', to, intensity })
  test('keeps a primary through rapid cascades instead of switching on every newer loss', () => {
    const cues=[loss(10,'a'),loss(10.4,'b'),loss(10.8,'c'),loss(11.4,'d'),loss(11.8,'e'),loss(12.2,'f')]
    expect(selectImpactFocus(cues,9)[0]).toBe('a')
    expect(selectImpactFocus(cues,10.9)[0]).toBe('a')
    expect(selectImpactFocus(cues,11.49)[0]).toBe('a')
    expect(selectImpactFocus(cues,11.6)[0]).toBe('e')
    expect(selectImpactFocus(cues,12.9)[0]).toBe('e')
    expect(selectImpactFocus(cues,13.4)[0]).toBe('f')
    expect(selectImpactFocus(cues,16)).toEqual([])
  })
  test('prepares upcoming impacts and retains simultaneous targets in deterministic priority order', () => {
    const cues=[loss(10,'a',.5),loss(10,'b',1),loss(12,'c')]
    expect(selectImpactFocus(cues,8.5)).toEqual([])
    expect(selectImpactFocus(cues,8.6)).toEqual(['b','a'])
    expect(selectImpactFocus(cues,10.7)[0]).toBe('b')
    expect(selectImpactFocus(cues,11.6)[0]).toBe('c')
    const forward=selectImpactFocus(cues,11.6)
    selectImpactFocus(cues,8.6)
    expect(selectImpactFocus(cues,11.6)).toEqual(forward)
  })
  test('covers a late cascade tail before a distant next exchange', () => {
    const cues=[loss(10,'a'),loss(10.4,'b'),loss(11.4,'c'),loss(20,'d')]
    expect(selectImpactFocus(cues,11.6)[0]).toBe('c')
    expect(selectImpactFocus(cues,15)).toEqual([])
    expect(selectImpactFocus(cues,19)[0]).toBe('d')
  })
})
