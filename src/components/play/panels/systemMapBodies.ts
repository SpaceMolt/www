/**
 * How each body on the in-system map looks. One branch per POI type and class in the game data
 * (gameserver data/galaxy), and a short list of systems that get a drawing of their own.
 */
import type { Point } from './systemMapMath'

export interface Poi {
  id: string; name: string; type: string; class?: string
  base_id?: string; base_name?: string; base_type?: string; has_base?: boolean; ship_count?: number
  /** The base here belongs to a pirate stronghold crew. */
  stronghold?: boolean
  position?: { x?: number; y?: number }
}

type Ctx = CanvasRenderingContext2D
type Rgb = [number, number, number]

export const TAU = Math.PI * 2
export const COLOR = { bg: '#0d1321', cyan: '#00d4ff', white: '#e8f4f8', silver: '#a8c5d6', grey: '#6b8fa3', green: '#2dd4bf', purple: '#9b59b6' }
export const KIND_COLOR = { mining: '#ff9f6b', ice: '#bfe6ff', gas: '#2dd4bf', rad: '#ffd93d' }

export const circle = (ctx: Ctx, x: number, y: number, r: number) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU) }
const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`
const hex = ([r, g, b]: Rgb) => `rgb(${r},${g},${b})`

/** Seeded random, so a body looks the same each time you enter the system. */
export function seeded(text: string) {
  let seed = [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Stars ──────────────────────────────────────────────────────────────────

/** Star color by spectral letter, hot to cool. */
const SPECTRAL: Record<string, Rgb> = {
  O: [155, 176, 255], B: [170, 191, 255], A: [202, 215, 255], F: [248, 247, 255],
  G: [255, 233, 168], K: [255, 196, 122], M: [255, 155, 107],
}
/** Disc radius in px by luminosity class: supergiants down to dwarfs. */
const LUMINOSITY: Record<string, number> = { Ia: 16, I: 15, II: 13, III: 11, IV: 9, V: 8 }
const STAR_NAMES: Record<string, string> = { Ia: 'supergiant', I: 'supergiant', II: 'bright giant', III: 'giant', IV: 'subgiant', V: 'main sequence' }
const EXOTIC_STARS: Record<string, string> = { BH: 'Black hole', NS: 'Neutron star', DA: 'White dwarf', WR: 'Wolf-Rayet star' }

const spectral = (cls = '') => /^([OBAFGKM])\d?(Ia|IV|III|II|I|V)?$/.exec(cls)

function drawGlow(ctx: Ctx, x: number, y: number, color: Rgb, radius: number, strength = 0.9) {
  const glow = ctx.createRadialGradient(x, y, 1, x, y, radius)
  glow.addColorStop(0, rgba(color, strength)); glow.addColorStop(0.25, rgba(color, strength * 0.37)); glow.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = glow; circle(ctx, x, y, radius); ctx.fill()
}

function drawBlackHole(ctx: Ctx, x: number, y: number, t: number) {
  const hot: Rgb = [255, 170, 90]
  drawGlow(ctx, x, y, [255, 120, 60], 34, 0.35)
  // The disk is a tilted ellipse: the far half goes behind the hole, the near half in front.
  const half = (from: number, to: number) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35); ctx.scale(1, 0.32)
    for (const [r, a] of [[19, 0.25], [15.5, 0.5], [12, 0.85]] as const) {
      ctx.strokeStyle = rgba(hot, a); ctx.lineWidth = 2.6
      ctx.beginPath(); ctx.arc(0, 0, r, from, to); ctx.stroke()
    }
    // A hot spot that circles the disk.
    const spot = t * 0.0009
    if (Math.sin(spot) < 0 === from > 1) { ctx.fillStyle = 'rgba(255,240,210,0.9)'; circle(ctx, Math.cos(spot) * 15.5, Math.sin(spot) * 15.5, 1.6); ctx.fill() }
    ctx.restore()
  }
  half(Math.PI, TAU)
  ctx.fillStyle = '#000'; circle(ctx, x, y, 7); ctx.fill()
  // Light bent around the hole.
  ctx.strokeStyle = 'rgba(255,225,180,0.95)'; ctx.lineWidth = 1.2; circle(ctx, x, y, 7.6); ctx.stroke()
  ctx.strokeStyle = rgba(hot, 0.35); ctx.lineWidth = 1; circle(ctx, x, y, 9.5); ctx.stroke()
  half(0, Math.PI)
}

function drawStar(ctx: Ctx, cls: string | undefined, x: number, y: number, t: number): number {
  if (cls === 'BH') { drawBlackHole(ctx, x, y, t); return 12 }
  if (cls === 'NS') {
    // A pulsar: a tiny hot core with two beams that sweep.
    const color: Rgb = [207, 228, 255]
    drawGlow(ctx, x, y, color, 16)
    const angle = t * 0.0021
    const beam = ctx.createLinearGradient(x - Math.cos(angle) * 30, y - Math.sin(angle) * 30, x + Math.cos(angle) * 30, y + Math.sin(angle) * 30)
    beam.addColorStop(0, rgba(color, 0)); beam.addColorStop(0.5, rgba(color, 0.8)); beam.addColorStop(1, rgba(color, 0))
    ctx.strokeStyle = beam; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(x - Math.cos(angle) * 30, y - Math.sin(angle) * 30); ctx.lineTo(x + Math.cos(angle) * 30, y + Math.sin(angle) * 30); ctx.stroke()
    ctx.strokeStyle = rgba(color, 0.35); ctx.lineWidth = 1; circle(ctx, x, y, 6); ctx.stroke()
    ctx.fillStyle = '#fff'; circle(ctx, x, y, 2.5); ctx.fill()
    return 7
  }
  if (cls === 'DA') {
    // A white dwarf: small, hard, with thin spikes.
    const color: Rgb = [230, 240, 255]
    drawGlow(ctx, x, y, color, 18)
    ctx.strokeStyle = rgba(color, 0.55); ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12); ctx.stroke()
    ctx.fillStyle = '#fff'; circle(ctx, x, y, 3.5); ctx.fill()
    return 6
  }
  if (cls === 'WR') {
    // A Wolf-Rayet star throws its outer layers off in shells.
    const color: Rgb = [184, 166, 255]
    drawGlow(ctx, x, y, color, 46)
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.00012 + i / 3) % 1
      ctx.strokeStyle = rgba(color, 0.4 * (1 - phase)); ctx.lineWidth = 1.2; circle(ctx, x, y, 11 + phase * 26); ctx.stroke()
    }
    ctx.fillStyle = hex(color); circle(ctx, x, y, 9); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(ctx, x, y, 4.5); ctx.fill()
    return 11
  }
  const match = spectral(cls)
  const color = SPECTRAL[match?.[1] ?? 'G']
  const r = LUMINOSITY[match?.[2] ?? 'V']
  drawGlow(ctx, x, y, color, r * 5)
  ctx.fillStyle = hex(color); circle(ctx, x, y, r); ctx.fill()
  return r + 2
}

// ── Planets, moons, asteroids ──────────────────────────────────────────────

/** Planet color and radius in px, by class. */
const PLANET: Record<string, [string, number]> = {
  scorched: ['#b9764a', 4.5], lava_world: ['#e0562f', 5], arid: ['#c9a26b', 5], hothouse: ['#e3c16f', 5.5],
  terran: ['#4d9de0', 6], super_terran: ['#5fb37a', 7], oceanic: ['#3d7fe0', 6], tundra: ['#9fb8c4', 5],
  glacial: ['#cfe6f2', 5], ice_world: ['#d8eef8', 5], jovian: ['#d8a26a', 11], ice_giant: ['#8fd8e8', 8.5],
}

function drawSphere(ctx: Ctx, x: number, y: number, r: number, color: string, lit: [number, number], banded = false) {
  ctx.fillStyle = color; circle(ctx, x, y, r); ctx.fill()
  if (banded) {
    // Cloud bands on a gas giant.
    ctx.save(); circle(ctx, x, y, r); ctx.clip()
    ctx.strokeStyle = 'rgba(4,7,13,0.22)'; ctx.lineWidth = r * 0.22
    for (const dy of [-0.45, 0.1, 0.6]) { ctx.beginPath(); ctx.moveTo(x - r, y + dy * r); ctx.lineTo(x + r, y + dy * r); ctx.stroke() }
    ctx.restore()
  }
  const shade = ctx.createLinearGradient(x - lit[0] * r, y - lit[1] * r, x + lit[0] * r, y + lit[1] * r)
  shade.addColorStop(0.3, 'rgba(4,7,13,0)'); shade.addColorStop(1, 'rgba(4,7,13,0.85)')
  ctx.fillStyle = shade; circle(ctx, x, y, r + 0.5); ctx.fill()
}

// ── Clouds ─────────────────────────────────────────────────────────────────

/** Gas cloud and nebula color by class. */
const CLOUD: Record<string, Rgb> = {
  molecular_cloud: [45, 212, 191], atmospheric: [190, 220, 120], emission: [255, 107, 157],
  reflection: [107, 170, 255], stellar_nursery: [255, 180, 120],
}
const cloudColor = (p: Poi): Rgb => CLOUD[p.class ?? ''] ?? (p.type === 'nebula' ? [140, 130, 255] : CLOUD.molecular_cloud)

function drawCloud(ctx: Ctx, p: Poi, x: number, y: number, t: number) {
  const color = cloudColor(p)
  const rand = seeded(p.id)
  // A nebula is wide and uneven; a gas cloud is one compact puff.
  const blobs = p.type === 'nebula' ? 4 : 1
  const size = p.type === 'nebula' ? 26 : 22
  for (let i = 0; i < blobs; i++) {
    const bx = x + (i ? (rand() - 0.5) * 34 : 0)
    const by = y + (i ? (rand() - 0.5) * 26 : 0)
    const cloud = ctx.createRadialGradient(bx, by, 1, bx, by, size)
    cloud.addColorStop(0, rgba(color, 0.3)); cloud.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = cloud; circle(ctx, bx, by, size); ctx.fill()
  }
  if (p.class === 'stellar_nursery') {
    // New stars that flicker inside the cloud.
    for (let i = 0; i < 5; i++) {
      const sx = x + (rand() - 0.5) * 34, sy = y + (rand() - 0.5) * 26
      ctx.fillStyle = `rgba(255,244,214,${0.45 + 0.4 * Math.sin(t * 0.002 + i * 2.1)})`
      circle(ctx, sx, sy, 1.1); ctx.fill()
    }
  }
}

// ── Fields ─────────────────────────────────────────────────────────────────

/** Rock and ice color by belt composition. */
const FIELD: Record<string, string> = {
  metallic: '#ff9f6b', carbonaceous: '#8f8378', mixed: '#c9a27f', kuiper: '#bfe6ff', cometary: '#e3f6ff',
}

/** The accent color of a POI: its belt particles, its brackets, its edge marker. */
export function poiColor(p: Poi): string {
  if (p.type === 'ice_field') return FIELD[p.class ?? ''] ?? KIND_COLOR.ice
  if (p.type === 'asteroid_belt' || p.type === 'asteroid') return FIELD[p.class ?? ''] ?? KIND_COLOR.mining
  if (p.type === 'gas_cloud' || p.type === 'nebula') return hex(cloudColor(p))
  if (p.type === 'relic') return p.class === 'alien_artifact' ? '#e879f9' : COLOR.purple
  if (p.type.startsWith('wormhole')) return p.type === 'wormhole_collapsed' ? COLOR.grey : '#7dd3fc'
  if (p.type === 'station') return COLOR.cyan
  return COLOR.silver
}

// ── Built things ───────────────────────────────────────────────────────────

/** A base glyph: a station is a diamond, an outpost a triangle, a mobile base a hexagon. */
function drawBase(ctx: Ctx, baseType: string | undefined, x: number, y: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale)
  ctx.fillStyle = COLOR.bg; ctx.strokeStyle = COLOR.cyan; ctx.lineWidth = 1.6
  ctx.beginPath()
  if (baseType === 'outpost') { ctx.moveTo(0, -5.5); ctx.lineTo(5.2, 4); ctx.lineTo(-5.2, 4) }
  else if (baseType === 'mobile_base') { for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos(i * TAU / 6) * 6, Math.sin(i * TAU / 6) * 6) }
  else { ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0) }
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = COLOR.cyan; circle(ctx, 0, baseType === 'outpost' ? 0.8 : 0, 1.5); ctx.fill()
  ctx.restore()
}

/** Hulls welded into one base: the Frontier's Patchwork, and the smaller mobile bases players build. */
function drawWelded(ctx: Ctx, id: string, x: number, y: number, hulls: number, t: number) {
  const rand = seeded(id)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rand() * TAU)
  ctx.lineWidth = 1
  const boxes = Array.from({ length: hulls }, (_, i) => ({
    cx: (rand() - 0.5) * 5, cy: (i - (hulls - 1) / 2) * 5 + (rand() - 0.5) * 1.5,
    w: 11 + rand() * 7, h: 3.6 + rand() * 1.6, tilt: (rand() - 0.5) * 0.35,
    hull: ['#8fa3ad', '#b08a5a', '#6f8796', '#a39a84'][i % 4],
  }))
  // Gantries first, so the hulls sit on top of the welds.
  ctx.strokeStyle = 'rgba(232,244,248,0.55)'; ctx.beginPath()
  boxes.slice(1).forEach((b, i) => [-3, 3].forEach((dx) => { ctx.moveTo(boxes[i].cx + dx, boxes[i].cy); ctx.lineTo(b.cx + dx, b.cy) }))
  ctx.stroke()
  for (const b of boxes) {
    ctx.save(); ctx.translate(b.cx, b.cy); ctx.rotate(b.tilt)
    ctx.fillStyle = b.hull; ctx.strokeStyle = COLOR.bg
    ctx.beginPath(); ctx.moveTo(-b.w / 2, -b.h / 2); ctx.lineTo(b.w / 2 - b.h, -b.h / 2); ctx.lineTo(b.w / 2, 0); ctx.lineTo(b.w / 2 - b.h, b.h / 2); ctx.lineTo(-b.w / 2, b.h / 2)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    // Mismatched running lights, and a drive that still burns.
    ctx.fillStyle = `rgba(255,190,90,${0.5 + 0.4 * Math.sin(t * 0.004 + b.cx)})`; ctx.fillRect(-b.w / 2 - 1.5, -0.6, 1.5, 1.2)
    ctx.fillStyle = COLOR.cyan; ctx.fillRect(b.w / 6, -0.5, 1, 1)
    ctx.restore()
  }
  ctx.restore()
  return hulls * 2.5 + 6
}

/** A pirate stronghold: a spiked, dark-red fortress with a slow warning pulse. */
function drawStronghold(ctx: Ctx, x: number, y: number, t: number) {
  const red: Rgb = [255, 71, 87]
  drawGlow(ctx, x, y, red, 20, 0.22 + 0.1 * Math.sin(t * 0.003))
  ctx.fillStyle = '#1a0a0e'; ctx.strokeStyle = hex(red); ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16 - TAU / 4, d = i % 2 ? 4.5 : i % 4 ? 8 : 11; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) }
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = hex(red); circle(ctx, x, y, 1.8); ctx.fill()
  return 11
}

/** Krynn's Blood Arena: a ringed pit with a duel that never stops. */
function drawArena(ctx: Ctx, x: number, y: number, t: number) {
  const red: Rgb = [255, 71, 87]
  drawGlow(ctx, x, y, red, 26, 0.3)
  ctx.save(); ctx.translate(x, y)
  // Stands: two counter-rotating segmented rings.
  ;[[13, 10, 0.0002], [9.5, 7, -0.00035]].forEach(([radius, segments, spin], ring) => {
    ctx.strokeStyle = rgba(red, ring ? 0.6 : 0.95); ctx.lineWidth = ring ? 1.4 : 2.4
    for (let i = 0; i < segments; i++) {
      const a = i * TAU / segments + t * spin
      ctx.beginPath(); ctx.arc(0, 0, radius, a, a + TAU / segments * 0.72); ctx.stroke()
    }
  })
  ctx.fillStyle = '#12070a'; circle(ctx, 0, 0, 6); ctx.fill()
  // Two fighters circle the pit and trade fire.
  const a = t * 0.0011, d = 3.6
  const [ax, ay, bx, by] = [Math.cos(a) * d, Math.sin(a) * d, -Math.cos(a) * d, -Math.sin(a) * d]
  const shot = (t * 0.004) % 2
  ctx.strokeStyle = rgba([255, 217, 61], shot < 1 ? 0.9 : 0.15); ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * Math.min(shot, 1), ay + (by - ay) * Math.min(shot, 1)); ctx.stroke()
  ctx.fillStyle = COLOR.white; circle(ctx, ax, ay, 1.3); ctx.fill()
  ctx.fillStyle = hex(red); circle(ctx, bx, by, 1.3); ctx.fill()
  ctx.restore()
  return 14
}

function drawRelic(ctx: Ctx, p: Poi, x: number, y: number, t: number): number {
  const color = poiColor(p)
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.4
  if (p.class === 'megastructure') {
    // A built ring with spokes to a hub.
    circle(ctx, x, y, 8); ctx.stroke()
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5); ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); ctx.stroke() }
    circle(ctx, x, y, 2.5); ctx.fill()
    return 10
  }
  if (p.class === 'derelict') {
    // A broken hull: two halves that have drifted apart.
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5); ctx.globalAlpha = 0.85
    ctx.strokeRect(-8, -3, 6.5, 6); ctx.beginPath(); ctx.moveTo(1.5, -3.5); ctx.lineTo(8, -2); ctx.lineTo(7, 4); ctx.lineTo(0.5, 2.5); ctx.closePath(); ctx.stroke()
    ctx.fillRect(-0.6, 3.5, 1.2, 1.2); ctx.fillRect(-1.6, -5.5, 1, 1)
    ctx.restore()
    return 9
  }
  if (p.class === 'alien_artifact') {
    // Not built by anyone we know: a shard that pulses.
    const pulse = (Math.sin(t * 0.0018) + 1) / 2
    drawGlow(ctx, x, y, [232, 121, 249], 18 + pulse * 6, 0.45)
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke()
    return 10
  }
  drawBrackets(ctx, x, y, color)
  return 8
}

function drawWormhole(ctx: Ctx, p: Poi, x: number, y: number, t: number): number {
  const collapsed = p.type === 'wormhole_collapsed'
  const color: Rgb = collapsed ? [107, 143, 163] : p.type === 'wormhole_exit' ? [110, 231, 183] : [125, 211, 252]
  if (!collapsed) drawGlow(ctx, x, y, color, 20, 0.4)
  ctx.fillStyle = '#04070d'; circle(ctx, x, y, 4); ctx.fill()
  if (collapsed) { ctx.strokeStyle = rgba(color, 0.5); ctx.lineWidth = 1; circle(ctx, x, y, 4); ctx.stroke() }
  // Arcs that swirl in at an entrance and out at an exit. A collapsed one is still and broken.
  const spin = collapsed ? 0 : t * (p.type === 'wormhole_exit' ? -0.0012 : 0.0012)
  ctx.lineWidth = 1.4
  for (let i = 0; i < 3; i++) {
    const r = 5 + i * 2.6
    ctx.strokeStyle = rgba(color, collapsed ? 0.75 : 0.9 - i * 0.22)
    ctx.beginPath(); ctx.arc(x, y, r, spin * (1 + i * 0.4) + i * 2.1, spin * (1 + i * 0.4) + i * 2.1 + (collapsed ? 1.2 : 3.6)); ctx.stroke()
  }
  return 11
}

function drawBrackets(ctx: Ctx, x: number, y: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.5
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath(); ctx.moveTo(x + sx * 6.5, y + sy * 3.5); ctx.lineTo(x + sx * 6.5, y + sy * 6.5); ctx.lineTo(x + sx * 3.5, y + sy * 6.5); ctx.stroke()
  }
  ctx.fillStyle = color; circle(ctx, x, y, 1.8); ctx.fill()
}

/** Draw a POI; returns its radius. `lit` is the unit vector away from the star, `t` the animation time in ms. */
export function drawPoi(ctx: Ctx, p: Poi, x: number, y: number, lit: [number, number], t: number): number {
  let r: number
  if (p.type === 'sun') return drawStar(ctx, p.class, x, y, t)
  if (p.id === 'blood_arena') return drawArena(ctx, x, y, t)
  if (p.stronghold) return drawStronghold(ctx, x, y, t)
  if (p.base_id === 'frontier_station') return drawWelded(ctx, p.id, x, y, 4, t)
  if (p.type === 'station' && p.base_type === 'mobile_base') return drawWelded(ctx, p.id, x, y, 2, t)
  if (p.type === 'station') { drawBase(ctx, p.base_type, x, y); return 7 }
  if (p.type === 'planet') {
    const [color, size] = PLANET[p.class ?? ''] ?? ['#9fb3c0', 5]
    if (p.class === 'lava_world') drawGlow(ctx, x, y, [224, 86, 47], size * 2.4, 0.5)
    drawSphere(ctx, x, y, size, color, lit, p.class === 'jovian' || p.class === 'ice_giant')
    r = size
  } else if (p.type === 'moon') {
    drawSphere(ctx, x, y, 3, '#9aa7b0', lit); r = 3
  } else if (p.type === 'asteroid') {
    // One rock, not a field.
    const rand = seeded(p.id)
    ctx.fillStyle = poiColor(p); ctx.beginPath()
    for (let i = 0; i < 7; i++) { const a = i * TAU / 7, d = 3 + rand() * 2.5; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) }
    ctx.closePath(); ctx.fill(); r = 6
  } else if (p.type === 'relic') {
    r = drawRelic(ctx, p, x, y, t)
  } else if (p.type.startsWith('wormhole')) {
    r = drawWormhole(ctx, p, x, y, t)
  } else {
    if (p.type === 'gas_cloud' || p.type === 'nebula') drawCloud(ctx, p, x, y, t)
    drawBrackets(ctx, x, y, poiColor(p)); r = 8
  }
  // A base on a body that is not itself a station: a small glyph on its shoulder.
  if (p.has_base) drawBase(ctx, p.base_type, x + r + 3, y - r - 3, 0.6)
  return r
}

/** "K2III · orange giant", "Black hole", "Molecular cloud". */
export function classLabel(p: Poi): string | undefined {
  if (!p.class) return undefined
  if (p.type === 'sun') {
    if (EXOTIC_STARS[p.class]) return EXOTIC_STARS[p.class]
    const match = spectral(p.class)
    return match ? `${p.class} · ${STAR_NAMES[match[2] ?? 'V']}` : p.class
  }
  return p.class.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

// ── Systems with a drawing of their own ────────────────────────────────────

interface Scene { pois: Poi[]; project: (p: Point) => Point; scale: number; t: number }

/** Alzirr: The Maw pulls a spiral of matter off its companion star. The Bleeding Ring POI is the disk itself. */
const alzirrDisk = (() => {
  const rand = seeded('the_bleeding_ring')
  return Array.from({ length: 700 }, () => ({ turn: rand() * TAU * 2.2, arm: rand() < 0.5 ? 0 : Math.PI, drift: (rand() - 0.5) * (rand() < 0.75 ? 0.22 : 1.4), size: 0.6 + rand() * 1.2, alpha: 0.25 + rand() * 0.6 }))
})()

function drawAlzirr(ctx: Ctx, { pois, project, scale, t }: Scene) {
  const ring = pois.find((p) => p.id === 'the_bleeding_ring')
  const companion = pois.find((p) => p.id === 'alzirr_a')
  const edge = Math.hypot(ring?.position?.x ?? 0.3, ring?.position?.y ?? -0.7) * 1.25 // AU; the POI sits inside the disk
  const maw = project({ x: 0, y: 0 })
  drawGlow(ctx, maw.x, maw.y, [255, 90, 60], edge * scale * 1.15, 0.22)
  // Two arms wind inward. Matter near the hole moves faster and burns hotter.
  for (const dot of alzirrDisk) {
    const k = dot.turn / (TAU * 2.2) // 0 at the hole, 1 at the rim
    const r = edge * (0.08 + 0.92 * k)
    const angle = dot.turn + dot.arm + dot.drift - t * 0.00022 / (0.25 + k)
    const q = project({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
    ctx.fillStyle = `rgba(255,${Math.round(235 - 150 * k)},${Math.round(200 - 170 * k)},${dot.alpha})`
    ctx.fillRect(q.x, q.y, dot.size, dot.size)
  }
  // The stream from the orange giant to the disk.
  if (companion?.position) {
    const from = { x: companion.position.x ?? 0, y: companion.position.y ?? 0 }
    const reach = Math.hypot(from.x, from.y)
    ctx.fillStyle = 'rgba(255,170,110,0.7)'
    for (let i = 0; i < 140; i++) {
      const k = (i / 140 + t * 0.00004) % 1 // 0 at the star, 1 at the rim of the disk
      const base = Math.atan2(from.y, from.x) - k * 1.5
      const r = reach + (edge - reach) * k
      const q = project({ x: Math.cos(base) * r, y: Math.sin(base) * r })
      ctx.fillRect(q.x, q.y, 2 - k, 2 - k)
    }
  }
}

const SPECIAL_SYSTEMS: Record<string, (ctx: Ctx, scene: Scene) => void> = { alzirr: drawAlzirr }

/** Draw the backdrop of a system that has one of its own. Runs before the POIs. */
export const drawSystemSpecial = (ctx: Ctx, systemId: string | undefined, scene: Scene) => SPECIAL_SYSTEMS[systemId ?? '']?.(ctx, scene)

/** POIs whose own drawing is part of the system special, so only their marker is drawn. */
export const drawnBySpecial = (systemId: string | undefined, p: Poi) => systemId === 'alzirr' && p.id === 'the_bleeding_ring'
