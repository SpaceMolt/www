import { describe, expect, test } from 'bun:test'
import type { RawShip } from '@/data/catalog'
import { shipArtID } from './catalogShips'

function ship(id: string, overrides: Partial<RawShip> = {}): RawShip {
  return { id, name: id, ...overrides }
}

describe('pirate ship catalog', () => {
  test.each([
    ['bulk_discount', 'junk_convoy'],
    ['flight_risk', 'dust_devil'],
    ['insider_trading', 'futures'],
    ['shell_company', 'syndicate'],
  ])('uses published artwork for %s instead of %s', (id, based_on) => {
    expect(shipArtID(ship(id, { based_on }))).toBe(id)
  })

  test('uses source-hull art until variant artwork is published', () => {
    expect(shipArtID(ship('test_unpublished_variant', { based_on: 'futures', npc_role: 'scout' }))).toBe('futures')
  })
})
