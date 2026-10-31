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

/** Station info from /api/stations */
export interface StationInfo {
  id: string
  name: string
  empire?: string
  services: string[]
}

/** Groups market stations by empire. /api/stations also lists stations with no market. */
export function groupStationsByEmpire(stations: StationInfo[]): Record<string, StationInfo[]> {
  const grouped: Record<string, StationInfo[]> = {}
  for (const station of stations) {
    if (!station.services?.includes('market')) continue
    // Faction stations have no empire; /api/market lists them as 'independent'.
    const empire = station.empire || 'independent'
    ;(grouped[empire] ??= []).push(station)
  }
  for (const list of Object.values(grouped)) list.sort((a, b) => a.name.localeCompare(b.name))
  return grouped
}
