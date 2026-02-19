'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

// --- Types matching the gameserver battle log API ---

interface FittedModule {
  name: string
  category: string
  quality: number
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
  shield_before: number
  shield_after: number
  hull_before: number
  hull_after: number
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

interface SystemPOI {
  id: string
  name: string
  type: string
  position: { x: number; y: number }
  has_base: boolean
  base_id?: string
  online: number
}

// --- Constants ---

const SIDE_COLORS = ['#00d4ff', '#e63946', '#2dd4bf', '#ffd93d', '#9b59b6', '#ff6b35']
const SIDE_COLORS_DIM = ['rgba(0,212,255,0.3)', 'rgba(230,57,70,0.3)', 'rgba(45,212,191,0.3)', 'rgba(255,217,61,0.3)', 'rgba(155,89,182,0.3)', 'rgba(255,107,53,0.3)']
const ZONE_NAMES = ['outer', 'mid', 'inner', 'engaged']
const PLAYBACK_SPEEDS = [0.5, 1, 2, 5]

const POI_ICONS: Record<string, { icon: string; color: string }> = {
  asteroid_belt: { icon: '\u2b50', color: '#ffa500' },
  gas_cloud: { icon: '\u2601', color: '#9b59b6' },
  ice_field: { icon: '\u2744', color: '#4dabf7' },
  station: { icon: '\u25a0', color: '#2dd4bf' },
  jump_gate: { icon: '\u25c6', color: '#00d4ff' },
  debris_field: { icon: '\u25cb', color: '#5a6a7a' },
  anomaly: { icon: '?', color: '#e63946' },
}

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
        events.push({ tick: entry.tick, type: 'attack', color: '#ff6b35', text: `${name(a.attacker_id)} hit ${name(a.target_id)} for ${dmgStr} ${a.damage_type}` })
      } else {
        events.push({ tick: entry.tick, type: 'miss', color: '#3d5a6c', text: `${name(a.attacker_id)} missed ${name(a.target_id)} (${Math.round(a.hit_chance * 100)}% chance)` })
      }
    }
  }

  if (entry.regen) {
    for (const r of entry.regen) {
      if (r.shield_regen > 0) {
        events.push({ tick: entry.tick, type: 'regen', color: '#4dabf7', text: `${name(r.player_id)} regenerated ${r.shield_regen} shields` })
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
  pois: SystemPOI[],
  battleCenter: { x: number; y: number },
  originPoi?: string,
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

  // Draw POIs as background landmarks
  for (const poi of pois) {
    const [px, py] = toScreen(poi.position.x, poi.position.y)
    const isOrigin = poi.id === originPoi
    const typeInfo = POI_ICONS[poi.type] || { icon: '\u25cb', color: '#5a6a7a' }

    // POI marker circle
    const poiRadius = isOrigin ? 8 : 6
    ctx.beginPath()
    ctx.arc(px, py, poiRadius, 0, Math.PI * 2)
    ctx.fillStyle = isOrigin ? typeInfo.color + '40' : typeInfo.color + '20'
    ctx.fill()
    ctx.strokeStyle = isOrigin ? typeInfo.color + 'aa' : typeInfo.color + '50'
    ctx.lineWidth = isOrigin ? 2 : 1
    ctx.setLineDash(isOrigin ? [] : [3, 3])
    ctx.stroke()
    ctx.setLineDash([])

    // Station/base: filled square instead
    if (poi.has_base) {
      const sz = 5
      ctx.fillStyle = typeInfo.color + '60'
      ctx.fillRect(px - sz, py - sz, sz * 2, sz * 2)
      ctx.strokeStyle = typeInfo.color + '90'
      ctx.lineWidth = 1
      ctx.strokeRect(px - sz, py - sz, sz * 2, sz * 2)
    }

    // POI name label
    ctx.fillStyle = isOrigin ? 'rgba(168, 197, 214, 0.9)' : 'rgba(168, 197, 214, 0.5)'
    ctx.font = `${isOrigin ? '11' : '9'}px "JetBrains Mono", monospace`
    ctx.textAlign = 'center'
    ctx.fillText(poi.name, px, py + poiRadius + 12)

    // POI type sublabel
    ctx.fillStyle = 'rgba(61, 90, 108, 0.6)'
    ctx.font = '8px "JetBrains Mono", monospace'
    ctx.fillText(poi.type.replace(/_/g, ' '), px, py + poiRadius + 22)

    // Origin POI: "BATTLE" badge
    if (isOrigin) {
      ctx.fillStyle = 'rgba(230, 57, 70, 0.8)'
      ctx.font = 'bold 8px "JetBrains Mono", monospace'
      ctx.fillText('BATTLE', px, py - poiRadius - 6)
    }
  }

  // Zone bands — vertical dividers showing distance zones along the battle axis
  // Centered on the battle origin (not the view center), since POIs may shift the view
  const bcx = battleCenter.x, bcy = battleCenter.y
  const zoneBoundaries = [0.5, 1.5, 2.5] // between engaged/inner, inner/mid, mid/outer
  const zoneLabels = ['engaged', 'inner', 'mid', 'outer']
  const zoneScale_render = 0.3

  // Draw zone background tints (subtle alternating bands)
  for (let z = 0; z < 4; z++) {
    const leftBound = z === 0 ? 0 : zoneBoundaries[z - 1] * zoneScale_render
    const rightBound = z < 3 ? zoneBoundaries[z] * zoneScale_render : (viewBounds.maxX - viewBounds.minX) / 2

    // Both sides of battle center (mirrored)
    for (const dir of [-1, 1]) {
      const [lx] = toScreen(bcx + leftBound * dir, bcy)
      const [rx] = toScreen(bcx + rightBound * dir, bcy)
      const x1 = Math.min(lx, rx)
      const x2 = Math.max(lx, rx)
      if (z % 2 === 0) {
        ctx.fillStyle = 'rgba(61, 90, 108, 0.04)'
        ctx.fillRect(x1, 0, x2 - x1, height)
      }
    }
  }

  // Draw zone boundary lines
  for (const boundary of zoneBoundaries) {
    const dist = boundary * zoneScale_render
    for (const dir of [-1, 1]) {
      const [bx] = toScreen(bcx + dist * dir, bcy)
      ctx.beginPath()
      ctx.moveTo(bx, 0)
      ctx.lineTo(bx, height)
      ctx.strokeStyle = 'rgba(61, 90, 108, 0.2)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 8])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Zone labels at top — both sides, readable color
  for (let z = 0; z < 4; z++) {
    const leftBound = z === 0 ? 0 : zoneBoundaries[z - 1] * zoneScale_render
    const rightBound = z < 3 ? zoneBoundaries[z] * zoneScale_render : (viewBounds.maxX - viewBounds.minX) / 2
    const mid_zone = (leftBound + rightBound) / 2

    ctx.fillStyle = 'rgba(168, 197, 214, 0.7)'
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'

    // Positive side (right)
    const [rx] = toScreen(bcx + mid_zone, bcy)
    ctx.fillText(zoneLabels[z], rx, 16)

    // Negative side (left) — skip engaged (z=0) since it's centered
    if (z > 0) {
      const [lx] = toScreen(bcx - mid_zone, bcy)
      ctx.fillText(zoneLabels[z], lx, 16)
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
        ctx.strokeStyle = `rgba(255, 107, 53, ${0.6 * (1 - animProgress * 0.5)})`
        ctx.lineWidth = 2
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
        ctx.fillStyle = 'rgba(255, 220, 100, 0.95)'
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

    // Rotate ship to face the opposing side along horizontal axis
    // Side 1 (right of center) faces left (-π/2), side 2 (left of center) faces right (π/2)
    const facing = snap.side_id === 1 ? -Math.PI / 2 : Math.PI / 2
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

  // System POIs
  const [pois, setPois] = useState<SystemPOI[]>([])
  const [originPoi, setOriginPoi] = useState<string | undefined>()

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

  // Battle center: origin POI position, or centroid of first-tick participants
  const battleCenter = useMemo<{ x: number; y: number }>(() => {
    // Prefer the origin POI position
    if (originPoi && pois.length > 0) {
      const origin = pois.find(p => p.id === originPoi)
      if (origin) return { x: origin.position.x, y: origin.position.y }
    }
    // Fallback: centroid of all participant positions
    if (entries.length > 0) {
      let sx = 0, sy = 0, n = 0
      for (const snap of entries[0].snapshots) {
        sx += snap.x; sy += snap.y; n++
      }
      if (n > 0) return { x: sx / n, y: sy / n }
    }
    return { x: 0, y: 0 }
  }, [entries, pois, originPoi])

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
        renderBattle(ctx, w, h, entry, prevEntry, hoveredPlayer || selectedPlayer, animProgressRef.current, viewBounds, pois, battleCenter, originPoi)
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      resizeObserver.disconnect()
    }
  }, [entries, currentTickIndex, isPlaying, playbackSpeed, hoveredPlayer, selectedPlayer, viewBounds, pois, battleCenter, originPoi])

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
        <div className={styles.loading}>Loading battle replay...</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className={styles.main}>
        <div className={styles.error}>
          <p>Failed to load battle: {error}</p>
          <Link href="/battles" className={styles.backLink}>Back to Battle Records</Link>
        </div>
      </main>
    )
  }

  if (entries.length === 0) {
    return (
      <main className={styles.main}>
        <div className={styles.error}>
          <p>No battle data found for this ID.</p>
          <Link href="/battles" className={styles.backLink}>Back to Battle Records</Link>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      {/* Header */}
      <div className={styles.header}>
        <Link href="/battles" className={styles.backLink}>&larr; Battle Records</Link>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>
            Battle in {entries[0].system_id}
            {battleEnded && (
              <span className={styles.outcomeBadge}>
                {battleEnded.outcome === 'victory' ? 'Victory' : battleEnded.outcome === 'stalemate' ? 'Stalemate' : 'Mutual Destruction'}
              </span>
            )}
          </h1>
          <div className={styles.headerMeta}>
            <span>ID: {battleId.slice(0, 12)}...</span>
            <span>{entries.length} ticks</span>
            {battleEnded && <span>{battleEnded.total_damage.toLocaleString()} total damage</span>}
            {battleEnded && <span>{battleEnded.ships_destroyed} ships destroyed</span>}
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
                <span className={styles.winnerLabel}>WINNER</span>
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
                    <span className={styles.barLabel}>Hull</span>
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
                      <span className={styles.barLabel}>Shield</span>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${(inspectedSnap.shield / inspectedSnap.max_shield) * 100}%`, backgroundColor: '#4dabf7' }} />
                      </div>
                      <span className={styles.barValue}>{inspectedSnap.shield}/{inspectedSnap.max_shield}</span>
                    </div>
                  )}
                  <div className={styles.barRow}>
                    <span className={styles.barLabel}>Fuel</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${(inspectedSnap.fuel / inspectedSnap.max_fuel) * 100}%`, backgroundColor: '#ff6b35' }} />
                    </div>
                    <span className={styles.barValue}>{inspectedSnap.fuel}/{inspectedSnap.max_fuel}</span>
                  </div>
                </div>
                <div className={styles.shipInfoDetails}>
                  <span>Zone: {inspectedSnap.zone}</span>
                  <span>Stance: {inspectedSnap.stance}</span>
                  {inspectedSnap.target_id && <span>Target: {usernameMap.current.get(inspectedSnap.target_id) || inspectedSnap.target_id.slice(0, 8)}</span>}
                  <span>Dmg dealt: {inspectedSnap.damage_dealt}</span>
                  <span>Dmg taken: {inspectedSnap.damage_taken}</span>
                  {inspectedSnap.kill_count > 0 && <span>Kills: {inspectedSnap.kill_count}</span>}
                </div>
                {inspectedSnap.modules && inspectedSnap.modules.length > 0 && (
                  <div className={styles.shipInfoModules}>
                    <div className={styles.shipInfoModulesLabel}>Loadout</div>
                    {inspectedSnap.modules.map((mod, i) => (
                      <div key={i} className={styles.moduleRow}>
                        <span className={styles.moduleName}>{mod.name}</span>
                        {mod.quality !== 1.0 && (
                          <span className={styles.moduleQuality} style={{ color: mod.quality > 1.0 ? '#2dd4bf' : '#ffd93d' }}>
                            {mod.quality > 1.0 ? '+' : ''}{Math.round((mod.quality - 1) * 100)}%
                          </span>
                        )}
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
          <div className={styles.feedHeader}>Event Log</div>
          <div className={styles.feed} ref={feedRef}>
            {allEvents.length === 0 && (
              <div className={styles.feedEmpty}>No events yet</div>
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
            Tick {currentEntry?.tick ?? 0} ({currentTickIndex + 1}/{entries.length})
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
