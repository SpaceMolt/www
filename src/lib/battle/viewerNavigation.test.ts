import { describe, expect, it } from 'bun:test'
import { acceptsPlaybackShortcut, battleMomentPath, reconcilePlayhead } from './viewerNavigation'

describe('embedded replay navigation', () => {
  it('keeps the same viewed tick and animation fraction after late earlier rows', () => {
    expect(reconcilePlayhead([{ tick: 100 }, { tick: 102 }], [{ tick: 100 }, { tick: 101 }, { tick: 102 }], 1.5)).toBe(2.5)
    expect(reconcilePlayhead([{ tick: 100 }], [{ tick: 100 }, { tick: 101 }], 0.5)).toBe(0.5)
    expect(reconcilePlayhead([], [{ tick: 100 }], 0)).toBe(0)
  })
  it('shares canonical battle links, never the Play route or player query', () => {
    expect(battleMomentPath('battle/a', 4.9)).toBe('/battles/battle%2Fa?t=4')
    expect(battleMomentPath('battle', -1)).toBe('/battles/battle?t=0')
  })

  it('leaves buttons, form fields, and modified shortcuts alone', () => {
    const event = { altKey: false, ctrlKey: false, metaKey: false, defaultPrevented: false }
    expect(acceptsPlaybackShortcut(event, false)).toBe(true)
    expect(acceptsPlaybackShortcut(event, true)).toBe(false)
    for (const key of ['altKey', 'ctrlKey', 'metaKey', 'defaultPrevented']) {
      expect(acceptsPlaybackShortcut({ ...event, [key]: true }, false)).toBe(false)
    }
  })
})
