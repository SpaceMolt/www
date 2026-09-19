export interface FormationSlot {
  lateral: number
  depth: number
  elevation: number
  /** A shared fleet translation preserves row clearance inside its angular sector. */
  sectorOffset?: number
}
export interface FormationMember {
  id: string
  playerId: string
  size: number
  beam: number
  kind?: string
  family?: string
}

/** Full turning clearance also covers narrow hulls presenting a broadside. */
export function fleetMotionSpacing(ships: readonly { size: number; beam: number }[]): number {
  return ships.reduce((spacing, ship) => Math.max(spacing, ship.size * 1.2 + 40, ship.size * ship.beam * 1.4 + 28), 75)
}

/** A bounded number of vertical wings keeps depth and width comparable. */
export function balancedFormationSlot(lane: number, count: number, spacing: number, depth: number): FormationSlot {
  const members = Math.max(1, Math.floor(count))
  const layers = members >= 256 ? 4 : members >= 64 ? 3 : members >= 16 ? 2 : 1
  // Reserve every row's complete range excursion, approach and hull clearance.
  const rowPitch = depth * 1.7 + 110
  const columns = Math.min(members, Math.max(1, Math.ceil(Math.sqrt(members * rowPitch / spacing / layers))))
  const row = Math.floor(lane / (columns * layers))
  const columnIndex = Math.floor(lane / layers) % columns
  // Fill the center first, then alternate outward. Adding a second vertical
  // wing does not send the first/front-line ship to the edge of the formation.
  const centerOrder = columnIndex % 2 === 0 ? Math.floor(columnIndex / 2) : -Math.ceil(columnIndex / 2)
  const column = centerOrder + (columns % 2 === 0 ? .5 : 0)
  return { lateral: column * spacing, depth: row * rowPitch,
    elevation: (lane % layers) * Math.max(spacing, depth * .3 + 40) }
}

/** Assign once per side; deaths never compact the fleet and returning pilots
 * keep their lane. All appearances reserve clearance for that pilot's largest hull. */
export function buildFleetFormation(members: readonly FormationMember[], fleetCount = 2): Map<string, FormationSlot> {
  const pilots = new Map<string, FormationMember>()
  for (const member of members) {
    const prior = pilots.get(member.playerId)
    const representative = !prior || member.size > prior.size || member.size === prior.size && member.id < prior.id ? member : prior
    pilots.set(member.playerId, { ...representative, beam: Math.max(member.beam, prior?.beam ?? 0) })
  }
  const role: Record<string, number> = { scout: 0, fighter: 1, drone: 1, warship: 2, capital: 3, carrier: 4, support: 5, industrial: 6 }
  const mobile = [...pilots.values()].filter(member => member.kind !== 'station')
    .sort((a, b) => (role[a.family ?? ''] ?? 2) - (role[b.family ?? ''] ?? 2) || a.size - b.size || a.playerId.localeCompare(b.playerId))
  const spacing = fleetMotionSpacing(mobile)
  const depth = Math.max(130, ...mobile.map(member => member.size * 1.25 + 55))
  const slots = new Map(mobile.map((member, lane) => [member.playerId, balancedFormationSlot(lane, mobile.length, spacing, depth)]))
  const stations = [...pilots.values()].filter(member => member.kind === 'station').sort((a, b) => a.playerId.localeCompare(b.playerId))
  const stationSpacing = fleetMotionSpacing(stations)
  stations.forEach((member, lane) => slots.set(member.playerId, { lateral: (lane - (stations.length - 1) / 2) * stationSpacing,
    depth: 0, elevation: -Math.max(0, ...mobile.map(ship => ship.size * .65)) }))
  if (fleetCount > 2) {
    const halfAngle = Math.PI / fleetCount, sine = Math.sin(halfAngle), cosine = Math.cos(halfAngle)
    for (const group of [mobile, stations]) {
      let offset = 0
      for (const member of group) {
        const slot = slots.get(member.playerId)!
        const stationary = member.kind === 'station'
        // Signed distance to either sector boundary must contain the hull and
        // its full local sway. Keep one offset for the entire fleet: clamping
        // individual radial positions would collapse front and rear rows.
        const lateral = Math.abs(slot.lateral) + (stationary ? 0 : 6)
        const requiredRadius = (lateral * cosine + member.size * .78 + 24) / sine
        const minimumRadius = 150 + member.size * .65 + slot.depth - (stationary ? 0 : 50)
        offset = Math.max(offset, requiredRadius - minimumRadius)
      }
      for (const member of group) slots.set(member.playerId, { ...slots.get(member.playerId)!, sectorOffset: offset })
    }
  }
  return new Map(members.map(member => [member.id, slots.get(member.playerId)!]))
}
