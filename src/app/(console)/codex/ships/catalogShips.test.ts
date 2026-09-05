import { describe, expect, test } from 'bun:test'
import type { RawShip } from '@/data/catalog'
import { PUBLIC_PIRATE_SHIP_IDS, isListableShip, shipArtID } from './catalogShips'

function ship(id: string, overrides: Partial<RawShip> = {}): RawShip {
  return { id, name: id, ...overrides }
}

describe('public pirate ship catalog', () => {
  test('keeps the published NPC policy exact and reviewable', () => {
    expect(PUBLIC_PIRATE_SHIP_IDS).toEqual([
      'insider_trading',
      'bulk_discount',
      'flight_risk',
      'shell_company',
    ])
  })

  test.each([
    'insider_trading',
    'bulk_discount',
    'flight_risk',
    'shell_company',
  ])('documents the boarding-era pirate variant %s', (id) => {
    expect(isListableShip(ship(id, { faction: 'pirate', npc_role: 'hauler' }))).toBe(true)
  })

  test('continues to hide unrelated NPC and boss hulls', () => {
    expect(isListableShip(ship('no_appeal', { faction: 'pirate', npc_role: 'boss' }))).toBe(false)
    expect(isListableShip(ship('future_support_ship', { npc_role: 'support' }))).toBe(false)
    expect(isListableShip(ship('flight_risk', { faction: 'crimson', npc_role: 'fighter' }))).toBe(false)
  })

  test('keeps player hulls public', () => {
    expect(isListableShip(ship('futures', { faction: 'nebula' }))).toBe(true)
  })

  test('uses source-hull art until variant artwork is published', () => {
    expect(shipArtID(ship('insider_trading', { based_on: 'futures', npc_role: 'scout' }))).toBe('futures')
  })
})
