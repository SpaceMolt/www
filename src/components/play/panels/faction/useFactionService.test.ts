import { expect, test } from 'bun:test'
import { factionServicesAt } from './useFactionService'

const lockbox = { status: 'active', faction_service: 'faction_storage' }
const ownStation = { id: 'base_1', type: 'station', faction_id: 'f1' }

test('active faction facilities give their services', () => {
  const services = factionServicesAt({ facilities: [lockbox, { status: 'constructing', faction_service: 'faction_market' }], factionId: 'f1', dockedAt: 'base_1' })
  expect([...services]).toEqual(['faction_storage'])
})

// gameserver stationOwnerFoldedFactionServiceLocked: the owning faction gets storage, and a market where the station runs one.
test('own player station gives storage, and the faction market when the station has a market', () => {
  expect([...factionServicesAt({ base: ownStation, services: ['storage'], factionId: 'f1', dockedAt: 'base_1' })]).toEqual(['faction_storage'])
  expect([...factionServicesAt({ base: ownStation, services: ['market'], factionId: 'f1', dockedAt: 'base_1' })].sort()).toEqual(['faction_market', 'faction_storage'])
})

test('another faction station, an outpost, or a stale base gives nothing extra', () => {
  expect(factionServicesAt({ base: ownStation, services: ['market'], factionId: 'f2', dockedAt: 'base_1' }).size).toBe(0)
  expect(factionServicesAt({ base: { ...ownStation, type: 'outpost' }, factionId: 'f1', dockedAt: 'base_1' }).size).toBe(0)
  expect(factionServicesAt({ base: ownStation, factionId: 'f1', dockedAt: 'base_2' }).size).toBe(0)
})
