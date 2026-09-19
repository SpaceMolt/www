import { describe, expect, it } from 'bun:test'
import { cinemaShortcut } from './playbackControls'

const event = { key: 'Escape', altKey: false, ctrlKey: false, metaKey: false, defaultPrevented: false }

describe('cinema keyboard controls', () => {
  it('dismisses settings with Escape while the settings button or an option retains focus', () => {
    expect(cinemaShortcut(event, true)).toBe('close-settings')
  })
  it('preserves native slider and button keyboard interaction', () => {
    for (const key of [' ', 'ArrowLeft', 'ArrowRight', 'm', 'f']) {
      expect(cinemaShortcut({ ...event, key }, true)).toBeNull()
    }
  })
  it('leaves browser shortcuts and handled keys alone', () => {
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'defaultPrevented']) {
      expect(cinemaShortcut({ ...event, [modifier]: true }, false)).toBeNull()
    }
  })
  it('seeks and controls playback when the cinema itself is focused', () => {
    expect(cinemaShortcut({ ...event, key: ' ' }, false)).toBe('play')
    expect(cinemaShortcut({ ...event, key: 'ArrowLeft' }, false)).toBe('back')
    expect(cinemaShortcut({ ...event, key: 'ArrowRight' }, false)).toBe('forward')
    expect(cinemaShortcut({ ...event, key: 'M' }, false)).toBe('mute')
    expect(cinemaShortcut({ ...event, key: 'F' }, false)).toBe('fullscreen')
  })
})
