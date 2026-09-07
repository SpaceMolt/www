import { describe, expect, it, mock } from 'bun:test'
import { restoreSettingsFocus } from './settingsFocus'

describe('cinema settings focus restoration', () => {
  it('returns focus to the settings trigger without scrolling the player', () => {
    const trigger = { isConnected: true, focus: mock() }
    const player = { isConnected: true, focus: mock() }
    restoreSettingsFocus(trigger, player)
    expect(trigger.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(player.focus).not.toHaveBeenCalled()
  })

  it('keeps keyboard playback reachable if the controls have been removed', () => {
    const trigger = { isConnected: false, focus: mock() }
    const player = { isConnected: true, focus: mock() }
    restoreSettingsFocus(trigger, player)
    expect(trigger.focus).not.toHaveBeenCalled()
    expect(player.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('handles missing refs during teardown', () => {
    expect(() => restoreSettingsFocus(null, null)).not.toThrow()
  })
})
