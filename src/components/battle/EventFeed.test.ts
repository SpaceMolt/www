import { describe, expect, it } from 'bun:test'
import { eventFeedText } from './EventFeed'
import type { BattleEvent } from '@/lib/battle/timeline'

const baseEvent: BattleEvent = {
  tickIndex: 0,
  tick: 42,
  kind: 'boarding',
  color: '#fff',
  text: 'English fallback',
}

describe('eventFeedText', () => {
  it('renders localized event prose from its key and params', () => {
    const event: BattleEvent = {
      ...baseEvent,
      translation: {
        key: 'battles.events.boardingClosingStarted',
        params: { actor: 'Corsair', target: 'Merchant' },
      },
    }
    const t = (key: string, params?: Record<string, string | number>) =>
      `${key}: ${params?.actor} -> ${params?.target}`

    expect(eventFeedText(event, t)).toBe('battles.events.boardingClosingStarted: Corsair -> Merchant')
  })

  it('preserves server-derived English text when no translation is available', () => {
    expect(eventFeedText(baseEvent, () => 'unused')).toBe('English fallback')

    const keyedEvent: BattleEvent = {
      ...baseEvent,
      translation: { key: 'battles.events.missing' },
    }
    expect(eventFeedText(keyedEvent, key => key)).toBe('English fallback')
  })
})
