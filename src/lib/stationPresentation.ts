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

// Faction colors are player-picked. A very dark one (MOON's #502087) vanishes
// on the dark map, so mix it toward white until it reads. Hex comes back as
// #rrggbb so callers can append an alpha byte; other CSS colors pass through.
export function visibleOnDarkMap(color: string): string {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color)
  if (!m) return color
  const hex = m[1].length <= 4 ? [...m[1]].map((c) => c + c).join('') : m[1]
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  const t = Math.max(0, (0.35 - luminance) / (1 - luminance))
  return '#' + rgb.map((c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, '0')).join('')
}
