import { transitProgress, type WorldPoint } from './transitMotion'

/**
 * A moving station from `/api/map/activity` (and `/api/intel-map`)
 * `mobile_bases`: a faction mobile base or the Frontier mobile capital.
 * `system_id` is where it is now and is absent while it jumps; a jumping
 * faction base instead carries the lane and its ticks in the transit shape.
 */
export interface PublicMobileBase {
  base_id: string
  name: string
  kind: 'faction' | 'capital'
  faction_id?: string
  faction_tag?: string
  faction_color?: string
  empire?: string
  archetype_id?: string
  lifecycle?: 'stationary' | 'in_system_transit' | 'jump_preparing' | 'jumping'
  system_id?: string
  from_system?: string
  to_system?: string
  start_tick?: number
  arrival_tick?: number
  /** Mobile capital only: its next patrol stop and the tick it switches there. */
  next_system?: string
  depart_tick?: number
  wrecked: boolean
}

export interface MobileBasePose extends WorldPoint {
  /** True while the base is out on a jump lane. */
  jumping: boolean
  /** Heading in radians along the lane; 0 when parked. */
  angle: number
}

/**
 * Where to draw a mobile base at `tickNow`: on its system, or interpolated
 * along the jump lane exactly as ship transits are. Null when a system it
 * names is not on the map.
 */
export function mobileBasePose(
  base: PublicMobileBase,
  tickNow: number,
  systemPosition: (id: string) => WorldPoint | undefined,
): MobileBasePose | null {
  if (base.from_system && base.to_system) {
    const from = systemPosition(base.from_system)
    const to = systemPosition(base.to_system)
    if (!from || !to) return null
    const p = transitProgress(base.start_tick ?? 0, base.arrival_tick ?? 0, tickNow)
    return {
      x: from.x + (to.x - from.x) * p,
      y: from.y + (to.y - from.y) * p,
      jumping: true,
      angle: Math.atan2(to.y - from.y, to.x - from.x),
    }
  }
  const at = base.system_id ? systemPosition(base.system_id) : undefined
  return at ? { x: at.x, y: at.y, jumping: false, angle: 0 } : null
}

/** "~1h 25m" style countdown for a tick count at the default 10 s tick. */
export function formatTicksLeft(ticks: number): string {
  const minutes = Math.ceil((Math.max(0, ticks) * 10) / 60)
  if (minutes < 60) return `~${minutes}m`
  return `~${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/**
 * One-line status for tooltips and panels. With `tickNow`, the mobile capital
 * names its next patrol stop and when it switches there.
 */
export function mobileBaseStatus(
  base: PublicMobileBase,
  systemName: (id: string) => string = (id) => id,
  tickNow: number | null = null,
): string {
  if (base.wrecked) return 'Wrecked'
  if (base.kind === 'capital') {
    if (!base.next_system) return 'On patrol'
    const when = base.depart_tick && tickNow !== null ? ` in ${formatTicksLeft(base.depart_tick - tickNow)}` : ''
    return `Next stop: ${systemName(base.next_system)}${when}`
  }
  switch (base.lifecycle) {
    case 'jumping':
      return base.from_system && base.to_system
        ? `Jumping ${systemName(base.from_system)} → ${systemName(base.to_system)}`
        : 'Jumping'
    case 'jump_preparing':
      return 'Preparing to jump'
    case 'in_system_transit':
      return 'Moving in-system'
    default:
      return 'Holding position'
  }
}

/** Display name with the owner's tag, e.g. "[DRFT] Civitas". */
export function mobileBaseLabel(base: PublicMobileBase): string {
  return base.faction_tag ? `[${base.faction_tag}] ${base.name}` : base.name
}
