import { expect, test } from 'bun:test'
import { hostileStronghold } from './MissionsPanel'

const stations = [
  { base_id: 'crix_stronghold_station', name: 'Crix Stronghold', empire: 'pirates' },
  { base_id: 'sol_central', name: 'Sol Central', empire: 'solarian' },
]

test('a stronghold destination is hostile without standing with its crew', () => {
  expect(hostileStronghold({ targetBaseId: 'crix_stronghold_station', stations })?.name).toBe('Crix Stronghold')
  expect(hostileStronghold({ targetBaseId: 'crix_stronghold_station', stations, standings: { pirate_crix: { reputation: -30 } } })?.name).toBe('Crix Stronghold')
})

test('standing of 0 or more with that crew clears the warning; another crew does not', () => {
  expect(hostileStronghold({ targetBaseId: 'crix_stronghold_station', stations, standings: { pirate_crix: { reputation: 0 } } })).toBeUndefined()
  expect(hostileStronghold({ targetBaseId: 'crix_stronghold_station', stations, standings: { pirate_kael: { reputation: 50 } } })?.name).toBe('Crix Stronghold')
})

test('empire stations, unknown bases and no target are not hostile', () => {
  expect(hostileStronghold({ targetBaseId: 'sol_central', stations })).toBeUndefined()
  expect(hostileStronghold({ targetBaseId: 'nowhere', stations })).toBeUndefined()
  expect(hostileStronghold({ stations })).toBeUndefined()
})
