import { expect, test } from 'bun:test'
import en from '@/i18n/translations/en.json'

test('flee guidance explains the minimum, pursuer speed, and disruption', () => {
  const hint = en.battles.playCombat.stanceHint.flee
  expect(hint).toContain('at least 3 ticks')
  expect(hint).toContain('fastest pursuer')
  expect(hint).toContain('cannot escape while warp-disrupted')
})

test('Play combat labels do not collide with the replay Play button', () => {
  expect(en.battles.play).toBe('Play')
  expect(en.battles.playCombat.liveControls).toBe('Live tactical controls')
  expect(en.battles.playCombat.stance.fire).toBe('Fire')
  expect(en.battles.playCombat.visualizer).toBe('Battle visualizer')
})
