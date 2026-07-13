/**
 * Canvas renderer for the battle viewer.
 *
 * The battlefield is drawn the way the engine models it: four concentric
 * range rings (outer → mid → inner → engaged) around a shared centre, with
 * each side approaching from its own bearing. Every frame is drawn purely
 * from (timeline, playhead, wall-clock) — no retained particle state — so
 * scrubbing, stepping and replaying are all deterministic.
 */

import { damageTypeColor, zoneIndex } from './types'
import type { ParticipantSnapshot } from './types'
import type { BattleTimeline, ParticipantMeta } from './timeline'
import { GLYPH_NOSE_X, strokeGlyphDetail, traceGlyphPath } from './shipGlyphs'

// --- Deterministic pseudo-randomness (stable across frames) ---

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic [0,1) from any seed strings/numbers. */
function rand01(...seeds: (string | number)[]): number {
  let h = 2166136261
  for (const s of seeds) {
    const str = String(s)
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  h ^= h >>> 13
  return ((h >>> 0) % 100000) / 100000
}

// --- Arena layout ---

/** Ring radii in arena units, indexed by zoneIndex (outer=0 … engaged=3). */
const RING_R = [1.0, 0.72, 0.45, 0.17]
export const RING_LABELS = ['OUTER', 'MID', 'INNER', 'ENGAGED']

export interface ViewState {
  zoom: number
  panX: number
  panY: number
}

export interface RenderInput {
  timeline: BattleTimeline
  battleId: string
  playhead: number
  timeMs: number
  width: number
  height: number
  hoveredId: string | null
  selectedId: string | null
  view: ViewState
  reducedMotion: boolean
}

interface Vec {
  x: number
  y: number
}

function sideAngle(sideIndex: number, sideCount: number): number {
  if (sideCount <= 2) return sideIndex === 0 ? Math.PI : 0
  return -Math.PI / 2 + (2 * Math.PI * sideIndex) / sideCount
}

/** Arena-space position for one participant snapshot. */
function arenaPos(
  timeline: BattleTimeline,
  meta: ParticipantMeta,
  snap: ParticipantSnapshot,
): Vec {
  const sideCount = timeline.sides.length
  const angle = sideAngle(meta.sideIndex, sideCount)
  const r = RING_R[zoneIndex(snap.zone)]
  const side = timeline.sides[meta.sideIndex]
  const n = side ? side.participantIds.length : 1
  const spacing = Math.min(0.26, n > 1 ? 1.1 / (n - 1) : 0.26)
  const offset = (meta.slot - (n - 1) / 2) * spacing
  const lateral = 0.68 + 0.32 * r
  // Stagger alternate slots radially so wingmates never fully stack.
  const radial = r + (meta.slot % 2 === 1 ? 0.07 : 0)
  const px = -Math.sin(angle)
  const py = Math.cos(angle)
  return {
    x: Math.cos(angle) * radial + px * offset * lateral,
    y: Math.sin(angle) * radial + py * offset * lateral,
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function angleLerp(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return a + d * t
}

export interface SampledShip {
  meta: ParticipantMeta
  snap: ParticipantSnapshot
  nextSnap?: ParticipantSnapshot
  pos: Vec
  facing: number
  moving: boolean
  /** Displayed HP after subtracting damage that has already landed this tick */
  shield: number
  hull: number
  alive: boolean
}

interface AttackTiming {
  start: number
  dur: number
  impact: number
}

function attackTiming(battleId: string, tick: number, idx: number): AttackTiming {
  const r = rand01(battleId, tick, 'atk', idx)
  const start = 0.12 + 0.5 * r
  const dur = 0.2 + 0.12 * rand01(battleId, tick, 'dur', idx)
  return { start, dur, impact: start + dur * 0.82 }
}

/**
 * Samples every participant's position/facing/HP at a fractional playhead.
 * Also used for hit-testing from the component layer.
 */
export function sampleShips(timeline: BattleTimeline, playhead: number, timeMs: number, reducedMotion: boolean): Map<string, SampledShip> {
  const out = new Map<string, SampledShip>()
  const n = timeline.entries.length
  if (n === 0) return out
  const i = Math.max(0, Math.min(n - 1, Math.floor(playhead)))
  const p = Math.max(0, Math.min(1, playhead - i))
  const entry = timeline.entries[i]
  const snaps = timeline.snapshotAt[i]
  const nextSnaps = timeline.snapshotAt[i + 1]
  const moveT = easeInOut(Math.min(1, p / 0.45))

  // First pass: raw positions
  const rawPos = new Map<string, Vec>()
  for (const [id, snap] of snaps) {
    const meta = timeline.participants.get(id)
    if (!meta) continue
    const p0 = arenaPos(timeline, meta, snap)
    const s1 = nextSnaps?.get(id)
    const p1 = s1 ? arenaPos(timeline, meta, s1) : p0
    const pos = { x: lerp(p0.x, p1.x, moveT), y: lerp(p0.y, p1.y, moveT) }
    if (!reducedMotion) {
      const h = hashStr(id)
      pos.x += Math.sin(timeMs * 0.00042 + h) * 0.008
      pos.y += Math.cos(timeMs * 0.00037 + h * 1.7) * 0.008
    }
    rawPos.set(id, pos)
  }

  // Damage landed so far this tick, per target (for live HP bars)
  const landedShield = new Map<string, number>()
  const landedHull = new Map<string, number>()
  ;(entry.attacks ?? []).forEach((a, idx) => {
    if (!a.hit_success) return
    const t = attackTiming(timeline.entries[i].battle_id, entry.tick, idx)
    if (p >= t.impact) {
      landedShield.set(a.target_id, (landedShield.get(a.target_id) ?? 0) + a.shield_damage)
      landedHull.set(a.target_id, (landedHull.get(a.target_id) ?? 0) + a.hull_damage)
    }
  })
  for (const b of entry.burns ?? []) {
    if (p >= 0.35) landedHull.set(b.target_id, (landedHull.get(b.target_id) ?? 0) + b.damage)
  }
  for (const r of entry.regen ?? []) {
    if (p >= 0.55) {
      landedShield.set(r.player_id, (landedShield.get(r.player_id) ?? 0) - r.shield_regen)
      landedHull.set(r.player_id, (landedHull.get(r.player_id) ?? 0) - (r.armor_repair + (r.remote_repair ?? 0)))
    }
  }

  for (const [id, snap] of snaps) {
    const meta = timeline.participants.get(id)
    const pos = rawPos.get(id)
    if (!meta || !pos) continue

    // Facing: toward current target, else toward centre.
    const facingToward = (targetId?: string): number => {
      const t = targetId ? rawPos.get(targetId) : undefined
      if (t) return Math.atan2(t.y - pos.y, t.x - pos.x)
      return Math.atan2(-pos.y, -pos.x)
    }
    const s1 = nextSnaps?.get(id)
    const f0 = facingToward(snap.target_id)
    const f1 = s1 ? facingToward(s1.target_id) : f0
    const facing = angleLerp(f0, f1, moveT)

    const p0 = arenaPos(timeline, meta, snap)
    const p1 = s1 ? arenaPos(timeline, meta, s1) : p0
    const moving = Math.hypot(p1.x - p0.x, p1.y - p0.y) > 0.01 && moveT < 1

    const shield = Math.max(0, Math.min(snap.max_shield, snap.shield - (landedShield.get(id) ?? 0)))
    const hull = Math.max(0, Math.min(snap.max_hull, snap.hull - (landedHull.get(id) ?? 0)))

    // A ship destroyed this tick starts disintegrating at its kill effect.
    let alive = true
    const killed = (entry.kills ?? []).some(k => k.victim_id === id)
    const escaped = (entry.flee ?? []).some(f => f.player_id === id && f.escaped)
    if (killed && p > 0.72) alive = false
    if (escaped && p > 0.68) alive = false

    out.set(id, { meta, snap, nextSnap: s1, pos, facing, moving, shield, hull, alive })
  }
  return out
}

// --- Screen transform ---

export interface ScreenTransform {
  toScreen(v: Vec): Vec
  /** Pixels per arena unit */
  scale: number
}

export function makeTransform(width: number, height: number, view: ViewState): ScreenTransform {
  const base = (Math.min(width, height) / 2) * 0.8
  const scale = base * view.zoom
  const cx = width / 2 + view.panX
  const cy = height / 2 + view.panY
  return {
    toScreen: v => ({ x: cx + v.x * scale, y: cy + v.y * scale }),
    scale,
  }
}

/** Glyph radius per ship scale (1 = personal … 5 = capital), in px at zoom 1. */
const SCALE_RADIUS = [9, 9, 12, 15.5, 20, 25.5]

function shipRadius(meta: ParticipantMeta, pxScale: number): number {
  // Glyph size by ship scale, in px at zoom 1 (tf.scale ≈ 360px on a desktop
  // viewport), clamped so extreme zoom or tiny viewports keep glyphs readable.
  const base =
    meta.kind === 'drone' ? 5 : meta.kind === 'creature' ? 9 : SCALE_RADIUS[Math.max(1, Math.min(5, Math.round(meta.scale)))]
  return base * Math.max(0.6, Math.min(1.8, pxScale / 360))
}

// --- Background (stars + nebula), drawn once per resize ---

export function renderBackground(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number,
  battleId: string,
  sideColors: string[],
): void {
  canvas.width = Math.max(1, Math.round(width * dpr))
  canvas.height = Math.max(1, Math.round(height * dpr))
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.fillStyle = '#04070f'
  ctx.fillRect(0, 0, width, height)

  // Nebula tints from the first two side colors, pushed to the flanks.
  const tints = [sideColors[0] ?? '#00d4ff', sideColors[1] ?? '#e63946', '#1a2744']
  const spots: [number, number, number, string, number][] = [
    [width * 0.12, height * 0.3, Math.max(width, height) * 0.55, tints[0], 0.05],
    [width * 0.88, height * 0.7, Math.max(width, height) * 0.55, tints[1], 0.05],
    [width * 0.5, height * 0.5, Math.max(width, height) * 0.7, tints[2], 0.16],
  ]
  for (const [x, y, r, color, alpha] of spots) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, hexWithAlpha(color, alpha))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
  }

  // Two star layers seeded by battle id.
  const seed = hashStr(battleId)
  for (let layer = 0; layer < 2; layer++) {
    const count = layer === 0 ? 140 : 60
    for (let s = 0; s < count; s++) {
      const x = rand01(seed, layer, s, 'x') * width
      const y = rand01(seed, layer, s, 'y') * height
      const r = layer === 0 ? 0.5 + rand01(seed, s, 'r') * 0.7 : 1 + rand01(seed, s, 'R') * 1.1
      const a = layer === 0 ? 0.25 + rand01(seed, s, 'a') * 0.3 : 0.45 + rand01(seed, s, 'A') * 0.4
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(232,244,248,${a.toFixed(2)})`
      ctx.fill()
    }
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// --- Main render ---

export function renderFrame(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { timeline, battleId, playhead, timeMs, width, height, hoveredId, selectedId, view, reducedMotion } = input
  const n = timeline.entries.length
  if (n === 0) return

  const i = Math.max(0, Math.min(n - 1, Math.floor(playhead)))
  const p = Math.max(0, Math.min(1, playhead - i))
  const entry = timeline.entries[i]
  const tf = makeTransform(width, height, view)
  const ships = sampleShips(timeline, playhead, timeMs, reducedMotion)

  drawArena(ctx, tf, timeline, timeMs, width, height)
  drawWrecks(ctx, tf, timeline, playhead, battleId, ships)

  // Target line for the selected ship.
  const focusId = selectedId || hoveredId
  if (focusId) {
    const s = ships.get(focusId)
    const target = s?.snap.target_id ? ships.get(s.snap.target_id) : undefined
    if (s && target) {
      const a = tf.toScreen(s.pos)
      const b = tf.toScreen(target.pos)
      ctx.save()
      ctx.setLineDash([4, 6])
      ctx.strokeStyle = 'rgba(230,57,70,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Ships under effects, effects on top.
  for (const s of ships.values()) {
    if (!s.alive) continue
    const sideSize = timeline.sides[s.meta.sideIndex]?.participantIds.length ?? 1
    drawShip(ctx, tf, s, timeMs, hoveredId === s.meta.id, selectedId === s.meta.id, battleId, entry.tick, p, reducedMotion, sideSize)
  }

  drawAttacks(ctx, tf, ships, entry, battleId, p)
  drawKills(ctx, tf, ships, entry, battleId, p)
  drawEscapes(ctx, tf, ships, entry, p)
  drawJoins(ctx, tf, timeline, ships, entry, p)
  drawFloaters(ctx, tf, ships, entry, battleId, p)
}

// --- Arena: rings, sector glows, centre marker ---

function drawArena(
  ctx: CanvasRenderingContext2D,
  tf: ScreenTransform,
  timeline: BattleTimeline,
  timeMs: number,
  width: number,
  height: number,
): void {
  const c = tf.toScreen({ x: 0, y: 0 })

  // Soft home-sector glow for each side at its rim bearing.
  const sideCount = timeline.sides.length
  for (const side of timeline.sides) {
    const a = sideAngle(side.index, sideCount)
    const gpos = tf.toScreen({ x: Math.cos(a) * 1.05, y: Math.sin(a) * 1.05 })
    const g = ctx.createRadialGradient(gpos.x, gpos.y, 0, gpos.x, gpos.y, tf.scale * 0.75)
    g.addColorStop(0, hexWithAlpha(side.color, 0.07))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
  }

  // Range rings.
  for (let z = 0; z < RING_R.length; z++) {
    const r = RING_R[z] * tf.scale
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
    ctx.strokeStyle = z === 3 ? 'rgba(0,212,255,0.22)' : 'rgba(77,171,247,0.13)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Ring label along the upper-right diagonal.
    const la = -Math.PI / 4
    const lx = c.x + Math.cos(la) * (r - 4)
    const ly = c.y + Math.sin(la) * (r - 4)
    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.fillStyle = 'rgba(107,143,163,0.55)'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(RING_LABELS[z], lx + 4, ly)
  }

  // Rotating dashes on the engaged ring + centre crosshair.
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(timeMs * 0.00012)
  ctx.setLineDash([6, 10])
  ctx.beginPath()
  ctx.arc(0, 0, RING_R[3] * tf.scale * 0.55, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(0,212,255,0.16)'
  ctx.stroke()
  ctx.restore()

  ctx.strokeStyle = 'rgba(0,212,255,0.35)'
  ctx.lineWidth = 1
  const ch = 5
  ctx.beginPath()
  ctx.moveTo(c.x - ch, c.y)
  ctx.lineTo(c.x + ch, c.y)
  ctx.moveTo(c.x, c.y - ch)
  ctx.lineTo(c.x, c.y + ch)
  ctx.stroke()
}

// --- Ship glyphs ---

function drawShip(
  ctx: CanvasRenderingContext2D,
  tf: ScreenTransform,
  s: SampledShip,
  timeMs: number,
  hovered: boolean,
  selected: boolean,
  battleId: string,
  tick: number,
  p: number,
  reducedMotion: boolean,
  sideSize: number,
): void {
  const pos = tf.toScreen(s.pos)
  const size = shipRadius(s.meta, tf.scale)
  const color = s.meta.color

  ctx.save()

  // Selection / hover ring.
  if (selected || hovered) {
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, size * 2.2, 0, Math.PI * 2)
    ctx.strokeStyle = hexWithAlpha(color, selected ? 0.75 : 0.4)
    ctx.setLineDash(selected ? [] : [3, 5])
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Shield bubble: opacity tracks shield fraction.
  if (s.snap.max_shield > 0) {
    const frac = s.shield / s.snap.max_shield
    if (frac > 0.02) {
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, size * 1.7, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(77,171,247,${(0.14 + frac * 0.38).toFixed(2)})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  // Evade afterimages.
  if (s.snap.stance === 'evade' && !reducedMotion) {
    for (let g = 1; g <= 2; g++) {
      drawShipBody(ctx, pos.x - Math.cos(s.facing) * g * size * 0.9, pos.y - Math.sin(s.facing) * g * size * 0.9, size, s.facing, s.meta, hexWithAlpha(color, 0.12 / g), true)
    }
  }

  // Engine glow (brighter while moving).
  const flick = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(timeMs * 0.02 + hashStr(s.meta.id))
  const engineA = s.moving ? 0.7 + 0.3 * flick : 0.22 + 0.18 * flick
  const ex = pos.x - Math.cos(s.facing) * size * 1.15
  const ey = pos.y - Math.sin(s.facing) * size * 1.15
  const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, size * (s.moving ? 1.3 : 0.7))
  eg.addColorStop(0, `rgba(0,212,255,${(engineA * 0.7).toFixed(2)})`)
  eg.addColorStop(1, 'rgba(0,212,255,0)')
  ctx.fillStyle = eg
  ctx.beginPath()
  ctx.arc(ex, ey, size * (s.moving ? 1.3 : 0.7), 0, Math.PI * 2)
  ctx.fill()

  // Body.
  drawShipBody(ctx, pos.x, pos.y, size, s.facing, s.meta, color, false)

  // Brace stance: rotating guard arcs.
  if (s.snap.stance === 'brace') {
    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate(reducedMotion ? 0 : timeMs * 0.0011)
    for (let a = 0; a < 2; a++) {
      ctx.beginPath()
      ctx.arc(0, 0, size * 1.45, a * Math.PI, a * Math.PI + Math.PI * 0.65)
      ctx.strokeStyle = 'rgba(45,212,191,0.55)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.restore()
  }

  // Flee stance: outward chevrons + spool pips.
  if (s.snap.stance === 'flee') {
    const away = Math.atan2(s.pos.y, s.pos.x)
    for (let k = 0; k < 2; k++) {
      const d = size * (1.9 + k * 0.55 + (reducedMotion ? 0 : ((timeMs * 0.004) % 0.55)))
      const bx = pos.x + Math.cos(away) * d
      const by = pos.y + Math.sin(away) * d
      ctx.beginPath()
      ctx.moveTo(bx - Math.cos(away - 0.5) * 5, by - Math.sin(away - 0.5) * 5)
      ctx.lineTo(bx, by)
      ctx.lineTo(bx - Math.cos(away + 0.5) * 5, by - Math.sin(away + 0.5) * 5)
      ctx.strokeStyle = 'rgba(255,217,61,0.7)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  // Burning: seeded embers drifting off the hull.
  if ((s.snap.burn_ticks ?? 0) > 0 && !reducedMotion) {
    for (let e = 0; e < 5; e++) {
      const cyc = (timeMs * 0.0011 + rand01(s.meta.id, 'ember', e)) % 1
      const ang = rand01(s.meta.id, 'embang', e) * Math.PI * 2
      const dx = Math.cos(ang) * size * 0.6
      ctx.beginPath()
      ctx.arc(pos.x + dx + cyc * 4, pos.y + Math.sin(ang) * size * 0.5 - cyc * size * 1.6, 1.4 * (1 - cyc), 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,149,81,${(0.8 * (1 - cyc)).toFixed(2)})`
      ctx.fill()
    }
  }

  // Disruption: purple crackle flicker.
  if ((s.snap.disruption_ticks ?? 0) > 0) {
    const on = reducedMotion || Math.sin(timeMs * 0.03 + hashStr(s.meta.id)) > 0.2
    if (on) {
      ctx.save()
      ctx.strokeStyle = 'rgba(155,89,182,0.8)'
      ctx.lineWidth = 1
      for (let b = 0; b < 3; b++) {
        const a0 = rand01(s.meta.id, 'zap', b, Math.floor(timeMs / 120)) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(pos.x + Math.cos(a0) * size * 0.5, pos.y + Math.sin(a0) * size * 0.5)
        ctx.lineTo(pos.x + Math.cos(a0 + 0.55) * size * 1.35, pos.y + Math.sin(a0 + 0.55) * size * 1.35)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  // --- Fixed-size HUD: bars + labels ---
  const barW = Math.max(26, size * 2.4)
  const barY = pos.y + size * 1.9 + 4
  if (s.snap.max_shield > 0) {
    drawBar(ctx, pos.x - barW / 2, barY, barW, 3, s.shield / s.snap.max_shield, '#4dabf7')
  }
  const hullFrac = s.snap.max_hull > 0 ? s.hull / s.snap.max_hull : 0
  const hullColor = hullFrac > 0.55 ? '#2dd4bf' : hullFrac > 0.25 ? '#ffd93d' : '#e63946'
  drawBar(ctx, pos.x - barW / 2, barY + (s.snap.max_shield > 0 ? 5 : 0), barW, 3, hullFrac, hullColor)

  // Name + class labels.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.font = `${hovered || selected ? '600 ' : ''}11px "JetBrains Mono", monospace`
  ctx.fillStyle = hovered || selected ? '#e8f4f8' : 'rgba(232,244,248,0.82)'
  ctx.fillText(s.meta.name, pos.x, pos.y - size * 1.9 - 4)
  // Class sublabels crowd large formations; show them on focus only.
  if (sideSize <= 4 || hovered || selected) {
    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.fillStyle = 'rgba(107,143,163,0.75)'
    ctx.fillText(s.meta.shipClassName, pos.x, pos.y - size * 1.9 + 7)
  }

  ctx.restore()
}

function drawShipBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  facing: number,
  meta: ParticipantMeta,
  color: string,
  ghost: boolean,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(facing)
  traceGlyphPath(ctx, meta.archetype, size, hashStr(meta.id))

  if (ghost) {
    ctx.fillStyle = color
    ctx.fill()
  } else {
    const g = ctx.createLinearGradient(-size, 0, size, 0)
    g.addColorStop(0, hexWithAlpha(color, 0.55))
    g.addColorStop(1, color)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(232,244,248,0.65)'
    ctx.lineWidth = 0.8
    ctx.stroke()
    strokeGlyphDetail(ctx, meta.archetype, size)
    // Armed cue: a short muzzle line off the nose — this thing shoots.
    // Skipped on tiny glyphs where it would read as noise.
    if (meta.armed && size >= 8) {
      const nose = GLYPH_NOSE_X[meta.archetype]
      ctx.beginPath()
      ctx.moveTo(size * nose, 0)
      ctx.lineTo(size * (nose + 0.35), 0)
      ctx.strokeStyle = 'rgba(232,244,248,0.85)'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
  ctx.fillStyle = 'rgba(13,19,33,0.85)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = color
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h)
  ctx.strokeStyle = 'rgba(107,143,163,0.35)'
  ctx.lineWidth = 0.5
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1)
}

// --- Weapons fire ---

function drawAttacks(
  ctx: CanvasRenderingContext2D,
  tf: ScreenTransform,
  ships: Map<string, SampledShip>,
  entry: BattleTimeline['entries'][number],
  battleId: string,
  p: number,
): void {
  const attacks = entry.attacks ?? []
  attacks.forEach((a, idx) => {
    const from = ships.get(a.attacker_id)
    const to = ships.get(a.target_id)
    if (!from || !to) return
    const t = attackTiming(battleId, entry.tick, idx)
    const tp = (p - t.start) / t.dur
    if (tp < 0 || tp > 1.6) return

    const src = tf.toScreen(from.pos)
    let dst = tf.toScreen(to.pos)

    // Misses streak past the target.
    if (!a.hit_success) {
      const dx = dst.x - src.x
      const dy = dst.y - src.y
      const len = Math.hypot(dx, dy) || 1
      const missSide = rand01(battleId, entry.tick, 'miss', idx) > 0.5 ? 1 : -1
      dst = {
        x: dst.x + (dx / len) * 46 + (-dy / len) * 22 * missSide,
        y: dst.y + (dy / len) * 46 + (dx / len) * 22 * missSide,
      }
    }

    const weapons = a.weapons?.length ? a.weapons : null
    if (weapons) {
      weapons.forEach((w, j) => {
        const wtp = tp - j * 0.13
        if (wtp < 0 || wtp > 1) return
        drawProjectile(ctx, src, dst, w.damage_type || a.damage_type, wtp, battleId, entry.tick, idx * 7 + j, a.splash === true)
      })
    } else if (tp <= 1) {
      drawProjectile(ctx, src, dst, a.damage_type, tp, battleId, entry.tick, idx, a.splash === true)
    }

    // Impact effects at the (real) target.
    if (a.hit_success && p >= t.impact && p <= t.impact + 0.22) {
      const it = (p - t.impact) / 0.22
      const targetPos = tf.toScreen(to.pos)
      const size = shipRadius(to.meta, tf.scale)
      const crit = a.weapons?.some(w => w.crit_fired) ?? false

      if (a.shield_damage > 0 && to.snap.max_shield > 0) {
        // Shield ripple facing the attacker.
        const ang = Math.atan2(src.y - targetPos.y, src.x - targetPos.x)
        ctx.beginPath()
        ctx.arc(targetPos.x, targetPos.y, size * (1.7 + it * 0.6), ang - 0.8, ang + 0.8)
        ctx.strokeStyle = `rgba(120,210,255,${(0.9 * (1 - it)).toFixed(2)})`
        ctx.lineWidth = 2.5 * (1 - it)
        ctx.stroke()
      }
      if (a.hull_damage > 0) {
        // Hull sparks.
        for (let sp = 0; sp < 7; sp++) {
          const ang = rand01(battleId, entry.tick, 'spark', idx, sp) * Math.PI * 2
          const d = size * (0.4 + it * 2.1)
          const sx = targetPos.x + Math.cos(ang) * d
          const sy = targetPos.y + Math.sin(ang) * d
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + Math.cos(ang) * 4, sy + Math.sin(ang) * 4)
          ctx.strokeStyle = `rgba(255,${180 - Math.floor(it * 100)},81,${(1 - it).toFixed(2)})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      }
      if (crit) {
        ctx.beginPath()
        ctx.arc(targetPos.x, targetPos.y, size * (1 + it * 3), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,255,255,${(0.8 * (1 - it)).toFixed(2)})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      // Flash core.
      const fg = ctx.createRadialGradient(targetPos.x, targetPos.y, 0, targetPos.x, targetPos.y, size * (0.8 + it))
      fg.addColorStop(0, `rgba(255,255,255,${(0.55 * (1 - it)).toFixed(2)})`)
      fg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = fg
      ctx.beginPath()
      ctx.arc(targetPos.x, targetPos.y, size * (0.8 + it), 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  src: Vec,
  dst: Vec,
  damageType: string,
  tp: number,
  battleId: string,
  tick: number,
  seed: number,
  splash: boolean,
): void {
  const color = damageTypeColor(damageType)
  const dx = dst.x - src.x
  const dy = dst.y - src.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  ctx.save()
  if (splash) ctx.globalAlpha = 0.55

  switch (damageType) {
    case 'energy':
    case 'thermal': {
      // Beam: intensity envelope ramps up then down.
      const env = Math.sin(Math.min(1, tp) * Math.PI)
      ctx.strokeStyle = hexWithAlpha(color, 0.32 * env)
      ctx.lineWidth = 4.5
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(dst.x, dst.y)
      ctx.stroke()
      ctx.strokeStyle = `rgba(255,255,255,${(0.85 * env).toFixed(2)})`
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(dst.x, dst.y)
      ctx.stroke()
      break
    }
    case 'em': {
      // Crackling arc: deterministic zigzag, re-jittered as tp advances.
      const env = Math.sin(Math.min(1, tp) * Math.PI)
      const segs = 8
      ctx.strokeStyle = hexWithAlpha(color, 0.9 * env)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      for (let s = 1; s < segs; s++) {
        const f = s / segs
        const jag = (rand01(battleId, tick, seed, s, Math.floor(tp * 6)) - 0.5) * 22 * env
        ctx.lineTo(src.x + dx * f + -uy * jag, src.y + dy * f + ux * jag)
      }
      ctx.lineTo(dst.x, dst.y)
      ctx.stroke()
      break
    }
    case 'explosive': {
      // Missile with a curved path and trail.
      const bulge = (rand01(battleId, tick, seed, 'bulge') - 0.5) * len * 0.5
      const mx = src.x + dx * 0.5 + -uy * bulge
      const my = src.y + dy * 0.5 + ux * bulge
      const pt = bezierPoint(src, { x: mx, y: my }, dst, Math.min(1, tp))
      // Trail.
      ctx.strokeStyle = hexWithAlpha(color, 0.35)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      const steps = 8
      for (let s = 0; s <= steps; s++) {
        const f = Math.max(0, Math.min(1, tp) - 0.25) + (s / steps) * Math.min(0.25, Math.min(1, tp))
        const q = bezierPoint(src, { x: mx, y: my }, dst, f)
        if (s === 0) ctx.moveTo(q.x, q.y)
        else ctx.lineTo(q.x, q.y)
      }
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = hexWithAlpha(color, 0.35)
      ctx.fill()
      break
    }
    case 'void': {
      const f = Math.min(1, tp)
      const px = src.x + dx * f
      const py = src.y + dy * f
      const g = ctx.createRadialGradient(px, py, 0, px, py, 9)
      g.addColorStop(0, 'rgba(199,125,255,0.95)')
      g.addColorStop(0.5, 'rgba(90,20,140,0.5)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(px, py, 9, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    default: {
      // Kinetic: tracer rounds.
      for (let k = 0; k < 3; k++) {
        const f = Math.min(1, tp) - k * 0.09
        if (f < 0 || f > 1) continue
        const px = src.x + dx * f
        const py = src.y + dy * f
        ctx.strokeStyle = hexWithAlpha(color, 0.95)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(px - ux * 7, py - uy * 7)
        ctx.lineTo(px, py)
        ctx.stroke()
      }
      break
    }
  }
  ctx.restore()
}

function bezierPoint(a: Vec, b: Vec, c: Vec, t: number): Vec {
  const mt = 1 - t
  return {
    x: mt * mt * a.x + 2 * mt * t * b.x + t * t * c.x,
    y: mt * mt * a.y + 2 * mt * t * b.y + t * t * c.y,
  }
}

// --- Kill explosions ---

function drawKills(
  ctx: CanvasRenderingContext2D,
  tf: ScreenTransform,
  ships: Map<string, SampledShip>,
  entry: BattleTimeline['entries'][number],
  battleId: string,
  p: number,
): void {
  for (const k of entry.kills ?? []) {
    const victim = ships.get(k.victim_id)
    if (!victim) continue
    const t = (p - 0.55) / 0.45
    if (t < 0) continue
    const pos = tf.toScreen(victim.pos)
    const size = shipRadius(victim.meta, tf.scale)

    // White flash.
    if (t < 0.2) {
      const ft = t / 0.2
      const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size * 4)
      g.addColorStop(0, `rgba(255,255,255,${(0.9 * (1 - ft)).toFixed(2)})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, size * 4, 0, Math.PI * 2)
      ctx.fill()
    }
    // Fireball.
    const fb = Math.min(1, t / 0.7)
    const fr = size * (0.8 + fb * 1.8)
    const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, fr)
    g.addColorStop(0, `rgba(255,220,150,${(0.85 * (1 - fb)).toFixed(2)})`)
    g.addColorStop(0.5, `rgba(255,107,53,${(0.6 * (1 - fb)).toFixed(2)})`)
    g.addColorStop(1, 'rgba(230,57,70,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, fr, 0, Math.PI * 2)
    ctx.fill()
    // Shockwave ring.
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, size * (1 + t * 5), 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255,180,120,${(0.55 * (1 - t)).toFixed(2)})`
    ctx.lineWidth = 1.5
    ctx.stroke()
    // Debris streaks.
    for (let d = 0; d < 9; d++) {
      const ang = rand01(battleId, entry.tick, 'debris', k.victim_id, d) * Math.PI * 2
      const speed = 2 + rand01(battleId, 'dspd', d) * 4
      const dist = size * speed * t
      const dx = pos.x + Math.cos(ang) * dist
      const dy = pos.y + Math.sin(ang) * dist
      ctx.beginPath()
      ctx.moveTo(dx, dy)
      ctx.lineTo(dx + Math.cos(ang) * 5 * (1 - t), dy + Math.sin(ang) * 5 * (1 - t))
      ctx.strokeStyle = `rgba(255,150,100,${(0.8 * (1 - t)).toFixed(2)})`
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
  }
}

/** Fading debris markers where ships died on earlier ticks. */
function drawWrecks(
  ctx: CanvasRenderingContext2D,
  tf: ScreenTransform,
  timeline: BattleTimeline,
  playhead: number,
  battleId: string,
  ships: Map<string, SampledShip>,
): void {
  for (const meta of timeline.participants.values()) {
    if (meta.fate !== 'destroyed' || meta.fateTickIndex === undefined) continue
    const dt = playhead - meta.fateTickIndex
    if (dt < 0.95 || dt > 3) continue
    const snaps = timeline.snapshotAt[meta.fateTickIndex]
    const snap = snaps?.get(meta.id)
    if (!snap) continue
    const pos = tf.toScreen(arenaPos(timeline, meta, snap))
    const alpha = Math.max(0, 0.5 * (1 - (dt - 1) / 2))
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = '#6b8fa3'
    ctx.lineWidth = 1
    for (let d = 0; d < 5; d++) {
      const ang = rand01(battleId, 'wreck', meta.id, d) * Math.PI * 2
      const r1 = 3 + rand01(battleId, 'wr1', d) * 6
      ctx.beginPath()
      ctx.moveTo(pos.x + Math.cos(ang) * r1, pos.y + Math.sin(ang) * r1)
      ctx.lineTo(pos.x + Math.cos(ang) * (r1 + 4), pos.y + Math.sin(ang) * (r1 + 4))
      ctx.stroke()
    }
    ctx.font = '8px "JetBrains Mono", monospace'
    ctx.fillStyle = '#6b8fa3'
    ctx.textAlign = 'center'
    ctx.fillText('✕ ' + meta.name, pos.x, pos.y - 10)
    ctx.restore()
  }
}

// --- Escapes & joins ---

function drawEscapes(
  ctx: CanvasRenderingContext2D,
  tf: ScreenTransform,
  ships: Map<string, SampledShip>,
  entry: BattleTimeline['entries'][number],
  p: number,
): void {
  for (const f of entry.flee ?? []) {
    if (!f.escaped) continue
    const s = ships.get(f.player_id)
    if (!s) continue
    const t = (p - 0.5) / 0.35
    if (t < 0 || t > 1.4) continue
    const pos = tf.toScreen(s.pos)
    const away = Math.atan2(s.pos.y, s.pos.x)
    const stretch = 20 + t * 160
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - t)
    const g = ctx.createLinearGradient(pos.x, pos.y, pos.x + Math.cos(away) * stretch, pos.y + Math.sin(away) * stretch)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(1, 'rgba(0,212,255,0)')
    ctx.strokeStyle = g
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.lineTo(pos.x + Math.cos(away) * stretch, pos.y + Math.sin(away) * stretch)
    ctx.stroke()
    ctx.restore()
  }
}

function drawJoins(
  ctx: CanvasRenderingContext2D,
  tf: ScreenTransform,
  timeline: BattleTimeline,
  ships: Map<string, SampledShip>,
  entry: BattleTimeline['entries'][number],
  p: number,
): void {
  for (const j of entry.joins ?? []) {
    const s = ships.get(j.player_id)
    // The joiner may only snapshot from the next tick; find its home position.
    let pos: Vec | null = null
    if (s) {
      pos = tf.toScreen(s.pos)
    } else {
      const meta = timeline.participants.get(j.player_id)
      const nextSnap = meta ? timeline.snapshotAt[meta.firstTickIndex]?.get(j.player_id) : undefined
      if (meta && nextSnap) pos = tf.toScreen(arenaPos(timeline, meta, nextSnap))
    }
    if (!pos) continue
    const t = p / 0.35
    if (t > 1) continue
    ctx.save()
    ctx.globalAlpha = 1 - t
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 6 + t * 26, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(45,212,191,0.8)'
    ctx.lineWidth = 2 * (1 - t)
    ctx.stroke()
    const streak = 90 * (1 - t)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(pos.x - streak, pos.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.restore()
  }
}

// --- Damage floaters ---

function drawFloaters(
  ctx: CanvasRenderingContext2D,
  tf: ScreenTransform,
  ships: Map<string, SampledShip>,
  entry: BattleTimeline['entries'][number],
  battleId: string,
  p: number,
): void {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const attacks = entry.attacks ?? []
  attacks.forEach((a, idx) => {
    const to = ships.get(a.target_id)
    if (!to) return
    const t = attackTiming(battleId, entry.tick, idx)
    const life = (p - t.impact) / 0.4
    if (life < 0 || life > 1) return
    const pos = tf.toScreen(to.pos)
    const size = shipRadius(to.meta, tf.scale)
    const rise = life * 26
    const alpha = life < 0.7 ? 1 : (1 - life) / 0.3
    const crit = a.weapons?.some(w => w.crit_fired) ?? false
    const jx = (rand01(battleId, entry.tick, 'fjx', idx) - 0.5) * 18

    if (!a.hit_success) {
      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.fillStyle = `rgba(107,143,163,${(alpha * 0.9).toFixed(2)})`
      ctx.fillText('miss', pos.x + jx, pos.y - size * 2 - rise)
      return
    }
    let y = pos.y - size * 2 - rise
    if (a.shield_damage > 0) {
      ctx.font = `${crit ? '700 13px' : '600 11px'} "JetBrains Mono", monospace`
      ctx.fillStyle = `rgba(120,210,255,${alpha.toFixed(2)})`
      ctx.fillText(`-${a.shield_damage}`, pos.x + jx, y)
      y -= 12
    }
    if (a.hull_damage > 0) {
      ctx.font = `${crit ? '700 14px' : '600 12px'} "JetBrains Mono", monospace`
      ctx.fillStyle = `rgba(255,140,90,${alpha.toFixed(2)})`
      ctx.fillText(`-${a.hull_damage}`, pos.x + jx, y)
      y -= 12
    }
    if (crit) {
      ctx.font = '700 9px "JetBrains Mono", monospace'
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`
      ctx.fillText('CRIT', pos.x + jx, y)
    }
  })

  // Regen floaters.
  for (const r of entry.regen ?? []) {
    const s = ships.get(r.player_id)
    if (!s) continue
    const life = (p - 0.55) / 0.4
    if (life < 0 || life > 1) continue
    const total = r.shield_regen + r.armor_repair + (r.remote_repair ?? 0)
    if (total <= 0) continue
    const pos = tf.toScreen(s.pos)
    const size = shipRadius(s.meta, tf.scale)
    ctx.font = '600 11px "JetBrains Mono", monospace'
    ctx.fillStyle = `rgba(94,230,168,${(1 - life).toFixed(2)})`
    ctx.fillText(`+${total}`, pos.x, pos.y - size * 2 - life * 22)
  }

  // Burn floaters.
  for (const b of entry.burns ?? []) {
    const s = ships.get(b.target_id)
    if (!s) continue
    const life = (p - 0.35) / 0.4
    if (life < 0 || life > 1) continue
    const pos = tf.toScreen(s.pos)
    const size = shipRadius(s.meta, tf.scale)
    ctx.font = '600 10px "JetBrains Mono", monospace'
    ctx.fillStyle = `rgba(255,149,81,${(1 - life).toFixed(2)})`
    ctx.fillText(`-${b.damage} 🔥`, pos.x + 14, pos.y - size * 1.6 - life * 20)
  }
  ctx.restore()
}
