import { describe, expect, it } from 'bun:test'
import { findPlayer, matchesPlayer } from './matchesPlayer'

const vex = { id: 'ac34e18345dc78e620', username: 'Vex Caldera' }
const other = { id: 'ac34e18345dc76e620', username: 'Other' }

describe('matchesPlayer', () => {
  it('matches a name substring in any case', () => {
    expect(matchesPlayer('caldera', vex)).toBe(true)
  })
  it('matches the full player ID, ignoring case and spaces', () => {
    expect(matchesPlayer(' AC34E18345DC78E620 ', vex)).toBe(true)
    expect(matchesPlayer('ac34e18345dc78e620', other)).toBe(false)
  })
  it('does not match a partial ID', () => {
    expect(matchesPlayer('ac34', vex)).toBe(false)
  })
})

describe('findPlayer', () => {
  it('finds by ID or by exact name in any case', () => {
    expect(findPlayer([other, vex], 'ac34e18345dc78e620')).toBe(vex)
    expect(findPlayer([other, vex], 'vex caldera')).toBe(vex)
  })
  it('does not match a partial name', () => {
    expect(findPlayer([vex], 'vex')).toBeUndefined()
  })
})
