'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import { useTranslation } from '@/i18n'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

// --- Types matching the gameserver battle log API ---

interface FittedModule {
  name: string
  category: string
  loaded_ammo?: string
  current_ammo?: number
  magazine_size?: number
}

interface ParticipantSnapshot {
  player_id: string
  username: string
  side_id: number
  zone: string
  stance: string
  target_id?: string
  auto_pilot: boolean
  flee_counter: number
  ship_class: string
  hull: number
  max_hull: number
  shield: number
  max_shield: number
  fuel: number
  max_fuel: number
  damage_dealt: number
  damage_taken: number
  kill_count: number
  // Active status effects (debuffs) at the start of this tick
  disruption_ticks?: number
  speed_penalty_pct?: number
  damage_penalty_pct?: number
  burn_ticks?: number
  burn_damage_per_tick?: number
  armor_melt_ticks?: number
  armor_melt_pct?: number
  x: number
  y: number
  modules?: FittedModule[]
}

interface WeaponFireDetail {
  instance_id: string
  name: string
  base_damage: number
  after_disruption: number
  type_bonus_pct: number
  crit_chance: number
  crit_roll: number
  crit_fired: boolean
  damage: number
  damage_type: string
  ammo_used?: string
  ammo_mod?: number
}

interface AttackLogEntry {
  attacker_id: string
  target_id: string
  zone_distance: number
  weapons: WeaponFireDetail[]
  raw_damage: number
  weapon_skill_pct: number
  capital_bonus_pct?: number
  off_buff_pct?: number
  pre_hit_damage: number
  hit_chance: number
  hit_roll: number
  hit_success: boolean
  stance_mult?: number
  after_stance?: number
  def_buff_pct?: number
  after_def_buff?: number
  shield_resist_pct?: number
  type_resist_pct?: number
  flat_reduction_pct?: number
  final_damage: number
  shield_damage: number
  hull_damage: number
  damage_type: string
  disrupted?: boolean
  splash?: boolean
}

interface KillLogEntry {
  killer_id: string
  victim_id: string
  killer_username: string
  victim_username: string
}

interface ZoneMoveLogEntry {
  player_id: string
  old_zone: string
  new_zone: string
  reason: string
}

interface CommandLogEntry {
  player_id: string
  command: string
  stance?: string
  target_id?: string
}

interface FleeLogEntry {
  player_id: string
  flee_counter: number
  flee_required: number
  escaped: boolean
}

interface RegenLogEntry {
  player_id: string
  shield_regen: number
  armor_repair: number
  remote_repair?: number
  shield_before: number
  shield_after: number
  hull_before: number
  hull_after: number
}

interface BurnLogEntry {
  target_id: string
  damage: number
  ticks_remaining: number
  destroyed?: boolean
}

interface JoinLogEntry {
  player_id: string
  username: string
  side_id: number
}

interface BattleEndLogEntry {
  outcome: string
  winning_side: number
  duration: number
  total_damage: number
  ships_destroyed: number
  participants: { player_id: string; username: string; side_id: number; damage_dealt: number; damage_taken: number; kill_count: number; survived: boolean }[]
}

interface BattleLogEntry {
  battle_id: string
  system_id: string
  tick: number
  snapshots: ParticipantSnapshot[]
  commands?: CommandLogEntry[]
  autopilot?: { player_id: string; chosen_target?: string; reason: string }[]
  zone_moves?: ZoneMoveLogEntry[]
  attacks?: AttackLogEntry[]
  burns?: BurnLogEntry[]
  regen?: RegenLogEntry[]
  fuel?: { player_id: string; fuel_burned: number; fuel_before: number; fuel_after: number; forced_fire: boolean }[]
  flee?: FleeLogEntry[]
  joins?: JoinLogEntry[]
  kills?: KillLogEntry[]
  battle_ended?: BattleEndLogEntry
}

interface BattleLogResponse {
  battle_id: string
  entries: BattleLogEntry[]
  total_ticks: number
  has_more: boolean
}

// --- Constants ---

const SIDE_COLORS = ['#00d4ff', '#e63946', '#2dd4bf', '#ffd93d', '#9b59b6', '#ff6b35']
const SIDE_COLORS_DIM = ['rgba(0,212,255,0.3)', 'rgba(230,57,70,0.3)', 'rgba(45,212,191,0.3)', 'rgba(255,217,61,0.3)', 'rgba(155,89,182,0.3)', 'rgba(255,107,53,0.3)']
const ZONE_NAMES = ['outer', 'mid', 'inner', 'engaged']
const PLAYBACK_SPEEDS = [0.5, 1, 2, 5]

// Each side advances through 4 rings (outer\u2192mid\u2192inner\u2192engaged); the server places
// a ring at radius (3 - ringIndex) * 0.3 AU from the battle centre. Two opposing
// ships' separation is the sum of their ring distances from the centre, running
// 0 (both engaged, point blank) to 6 (both on opposite rims) \u2014 the axis weapon
// reach and hit chance map onto.
const RING_LABELS = ['engaged', 'inner', 'mid', 'outer']
const ZONE_SCALE_AU = 0.3
const RING_RADII_AU = [0, 1, 2, 3].map(r => r * ZONE_SCALE_AU) // engaged..outer
const RING_BOUNDARIES_AU = [0.5, 1.5, 2.5].map(b => b * ZONE_SCALE_AU)

// --- Event formatting ---

interface FormattedEvent {
  tick: number
  type: string
  color: string
  text: string
}

function formatEvents(entry: BattleLogEntry, usernameMap: Map<string, string>): FormattedEvent[] {
  const events: FormattedEvent[] = []
  const name = (id: string) => usernameMap.get(id) || id.slice(0, 8)

  if (entry.joins) {
    for (const j of entry.joins) {
      events.push({ tick: entry.tick, type: 'join', color: '#2dd4bf', text: `${j.username} joined the battle (Side ${j.side_id})` })
    }
  }

  if (entry.commands) {
    for (const c of entry.commands) {
      if (c.stance) {
        events.push({ tick: entry.tick, type: 'stance', color: '#a8c5d6', text: `${name(c.player_id)} switched to ${c.stance} stance` })
      }
    }
  }

  if (entry.zone_moves) {
    for (const z of entry.zone_moves) {
      const direction = ZONE_NAMES.indexOf(z.new_zone) > ZONE_NAMES.indexOf(z.old_zone) ? 'advanced' : 'retreated'
      events.push({ tick: entry.tick, type: 'zone', color: '#4dabf7', text: `${name(z.player_id)} ${direction} to ${z.new_zone} zone` })
    }
  }

  if (entry.attacks) {
    for (const a of entry.attacks) {
      if (a.hit_success) {
        const dmgParts = []
        if (a.shield_damage > 0) dmgParts.push(`${a.shield_damage} shield`)
        if (a.hull_damage > 0) dmgParts.push(`${a.hull_damage} hull`)
        const dmgStr = dmgParts.length > 0 ? dmgParts.join(' + ') : `${a.final_damage}`
        const ammo = a.weapons?.find(w => w.ammo_used)?.ammo_used
        const ammoStr = ammo ? ` [${ammo}]` : ''
        if (a.splash) {
          events.push({ tick: entry.tick, type: 'splash', color: '#c77dff', text: `${name(a.target_id)} caught ${dmgStr} ${a.damage_type} splash from ${name(a.attacker_id)}${ammoStr}` })
        } else {
          events.push({ tick: entry.tick, type: 'attack', color: '#ff6b35', text: `${name(a.attacker_id)} hit ${name(a.target_id)} for ${dmgStr} ${a.damage_type} (range ${a.zone_distance})${ammoStr}` })
        }
      } else {
        events.push({ tick: entry.tick, type: 'miss', color: '#3d5a6c', text: `${name(a.attacker_id)} missed ${name(a.target_id)} (range ${a.zone_distance}, ${Math.round(a.hit_chance * 100)}% chance)` })
      }
    }
  }

  if (entry.burns) {
    for (const b of entry.burns) {
      const remaining = b.ticks_remaining > 0 ? ` (${b.ticks_remaining} ticks left)` : ''
      if (b.destroyed) {
        events.push({ tick: entry.tick, type: 'burn', color: '#e63946', text: `${name(b.target_id)} burned to destruction (${b.damage} damage)` })
      } else {
        events.push({ tick: entry.tick, type: 'burn', color: '#ff9551', text: `${name(b.target_id)} took ${b.damage} burn damage${remaining}` })
      }
    }
  }

  if (entry.regen) {
    for (const r of entry.regen) {
      if (r.shield_regen > 0) {
        events.push({ tick: entry.tick, type: 'regen', color: '#4dabf7', text: `${name(r.player_id)} regenerated ${r.shield_regen} shields` })
      }
      if (r.armor_repair > 0) {
        events.push({ tick: entry.tick, type: 'regen', color: '#2dd4bf', text: `${name(r.player_id)} repaired ${r.armor_repair} armor` })
      }
      if (r.remote_repair && r.remote_repair > 0) {
        events.push({ tick: entry.tick, type: 'repair', color: '#5ee6a8', text: `${name(r.player_id)} received ${r.remote_repair} remote hull repair` })
      }
    }
  }

  if (entry.flee) {
    for (const f of entry.flee) {
      if (f.escaped) {
        events.push({ tick: entry.tick, type: 'flee', color: '#ffd93d', text: `${name(f.player_id)} escaped the battle!` })
      } else {
        events.push({ tick: entry.tick, type: 'flee', color: '#a8c5d6', text: `${name(f.player_id)} fleeing (${f.flee_counter}/${f.flee_required})` })
      }
    }
  }

  if (entry.kills) {
    for (const k of entry.kills) {
      events.push({ tick: entry.tick, type: 'kill', color: '#e63946', text: `${k.victim_username} destroyed by ${k.killer_username}` })
    }
  }

  if (entry.battle_ended) {
    const e = entry.battle_ended
    let outcomeText = 'Battle ended'
    if (e.outcome === 'victory') {
      const winner = e.participants.filter(p => p.side_id === e.winning_side).map(p => p.username).join(', ')
      outcomeText = `Victory! ${winner} won`
    } else if (e.outcome === 'stalemate') {
      outcomeText = 'Battle ended in a stalemate'
    } else if (e.outcome === 'mutual_destruction') {
      outcomeText = 'Mutual destruction!'
    }
    events.push({ tick: entry.tick, type: 'end', color: '#ffd93d', text: `${outcomeText} (${e.duration} ticks, ${e.total_damage} total damage)` })
  }

  return events
}

// --- Canvas rendering ---

interface ViewBounds { minX: number; maxX: number; minY: number; maxY: number }

function renderBattle(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  entry: BattleLogEntry | null,
  prevEntry: BattleLogEntry | null,
  hoveredPlayer: string | null,
  animProgress: number,
  viewBounds: ViewBounds,
  battleCenter: { x: number; y: number },
  battleAxis: { x: number; y: number },
) {
  ctx.fillStyle = '#050810'
  ctx.fillRect(0, 0, width, height)

  if (!entry || entry.snapshots.length === 0) {
    ctx.fillStyle = '#3d5a6c'
    ctx.font = '14px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('No battle data', width / 2, height / 2)
    return
  }

  // Use pre-computed stable bounds (passed in via viewBounds)
  const { minX, maxX, minY, maxY } = viewBounds

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scale = Math.min(width / rangeX, height / rangeY) * 0.85
  const cx = width / 2
  const cy = height / 2
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  const toScreen = (x: number, y: number): [number, number] => {
    return [cx + (x - midX) * scale, cy + (y - midY) * scale]
  }

  // Subtle grid for spatial context
  ctx.strokeStyle = 'rgba(61, 90, 108, 0.08)'
  ctx.lineWidth = 1
  const gridStep = 40
  for (let gx = gridStep; gx < width; gx += gridStep) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke()
  }
  for (let gy = gridStep; gy < height; gy += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke()
  }

  // Zone rings along the battle axis. The server lays each side out along an
  // arbitrary axis (battleAxis), so bands and labels are drawn perpendicular to
  // that axis rather than assuming a horizontal layout. The axis runs through 7
  // ring positions — outer/mid/inner/engaged/inner/mid/outer — and the
  // separation between two opposing ships (0–6) is what weapon reach maps onto.
  const bcx = battleCenter.x, bcy = battleCenter.y
  const ax = battleAxis.x, ay = battleAxis.y       // unit vector along the axis
  const perpX = -ay, perpY = ax                    // unit vector perpendicular to it

  // Half-length (world units) of the perpendicular extent, big enough to span the canvas.
  const spanWorld = Math.max(viewBounds.maxX - viewBounds.minX, viewBounds.maxY - viewBounds.minY) * 1.5
  // A world point at signed along-axis distance d and perpendicular offset t.
  const onAxis = (d: number, t: number): [number, number] => [bcx + ax * d + perpX * t, bcy + ay * d + perpY * t]

  // Alternating band tints, one ring at a time, mirrored on both sides of centre.
  for (let z = 0; z < 4; z++) {
    if (z % 2 !== 0) continue
    const inner = z === 0 ? 0 : RING_BOUNDARIES_AU[z - 1]
    const outer = z < 3 ? RING_BOUNDARIES_AU[z] : spanWorld
    for (const dir of [-1, 1]) {
      const corners = [onAxis(dir * inner, -spanWorld), onAxis(dir * outer, -spanWorld), onAxis(dir * outer, spanWorld), onAxis(dir * inner, spanWorld)]
      ctx.beginPath()
      corners.forEach(([wx, wy], i) => {
        const [sx, sy] = toScreen(wx, wy)
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
      })
      ctx.closePath()
      ctx.fillStyle = 'rgba(61, 90, 108, 0.04)'
      ctx.fill()
    }
  }

  // Ring boundary lines, perpendicular to the axis, mirrored on both sides.
  for (const boundary of RING_BOUNDARIES_AU) {
    for (const dir of [-1, 1]) {
      const [e1x, e1y] = toScreen(...onAxis(dir * boundary, -spanWorld))
      const [e2x, e2y] = toScreen(...onAxis(dir * boundary, spanWorld))
      ctx.beginPath()
      ctx.moveTo(e1x, e1y)
      ctx.lineTo(e2x, e2y)
      ctx.strokeStyle = 'rgba(61, 90, 108, 0.2)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 8])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Ring labels, placed where each ring's perpendicular line crosses the top edge
  // of the canvas (so they stay on-screen and aligned with the bands at any axis
  // orientation). Each ring is labelled at its actual radius from the centre.
  ctx.fillStyle = 'rgba(168, 197, 214, 0.7)'
  ctx.font = '10px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  const [oScreenX, oScreenY] = toScreen(bcx, bcy)
  const [pScreenX, pScreenY] = toScreen(bcx + perpX, bcy + perpY)
  let dpx = pScreenX - oScreenX, dpy = pScreenY - oScreenY
  const dpl = Math.hypot(dpx, dpy) || 1
  dpx /= dpl; dpy /= dpl
  const targetY = 14
  for (let z = 0; z < 4; z++) {
    const dirs = z === 0 ? [1] : [-1, 1] // engaged is centred — label once
    for (const dir of dirs) {
      const [s0x, s0y] = toScreen(...onAxis(dir * RING_RADII_AU[z], 0))
      let lx: number, ly: number
      if (Math.abs(dpy) > 0.01) {
        const tEdge = (targetY - s0y) / dpy
        lx = s0x + dpx * tEdge
        ly = targetY
      } else {
        // Axis is near-vertical (ring lines run horizontally) — offset upward a little.
        lx = s0x
        ly = Math.max(targetY, s0y - 20)
      }
      lx = Math.max(24, Math.min(width - 24, lx))
      ctx.fillText(RING_LABELS[z], lx, ly)
    }
  }

  // Draw attack lines (attacker -> target)
  if (entry.attacks) {
    for (const atk of entry.attacks) {
      const attacker = entry.snapshots.find(s => s.player_id === atk.attacker_id)
      const target = entry.snapshots.find(s => s.player_id === atk.target_id)
      if (!attacker || !target) continue

      const [ax, ay] = toScreen(attacker.x, attacker.y)
      const [tx, ty] = toScreen(target.x, target.y)

      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(tx, ty)
      if (atk.hit_success) {
        if (atk.splash) {
          ctx.strokeStyle = `rgba(199, 125, 255, ${0.5 * (1 - animProgress * 0.5)})`
          ctx.lineWidth = 1.5
          ctx.setLineDash([2, 4])
        } else {
          ctx.strokeStyle = `rgba(255, 107, 53, ${0.6 * (1 - animProgress * 0.5)})`
          ctx.lineWidth = 2
        }
      } else {
        ctx.strokeStyle = `rgba(61, 90, 108, ${0.3 * (1 - animProgress * 0.5)})`
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Damage number floats up from target
      if (atk.hit_success && atk.final_damage > 0) {
        const floatY = ty - 20 - animProgress * 15
        ctx.fillStyle = atk.splash ? 'rgba(199, 125, 255, 0.95)' : 'rgba(255, 220, 100, 0.95)'
        ctx.font = 'bold 13px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`-${atk.final_damage}`, tx, floatY)
      }
    }
  }

  // Draw kill explosions
  if (entry.kills) {
    for (const kill of entry.kills) {
      const victim = entry.snapshots.find(s => s.player_id === kill.victim_id)
      if (!victim) continue
      const [vx, vy] = toScreen(victim.x, victim.y)
      const explosionRadius = 15 + animProgress * 20
      const alpha = 0.8 * (1 - animProgress)
      ctx.beginPath()
      ctx.arc(vx, vy, explosionRadius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(230, 57, 70, ${alpha * 0.3})`
      ctx.fill()
      ctx.strokeStyle = `rgba(255, 107, 53, ${alpha})`
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // Build a prev position map for interpolation
  const prevPosMap = new Map<string, { x: number; y: number }>()
  if (prevEntry) {
    for (const s of prevEntry.snapshots) {
      prevPosMap.set(s.player_id, { x: s.x, y: s.y })
    }
  }

  // Draw ships
  for (const snap of entry.snapshots) {
    const sideColor = SIDE_COLORS[(snap.side_id - 1) % SIDE_COLORS.length]
    const sideColorDim = SIDE_COLORS_DIM[(snap.side_id - 1) % SIDE_COLORS_DIM.length]

    // Interpolate from previous position
    let drawX = snap.x, drawY = snap.y
    const prev = prevPosMap.get(snap.player_id)
    if (prev && animProgress < 1) {
      drawX = prev.x + (snap.x - prev.x) * Math.min(animProgress * 2, 1)
      drawY = prev.y + (snap.y - prev.y) * Math.min(animProgress * 2, 1)
    }

    const [sx, sy] = toScreen(drawX, drawY)
    const isHovered = hoveredPlayer === snap.player_id
    const shipSize = isHovered ? 14 : 11

    ctx.save()
    ctx.translate(sx, sy)

    // Rotate ship to face along the battle axis toward the centre, where the
    // opposing side closes in. The chevron's local "up" (0,-1) is aimed at the
    // facing vector via atan2(fx, -fy).
    const relAlong = (drawX - bcx) * ax + (drawY - bcy) * ay
    const faceSign = relAlong >= 0 ? -1 : 1
    const facing = Math.atan2(faceSign * ax, -(faceSign * ay))
    ctx.rotate(facing)

    // Glow behind hovered ship
    if (isHovered) {
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, shipSize * 2.5)
      glow.addColorStop(0, sideColor + '30')
      glow.addColorStop(1, sideColor + '00')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(0, 0, shipSize * 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Ship body (chevron pointing up in local space, rotated to face opponent)
    ctx.beginPath()
    ctx.moveTo(0, -shipSize)
    ctx.lineTo(shipSize * 0.65, shipSize * 0.35)
    ctx.lineTo(0, shipSize * 0.15)
    ctx.lineTo(-shipSize * 0.65, shipSize * 0.35)
    ctx.closePath()
    ctx.fillStyle = isHovered ? sideColor : sideColorDim
    ctx.fill()
    ctx.strokeStyle = sideColor
    ctx.lineWidth = isHovered ? 2.5 : 1.5
    ctx.stroke()

    // Reset rotation for bars and labels (they should stay horizontal)
    ctx.rotate(-facing)

    // Status-effect indicators: small colored dots above the ship
    const statusColors: string[] = []
    if (snap.disruption_ticks) statusColors.push('#c77dff')
    if (snap.burn_ticks) statusColors.push('#ff9551')
    if (snap.armor_melt_ticks) statusColors.push('#e63946')
    if (statusColors.length > 0) {
      const dotR = 3
      const gap = 3
      const totalW = statusColors.length * (dotR * 2) + (statusColors.length - 1) * gap
      let dx = -totalW / 2 + dotR
      const dy = -shipSize - 8
      for (const c of statusColors) {
        ctx.beginPath()
        ctx.arc(dx, dy, dotR, 0, Math.PI * 2)
        ctx.fillStyle = c
        ctx.fill()
        dx += dotR * 2 + gap
      }
    }

    // Hull/shield bars below ship
    const barWidth = 40
    const barY = shipSize + 8

    // Shield bar
    if (snap.max_shield > 0) {
      const shieldPct = snap.shield / snap.max_shield
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(-barWidth / 2, barY, barWidth, 4)
      ctx.fillStyle = '#4dabf7'
      ctx.fillRect(-barWidth / 2, barY, barWidth * shieldPct, 4)
    }

    // Hull bar
    const hullPct = snap.hull / snap.max_hull
    const hullColor = hullPct > 0.5 ? '#2dd4bf' : hullPct > 0.25 ? '#ffd93d' : '#e63946'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(-barWidth / 2, barY + 5, barWidth, 4)
    ctx.fillStyle = hullColor
    ctx.fillRect(-barWidth / 2, barY + 5, barWidth * hullPct, 4)

    // Name label (always visible, prominent)
    ctx.fillStyle = isHovered ? '#ffffff' : sideColor
    ctx.font = `bold ${isHovered ? '12' : '11'}px "JetBrains Mono", monospace`
    ctx.textAlign = 'center'
    ctx.fillText(snap.username, 0, barY + 18)

    // Ship class sublabel
    ctx.fillStyle = 'rgba(168, 197, 214, 0.5)'
    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.fillText(snap.ship_class, 0, barY + 29)

    ctx.restore()
  }
}

// --- Main component ---

export default function BattleDetailPage() {
  const { t } = useTranslation()
  const params = useParams()
  const battleId = params.id as string

  const [entries, setEntries] = useState<BattleLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Playback state
  const [currentTickIndex, setCurrentTickIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const animProgressRef = useRef(0)
  const animFrameRef = useRef<number>(0)

  // Event feed
  const feedRef = useRef<HTMLDivElement>(null)

  // Username map (player_id -> username)
  const usernameMap = useRef(new Map<string, string>())

  // --- Data loading ---
  useEffect(() => {
    if (!battleId) return

    async function loadBattle() {
      setLoading(true)
      try {
        // Load all entries (battles rarely exceed 50 ticks, max 200 per request)
        let allEntries: BattleLogEntry[] = []
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const res = await fetch(`${API_BASE}/api/battle/log?battle_id=${encodeURIComponent(battleId)}&tick_start=${offset}&limit=200`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data: BattleLogResponse = await res.json()
          allEntries = allEntries.concat(data.entries || [])
          hasMore = data.has_more
          if (data.entries && data.entries.length > 0) {
            offset = data.entries[data.entries.length - 1].tick + 1
          } else {
            hasMore = false
          }
        }

        // Build username map
        for (const entry of allEntries) {
          for (const snap of entry.snapshots) {
            usernameMap.current.set(snap.player_id, snap.username)
          }
        }

        setEntries(allEntries)
        setError(null)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load battle data')
      } finally {
        setLoading(false)
      }
    }

    loadBattle()
  }, [battleId])

  // --- Stable view bounds from battle participants only (POIs render if in view) ---
  const viewBounds = useMemo<ViewBounds>(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const entry of entries) {
      for (const s of entry.snapshots) {
        minX = Math.min(minX, s.x)
        maxX = Math.max(maxX, s.x)
        minY = Math.min(minY, s.y)
        maxY = Math.max(maxY, s.y)
      }
    }
    const pad = 0.5
    return {
      minX: minX === Infinity ? -1 : minX - pad,
      maxX: maxX === -Infinity ? 1 : maxX + pad,
      minY: minY === Infinity ? -1 : minY - pad,
      maxY: maxY === -Infinity ? 1 : maxY + pad,
    }
  }, [entries])

  // Battle geometry: the centre of the arena and the unit axis the two sides are
  // laid out along. The server places each side along an arbitrary axis (derived
  // from the origin POI direction or a battle-ID seed), so we recover it from the
  // data: for a 2-side fight it is the line between the side centroids (robust to
  // the perpendicular spread); otherwise we fall back to the principal axis of all
  // ship positions via a 2D PCA. Computed once over every tick so it stays stable.
  const battleGeometry = useMemo<{ center: { x: number; y: number }; axis: { x: number; y: number } }>(() => {
    const sideSums = new Map<number, { x: number; y: number; n: number }>()
    let gx = 0, gy = 0, gn = 0
    for (const entry of entries) {
      for (const s of entry.snapshots) {
        const acc = sideSums.get(s.side_id) || { x: 0, y: 0, n: 0 }
        acc.x += s.x; acc.y += s.y; acc.n++
        sideSums.set(s.side_id, acc)
        gx += s.x; gy += s.y; gn++
      }
    }
    if (gn === 0) return { center: { x: 0, y: 0 }, axis: { x: 1, y: 0 } }
    const center = { x: gx / gn, y: gy / gn }

    let axis = { x: 1, y: 0 }
    const centroids = [...sideSums.values()].map(s => ({ x: s.x / s.n, y: s.y / s.n }))
    if (centroids.length === 2) {
      axis = { x: centroids[1].x - centroids[0].x, y: centroids[1].y - centroids[0].y }
    } else {
      // 2D PCA: principal eigenvector of the position covariance matrix.
      let sxx = 0, sxy = 0, syy = 0
      for (const entry of entries) {
        for (const s of entry.snapshots) {
          const dx = s.x - center.x, dy = s.y - center.y
          sxx += dx * dx; sxy += dx * dy; syy += dy * dy
        }
      }
      const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
      axis = { x: Math.cos(theta), y: Math.sin(theta) }
    }
    const len = Math.hypot(axis.x, axis.y)
    if (len < 1e-9) return { center, axis: { x: 1, y: 0 } }
    return { center, axis: { x: axis.x / len, y: axis.y / len } }
  }, [entries])

  // --- Page title ---
  useEffect(() => {
    if (entries.length > 0) {
      const systemId = entries[0].system_id || 'Unknown'
      document.title = `Battle in ${systemId} - SpaceMolt`
    } else {
      document.title = 'Battle Replay - SpaceMolt'
    }
  }, [entries])

  // --- Playback timer ---
  useEffect(() => {
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current)
      playTimerRef.current = null
    }

    if (isPlaying && entries.length > 0) {
      const interval = 1000 / playbackSpeed
      playTimerRef.current = setInterval(() => {
        setCurrentTickIndex(prev => {
          if (prev >= entries.length - 1) {
            setIsPlaying(false)
            return prev
          }
          animProgressRef.current = 0
          return prev + 1
        })
      }, interval)
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
  }, [isPlaying, playbackSpeed, entries.length])

  // --- Canvas rendering loop ---
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    resizeCanvas()
    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(container)

    let lastTime = 0
    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000
      lastTime = time

      if (isPlaying) {
        animProgressRef.current = Math.min(animProgressRef.current + dt * playbackSpeed, 1)
      } else {
        animProgressRef.current = 1
      }

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0) // reset before scaling
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
        const w = canvas.width / window.devicePixelRatio
        const h = canvas.height / window.devicePixelRatio
        const entry = entries[currentTickIndex] || null
        const prevEntry = currentTickIndex > 0 ? entries[currentTickIndex - 1] : null
        renderBattle(ctx, w, h, entry, prevEntry, hoveredPlayer || selectedPlayer, animProgressRef.current, viewBounds, battleGeometry.center, battleGeometry.axis)
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      resizeObserver.disconnect()
    }
  }, [entries, currentTickIndex, isPlaying, playbackSpeed, hoveredPlayer, selectedPlayer, viewBounds, battleGeometry])

  // --- Mouse interaction on canvas ---
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || entries.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const entry = entries[currentTickIndex]
    if (!entry) return

    // Use same stable bounds as render
    const { minX, maxX, minY, maxY } = viewBounds
    const w = rect.width, h = rect.height
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const scale = Math.min(w / rangeX, h / rangeY) * 0.85
    const cx = w / 2, cy = h / 2
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2

    // Find closest ship
    let closest: string | null = null
    let closestDist = 25 // pixel threshold
    for (const snap of entry.snapshots) {
      const sx = cx + (snap.x - midX) * scale
      const sy = cy + (snap.y - midY) * scale
      const dist = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2)
      if (dist < closestDist) {
        closestDist = dist
        closest = snap.player_id
      }
    }

    setHoveredPlayer(closest)
  }, [entries, currentTickIndex, viewBounds])

  const handleCanvasClick = useCallback(() => {
    if (hoveredPlayer) {
      setSelectedPlayer(prev => prev === hoveredPlayer ? null : hoveredPlayer)
    } else {
      setSelectedPlayer(null)
    }
  }, [hoveredPlayer])

  // --- Auto-scroll event feed ---
  useEffect(() => {
    if (feedRef.current && isPlaying) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [currentTickIndex, isPlaying])

  // --- Derived data ---
  const currentEntry = entries[currentTickIndex] || null
  const allEvents = entries.slice(0, currentTickIndex + 1).flatMap(e => formatEvents(e, usernameMap.current))
  const inspectedPlayer = selectedPlayer || hoveredPlayer
  const inspectedSnap = currentEntry?.snapshots.find(s => s.player_id === inspectedPlayer) || null

  // Side summary from first entry
  const sides = new Map<number, { participants: string[] }>()
  if (entries.length > 0) {
    for (const snap of entries[0].snapshots) {
      if (!sides.has(snap.side_id)) sides.set(snap.side_id, { participants: [] })
      sides.get(snap.side_id)!.participants.push(snap.username)
    }
    // Also add late joiners
    for (const entry of entries) {
      if (entry.joins) {
        for (const j of entry.joins) {
          if (!sides.has(j.side_id)) sides.set(j.side_id, { participants: [] })
          const side = sides.get(j.side_id)!
          if (!side.participants.includes(j.username)) side.participants.push(j.username)
        }
      }
    }
  }

  const battleEnded = entries.length > 0 ? entries[entries.length - 1].battle_ended : null

  // --- Render ---

  if (loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loading}>{t('battles.loading')}</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className={styles.main}>
        <div className={styles.error}>
          <p>{t('battleDetail.failedToLoad', { error })}</p>
          <Link href="/battles" className={styles.backLink}>{t('battleDetail.backToBattles')}</Link>
        </div>
      </main>
    )
  }

  if (entries.length === 0) {
    return (
      <main className={styles.main}>
        <div className={styles.error}>
          <p>{t('battleDetail.notFound')}</p>
          <Link href="/battles" className={styles.backLink}>{t('battleDetail.backToBattles')}</Link>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      {/* Header */}
      <div className={styles.header}>
        <Link href="/battles" className={styles.backLink}>&larr; {t('battleDetail.backToBattles')}</Link>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>
            {t('battleDetail.battleIn', { system: entries[0].system_id })}
            {battleEnded && (
              <span className={styles.outcomeBadge}>
                {battleEnded.outcome === 'victory' ? t('battles.outcomeVictory') : battleEnded.outcome === 'stalemate' ? t('battles.outcomeStalemate') : t('battles.outcomeMutualDestruction')}
              </span>
            )}
          </h1>
          <div className={styles.headerMeta}>
            <span>ID: {battleId.slice(0, 12)}...</span>
            <span>{t('battleDetail.ticks', { count: String(entries.length) })}</span>
            {battleEnded && <span>{t('battleDetail.totalDamage', { amount: battleEnded.total_damage.toLocaleString() })}</span>}
            {battleEnded && <span>{t('battleDetail.shipsDestroyed', { count: String(battleEnded.ships_destroyed) })}</span>}
          </div>
        </div>

        {/* Sides */}
        <div className={styles.sidesRow}>
          {Array.from(sides.entries()).map(([sideId, side], i) => (
            <div key={sideId} className={styles.sideCard}>
              <span className={styles.sideColorDot} style={{ backgroundColor: SIDE_COLORS[i % SIDE_COLORS.length] }} />
              <span className={styles.sideName}>
                {side.participants.join(', ')}
              </span>
              {battleEnded && battleEnded.winning_side === sideId && (
                <span className={styles.winnerLabel}>{t('battleDetail.winner')}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content: visualization + event feed */}
      <div className={styles.content}>
        <div className={styles.vizSection}>
          <div className={styles.canvasContainer} ref={containerRef}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onMouseMove={handleCanvasMouseMove}
              onClick={handleCanvasClick}
              onMouseLeave={() => setHoveredPlayer(null)}
            />

            {/* Ship info overlay — positioned inside canvas container */}
            {inspectedSnap && (
              <div className={styles.shipInfo}>
                <div className={styles.shipInfoHeader}>
                  <span className={styles.shipInfoName} style={{ color: SIDE_COLORS[(inspectedSnap.side_id - 1) % SIDE_COLORS.length] }}>
                    {inspectedSnap.username}
                  </span>
                  <span className={styles.shipInfoClass}>{inspectedSnap.ship_class}</span>
                </div>
                <div className={styles.shipInfoBars}>
                  <div className={styles.barRow}>
                    <span className={styles.barLabel}>{t('battleDetail.hull')}</span>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: `${(inspectedSnap.hull / inspectedSnap.max_hull) * 100}%`,
                          backgroundColor: inspectedSnap.hull / inspectedSnap.max_hull > 0.5 ? '#2dd4bf' : inspectedSnap.hull / inspectedSnap.max_hull > 0.25 ? '#ffd93d' : '#e63946',
                        }}
                      />
                    </div>
                    <span className={styles.barValue}>{inspectedSnap.hull}/{inspectedSnap.max_hull}</span>
                  </div>
                  {inspectedSnap.max_shield > 0 && (
                    <div className={styles.barRow}>
                      <span className={styles.barLabel}>{t('battleDetail.shield')}</span>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${(inspectedSnap.shield / inspectedSnap.max_shield) * 100}%`, backgroundColor: '#4dabf7' }} />
                      </div>
                      <span className={styles.barValue}>{inspectedSnap.shield}/{inspectedSnap.max_shield}</span>
                    </div>
                  )}
                  <div className={styles.barRow}>
                    <span className={styles.barLabel}>{t('battleDetail.fuel')}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${(inspectedSnap.fuel / inspectedSnap.max_fuel) * 100}%`, backgroundColor: '#ff6b35' }} />
                    </div>
                    <span className={styles.barValue}>{inspectedSnap.fuel}/{inspectedSnap.max_fuel}</span>
                  </div>
                </div>
                <div className={styles.shipInfoDetails}>
                  <span>{t('battleDetail.zone')}: {inspectedSnap.zone}</span>
                  <span>{t('battleDetail.stance')}: {inspectedSnap.stance}</span>
                  {inspectedSnap.target_id && <span>{t('battleDetail.target')}: {usernameMap.current.get(inspectedSnap.target_id) || inspectedSnap.target_id.slice(0, 8)}</span>}
                  <span>{t('battleDetail.dmgDealt')}: {inspectedSnap.damage_dealt}</span>
                  <span>{t('battleDetail.dmgTaken')}: {inspectedSnap.damage_taken}</span>
                  {inspectedSnap.kill_count > 0 && <span>{t('battleDetail.kills')}: {inspectedSnap.kill_count}</span>}
                </div>
                {(() => {
                  const badges: { label: string; color: string }[] = []
                  if (inspectedSnap.disruption_ticks) {
                    badges.push({ label: t('battleDetail.statusDisrupted', { ticks: String(inspectedSnap.disruption_ticks), spd: String(inspectedSnap.speed_penalty_pct ?? 0), dmg: String(inspectedSnap.damage_penalty_pct ?? 0) }), color: '#c77dff' })
                  }
                  if (inspectedSnap.burn_ticks) {
                    badges.push({ label: t('battleDetail.statusBurning', { dps: String(inspectedSnap.burn_damage_per_tick ?? 0), ticks: String(inspectedSnap.burn_ticks) }), color: '#ff9551' })
                  }
                  if (inspectedSnap.armor_melt_ticks) {
                    badges.push({ label: t('battleDetail.statusArmorMelt', { pct: String(inspectedSnap.armor_melt_pct ?? 0), ticks: String(inspectedSnap.armor_melt_ticks) }), color: '#e63946' })
                  }
                  if (badges.length === 0) return null
                  return (
                    <div className={styles.shipInfoStatus}>
                      {badges.map((b, i) => (
                        <span key={i} className={styles.statusBadge} style={{ color: b.color, borderColor: b.color }}>{b.label}</span>
                      ))}
                    </div>
                  )
                })()}
                {inspectedSnap.modules && inspectedSnap.modules.length > 0 && (
                  <div className={styles.shipInfoModules}>
                    <div className={styles.shipInfoModulesLabel}>{t('battleDetail.loadout')}</div>
                    {inspectedSnap.modules.map((mod, i) => (
                      <div key={i} className={styles.moduleRow}>
                        <span className={styles.moduleName}>{mod.name}</span>
                        {mod.magazine_size ? (
                          <span className={styles.moduleQuality} style={{ color: (mod.current_ammo ?? 0) > 0 ? '#a8c5d6' : '#e63946' }}>
                            {mod.loaded_ammo ? `${mod.loaded_ammo} ` : ''}{mod.current_ammo ?? 0}/{mod.magazine_size}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Event feed */}
        <div className={styles.feedSection}>
          <div className={styles.feedHeader}>{t('battleDetail.eventLog')}</div>
          <div className={styles.feed} ref={feedRef}>
            {allEvents.length === 0 && (
              <div className={styles.feedEmpty}>{t('battleDetail.noEvents')}</div>
            )}
            {allEvents.map((ev, i) => (
              <div key={i} className={styles.feedEvent}>
                <span className={styles.feedTick}>T{ev.tick}</span>
                <span className={styles.feedDot} style={{ backgroundColor: ev.color }} />
                <span className={styles.feedText}>{ev.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline + playback controls */}
      <div className={styles.timeline}>
        <div className={styles.controls}>
          <button className={styles.controlBtn} onClick={() => { setCurrentTickIndex(0); setIsPlaying(false); animProgressRef.current = 0 }} title="First tick">
            &#x23EE;
          </button>
          <button className={styles.controlBtn} onClick={() => { setCurrentTickIndex(i => Math.max(0, i - 1)); animProgressRef.current = 0 }} title="Previous tick">
            &#x23EA;
          </button>
          <button
            className={`${styles.controlBtn} ${styles.playBtn}`}
            onClick={() => {
              if (currentTickIndex >= entries.length - 1 && !isPlaying) {
                setCurrentTickIndex(0)
                animProgressRef.current = 0
              }
              setIsPlaying(p => !p)
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '\u23F8' : '\u25B6'}
          </button>
          <button className={styles.controlBtn} onClick={() => { setCurrentTickIndex(i => Math.min(entries.length - 1, i + 1)); animProgressRef.current = 0 }} title="Next tick">
            &#x23E9;
          </button>
          <button className={styles.controlBtn} onClick={() => { setCurrentTickIndex(entries.length - 1); setIsPlaying(false); animProgressRef.current = 1 }} title="Last tick">
            &#x23ED;
          </button>
        </div>

        <div className={styles.scrubber}>
          <input
            type="range"
            min={0}
            max={entries.length - 1}
            value={currentTickIndex}
            onChange={e => { setCurrentTickIndex(Number(e.target.value)); animProgressRef.current = 0 }}
            className={styles.scrubberInput}
          />
        </div>

        <div className={styles.timelineInfo}>
          <span className={styles.tickCounter}>
            {t('battleDetail.tick', { n: String(currentEntry?.tick ?? 0), current: String(currentTickIndex + 1), total: String(entries.length) })}
          </span>
          <div className={styles.speedControls}>
            {PLAYBACK_SPEEDS.map(speed => (
              <button
                key={speed}
                className={`${styles.speedBtn} ${playbackSpeed === speed ? styles.speedBtnActive : ''}`}
                onClick={() => setPlaybackSpeed(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
