import type { FactionInfoResponse, MobileBaseInfo } from '@spacemolt/lib'

/** Server limit for in-system moves: distance from the system center. */
export const MOBILE_BASE_MAX_RADIUS_AU = 10

export const LIFECYCLE_LABEL: Record<MobileBaseInfo['lifecycle'], string> = {
  stationary: 'Holding position',
  in_system_transit: 'Moving in-system',
  jump_preparing: 'Preparing to jump',
  jumping: 'Jumping',
}

/**
 * The leader always can; other members need a role with manage_bases. When the
 * member list is paged without this player, show the controls and let the
 * server decide.
 */
export function canManageMobileBase(info: FactionInfoResponse, playerId: string | undefined): boolean {
  if (!playerId) return false
  if (info.leader_id === playerId) return true
  const roleId = info.members?.find((m) => m.player_id === playerId)?.role
  if (!roleId || !info.roles) return true
  return Boolean(info.roles.find((r) => r.id === roleId || r.name === roleId)?.permissions.manage_bases)
}

/** Parse move inputs; null unless both are numbers within the move radius. */
export function parseMoveTarget(xText: string, yText: string): { x: number; y: number } | null {
  if (xText.trim() === '' || yText.trim() === '') return null
  const x = Number(xText)
  const y = Number(yText)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (Math.hypot(x, y) > MOBILE_BASE_MAX_RADIUS_AU) return null
  return { x, y }
}

/** Phase progress at `tick`: 0..1 and ticks left. Null while stationary. */
export function mobileBaseProgress(mb: MobileBaseInfo, tick: number): { fraction: number; ticksLeft: number } | null {
  if (mb.lifecycle === 'stationary' || mb.state_complete_tick <= mb.state_started_tick) return null
  const span = mb.state_complete_tick - mb.state_started_tick
  const fraction = Math.min(1, Math.max(0, (tick - mb.state_started_tick) / span))
  return { fraction, ticksLeft: Math.max(0, mb.state_complete_tick - tick) }
}

/** Live AU position: interpolated during an in-system move, as the server does. */
export function mobileBasePosition(mb: MobileBaseInfo, tick: number): { x: number; y: number } {
  if (mb.lifecycle !== 'in_system_transit') return mb.current_position
  const p = mobileBaseProgress(mb, tick)?.fraction ?? 0
  const from = mb.origin.position
  const to = mb.destination.position
  return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p }
}
