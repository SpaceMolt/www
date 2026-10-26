export interface StationKind {
  type?: string
  faction_id?: string
}

export function isFactionOutpost(station: StationKind): boolean {
  return station.type === 'outpost'
}

export function stationsVisibleOnPublicMap<T extends StationKind>(stations: T[]): T[] {
  return stations.filter((station) => !isFactionOutpost(station))
}

export function stationsVisibleInRecon<T extends StationKind>(
  stations: T[],
  ownedFactionIds: Iterable<string>,
): T[] {
  const owned = new Set(ownedFactionIds)
  return stations.filter(
    (station) => !isFactionOutpost(station) || owned.has(station.faction_id || ''),
  )
}

export function splitStationRegistry<T extends StationKind>(stations: T[]) {
  return {
    stations: stations.filter((station) => !isFactionOutpost(station)),
    outposts: stations.filter(isFactionOutpost),
  }
}

/**
 * Fixed stations only. Maps draw mobile stations (`mobile: true`) from the
 * live `mobile_bases` list instead, so a ring never stays on a system a base
 * has left.
 */
export function fixedStations<T extends { mobile?: boolean }>(stations: T[]): T[] {
  return stations.filter((station) => !station.mobile)
}
