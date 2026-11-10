import { expect, test } from 'bun:test'
import { treasuryBalance } from './treasuryBalance'

// Faction credits deposit and withdraw from anywhere (gameserver storageV2FactionDepositCredits:
// "Credits live in the treasury, not a station vault, so no dock is needed").

test('docked: balance comes from the storage view', () => {
  expect(treasuryBalance({ view: { credits: 500 }, info: { treasury: 400 } })).toBe(500)
})

test('undocked with no station picked: balance comes from faction info', () => {
  expect(treasuryBalance({ info: { treasury: 800 } })).toBe(800)
})

test('undocked viewing a remote station: balance comes from that view', () => {
  expect(treasuryBalance({ view: { credits: 900 }, info: { treasury: 800 } })).toBe(900)
})

test('nothing loaded yet: no balance, so no controls', () => {
  expect(treasuryBalance({})).toBeUndefined()
})
