'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize, Radar } from 'lucide-react'
import type { FactionQueryIntelResponse } from '@spacemolt/lib'
import {
  knownPoiDescription,
  useAccountStore,
  useLocationState,
  useMap,
  usePendingAction,
  usePlayer,
  useShip,
  useSystem,
} from '@/lib/spacemolt'
import { getItem } from '@/data/catalog'
import { titleCase as formatLabel } from '@/lib/format'
import { depositKind, DepositIcon, DepositRating } from '../LeftSidebar'
import { depositTitle } from '../richness'
import { reachAU, travelEstimateMs, travelSpeed } from '../routeWalk'
import { useTransitClock } from '../TravelProgress'
import sidebar from '../LeftSidebar.module.css'
import shared from '../shared.module.css'
import galaxy from './GalaxyPanel.module.css'
import styles from './SystemMap.module.css'
import { circle, classLabel, COLOR, drawnBySpecial, drawPoi, drawSystemSpecial, KIND_COLOR, poiColor, seeded, TAU, type Poi } from './systemMapBodies'
import { edgePoint, formatAU, formatSecs, stepToward, type Point } from './systemMapMath'

type IntelPoi = NonNullable<FactionQueryIntelResponse['entries'][number]['pois']>[number]
interface Deposit { id: string; name: string; richness: number; remaining?: number; capacity?: number }
interface Exit { id: string; systemId: string; name: string; distance?: number; angle: number }

interface SystemMapProps {
  /** A loop or auto-travel is flying the ship. */
  busy: boolean
  onTravel: (poiId: string) => void
  onJump: (systemId: string, systemName: string) => void
}

const MONO = '"JetBrains Mono", monospace'
/** The least and most AU from the center of the view to its nearer edge. */
const MIN_VIEW_AU = 0.01
const MAX_VIEW_AU = 400
const point = (p: Poi | undefined): Point | undefined => (p ? { x: p.position?.x ?? 0, y: p.position?.y ?? 0 } : undefined)
const isRing = (p: Poi) => p.type === 'asteroid_belt' || p.type === 'ice_field'
interface Rock { atSpot: boolean; angle: number; offset: number; size: number; alpha: number }
/** A belt is a full ring of rock around the star, thickest at the charted mining spot. */
function rocks(p: Poi): Rock[] {
  const rand = seeded(p.id)
  const gauss = () => (rand() + rand() + rand() + rand() - 2) / 1.15
  const { x, y } = point(p)!
  return Array.from({ length: 520 }, (_, i) => {
    const atSpot = i % 5 < 2
    return { atSpot, angle: atSpot ? Math.atan2(y, x) + gauss() * 0.3 : rand() * TAU, offset: gauss() * 0.05, size: 0.5 + rand() * 1.1, alpha: 0.25 + rand() * 0.6 }
  })
}

const unit = (dx: number, dy: number): [number, number] => { const d = Math.hypot(dx, dy); return d < 1e-6 ? [0, 1] : [dx / d, dy / d] }

/** A name beside a body, pushed along (ux, uy), with deposit-kind marks and the ship count after it. Kept inside `width`. */
function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, ux: number, uy: number, gap: number, width: number, color: string, kinds: string[] = [], ships = 0) {
  ctx.font = `500 10.5px ${MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  const textWidth = ctx.measureText(text).width
  const kindsWidth = kinds.length ? kinds.length * 7 + 5 : 0
  const shipsWidth = ships ? ctx.measureText(String(ships)).width + 13 : 0
  const total = textWidth + kindsWidth + shipsWidth
  const tx = x + ux * gap
  const ty = y + uy * (gap + 4)
  let left = Math.max(6, Math.min(width - 6 - total, ux > 0.35 ? tx : ux < -0.35 ? tx - total : tx - total / 2))
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(13,19,33,0.85)'; ctx.strokeText(text, left, ty)
  ctx.fillStyle = color; ctx.fillText(text, left, ty)
  left += textWidth
  kinds.forEach((kind, i) => { ctx.fillStyle = KIND_COLOR[kind as keyof typeof KIND_COLOR]; ctx.fillRect(left + 6 + i * 7, ty - 2.5, 5, 5) })
  left += kindsWidth
  if (ships) {
    ctx.fillStyle = COLOR.green
    ctx.beginPath(); ctx.moveTo(left + 6, ty + 3); ctx.lineTo(left + 9, ty - 3.5); ctx.lineTo(left + 12, ty + 3); ctx.fill()
    ctx.fillText(String(ships), left + 14, ty)
  }
}

function drawChip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.font = `500 10px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const width = ctx.measureText(text).width + 12
  ctx.fillStyle = 'rgba(10,14,23,0.92)'; ctx.fillRect(x - width / 2, y - 9, width, 18)
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x - width / 2 + 0.5, y - 8.5, width - 1, 17)
  ctx.fillStyle = color; ctx.fillText(text, x, y + 0.5)
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, size = 7) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.45, size * 0.7); ctx.lineTo(-size * 0.45, -size * 0.7); ctx.closePath(); ctx.fill(); ctx.restore()
}

/**
 * The current system as a ship-centered chart: the camera follows the ship, so travel is a smooth
 * pan. Click a POI to travel, click a jump exit on the edge to jump.
 */
export function SystemMap({ busy, onTravel, onJump }: SystemMapProps) {
  const store = useAccountStore()
  const factionId = usePlayer()?.faction_id
  const ship = useShip()
  const speed = travelSpeed(ship)
  const location = useLocationState()
  const { etaSecs } = useTransitClock()
  const { data: galaxyMap } = useMap()
  const systemData = useSystem().data
  const system = systemData && 'system' in systemData ? systemData.system : undefined
  const tickMs = (store.account.welcome?.tick_rate || 10) * 1000

  const [intel, setIntel] = useState<{ systemId: string; pois: IntelPoi[] } | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [showRings, setShowRings] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef({ radius: 0, target: 0, fit: true }) // AU from the center to the nearer edge

  // Faction intel for this system; factions without an intel terminal get nothing.
  const systemId = system?.id
  useEffect(() => {
    if (!systemId || !factionId) return
    let cancelled = false
    store.account.commands.spacemolt_intel.query_intel({ system_id: systemId, limit: 1 })
      .then((r) => { if (!cancelled) setIntel({ systemId, pois: r.structuredContent?.entries?.[0]?.pois ?? [] }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [systemId, factionId, store])

  // Deposits the client knows: faction intel, and the live stock at your own POI.
  const deposits = useMemo(() => {
    const known = new Map<string, Deposit[]>()
    const name = (id: string) => getItem(id)?.name ?? formatLabel(id)
    if (intel?.systemId === systemId) {
      for (const p of intel?.pois ?? []) {
        if (p.resources?.length) known.set(p.id, p.resources.map((r) => ({ id: r.resource_id, name: name(r.resource_id), richness: r.richness, remaining: r.remaining, capacity: r.max_remaining })))
      }
    }
    if (location?.poi_id && location.resources?.length) {
      const capacity = (id: string) => known.get(location.poi_id)?.find((d) => d.id === id)?.capacity
      known.set(location.poi_id, location.resources.map((r) => ({ id: r.item_id, name: r.item_name || name(r.item_id), richness: r.richness, remaining: r.remaining, capacity: capacity(r.item_id) })))
    }
    return known
  }, [intel, systemId, location])

  // Jump exits sit on the edge of the view, toward the system they lead to.
  const exits = useMemo<Exit[]>(() => {
    const here = systemId ? galaxyMap?.system(systemId) : undefined
    const connections = system?.connections ?? []
    return connections.map((c, i) => {
      const there = galaxyMap?.system(c.system_id)
      return { id: `jump:${c.system_id}`, systemId: c.system_id, name: c.name, distance: c.distance, angle: here && there ? Math.atan2(there.y - here.y, there.x - here.x) : (i / connections.length) * TAU }
    })
  }, [system, systemId, galaxyMap])

  const pois = useMemo<Poi[]>(
    () => (system?.pois ?? []).map((p: Poi) => ({ ...p, stronghold: system?.is_stronghold && p.base_type === 'station' })),
    [system],
  )
  const inTransit = Boolean(location?.in_transit) && location?.transit_type !== 'jump'
  const blocked = busy || usePendingAction() !== null

  // What the animation loop reads each frame. A ref, so the loop does not restart on every update.
  const live = { pois, poiId: location?.poi_id, systemId, exits, deposits, speed, tickMs, etaSecs, hoverId, showRings, blocked, onTravel, onJump,
    destId: inTransit ? location?.transit_dest_poi_id : undefined,
    transitAt: location?.transit_x !== undefined && location.transit_y !== undefined ? { x: location.transit_x, y: location.transit_y } : undefined }
  const liveRef = useRef(live)
  liveRef.current = live

  const hasSystem = Boolean(system)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const starRandom = seeded('stars')
    const stars = Array.from({ length: 130 }, () => [starRandom(), starRandom(), starRandom()])
    const belts = new Map<string, Rock[]>()
    const nodes = new Map<string, Point>() // screen position of every click target
    const view = viewRef.current
    let ship: { pos: Point | null; from: Point | null; key: string; eta: number | null; arriveAt: number; systemId?: string } = { pos: null, from: null, key: '', eta: null, arriveAt: 0 }
    let last = performance.now()
    let raf = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const d = liveRef.current
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      const dt = Math.min(100, now - last)
      last = now
      if (!W || !H || d.pois.length === 0) return

      // --- ship position, in AU ---
      if (ship.systemId !== d.systemId) { ship = { pos: null, from: null, key: '', eta: null, arriveAt: 0, systemId: d.systemId }; view.fit = true; belts.clear() }
      const at = point(d.pois.find((p) => p.id === d.poiId))
      const dest = point(d.pois.find((p) => p.id === d.destId))
      if (dest) {
        ship.pos ??= d.transitAt ?? at ?? dest
        if (ship.key !== d.destId) {
          // A new trip: keep the drawn position.
          ship.key = d.destId!
          ship.eta = null
          ship.arriveAt = 0
          ship.from ??= ship.pos
          view.target = Math.max(view.target, Math.hypot(dest.x - ship.pos.x, dest.y - ship.pos.y) * 1.12) // keep the destination in view
        }
        // The shared transit clock counts in whole seconds; retime when it moves.
        if (d.etaSecs !== null && ship.eta !== d.etaSecs) { ship.eta = d.etaSecs; ship.arriveAt = now + d.etaSecs * 1000 }
        // No time yet: hold. A missing time must not read as "arrived".
        if (ship.arriveAt) ship.pos = stepToward(ship.pos, dest, dt, ship.arriveAt - now)
      } else {
        ship.key = ''
        ship.eta = null
        ship.from = null
        ship.pos = at && ship.pos ? stepToward(ship.pos, at, dt, 250) : at ?? ship.pos ?? { x: 0, y: 0 }
      }
      const s = ship.pos

      // --- camera ---
      const cx = W / 2
      const cy = H / 2
      const R = Math.max(40, Math.min(W, H) / 2 - 30)
      if (view.fit || !view.target) {
        view.target = Math.max(MIN_VIEW_AU, ...d.pois.map((p) => Math.hypot((p.position?.x ?? 0) - s.x, (p.position?.y ?? 0) - s.y))) * 1.1
        view.fit = false
        if (!view.radius) view.radius = view.target
      }
      view.target = Math.max(MIN_VIEW_AU, Math.min(MAX_VIEW_AU, view.target))
      view.radius += (view.target - view.radius) * (reduced ? 1 : 0.12)
      const z = R / view.radius
      const project = (p: Point): Point => ({ x: cx + (p.x - s.x) * z, y: cy + (p.y - s.y) * z })
      const star = project({ x: 0, y: 0 })
      const secsTo = (p: Point) => travelEstimateMs(s, p, d.speed) / 1000

      // --- backdrop, orbits, belts ---
      ctx.fillStyle = COLOR.bg; ctx.fillRect(0, 0, W, H)
      for (const [x, y, b] of stars) { ctx.fillStyle = `rgba(232,244,248,${0.12 + b * 0.4})`; ctx.fillRect(x * W, y * H, b > 0.8 ? 1.5 : 1, b > 0.8 ? 1.5 : 1) }
      ctx.lineWidth = 1
      for (const p of d.pois) {
        if (p.type !== 'planet' && !isRing(p)) continue
        const { x, y } = point(p)!
        ctx.strokeStyle = isRing(p) ? 'rgba(168,197,214,0.05)' : 'rgba(168,197,214,0.11)'
        circle(ctx, star.x, star.y, Math.hypot(x, y) * z); ctx.stroke()
      }
      for (const p of d.pois.filter(isRing)) {
        if (!belts.has(p.id)) belts.set(p.id, rocks(p))
        const { x, y } = point(p)!
        const orbit = Math.hypot(x, y)
        ctx.fillStyle = poiColor(p)
        for (const rock of belts.get(p.id)!) {
          const angle = rock.angle + (reduced || rock.atSpot ? 0 : now * 0.000012)
          const r = orbit * (1 + rock.offset)
          const q = project({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
          if (q.x < 0 || q.y < 0 || q.x > W || q.y > H) continue
          ctx.globalAlpha = rock.alpha * (rock.atSpot ? 0.95 : 0.55)
          ctx.fillRect(q.x, q.y, rock.size, rock.size)
        }
        ctx.globalAlpha = 1
      }

      const t = reduced ? 0 : now
      drawSystemSpecial(ctx, d.systemId, { pois: d.pois, project, scale: z, t })

      // --- travel-time rings, hidden while the ship moves ---
      if (d.showRings && !dest) {
        const tickSecs = d.tickMs / 1000
        for (const ticks of [1, 2, 4, 8, 16, 32, 64]) {
          const r = reachAU(ticks * d.speed) * z
          if (r < 28 || r > Math.hypot(W, H) / 2) continue
          ctx.strokeStyle = 'rgba(0,212,255,0.24)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); circle(ctx, cx, cy, r); ctx.stroke(); ctx.setLineDash([])
          const ly = cy - r > 16 ? cy - r : cy + r < H - 16 ? cy + r : null
          if (ly === null) continue
          ctx.font = `400 9.5px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          const text = `${ticks} ${ticks === 1 ? 'tick' : 'ticks'} · ${formatSecs(ticks * tickSecs)}`
          const width = ctx.measureText(text).width + 8
          ctx.fillStyle = COLOR.bg; ctx.fillRect(cx - width / 2, ly - 6, width, 12)
          ctx.fillStyle = 'rgba(0,212,255,0.8)'; ctx.fillText(text, cx, ly)
        }
      }

      // --- POIs; one outside the view becomes a marker on the edge ---
      nodes.clear()
      const pad = 24
      for (const p of d.pois) {
        const world = point(p)!
        const screen = project(world)
        const color = d.hoverId === p.id || d.poiId === p.id ? COLOR.white : COLOR.silver
        const edge = edgePoint(screen, { x: cx, y: cy }, W / 2 - pad, H / 2 - pad)
        if (edge) {
          const [ux, uy] = unit(screen.x - cx, screen.y - cy)
          nodes.set(p.id, edge)
          drawArrow(ctx, edge.x, edge.y, Math.atan2(uy, ux), poiColor(p))
          drawLabel(ctx, `${(p.base_name || p.name).toUpperCase()} · ${formatSecs(secsTo(world))}`, edge.x, edge.y, -ux, -uy, 12, W, d.hoverId === p.id ? COLOR.white : COLOR.grey)
          continue
        }
        nodes.set(p.id, screen)
        const lit = unit(screen.x - star.x, screen.y - star.y)
        const r = drawPoi(ctx, drawnBySpecial(d.systemId, p) ? { ...p, type: 'marker' } : p, screen.x, screen.y, lit, t, z)
        // A plain star at the center needs no name. A black hole or a companion star does.
        if (p.type === 'sun' && classLabel(p)?.includes('·') && !world.x && !world.y) continue
        const here = Math.hypot(screen.x - cx, screen.y - cy) < 4
        const kinds = [...new Set((d.deposits.get(p.id) ?? []).map((dep) => depositKind(dep.id)))]
        drawLabel(ctx, (p.base_name || p.name).toUpperCase(), screen.x, screen.y, here ? 0 : lit[0], here ? 1 : lit[1], here ? 22 : r + 7, W, color, kinds, p.ship_count)
      }
      const exitLabels: Point[] = []
      for (const exit of d.exits) {
        const edge = edgePoint({ x: cx + Math.cos(exit.angle) * (W + H), y: cy + Math.sin(exit.angle) * (W + H) }, { x: cx, y: cy }, W / 2 - pad, H / 2 - pad)!
        nodes.set(exit.id, edge)
        const [ux, uy] = [Math.cos(exit.angle), Math.sin(exit.angle)]
        drawArrow(ctx, edge.x, edge.y, exit.angle, COLOR.purple, 8)
        drawArrow(ctx, edge.x - ux * 8, edge.y - uy * 8, exit.angle, COLOR.purple, 8)
        // Exits that lead the same way share an edge: stack their labels.
        const stack = exitLabels.filter((q) => Math.abs(q.x - edge.x) < 170 && Math.abs(q.y - edge.y) < 14).length
        exitLabels.push(edge)
        drawLabel(ctx, `JUMP · ${exit.name.toUpperCase()}`, edge.x - ux * 8, edge.y - uy * 8 - stack * 14 * (edge.y > cy ? 1 : -1), -ux, -uy, 14, W, d.hoverId === exit.id ? COLOR.white : COLOR.purple)
      }

      // --- course, ship, hover ---
      const hover = d.hoverId ? nodes.get(d.hoverId) : undefined
      if (dest) {
        const to = project(dest)
        const from = project(ship.from ?? s)
        ctx.strokeStyle = COLOR.cyan; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(cx, cy); ctx.stroke()
        ctx.strokeStyle = 'rgba(0,212,255,0.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.setLineDash([])
        ctx.strokeStyle = COLOR.cyan; circle(ctx, to.x, to.y, 15); ctx.stroke()
        if (Math.hypot(to.x - cx, to.y - cy) > 70) drawChip(ctx, formatSecs(Math.ceil(Math.max(0, ship.arriveAt - now) / 1000)), (cx + to.x) / 2, (cy + to.y) / 2, COLOR.cyan)
        ctx.shadowColor = COLOR.cyan; ctx.shadowBlur = 10
        drawArrow(ctx, cx, cy, Math.atan2(to.y - cy, to.x - cx), COLOR.cyan, 8)
        ctx.shadowBlur = 0
      } else {
        ctx.strokeStyle = COLOR.cyan; ctx.lineWidth = 1.4; circle(ctx, cx, cy, 14); ctx.stroke()
        ctx.strokeStyle = 'rgba(0,212,255,0.3)'; circle(ctx, cx, cy, 18 + (reduced ? 0 : (Math.sin(now / 420) + 1) * 1.5)); ctx.stroke()
        if (hover && !d.blocked && d.hoverId !== d.poiId && !d.hoverId!.startsWith('jump:')) {
          ctx.strokeStyle = 'rgba(232,244,248,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hover.x, hover.y); ctx.stroke(); ctx.setLineDash([])
          const secs = secsTo(point(d.pois.find((p) => p.id === d.hoverId))!)
          drawChip(ctx, formatSecs(secs), (cx + hover.x) / 2, (cy + hover.y) / 2, COLOR.white)
        }
      }
      if (hover) { ctx.strokeStyle = COLOR.white; ctx.lineWidth = 1; circle(ctx, hover.x, hover.y, 11); ctx.stroke() }

      // The tooltip follows its POI as the view moves.
      const tip = tooltipRef.current
      if (tip && hover) {
        const left = hover.x + 18 + tip.offsetWidth > W ? hover.x - tip.offsetWidth - 18 : hover.x + 18
        tip.style.left = `${Math.max(4, Math.min(W - tip.offsetWidth - 4, left))}px`
        tip.style.top = `${Math.max(4, Math.min(H - tip.offsetHeight - 4, hover.y - tip.offsetHeight / 2))}px`
        tip.style.visibility = 'visible'
      }
    }
    raf = requestAnimationFrame(frame)

    const pick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      let best: string | null = null
      let bestDistance = 18
      for (const [id, node] of nodes) {
        const distance = Math.hypot(node.x - (e.clientX - rect.left), node.y - (e.clientY - rect.top))
        if (distance < bestDistance) { bestDistance = distance; best = id }
      }
      return best
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const id = pick(e)
      setHoverId(id)
      canvas.style.cursor = id && !liveRef.current.blocked && id !== liveRef.current.poiId ? 'pointer' : 'default'
    }
    const onLeave = (e: PointerEvent) => { if (e.pointerType !== 'touch') setHoverId(null) }
    const onClick = (e: MouseEvent) => {
      const d = liveRef.current
      const id = pick(e)
      // Touch has no hover: the first tap shows the details, the second tap goes.
      if ((e as PointerEvent).pointerType === 'touch' && d.hoverId !== id) { setHoverId(id); return }
      if (!id || d.blocked) return
      const exit = d.exits.find((x) => x.id === id)
      if (exit) d.onJump(exit.systemId, exit.name)
      else if (id !== d.poiId) d.onTravel(id)
    }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); view.target *= Math.exp(e.deltaY * 0.0015) }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [hasSystem])

  if (!system) return <div className={galaxy.mapContainer}><div className={`${shared.emptyState} ${styles.empty}`}>No system chart. The map returns when the jump ends.</div></div>

  const hoverPoi = pois.find((p) => p.id === hoverId)
  const hoverExit = exits.find((x) => x.id === hoverId)
  const hoverDeposits = hoverPoi ? deposits.get(hoverPoi.id) : undefined
  // Known from a visit, or from faction intel.
  const hoverDescription = hoverPoi && (knownPoiDescription(hoverPoi.id) || (intel?.systemId === systemId ? intel?.pois.find((p) => p.id === hoverPoi.id)?.description : undefined))
  const atPoi = point(pois.find((p) => p.id === location?.poi_id))
  const isHere = hoverPoi?.id === location?.poi_id && !inTransit
  // Distance from where the ship was last reported; the map itself draws the live position.
  const from = live.transitAt ?? atPoi
  const travelSecs = hoverPoi && from ? travelEstimateMs(from, point(hoverPoi)!, speed) / 1000 : undefined

  return (
    <div className={galaxy.mapContainer}>
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={`Map of the ${system.name} system`} />

      {(hoverPoi || hoverExit) && (
        <div ref={tooltipRef} className={styles.tooltip}>
          <div className={galaxy.tooltipName}>{hoverPoi ? hoverPoi.name : hoverExit!.name}</div>
          <div className={styles.tooltipMeta}>
            {hoverPoi ? [formatLabel(hoverPoi.type), classLabel(hoverPoi)].filter(Boolean).join(' · ') : 'Jump exit'}
          </div>
          {hoverDescription && <p className={styles.tooltipDescription}>{hoverDescription}</p>}
          <dl className={styles.tooltipRows}>
            {hoverPoi?.base_name && <><dt>Station</dt><dd>{hoverPoi.base_name}</dd></>}
            {hoverPoi && !isHere && travelSecs !== undefined && from && (
              <>
                <dt>Distance</dt><dd>{formatAU(Math.hypot(point(hoverPoi)!.x - from.x, point(hoverPoi)!.y - from.y))} AU</dd>
                <dt>Travel</dt><dd>{formatSecs(travelSecs)}</dd>
              </>
            )}
            {(hoverPoi?.ship_count ?? 0) > 0 && <><dt>Ships on scanner</dt><dd>{hoverPoi!.ship_count}</dd></>}
            {hoverExit?.distance !== undefined && <><dt>Distance</dt><dd>{hoverExit.distance} GU</dd></>}
          </dl>
          {hoverDeposits && (
            <div className={sidebar.resourceList}>
              {hoverDeposits.map((r) => (
                <div key={r.id} className={`${sidebar.resourceItem} ${r.remaining === 0 ? sidebar.depleted : ''}`} title={depositTitle(r.id, r.richness, r.remaining, r.capacity)}>
                  <DepositIcon itemId={r.id} />
                  <span className={sidebar.resourceName}>{r.name}</span>
                  <DepositRating itemId={r.id} richness={r.richness} remaining={r.remaining} />
                </div>
              ))}
            </div>
          )}
          <div className={styles.tooltipAction}>
            {isHere ? 'You are here' : blocked ? 'Ship is busy' : hoverExit ? 'Click to jump' : 'Click to travel'}
          </div>
        </div>
      )}

      <div className={galaxy.zoomControls}>
        <button className={`${galaxy.zoomBtn} ${showRings ? '' : styles.off}`} onClick={() => setShowRings((v) => !v)} aria-pressed={showRings} aria-label="Travel-time rings" title="Travel-time rings" type="button">
          <Radar size={16} />
        </button>
        <button className={galaxy.zoomBtn} onClick={() => { viewRef.current.fit = true }} aria-label="Fit the system in view" title="Fit system" type="button">
          <Maximize size={16} />
        </button>
        <button className={galaxy.zoomBtn} onClick={() => { viewRef.current.target *= 0.62 }} aria-label="Zoom in" type="button">+</button>
        <button className={galaxy.zoomBtn} onClick={() => { viewRef.current.target *= 1.6 }} aria-label="Zoom out" type="button">−</button>
      </div>
    </div>
  )
}
