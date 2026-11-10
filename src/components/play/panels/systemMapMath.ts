/** Geometry for the in-system map. Pure, so the canvas code stays about drawing. */

export interface Point { x: number; y: number }

/** Where a point outside the view lands on the view's edge, on the line from the center to it. Null when it is inside. */
export function edgePoint(p: Point, center: Point, halfWidth: number, halfHeight: number): Point | null {
  const dx = p.x - center.x
  const dy = p.y - center.y
  if (Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight) return null
  const k = Math.min(halfWidth / Math.abs(dx || 1e-9), halfHeight / Math.abs(dy || 1e-9))
  return { x: center.x + dx * k, y: center.y + dy * k }
}

/**
 * One animation step of the ship toward its destination. It covers the share of the remaining
 * distance that `dtMs` is of the remaining time, so the ship arrives on time from wherever it is
 * drawn now, with no jump when a server update corrects the arrival time.
 */
export function stepToward(pos: Point, dest: Point, dtMs: number, remainingMs: number): Point {
  const k = remainingMs <= 0 ? 1 : Math.min(1, dtMs / remainingMs)
  return { x: pos.x + (dest.x - pos.x) * k, y: pos.y + (dest.y - pos.y) * k }
}

/** "50s", "2m 10s". */
export const formatSecs = (secs: number) => (secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`)
