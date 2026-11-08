import { describe, expect, test } from 'bun:test'
import type { RawShip } from '@/data/catalog'
import { shipArtID } from './catalogShips'

function ship(id: string, overrides: Partial<RawShip> = {}): RawShip {
  return { id, name: id, ...overrides }
}

describe('pirate ship catalog', () => {
  test('uses source-hull art until variant artwork is published', () => {
    expect(shipArtID(ship('insider_trading', { based_on: 'futures', npc_role: 'scout' }))).toBe('futures')
  })
})
