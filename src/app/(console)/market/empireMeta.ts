import styles from './page.module.css'

export const EMPIRE_COLORS: Record<string, string> = {
  solarian: styles.empireSolarian,
  voidborn: styles.empireVoidborn,
  crimson: styles.empireCrimson,
  nebula: styles.empireNebula,
  outerrim: styles.empireOuterrim,
}

export const EMPIRE_LINK_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#c39bd3',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

/** The gameserver's market group for stations that belong to no empire (player stations). */
export const INDEPENDENT_EMPIRE_ID = 'independent'

/** Station info from /api/stations */
export interface StationInfo {
  id: string
  name: string
  empire: string
  services: string[]
}

/**
 * Groups stations by empire for the station-market links, sorted by name. A
 * station with no empire joins the independent group, but only if it runs a
 * market: player stations without one have nothing to link to.
 */
export function groupStationsByEmpire(stations: StationInfo[]): Record<string, StationInfo[]> {
  const grouped: Record<string, StationInfo[]> = {}
  for (const station of stations) {
    const key = station.empire || (station.services?.includes('market') ? INDEPENDENT_EMPIRE_ID : '')
    if (!key) continue
    ;(grouped[key] ??= []).push(station)
  }
  for (const list of Object.values(grouped)) list.sort((a, b) => a.name.localeCompare(b.name))
  return grouped
}
