// Frame-rendering logic for the homepage starfield, extracted from
// Starfield.tsx so the canvas draw ops can be unit tested.

export interface Star {
  x: number
  y: number
  z: number
  color: string
}

// The subset of CanvasRenderingContext2D the starfield uses.
export interface StarfieldCtx {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  globalAlpha: number
  lineWidth: number
  lineCap: CanvasLineCap
  fillRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  arc(x: number, y: number, r: number, start: number, end: number): void
  fill(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient
}

export const BACKGROUND = '#0a0e17'
export const STAR_COLORS = ['#e8f4f8', '#a8c5d6', '#00d4ff', '#ff6b35']

export function createStars(count: number, width: number, height: number): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width - width / 2,
      y: Math.random() * height - height / 2,
      z: Math.random() * width,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    })
  }
  return stars
}

function drawStar(ctx: StarfieldCtx, star: Star, width: number, height: number) {
  const cx = width / 2
  const cy = height / 2
  const sx = (star.x / star.z) * width + cx
  const sy = (star.y / star.z) * height + cy
  const size = Math.max(0, (1 - star.z / width) * 3)
  const opacity = Math.max(0, 1 - star.z / width)

  if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
    ctx.beginPath()
    ctx.arc(sx, sy, size, 0, Math.PI * 2)
    ctx.fillStyle = star.color
    ctx.globalAlpha = opacity
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

// One static (reduced-motion) frame: opaque clear, then stars.
export function drawStaticFrame(ctx: StarfieldCtx, stars: Star[], width: number, height: number) {
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, width, height)
  for (const star of stars) {
    drawStar(ctx, star, width, height)
  }
}

// How far back in time (in frames of motion) the trail's tail reaches.
const TRAIL_FRAMES = 30

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// One animated frame: opaque clear, then advance every star toward the
// camera and draw a trail from where it was TRAIL_FRAMES ago to its
// current position, fading to transparent toward the tail. The trail is
// recomputed from scratch every frame — an accumulated translucent fade
// fill never converges back to the background in 8-bit compositing and
// leaves permanent ghost trails.
export function drawAnimatedFrame(
  ctx: StarfieldCtx,
  stars: Star[],
  width: number,
  height: number,
  speed: number
) {
  ctx.fillStyle = BACKGROUND
  ctx.globalAlpha = 1
  ctx.fillRect(0, 0, width, height)

  const cx = width / 2
  const cy = height / 2

  for (const star of stars) {
    star.z -= speed
    if (star.z <= 0) {
      star.x = Math.random() * width - cx
      star.y = Math.random() * height - cy
      star.z = width
      // Freshly respawned: no meaningful previous position, draw a dot.
      drawStar(ctx, star, width, height)
      continue
    }

    const sx = (star.x / star.z) * width + cx
    const sy = (star.y / star.z) * height + cy

    // Tail reaches back along the star's actual path, clamped to its
    // spawn depth so trails never predate the star.
    const tailZ = Math.min(star.z + speed * TRAIL_FRAMES, width)
    const px = (star.x / tailZ) * width + cx
    const py = (star.y / tailZ) * height + cy

    // Cull only when the entire head-to-tail segment is off-canvas, so a
    // trail stays visible until it has fully left the frame.
    if (
      Math.max(sx, px) < 0 ||
      Math.min(sx, px) > width ||
      Math.max(sy, py) < 0 ||
      Math.min(sy, py) > height
    ) {
      continue
    }

    const len = Math.hypot(px - sx, py - sy)
    if (len < 1) {
      drawStar(ctx, star, width, height)
      continue
    }

    const size = Math.max(0, (1 - star.z / width) * 3)
    const opacity = Math.max(0, 1 - star.z / width)
    const grad = ctx.createLinearGradient(sx, sy, px, py)
    grad.addColorStop(0, hexToRgba(star.color, opacity))
    grad.addColorStop(1, hexToRgba(star.color, 0))
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(sx, sy)
    ctx.strokeStyle = grad
    ctx.lineWidth = Math.max(0.6, size)
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}
