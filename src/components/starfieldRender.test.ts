import { describe, it, expect } from 'bun:test'
import {
  BACKGROUND,
  createStars,
  drawAnimatedFrame,
  type Star,
  type StarfieldCtx,
} from './starfieldRender'

// Regression test for the "streaks" artifact on the homepage starfield.
//
// The animated frame used a 20%-alpha background fill instead of an opaque
// clear, relying on repeated compositing to fade old star positions out.
// Canvas pixels are 8-bit, and source-over rounding makes the fade converge
// a couple of units ABOVE the background (e.g. #0a0e17 residue settles at
// rgb(12,16,25)) and then stop, so every star leaves a permanent dotted
// ghost trail. Measured live on www.spacemolt.com: after ~15s of animation
// 99.86% of canvas pixels were residue, not background.

type Rgb = [number, number, number]

function parseColor(css: string): { rgb: Rgb; a: number } {
  const hex = css.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 }
  }
  const rgba = css.match(/^rgba?\(([^)]+)\)$/)
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => parseFloat(p.trim()))
    return { rgb: [parts[0], parts[1], parts[2]], a: parts[3] ?? 1 }
  }
  throw new Error(`unsupported color: ${css}`)
}

// 8-bit source-over compositing on an opaque destination, as the browser
// performs it for fillRect: out = round(src * a + dst * (1 - a)).
function compositeOver(dst: Rgb, fillStyle: string, globalAlpha: number): Rgb {
  const { rgb: src, a } = parseColor(fillStyle)
  const alpha = a * globalAlpha
  return dst.map((d, i) => Math.round(src[i] * alpha + d * (1 - alpha))) as Rgb
}

interface FillRectOp {
  fillStyle: string
  globalAlpha: number
  x: number
  y: number
  w: number
  h: number
}

// Records draw calls instead of rasterizing them.
function makeRecordingCtx() {
  const fillRects: FillRectOp[] = []
  const ctx: StarfieldCtx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    fillRect(x, y, w, h) {
      fillRects.push({ fillStyle: String(this.fillStyle), globalAlpha: this.globalAlpha, x, y, w, h })
    },
    beginPath() {},
    arc() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    createLinearGradient() {
      return { addColorStop() {} } as unknown as CanvasGradient
    },
  }
  return { ctx, fillRects }
}

const W = 1280
const H = 720
const BG = parseColor(BACKGROUND).rgb

function frameClear(stars: Star[]): FillRectOp {
  const { ctx, fillRects } = makeRecordingCtx()
  drawAnimatedFrame(ctx, stars, W, H, 1.5)
  const clear = fillRects.find((op) => op.x === 0 && op.y === 0 && op.w === W && op.h === H)
  expect(clear).toBeDefined()
  return clear!
}

describe('starfield animated frame', () => {
  it('erases the previous frame completely — a lit star pixel returns to the background', () => {
    const clear = frameClear(createStars(400, W, H))
    // A pixel where a star was drawn last frame (#e8f4f8, the brightest color).
    let pixel: Rgb = [232, 244, 248]
    // Even after many frames of clearing, the old star must not remain visible.
    for (let i = 0; i < 300; i++) {
      pixel = compositeOver(pixel, clear.fillStyle, clear.globalAlpha)
    }
    expect(pixel).toEqual(BG)
  })

  it('does not get stuck on the rgb(12,16,25) residue observed in production', () => {
    const clear = frameClear(createStars(400, W, H))
    let pixel: Rgb = [12, 16, 25]
    pixel = compositeOver(pixel, clear.fillStyle, clear.globalAlpha)
    expect(pixel).toEqual(BG)
  })
})
