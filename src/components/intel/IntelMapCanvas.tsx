'use client'

// Fleet intelligence galaxy canvas. Forked from the /play GalaxyPanel canvas
// core (DPR sizing, pan/zoom, touch, world↔screen transform) but fully
// props-driven: no game-state coupling, no fetching — the page supplies
// topology, fog-of-war sets, agent positions, and trails.

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import type {
  IntelAgent,
  IntelLayerState,
  IntelMapSystem,
  TrailSegment,
  TransitMarker,
} from '@/lib/intelTypes'
import styles from './IntelMapCanvas.module.css'

// ── Constants ──────────────────────────────────────────────────────────

const NODE_RADIUS = 6
const DEFAULT_COLOR = '#5a6a7a'
const UNKNOWN_COLOR = '#3a4654'
const LINE_COLOR = 'rgba(140, 170, 200, 0.6)'
const UNKNOWN_LINE_COLOR = 'rgba(90, 106, 122, 0.08)'
const INTEL_OUTLINE_COLOR = 'rgba(168, 197, 214, 0.75)'
const SELECTED_COLOR = 'rgba(0, 212, 255, 0.9)'
const MIN_ZOOM = 0.001
const MAX_ZOOM = 50
const ZOOM_SENSITIVITY = 0.002
const STAR_COUNT = 800
const ZOOM_EASE_FACTOR = 0.15
const PAN_EASE_FACTOR = 0.12
const DEFAULT_ZOOM = 0.08
// Unexplored systems stay faintly visible so the galaxy keeps its shape at
// any zoom — fog dims, it doesn't erase.
const UNKNOWN_ALPHA = 0.3
// Agent-system labels render well before general labels, but still hide at
// far zoom where a big fleet's labels would collapse into overlapping mush.
const AGENT_LABEL_MIN_ZOOM = 0.045
/** Engine tick rate. Used to advance the server tick between 20s snapshot polls
    so an in-flight agent creeps forward instead of stepping once per poll. */
const TICK_MS = 10_000

const EMPIRE_NAMES: Record<string, string> = {
  solarian: 'Solarian Confederacy',
  voidborn: 'Voidborn Collective',
  crimson: 'Crimson Pact',
  nebula: 'Nebula Trade Federation',
  outerrim: 'Outer Rim Explorers',
}

// ── Types ──────────────────────────────────────────────────────────────

export interface IntelMapCanvasHandle {
  panToSystem: (systemId: string) => void
}

/**
 * How far along its jump an agent is, 0..1.
 *
 * Clamped at both ends: a jump whose arrival tick has passed but which the next
 * poll has not yet cleared would otherwise overshoot past the destination, and a
 * server without start_tick (older deploy) yields a degenerate span — park the
 * dot at the origin rather than render NaN.
 */
function transitProgress(transit: TransitMarker, tickNow: number): number {
  const span = transit.arrivalTick - transit.startTick
  if (!Number.isFinite(span) || span <= 0) return 0
  const elapsed = tickNow - transit.startTick
  return Math.min(1, Math.max(0, elapsed / span))
}

interface IntelMapCanvasProps {
  systems: IntelMapSystem[]
  exploredSystems: Set<string>
  intelSystems: Set<string>
  agentsBySystem: Map<string, IntelAgent[]>
  trails: TrailSegment[]
  transits: TransitMarker[]
  /** Server tick from the last snapshot, and the wall-clock at which it arrived */
  currentTick: number | null
  tickAnchorMs: number
  selectedSystemId: string | null
  layers: IntelLayerState
  onSystemSelect: (id: string) => void
  /** Snap the initial view here once systems are available (e.g. first agent's system) */
  initialFocusSystemId?: string | null
}

interface Star {
  x: number
  y: number
  size: number
  brightness: number
  twinkleSpeed: number
  twinkleOffset: number
  color: string
}

type Visibility = 'explored' | 'intel' | 'unknown'

export const IntelMapCanvas = forwardRef<IntelMapCanvasHandle, IntelMapCanvasProps>(
  function IntelMapCanvas(
    {
      systems,
      exploredSystems,
      intelSystems,
      agentsBySystem,
      trails,
      transits,
      currentTick,
      tickAnchorMs,
      selectedSystemId,
      layers,
      onSystemSelect,
      initialFocusSystemId,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const tooltipNameRef = useRef<HTMLDivElement>(null)
    const tooltipEmpireRef = useRef<HTMLDivElement>(null)
    const tooltipTagsRef = useRef<HTMLDivElement>(null)

    // Mutable canvas state — the RAF loop reads these refs, not React state
    const stateRef = useRef({
      hoveredSystem: null as IntelMapSystem | null,
      viewX: 0,
      viewY: 0,
      zoom: DEFAULT_ZOOM,
      isDragging: false,
      dragStart: { x: 0, y: 0 },
      viewStart: { x: 0, y: 0 },
      animationTime: 0,
      lastFrameTime: performance.now(),
      targetZoom: DEFAULT_ZOOM,
      targetViewX: 0,
      targetViewY: 0,
      viewWasSettled: true,
      stars: [] as Star[],
      lastTouchDistance: null as number | null,
      lastPinchCenter: null as { x: number; y: number } | null,
      touchStartTime: 0,
      initialTouchPos: null as { x: number; y: number } | null,
      hasCentered: false,
    })

    // Props mirrored into refs so the render loop always sees current data
    const systemsProp = useRef(systems)
    systemsProp.current = systems
    const systemsByIdRef = useRef(new Map<string, IntelMapSystem>())
    systemsByIdRef.current = new Map(systems.map((s) => [s.id, s]))
    const exploredRef = useRef(exploredSystems)
    exploredRef.current = exploredSystems
    const intelRef = useRef(intelSystems)
    intelRef.current = intelSystems
    const agentsBySystemRef = useRef(agentsBySystem)
    agentsBySystemRef.current = agentsBySystem
    const trailsRef = useRef(trails)
    trailsRef.current = trails
    const transitsRef = useRef(transits)
    transitsRef.current = transits

    // Estimated server tick right now: the tick from the last snapshot plus the
    // wall-clock elapsed since it landed. The render loop calls this every frame
    // so an in-flight agent advances smoothly instead of once per 20s poll.
    const tickInfoRef = useRef({ tick: currentTick, anchorMs: tickAnchorMs })
    tickInfoRef.current = { tick: currentTick, anchorMs: tickAnchorMs }
    const tickNowRef = useRef(() => {
      const { tick, anchorMs } = tickInfoRef.current
      if (tick === null) return 0
      return tick + (Date.now() - anchorMs) / TICK_MS
    })
    const selectedRef = useRef(selectedSystemId)
    selectedRef.current = selectedSystemId
    const layersRef = useRef(layers)
    layersRef.current = layers
    const onSystemSelectRef = useRef(onSystemSelect)
    onSystemSelectRef.current = onSystemSelect

    // Galaxy bounds for the dynamic zoom-out floor: at maximum zoom-out the
    // galaxy still fills most of the viewport instead of shrinking to a dot.
    const galaxyBoundsRef = useRef<{ spanX: number; spanY: number } | null>(null)
    useEffect(() => {
      if (systems.length < 2) {
        galaxyBoundsRef.current = null
        return
      }
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const s of systems) {
        if (s.x < minX) minX = s.x
        if (s.x > maxX) maxX = s.x
        if (s.y < minY) minY = s.y
        if (s.y > maxY) maxY = s.y
      }
      galaxyBoundsRef.current = { spanX: maxX - minX, spanY: maxY - minY }
    }, [systems])

    const effectiveMinZoom = useCallback(() => {
      const canvas = canvasRef.current
      const bounds = galaxyBoundsRef.current
      if (!canvas || !bounds || bounds.spanX <= 0 || bounds.spanY <= 0) return MIN_ZOOM
      const fit = Math.min(
        canvas.clientWidth / (bounds.spanX * 1.3),
        canvas.clientHeight / (bounds.spanY * 1.3),
      )
      return Math.max(MIN_ZOOM, fit)
    }, [])

    // ── Imperative API ─────────────────────────────────────────────────

    const panToSystem = useCallback((systemId: string) => {
      const system = systemsByIdRef.current.get(systemId)
      if (!system) return
      const s = stateRef.current
      s.targetViewX = -system.x
      s.targetViewY = -system.y
      s.targetZoom = Math.max(s.targetZoom, 0.5)
    }, [])

    useImperativeHandle(ref, () => ({ panToSystem }), [panToSystem])

    // Snap to the initial focus system once, without animation
    useEffect(() => {
      const s = stateRef.current
      if (s.hasCentered || !initialFocusSystemId) return
      const system = systemsByIdRef.current.get(initialFocusSystemId)
      if (!system) return
      s.hasCentered = true
      s.viewX = -system.x
      s.viewY = -system.y
      s.targetViewX = -system.x
      s.targetViewY = -system.y
      s.zoom = 0.35
      s.targetZoom = 0.35
    }, [initialFocusSystemId, systems])

    // ── Coordinate helpers ─────────────────────────────────────────────

    const canvasCoords = useCallback((clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: clientX, y: clientY }
      const rect = canvas.getBoundingClientRect()
      return { x: clientX - rect.left, y: clientY - rect.top }
    }, [])

    const worldToScreen = useCallback((wx: number, wy: number) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const s = stateRef.current
      return {
        x: canvas.clientWidth / 2 + (wx + s.viewX) * s.zoom,
        y: canvas.clientHeight / 2 + (wy + s.viewY) * s.zoom,
      }
    }, [])

    const screenToWorld = useCallback((sx: number, sy: number) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const s = stateRef.current
      return {
        x: (sx - canvas.clientWidth / 2) / s.zoom - s.viewX,
        y: (sy - canvas.clientHeight / 2) / s.zoom - s.viewY,
      }
    }, [])

    const findSystemAt = useCallback(
      (sx: number, sy: number): IntelMapSystem | null => {
        const hitRadius = NODE_RADIUS * 2.5
        let closest: IntelMapSystem | null = null
        let closestDist = Infinity
        for (const system of systemsProp.current) {
          const pos = worldToScreen(system.x, system.y)
          const dx = pos.x - sx
          const dy = pos.y - sy
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < hitRadius && dist < closestDist) {
            closest = system
            closestDist = dist
          }
        }
        return closest
      },
      [worldToScreen],
    )

    const visibilityOf = useCallback((systemId: string): Visibility => {
      if (!layersRef.current.fog) return 'explored'
      if (exploredRef.current.has(systemId)) return 'explored'
      if (layersRef.current.intel && intelRef.current.has(systemId)) return 'intel'
      return 'unknown'
    }, [])

    // ── Star generation ────────────────────────────────────────────────

    const generateStars = useCallback(() => {
      const stars: Star[] = []
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          size: 0.3 + Math.random() * 1.5,
          brightness: 0.15 + Math.random() * 0.6,
          twinkleSpeed: 0.3 + Math.random() * 1.5,
          twinkleOffset: Math.random() * Math.PI * 2,
          color:
            Math.random() > 0.92 ? (Math.random() > 0.5 ? '#aaddff' : '#ffddaa') : '#ffffff',
        })
      }
      stateRef.current.stars = stars
    }, [])

    // ── Rendering ──────────────────────────────────────────────────────

    const drawStarfield = useCallback((ctx: CanvasRenderingContext2D) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const s = stateRef.current
      for (const star of s.stars) {
        const x = star.x * canvas.clientWidth
        const y = star.y * canvas.clientHeight
        const twinkle =
          0.5 + 0.5 * Math.sin(s.animationTime * 0.001 * star.twinkleSpeed + star.twinkleOffset)
        const alpha = star.brightness * twinkle
        if (star.color === '#ffffff') {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        } else if (star.color.startsWith('#aa')) {
          ctx.fillStyle = `rgba(170, 221, 255, ${alpha})`
        } else {
          ctx.fillStyle = `rgba(255, 221, 170, ${alpha})`
        }
        ctx.beginPath()
        ctx.arc(x, y, star.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }, [])

    const drawGrid = useCallback(
      (ctx: CanvasRenderingContext2D) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const s = stateRef.current
        const gridLevels = [
          { size: 1000, alpha: 0.35 },
          { size: 200, alpha: 0.18 },
          { size: 50, alpha: 0.1 },
          { size: 10, alpha: 0.06 },
          { size: 2, alpha: 0.04 },
        ]
        const startWorld = screenToWorld(0, 0)
        const endWorld = screenToWorld(canvas.clientWidth, canvas.clientHeight)
        ctx.lineWidth = 1
        for (const level of gridLevels) {
          const scaledGrid = level.size * s.zoom
          if (scaledGrid < 25 || scaledGrid > 500) continue
          ctx.strokeStyle = `rgba(90, 106, 122, ${level.alpha})`
          const startX = Math.floor(startWorld.x / level.size) * level.size
          const startY = Math.floor(startWorld.y / level.size) * level.size
          for (let wx = startX; wx <= endWorld.x; wx += level.size) {
            const screen = worldToScreen(wx, 0)
            ctx.beginPath()
            ctx.moveTo(screen.x, 0)
            ctx.lineTo(screen.x, canvas.clientHeight)
            ctx.stroke()
          }
          for (let wy = startY; wy <= endWorld.y; wy += level.size) {
            const screen = worldToScreen(0, wy)
            ctx.beginPath()
            ctx.moveTo(0, screen.y)
            ctx.lineTo(canvas.clientWidth, screen.y)
            ctx.stroke()
          }
        }
      },
      [screenToWorld, worldToScreen],
    )

    const drawTrails = useCallback(
      (ctx: CanvasRenderingContext2D) => {
        if (!layersRef.current.trails) return
        const byId = systemsByIdRef.current
        ctx.save()
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        for (const segment of trailsRef.current) {
          const fromSys = byId.get(segment.from)
          const toSys = byId.get(segment.to)
          if (!fromSys || !toSys) continue
          const from = worldToScreen(fromSys.x, fromSys.y)
          const to = worldToScreen(toSys.x, toSys.y)
          // Newest segments bright, oldest faint
          ctx.globalAlpha = 0.12 + 0.6 * (1 - segment.age)
          ctx.strokeStyle = segment.color
          ctx.beginPath()
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
          ctx.stroke()
        }
        ctx.restore()
      },
      [worldToScreen],
    )

    const drawTransits = useCallback(
      (ctx: CanvasRenderingContext2D) => {
        if (!layersRef.current.agents) return
        const byId = systemsByIdRef.current
        const s = stateRef.current
        ctx.save()
        for (const transit of transitsRef.current) {
          const fromSys = byId.get(transit.from)
          const toSys = byId.get(transit.to)
          if (!fromSys || !toSys) continue
          const from = worldToScreen(fromSys.x, fromSys.y)
          const to = worldToScreen(toSys.x, toSys.y)

          // Faint guide line for the jump in progress
          ctx.strokeStyle = 'rgba(0, 212, 255, 0.25)'
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 6])
          ctx.beginPath()
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
          ctx.stroke()
          ctx.setLineDash([])

          // Where the agent actually is: the fraction of the flight elapsed.
          // The server tick only advances every 10s and we only poll every 20s,
          // so estimate the tick from the last snapshot plus wall-clock since,
          // otherwise the dot would stand still and jerk forward once a poll.
          const t = transitProgress(transit, tickNowRef.current())
          const x = from.x + (to.x - from.x) * t
          const y = from.y + (to.y - from.y) * t
          const glow = ctx.createRadialGradient(x, y, 1, x, y, 10)
          glow.addColorStop(0, 'rgba(0, 212, 255, 0.7)')
          glow.addColorStop(1, 'rgba(0, 212, 255, 0)')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(x, y, 10, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(0, 212, 255, 1)'
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      },
      [worldToScreen],
    )

    const drawAgentBadge = useCallback(
      (ctx: CanvasRenderingContext2D, x: number, y: number, agents: IntelAgent[], nodeScale: number) => {
        const count = agents.length
        const anyOnline = agents.some((a) => a.online)
        const label = count > 99 ? '99+' : String(count)
        const radius = (label.length > 2 ? 11 : label.length > 1 ? 9 : 7) * Math.max(nodeScale, 0.6)
        const bx = x + NODE_RADIUS * nodeScale + radius * 0.9
        const by = y - NODE_RADIUS * nodeScale - radius * 0.9

        ctx.save()
        ctx.fillStyle = anyOnline ? 'rgba(0, 212, 255, 0.95)' : 'rgba(107, 143, 163, 0.9)'
        ctx.strokeStyle = 'rgba(5, 8, 16, 0.9)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(bx, by, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#050810'
        ctx.font = `bold ${Math.max(9, Math.round(radius * 1.1))}px "JetBrains Mono", monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, bx, by)
        ctx.restore()
      },
      [],
    )

    const render = useCallback(
      (ctx?: CanvasRenderingContext2D | null) => {
        const canvas = canvasRef.current
        if (!canvas) return
        if (!ctx) ctx = canvas.getContext('2d')
        if (!ctx) return
        const s = stateRef.current
        const allSystems = systemsProp.current
        if (allSystems.length === 0) return

        ctx.fillStyle = '#050810'
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)

        drawStarfield(ctx)
        drawGrid(ctx)

        // Connections — dimmed when either endpoint is unknown under fog
        const byId = systemsByIdRef.current
        const drawnConnections = new Set<string>()
        ctx.lineWidth = 1.5
        for (const system of allSystems) {
          const pos1 = worldToScreen(system.x, system.y)
          const vis1 = visibilityOf(system.id)
          for (const connId of system.connections) {
            const connKey = system.id < connId ? `${system.id}-${connId}` : `${connId}-${system.id}`
            if (drawnConnections.has(connKey)) continue
            drawnConnections.add(connKey)
            const connSystem = byId.get(connId)
            if (!connSystem) continue
            const pos2 = worldToScreen(connSystem.x, connSystem.y)
            const vis2 = visibilityOf(connId)
            ctx.strokeStyle =
              vis1 === 'unknown' || vis2 === 'unknown' ? UNKNOWN_LINE_COLOR : LINE_COLOR
            ctx.beginPath()
            ctx.moveTo(pos1.x, pos1.y)
            ctx.lineTo(pos2.x, pos2.y)
            ctx.stroke()
          }
        }

        drawTrails(ctx)

        // Scale nodes down when zoomed far out
        const ZOOM_THRESHOLD = 0.06
        const nodeScale = s.zoom < ZOOM_THRESHOLD ? s.zoom / ZOOM_THRESHOLD : 1
        const nr = NODE_RADIUS * nodeScale

        for (const system of allSystems) {
          const pos = worldToScreen(system.x, system.y)
          const vis = visibilityOf(system.id)
          const isHovered = s.hoveredSystem?.id === system.id
          const isSelected = selectedRef.current === system.id
          const isHomeSystem = system.is_home === true
          const agentsHere = layersRef.current.agents
            ? agentsBySystemRef.current.get(system.id)
            : undefined

          // Unknown systems: heavily dimmed, desaturated, no decoration
          if (vis === 'unknown' && !isHovered && !isSelected) {
            ctx.globalAlpha = UNKNOWN_ALPHA
            ctx.fillStyle = UNKNOWN_COLOR
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, nr * 0.8, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalAlpha = 1
            continue
          }

          const color = vis === 'unknown' ? UNKNOWN_COLOR : system.empire_color || DEFAULT_COLOR

          // Selection ring + glow
          if (isSelected) {
            const glow = ctx.createRadialGradient(pos.x, pos.y, nr, pos.x, pos.y, nr * 5)
            glow.addColorStop(0, 'rgba(0, 212, 255, 0.3)')
            glow.addColorStop(1, 'rgba(0, 212, 255, 0)')
            ctx.fillStyle = glow
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, nr * 5, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = SELECTED_COLOR
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, nr * 2.4 + 4 * nodeScale, 0, Math.PI * 2)
            ctx.stroke()
          }

          // Hover glow
          if (isHovered) {
            const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nr * 4)
            gradient.addColorStop(0, color + 'bb')
            gradient.addColorStop(0.5, color + '40')
            gradient.addColorStop(1, color + '00')
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, nr * 4, 0, Math.PI * 2)
            ctx.fill()
          }

          if (vis === 'intel') {
            // Faction intel only — dashed outline, muted fill, never visited
            ctx.fillStyle = color + '55'
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, nr * 0.8, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = INTEL_OUTLINE_COLOR
            ctx.lineWidth = 1.2
            ctx.setLineDash([3, 3])
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, nr * 1.5, 0, Math.PI * 2)
            ctx.stroke()
            ctx.setLineDash([])
          } else {
            // Explored (or fog disabled): base node like the public map
            const hoverScale = isHovered ? 1.5 : 1.0
            const nodeRadius = isHomeSystem ? nr * 1.6 : nr * 0.9

            if (system.is_stronghold) {
              const pulsePhase = (s.animationTime * 0.0015 + system.x * 0.002) % (Math.PI * 2)
              const pulseAlpha = 0.2 + Math.sin(pulsePhase) * 0.1
              const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nr * 4)
              gradient.addColorStop(0, `rgba(255, 68, 68, ${pulseAlpha})`)
              gradient.addColorStop(1, 'rgba(255, 68, 68, 0)')
              ctx.fillStyle = gradient
              ctx.beginPath()
              ctx.arc(pos.x, pos.y, nr * 4, 0, Math.PI * 2)
              ctx.fill()
            }

            ctx.fillStyle = system.is_stronghold && !system.empire ? '#f97316' : color
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, nodeRadius * hoverScale, 0, Math.PI * 2)
            ctx.fill()

            if (isHomeSystem) {
              ctx.strokeStyle = color
              ctx.lineWidth = 2 * nodeScale
              ctx.beginPath()
              ctx.arc(pos.x, pos.y, nodeRadius * hoverScale + 4 * nodeScale, 0, Math.PI * 2)
              ctx.stroke()
            }

            ctx.fillStyle = '#ffffff'
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, nodeRadius * 0.3 * hoverScale, 0, Math.PI * 2)
            ctx.fill()
          }

          // Agent count badge
          if (agentsHere && agentsHere.length > 0) {
            drawAgentBadge(ctx, pos.x, pos.y, agentsHere, nodeScale)
          }

          // Label — always for hovered/selected, agent systems above a lower
          // zoom gate, everything else only when zoomed in
          const showLabel =
            isHovered ||
            isSelected ||
            (agentsHere && agentsHere.length > 0 && s.zoom > AGENT_LABEL_MIN_ZOOM) ||
            s.zoom > 0.15
          if (showLabel) {
            ctx.font = isHovered
              ? 'bold 14px "Space Grotesk", sans-serif'
              : '13px "Space Grotesk", sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.fillStyle = isHovered
              ? '#ffffff'
              : vis === 'intel'
                ? 'rgba(168, 197, 214, 0.55)'
                : 'rgba(168, 197, 214, 0.9)'
            ctx.fillText(system.name, pos.x, pos.y + nr + 8)
          }
        }

        drawTransits(ctx)
      },
      [drawStarfield, drawGrid, drawTrails, drawTransits, drawAgentBadge, visibilityOf, worldToScreen],
    )

    // ── Tooltip ────────────────────────────────────────────────────────

    const updateTooltip = useCallback(
      (system: IntelMapSystem | null, mx: number, my: number) => {
        const tooltip = tooltipRef.current
        if (!tooltip) return
        if (!system) {
          tooltip.className = styles.tooltip
          return
        }
        const vis = visibilityOf(system.id)
        const agentsHere = agentsBySystemRef.current.get(system.id)

        if (tooltipNameRef.current) {
          tooltipNameRef.current.textContent = system.name
          tooltipNameRef.current.style.color =
            vis === 'unknown' ? '#6b8fa3' : system.empire_color || '#e8f4f8'
        }
        if (tooltipEmpireRef.current) {
          if (system.empire && vis !== 'unknown') {
            tooltipEmpireRef.current.textContent = EMPIRE_NAMES[system.empire] || system.empire
            tooltipEmpireRef.current.style.display = 'block'
          } else {
            tooltipEmpireRef.current.style.display = 'none'
          }
        }
        if (tooltipTagsRef.current) {
          const tags: string[] = []
          if (vis === 'explored' && layersRef.current.fog) tags.push('Explored')
          if (vis === 'intel') tags.push('Faction intel')
          if (vis === 'unknown') tags.push('No intel')
          if (agentsHere && agentsHere.length > 0) {
            tags.push(`${agentsHere.length} agent${agentsHere.length === 1 ? '' : 's'}`)
          }
          tooltipTagsRef.current.textContent = tags.join(' · ')
          tooltipTagsRef.current.style.display = tags.length > 0 ? 'block' : 'none'
        }
        tooltip.style.left = mx + 15 + 'px'
        tooltip.style.top = my + 15 + 'px'
        tooltip.className = `${styles.tooltip} ${styles.tooltipVisible}`
      },
      [visibilityOf],
    )

    // ── View controls ──────────────────────────────────────────────────

    const zoomIn = useCallback(() => {
      const s = stateRef.current
      s.targetZoom = Math.min(MAX_ZOOM, s.targetZoom * 1.5)
    }, [])

    const zoomOut = useCallback(() => {
      const s = stateRef.current
      s.targetZoom = Math.max(effectiveMinZoom(), s.targetZoom / 1.5)
    }, [effectiveMinZoom])

    const resetView = useCallback(() => {
      const s = stateRef.current
      s.targetViewX = 0
      s.targetViewY = 0
      s.targetZoom = DEFAULT_ZOOM
    }, [])

    // ── Main effect: canvas lifecycle ──────────────────────────────────

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const s = stateRef.current

      let resizeObserver: ResizeObserver | null = null

      function resizeCanvas() {
        if (!canvas) return
        const container = containerRef.current
        if (container) {
          const dpr = window.devicePixelRatio || 1
          canvas.width = container.clientWidth * dpr
          canvas.height = container.clientHeight * dpr
          canvas.style.width = container.clientWidth + 'px'
          canvas.style.height = container.clientHeight + 'px'
          ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        render(ctx)
      }

      generateStars()
      resizeCanvas()

      // Animation loop — always running for twinkle/transit animation
      let animFrameId: number
      function animationLoop(timestamp: number) {
        const deltaTime = timestamp - s.lastFrameTime
        s.lastFrameTime = timestamp
        s.animationTime += deltaTime

        const zoomDiff = s.targetZoom - s.zoom
        const viewXDiff = s.targetViewX - s.viewX
        const viewYDiff = s.targetViewY - s.viewY
        s.zoom += zoomDiff * ZOOM_EASE_FACTOR
        s.viewX += viewXDiff * PAN_EASE_FACTOR
        s.viewY += viewYDiff * PAN_EASE_FACTOR

        const viewSettled =
          Math.abs(zoomDiff) <= 0.0001 && Math.abs(viewXDiff) <= 0.1 && Math.abs(viewYDiff) <= 0.1

        render(ctx)

        if (viewSettled && !s.viewWasSettled) {
          s.zoom = s.targetZoom
          s.viewX = s.targetViewX
          s.viewY = s.targetViewY
        }
        s.viewWasSettled = viewSettled

        animFrameId = requestAnimationFrame(animationLoop)
      }
      animFrameId = requestAnimationFrame(animationLoop)

      // ── Mouse events ─────────────────────────────────────────────
      function onMouseDown(e: MouseEvent) {
        s.isDragging = true
        s.dragStart = { x: e.clientX, y: e.clientY }
        s.viewStart = { x: s.viewX, y: s.viewY }
      }

      function onMouseMove(e: MouseEvent) {
        if (s.isDragging) {
          const dx = e.clientX - s.dragStart.x
          const dy = e.clientY - s.dragStart.y
          s.viewX = s.viewStart.x + dx / s.zoom
          s.viewY = s.viewStart.y + dy / s.zoom
          s.targetViewX = s.viewX
          s.targetViewY = s.viewY
        } else {
          const pos = canvasCoords(e.clientX, e.clientY)
          const system = findSystemAt(pos.x, pos.y)
          s.hoveredSystem = system
          updateTooltip(system, pos.x, pos.y)
          canvas!.style.cursor = system ? 'pointer' : 'grab'
        }
      }

      function onMouseUp(e: MouseEvent) {
        const dx = e.clientX - s.dragStart.x
        const dy = e.clientY - s.dragStart.y
        const wasDrag = Math.abs(dx) > 5 || Math.abs(dy) > 5
        if (!wasDrag) {
          const pos = canvasCoords(e.clientX, e.clientY)
          const system = findSystemAt(pos.x, pos.y)
          if (system) onSystemSelectRef.current(system.id)
        }
        s.isDragging = false
      }

      function onMouseLeave() {
        s.isDragging = false
        s.hoveredSystem = null
        if (tooltipRef.current) tooltipRef.current.className = styles.tooltip
      }

      function onWheel(e: WheelEvent) {
        e.preventDefault()
        const clampedDelta = Math.max(-100, Math.min(100, e.deltaY))
        const zoomFactor = Math.exp(-clampedDelta * ZOOM_SENSITIVITY)
        s.targetZoom = Math.max(effectiveMinZoom(), Math.min(MAX_ZOOM, s.targetZoom * zoomFactor))

        // Zoom toward mouse position
        const pos = canvasCoords(e.clientX, e.clientY)
        const cx = canvas!.clientWidth / 2
        const cy = canvas!.clientHeight / 2
        const worldX = (pos.x - cx) / s.zoom - s.viewX
        const worldY = (pos.y - cy) / s.zoom - s.viewY
        const tempZoom = s.zoom
        s.zoom = s.targetZoom
        const newWorldX = (pos.x - cx) / s.zoom - s.viewX
        const newWorldY = (pos.y - cy) / s.zoom - s.viewY
        s.zoom = tempZoom
        s.targetViewX = s.viewX + (newWorldX - worldX)
        s.targetViewY = s.viewY + (newWorldY - worldY)
      }

      // ── Touch events ─────────────────────────────────────────────
      function getTouchDistance(touches: TouchList) {
        const dx = touches[0].clientX - touches[1].clientX
        const dy = touches[0].clientY - touches[1].clientY
        return Math.sqrt(dx * dx + dy * dy)
      }

      function getTouchCenter(touches: TouchList) {
        const midX = (touches[0].clientX + touches[1].clientX) / 2
        const midY = (touches[0].clientY + touches[1].clientY) / 2
        return canvasCoords(midX, midY)
      }

      function onTouchStart(e: TouchEvent) {
        e.preventDefault()
        s.touchStartTime = Date.now()
        if (e.touches.length === 1) {
          s.isDragging = true
          s.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          s.initialTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          s.viewStart = { x: s.viewX, y: s.viewY }
          s.lastTouchDistance = null
          s.lastPinchCenter = null
        } else if (e.touches.length === 2) {
          s.isDragging = false
          s.lastTouchDistance = getTouchDistance(e.touches)
          s.lastPinchCenter = getTouchCenter(e.touches)
          s.targetZoom = s.zoom
          s.targetViewX = s.viewX
          s.targetViewY = s.viewY
        }
      }

      function onTouchMove(e: TouchEvent) {
        e.preventDefault()
        if (e.touches.length === 1 && s.isDragging) {
          const dx = e.touches[0].clientX - s.dragStart.x
          const dy = e.touches[0].clientY - s.dragStart.y
          s.viewX = s.viewStart.x + dx / s.zoom
          s.viewY = s.viewStart.y + dy / s.zoom
          s.targetViewX = s.viewX
          s.targetViewY = s.viewY
        } else if (e.touches.length === 2) {
          const newDistance = getTouchDistance(e.touches)
          const newCenter = getTouchCenter(e.touches)
          if (s.lastTouchDistance === null) {
            s.lastTouchDistance = newDistance
            s.lastPinchCenter = newCenter
            return
          }
          const scale = newDistance / s.lastTouchDistance
          const cx = canvas!.clientWidth / 2
          const cy = canvas!.clientHeight / 2
          const worldX = (newCenter.x - cx) / s.zoom - s.viewX
          const worldY = (newCenter.y - cy) / s.zoom - s.viewY
          const newZoom = Math.max(effectiveMinZoom(), Math.min(MAX_ZOOM, s.zoom * scale))
          s.zoom = newZoom
          s.targetZoom = newZoom
          const newWorldX = (newCenter.x - cx) / s.zoom - s.viewX
          const newWorldY = (newCenter.y - cy) / s.zoom - s.viewY
          s.viewX += newWorldX - worldX
          s.viewY += newWorldY - worldY
          if (s.lastPinchCenter) {
            s.viewX += (newCenter.x - s.lastPinchCenter.x) / s.zoom
            s.viewY += (newCenter.y - s.lastPinchCenter.y) / s.zoom
          }
          s.targetViewX = s.viewX
          s.targetViewY = s.viewY
          s.lastTouchDistance = newDistance
          s.lastPinchCenter = newCenter
        }
      }

      function onTouchEnd(e: TouchEvent) {
        e.preventDefault()
        const wasTap = Date.now() - s.touchStartTime < 300
        if (wasTap && e.changedTouches.length === 1 && s.initialTouchPos) {
          const touch = e.changedTouches[0]
          const dx = touch.clientX - s.initialTouchPos.x
          const dy = touch.clientY - s.initialTouchPos.y
          if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) {
            const tpos = canvasCoords(touch.clientX, touch.clientY)
            const system = findSystemAt(tpos.x, tpos.y)
            if (system) onSystemSelectRef.current(system.id)
          }
        }
        if (e.touches.length === 0) {
          s.isDragging = false
          s.lastTouchDistance = null
          s.lastPinchCenter = null
          s.initialTouchPos = null
        } else if (e.touches.length === 1) {
          s.isDragging = true
          s.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          s.viewStart = { x: s.viewX, y: s.viewY }
          s.lastTouchDistance = null
          s.lastPinchCenter = null
        }
      }

      canvas.addEventListener('mousedown', onMouseDown)
      canvas.addEventListener('mousemove', onMouseMove)
      canvas.addEventListener('mouseup', onMouseUp)
      canvas.addEventListener('mouseleave', onMouseLeave)
      canvas.addEventListener('wheel', onWheel, { passive: false })
      canvas.addEventListener('touchstart', onTouchStart, { passive: false })
      canvas.addEventListener('touchmove', onTouchMove, { passive: false })
      canvas.addEventListener('touchend', onTouchEnd, { passive: false })

      if (containerRef.current) {
        resizeObserver = new ResizeObserver(() => resizeCanvas())
        resizeObserver.observe(containerRef.current)
      }

      return () => {
        canvas.removeEventListener('mousedown', onMouseDown)
        canvas.removeEventListener('mousemove', onMouseMove)
        canvas.removeEventListener('mouseup', onMouseUp)
        canvas.removeEventListener('mouseleave', onMouseLeave)
        canvas.removeEventListener('wheel', onWheel)
        canvas.removeEventListener('touchstart', onTouchStart)
        canvas.removeEventListener('touchmove', onTouchMove)
        canvas.removeEventListener('touchend', onTouchEnd)
        if (resizeObserver) resizeObserver.disconnect()
        cancelAnimationFrame(animFrameId)
      }
    }, [render, generateStars, canvasCoords, findSystemAt, updateTooltip])

    // ── JSX ────────────────────────────────────────────────────────────

    return (
      <div ref={containerRef} className={styles.mapContainer}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div ref={tooltipRef} className={styles.tooltip}>
          <div ref={tooltipNameRef} className={styles.tooltipName} />
          <div ref={tooltipEmpireRef} className={styles.tooltipEmpire} />
          <div ref={tooltipTagsRef} className={styles.tooltipTags} />
        </div>

        <div className={styles.zoomControls}>
          <button className={styles.zoomBtn} onClick={resetView} aria-label="Reset view" title="Reset view">
            &#8962;
          </button>
          <button className={styles.zoomBtn} onClick={zoomIn} aria-label="Zoom in">
            +
          </button>
          <button className={styles.zoomBtn} onClick={zoomOut} aria-label="Zoom out">
            {'−'}
          </button>
        </div>
      </div>
    )
  },
)
