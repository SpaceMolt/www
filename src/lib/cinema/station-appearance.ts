import { resolveAppearance, type ShipAppearance, type ShipEmpire } from './appearance'

// Exact public base IDs verified against gameserver/data/galaxy's empire home
// systems and pirate_stations.yaml. Ownership faction IDs do not imply an empire.
const stationEmpires = new Map<string, ShipEmpire>([
  ['confederacy_central_command', 'solarian'],
  ['central_nexus', 'voidborn'],
  ['crimson_war_citadel', 'crimson'],
  ['grand_exchange_station', 'nebula'],
  ['frontier_station', 'outerrim'],
  ['sable_port_station', 'pirate'],
])

export function resolveStationAppearance(baseId: string): ShipAppearance {
  return resolveAppearance('station', stationEmpires.get(baseId), 5, '', 0, 'station')
}
