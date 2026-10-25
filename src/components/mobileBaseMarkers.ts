import { mobileBasePose, type PublicMobileBase } from '@/lib/mobileBases'
import type { WorldPoint } from '@/lib/transitMotion'

const DEFAULT_MOBILE_BASE_COLOR = '#00FFFF'
const WRECKED_MOBILE_BASE_COLOR = '#6b7280'
/** Angle between neighbouring bases parked at one system. */
const FAN_STEP = Math.PI / 5

/** A mobile base placed on screen for one frame. */
export interface MobileBaseMarker {
  base: PublicMobileBase
  /** Glyph centre in screen pixels. */
  x: number
  y: number
  /** The system node it is tethered to, or the system it is jumping to. */
  anchorX: number
  anchorY: number
  jumping: boolean
  /** Heading along the lane in radians; 0 when parked. */
  angle: number
}

/**
 * Screen offset for the `index`th of `count` bases parked at one system:
 * up-right of the node, fanned out so several bases do not overlap.
 */
export function mobileBaseFanOffset(index: number, count: number, distance: number): { dx: number; dy: number } {
  const angle = -Math.PI / 4 + (index - (count - 1) / 2) * FAN_STEP
  return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance }
}

/** Stroke color: the owner's color, the capital's empire color, else cyan; grey once wrecked. */
export function mobileBaseColor(base: PublicMobileBase, empireColor?: string): string {
  if (base.wrecked) return WRECKED_MOBILE_BASE_COLOR
  return base.faction_color || (base.kind === 'capital' && empireColor) || DEFAULT_MOBILE_BASE_COLOR
}

/**
 * Places every base on screen. Parked bases sit `parkedOffset` pixels off
 * their system node; jumping bases sit on the lane and anchor to their
 * destination. Jumping bases are left out until the tick clock is known.
 */
export function layoutMobileBaseMarkers(
  bases: PublicMobileBase[],
  tickNow: number | null,
  systemPosition: (id: string) => WorldPoint | undefined,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  parkedOffset: number,
): MobileBaseMarker[] {
  const parkedBySystem = new Map<string, PublicMobileBase[]>()
  for (const base of bases) {
    if (base.from_system && base.to_system) continue
    if (!base.system_id) continue
    const group = parkedBySystem.get(base.system_id)
    if (group) group.push(base)
    else parkedBySystem.set(base.system_id, [base])
  }

  const markers: MobileBaseMarker[] = []
  for (const base of bases) {
    const jumping = !!(base.from_system && base.to_system)
    if (jumping && tickNow === null) continue
    const pose = mobileBasePose(base, tickNow ?? 0, systemPosition)
    if (!pose) continue
    if (pose.jumping) {
      const at = toScreen(pose.x, pose.y)
      const to = systemPosition(base.to_system!)!
      const anchor = toScreen(to.x, to.y)
      markers.push({ base, x: at.x, y: at.y, anchorX: anchor.x, anchorY: anchor.y, jumping: true, angle: pose.angle })
    } else {
      const group = parkedBySystem.get(base.system_id!)!
      const { dx, dy } = mobileBaseFanOffset(group.indexOf(base), group.length, parkedOffset)
      const anchor = toScreen(pose.x, pose.y)
      markers.push({ base, x: anchor.x + dx, y: anchor.y + dy, anchorX: anchor.x, anchorY: anchor.y, jumping: false, angle: 0 })
    }
  }
  return markers
}

/** The marker closest to (sx, sy) within `radius` pixels, or null. */
export function mobileBaseMarkerAt(markers: MobileBaseMarker[], sx: number, sy: number, radius: number): MobileBaseMarker | null {
  let closest: MobileBaseMarker | null = null
  let closestDist = radius
  for (const marker of markers) {
    const dist = Math.hypot(marker.x - sx, marker.y - sy)
    if (dist < closestDist) {
      closest = marker
      closestDist = dist
    }
  }
  return closest
}
