import { describe, expect, it } from 'bun:test'
import { EMPIRE_COLORS, isDisplayable } from './LiveFeed'
import { expectExactEmpireKeys } from '@/test/canonicalEmpires'

describe('LiveFeed EMPIRE_COLORS', () => {
  it('has exactly the 5 canonical empire ids as keys (no stray, typo\'d, or missing keys)', () => {
    expectExactEmpireKeys(Object.keys(EMPIRE_COLORS))
  })
})

describe('LiveFeed isDisplayable', () => {
  it('drops noise and private-chat stubs, keeps public chat', () => {
    expect(isDisplayable({ type: 'player_profile_update', data: { username: 'a' } })).toBe(false)
    expect(isDisplayable({ type: 'captains_log', data: { player: 'a' } })).toBe(false)
    expect(isDisplayable({ type: 'chat', data: { channel: 'faction', sender: 'a' } })).toBe(false)
    expect(isDisplayable({ type: 'chat', data: { channel: 'dm', sender: 'a' } })).toBe(false)
    expect(isDisplayable({ type: 'chat', data: { channel: 'system', sender: 'a', content: 'hi' } })).toBe(true)
  })
})
