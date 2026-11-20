interface Point { x: number; y: number }

/**
 * The part of the line from `a` to `b` inside a `width` x `height` view, grown by `margin` px on each
 * side, or null when none of it is inside. `dashOffset` is the length cut from the start, so a dash
 * pattern stays fixed on the line.
 */
export function clipToView(a: Point, b: Point, width: number, height: number, margin: number) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let [t0, t1] = [0, 1]
  // Liang-Barsky: each pair is one edge of the view.
  for (const [p, q] of [[-dx, a.x + margin], [dx, width + margin - a.x], [-dy, a.y + margin], [dy, height + margin - a.y]]) {
    if (p === 0) {
      if (q < 0) return null
    } else if (p < 0) t0 = Math.max(t0, q / p)
    else t1 = Math.min(t1, q / p)
  }
  if (!(t0 <= t1)) return null // also NaN, from a point that is not finite
  return {
    from: { x: a.x + dx * t0, y: a.y + dy * t0 },
    to: { x: a.x + dx * t1, y: a.y + dy * t1 },
    dashOffset: t0 * Math.hypot(dx, dy),
  }
}

/**
 * Strokes only the part of a line that is on the canvas. A canvas draws every dash of a stroke, also
 * the dashes off screen, so a dashed line far longer than the view costs seconds per frame (dc#434442).
 */
export function strokeLine(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
  // 16 px covers the line width and a shadowBlur glow, so the cut ends stay off screen.
  const seg = clipToView(a, b, ctx.canvas.clientWidth, ctx.canvas.clientHeight, 16)
  if (!seg) return
  const period = ctx.getLineDash().reduce((sum, d) => sum + d, 0)
  // Modulo the period: a huge offset loses precision in the canvas and the dashes shimmer.
  ctx.lineDashOffset = period ? seg.dashOffset % period : 0
  ctx.beginPath()
  ctx.moveTo(seg.from.x, seg.from.y)
  ctx.lineTo(seg.to.x, seg.to.y)
  ctx.stroke()
  ctx.lineDashOffset = 0
}
