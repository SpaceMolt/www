import { expect, test } from 'bun:test'
import { resolveStationAppearance } from './station-appearance'

test('identified stations use construction identity; player and unrecognized bases stay generic', () => {
  expect(resolveStationAppearance('sable_port_station').empire).toBe('pirate')
  expect(resolveStationAppearance('central_nexus').empire).toBe('voidborn')
  for (const id of ['b495c6003fc83e18f6d8cecbe6929133', 'solarian_player_base', '']) {
    const appearance = resolveStationAppearance(id)
    expect(appearance.empire).toBe('neutral')
    expect(appearance.family).toBe('station')
    expect(appearance.length).toBeGreaterThan(35)
  }
})
