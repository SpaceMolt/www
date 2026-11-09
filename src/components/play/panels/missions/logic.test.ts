import { test, expect } from 'bun:test'
import type { WaitingPassengerView } from '@spacemolt/lib'
import { groupByDestination, packageOptions, filterMissions, settleBlock, shipFormError, type ShipForm } from './logic'

test('packageOptions keeps only sealed packages from cargo and storage', () => {
  const options = packageOptions({
    cargo: [
      { item_id: 'ore_iron', item_name: 'Iron Ore', quantity: 5 },
      { item_id: 'package:abc', item_name: 'Crate: ore', quantity: 1 },
    ],
    storage: [{ item_id: 'package:def', name: 'Crate: parts', quantity: 1 }, { item_id: 'package:gone', quantity: 0 }],
  })
  expect(options).toEqual([
    { item_id: 'package:abc', label: 'Crate: ore', source: 'cargo' },
    { item_id: 'package:def', label: 'Crate: parts', source: 'storage' },
  ])
})

const form: ShipForm = {
  packageId: 'package:abc',
  destination: 'haven_station',
  baseReward: '500',
  speedBonus: '',
  visibility: 'public',
  invitedId: '',
}

test('shipFormError accepts a complete form and names the first problem', () => {
  expect(shipFormError(form)).toBeNull()
  expect(shipFormError({ ...form, packageId: '' })).toContain('package')
  expect(shipFormError({ ...form, destination: ' ' })).toContain('destination')
  expect(shipFormError({ ...form, baseReward: '0' })).toContain('Reward')
  expect(shipFormError({ ...form, baseReward: '12.5' })).toContain('Reward')
  expect(shipFormError({ ...form, speedBonus: '-3' })).toContain('Speed bonus')
  expect(shipFormError({ ...form, visibility: 'invited' })).toContain('carrier')
})

const waiting = (name: string, destination: string, fare: number): WaitingPassengerView => ({
  bio: '',
  citizen_id: name,
  citizenship: 'solarian',
  class: 'economy',
  destination,
  destination_name: destination.toUpperCase(),
  estimated_fare: fare,
  name,
})

test('groupByDestination groups and orders by total fare', () => {
  const groups = groupByDestination([waiting('a', 'sol', 10), waiting('b', 'haven', 50), waiting('c', 'sol', 30)])
  expect(groups.map((g) => [g.destination, g.passengers.length, g.estimated_fare])).toEqual([
    ['haven', 1, 50],
    ['sol', 2, 40],
  ])
})

test('settleBlock needs the right dock and the package aboard', () => {
  expect(settleBlock({ station: 'sol', stationName: 'Sol Station', dockedAt: null, hasPackage: true })).toBe('Dock at Sol Station first.')
  expect(settleBlock({ station: 'sol', dockedAt: 'sol', hasPackage: false })).toContain('Withdraw')
  expect(settleBlock({ station: 'sol', dockedAt: 'sol', hasPackage: true })).toBeNull()
})

test('filterMissions matches text in title or description and an optional type', () => {
  const missions = [
    { title: 'Ore Run', description: 'Haul iron', type: 'delivery' },
    { title: 'Pirate Hunt', description: 'Kill raiders', type: 'combat' },
  ]
  expect(filterMissions(missions, { text: 'IRON' }).map((m) => m.title)).toEqual(['Ore Run'])
  expect(filterMissions(missions, { type: 'combat' }).map((m) => m.title)).toEqual(['Pirate Hunt'])
  expect(filterMissions(missions)).toHaveLength(2)
})
