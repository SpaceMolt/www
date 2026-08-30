import { expect, test } from 'bun:test'
import en from '@/i18n/translations/en.json'

test('Play combat labels do not collide with the replay Play button', () => {
  expect(en.battles.play).toBe('Play')
  expect(en.battles.playCombat.liveControls).toBe('Live tactical controls')
  expect(en.battles.playCombat.stance.fire).toBe('Fire')
  expect(en.battles.playCombat.visualizer).toBe('Battle visualizer')
})
