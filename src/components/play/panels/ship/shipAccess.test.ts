import { expect, test } from 'bun:test'
import { shipBlockReasons } from './shipAccess'

test('piloting below the requirement blocks; meeting it does not', () => {
  const ship = { piloting_required: 30 }
  expect(shipBlockReasons(ship, { piloting: 12 })).toEqual(['Needs Piloting 30 (you have 12)'])
  expect(shipBlockReasons(ship, { piloting: 30 })).toEqual([])
})

test('legacy hulls skip piloting and reputation, as on the server', () => {
  expect(shipBlockReasons({ legacy: true, piloting_required: 50, required_reputation: 60, faction: 'solarian' })).toEqual([])
})

test('reputation with the hull empire must reach the requirement', () => {
  const ship = { faction: 'solarian', required_reputation: 60 }
  expect(shipBlockReasons(ship, { standings: { solarian: { reputation: 12 } } }))
    .toEqual(['Needs 60 reputation with Solarian (you have 12)'])
  expect(shipBlockReasons(ship, { standings: { solarian: { reputation: 60 } } })).toEqual([])
  expect(shipBlockReasons(ship, { standings: {} })).toEqual(['Needs 60 reputation with Solarian (you have 0)'])
})

test('nothing blocks on piloting or reputation before skills and standings load', () => {
  expect(shipBlockReasons({ piloting_required: 30, faction: 'solarian', required_reputation: 60 })).toEqual([])
})

test('a prestige hull is locked with its player-facing reason', () => {
  const ship = { required_achievement: 'bullion_baron', prestige_lock: 'Locked: prestige hull reserved for pilots who have earned the "Bullion Baron" achievement.' }
  expect(shipBlockReasons(ship)).toEqual(['Locked: prestige hull reserved for pilots who have earned the "Bullion Baron" achievement.'])
  expect(shipBlockReasons({ required_faction_achievement: 'syndicate' })).toEqual(['Prestige hull: needs an achievement'])
})

test('the commissionable set clears piloting and prestige, but not reputation (no license waiver on a purchase)', () => {
  const ship = { piloting_required: 30, faction: 'crimson', required_reputation: 60, required_achievement: 'x' }
  const player = { piloting: 0, standings: {} }
  expect(shipBlockReasons(ship, { ...player, commissionable: true })).toEqual(['Needs 60 reputation with Crimson (you have 0)'])
  expect(shipBlockReasons(ship, player)).toHaveLength(3)
})
