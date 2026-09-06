import { describe, expect, test } from 'bun:test'
import { cueRange, cueLifetime, weaponImpactAge } from './playback'
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
