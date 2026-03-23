'use client'

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import styles from './GalaxyPanel.module.css'

// ── Types ──────────────────────────────────────────────────────────────

export interface MapSystemData {
  id: string
  name: string
  x: number
  y: number
  empire?: string
  empire_color?: string
  is_home?: boolean
  is_stronghold?: boolean
  has_station?: boolean
  connections: string[]
}

export interface PlannedRoute {
  route: { system_id: string; name: string; jumps: number }[]
  totalJumps: number
  targetSystem: string
  fuelPerJump: number
  estimatedFuel: number
  fuelAvailable: number
  viaWaypoints?: string[] // user-added intermediate system IDs
}

interface MapData {
  systems: MapSystemData[]
}

export interface GalaxyPanelHandle {
  panToSystem: (systemId: string) => void
  getSystems: () => MapSystemData[]
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

// ── Constants ──────────────────────────────────────────────────────────

const NODE_RADIUS = 6
const DEFAULT_COLOR = '#5a6a7a'
const LINE_COLOR = 'rgba(140, 170, 200, 0.6)'
const MIN_ZOOM = 0.001
const MAX_ZOOM = 50
const ZOOM_SENSITIVITY = 0.002
const STAR_COUNT = 800
const ZOOM_EASE_FACTOR = 0.15
const PAN_EASE_FACTOR = 0.12
const DEFAULT_ZOOM = 0.08

// ── Client-side BFS pathfinding ────────────────────────────────────────

function findRouteBFS(systems: MapSystemData[], fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId]
  const adj = new Map<string, string[]>()
  for (const sys of systems) {
    adj.set(sys.id, [...sys.connections])
  }
  const queue: string[] = [fromId]
  const visited = new Set<string>([fromId])
  const parent = new Map<string, string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === toId) {
      const path: string[] = []
      let node: string | undefined = toId
      while (node && node !== fromId) {
        path.unshift(node)
        node = parent.get(node)
      }
      path.unshift(fromId)
      return path
    }
    for (const neighbor of adj.get(current) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        parent.set(neighbor, current)
        queue.push(neighbor)
      }
    }
  }
  return null
}

function buildRouteFromPath(path: string[], systems: MapSystemData[], fuelPerJump: number, fuelAvailable: number, viaWaypoints?: string[]): PlannedRoute {
  const systemMap = new Map(systems.map((s) => [s.id, s]))
  const totalJumps = path.length - 1
  return {
    route: path.map((id, i) => ({
      system_id: id,
      name: systemMap.get(id)?.name || id,
      jumps: i,
    })),
    totalJumps,
    targetSystem: path[path.length - 1],
    fuelPerJump,
    estimatedFuel: fuelPerJump * totalJumps,
    fuelAvailable,
    viaWaypoints: viaWaypoints?.length ? viaWaypoints : undefined,
  }
}

/** Build a full route through a sequence of via-points using BFS for each leg */
function buildRouteViaWaypoints(systems: MapSystemData[], startId: string, destId: string, via: string[], fuelPerJump: number, fuelAvailable: number): PlannedRoute | null {
  const stops = [startId, ...via, destId]
  const fullPath: string[] = []
  for (let i = 0; i < stops.length - 1; i++) {
    const leg = findRouteBFS(systems, stops[i], stops[i + 1])
    if (!leg) return null
    if (i === 0) {
      fullPath.push(...leg)
    } else {
      fullPath.push(...leg.slice(1)) // skip duplicate junction
    }
  }
  return buildRouteFromPath(fullPath, systems, fuelPerJump, fuelAvailable, via)
}

const EMPIRE_NAMES: Record<string, string> = {
  solarian: 'Solarian Confederacy',
  voidborn: 'Voidborn Collective',
  crimson: 'Crimson Pact',
  nebula: 'Nebula Trade Federation',
  outerrim: 'Outer Rim Explorers',
}

// ── Component ──────────────────────────────────────────────────────────

interface AutoTravelProgress {
  completedJumps: number
  totalJumps: number
  phase: string
  route: PlannedRoute
}

interface GalaxyPanelProps {
  onSystemSelect?: (system: MapSystemData) => void
  plannedRoute?: PlannedRoute | null
  onPlannedRouteChange?: (route: PlannedRoute | null) => void
  autoTravelProgress?: AutoTravelProgress | null
}

export const GalaxyPanel = forwardRef<GalaxyPanelHandle, GalaxyPanelProps>(function GalaxyPanel({ onSystemSelect, plannedRoute, onPlannedRouteChange, autoTravelProgress }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipNameRef = useRef<HTMLDivElement>(null)
  const tooltipEmpireRef = useRef<HTMLDivElement>(null)
  const tooltipTagsRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef<HTMLDivElement>(null)

  // Mutable state refs (not React state -- canvas animation loop manages these)
  const stateRef = useRef({
    mapData: null as MapData | null,
    hoveredSystem: null as MapSystemData | null,
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
    isAnimating: false,
    viewWasSettled: true,
    stars: [] as Star[],
    lastTouchDistance: null as number | null,
    lastPinchCenter: null as { x: number; y: number } | null,
    touchStartTime: 0,
    initialTouchPos: null as { x: number; y: number } | null,
    // Waypoint drag state
    draggingWaypointIdx: -1,
    dragPreviewRoute: null as PlannedRoute | null,
    lastDragSystemId: '',
  })

  const plannedRouteRef = useRef<PlannedRoute | null>(null)
  // Only sync from prop when NOT dragging (drag manages its own preview)
  if (stateRef.current.draggingWaypointIdx < 0) {
    plannedRouteRef.current = plannedRoute ?? null
  }

  const onPlannedRouteChangeRef = useRef(onPlannedRouteChange)
  onPlannedRouteChangeRef.current = onPlannedRouteChange

  const onSystemSelectRef = useRef(onSystemSelect)
  onSystemSelectRef.current = onSystemSelect

  const autoTravelProgressRef = useRef<AutoTravelProgress | null>(null)
  autoTravelProgressRef.current = autoTravelProgress ?? null

  // ── Imperative API for sidebar ─────────────────────────────────────
  useImperativeHandle(ref, () => ({
    panToSystem: (systemId: string) => {
      const s = stateRef.current
      if (!s.mapData) return
      const system = s.mapData.systems.find((sys) => sys.id === systemId)
      if (!system) return
      s.targetViewX = -system.x
      s.targetViewY = -system.y
      s.targetZoom = 0.5
      s.isAnimating = true
    },
    getSystems: () => stateRef.current.mapData?.systems ?? [],
  }))

  // ── Helpers ────────────────────────────────────────────────────────

  // Convert viewport clientX/clientY to canvas-relative coordinates
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
    const cx = canvas.clientWidth / 2
    const cy = canvas.clientHeight / 2
    return {
      x: cx + (wx + s.viewX) * s.zoom,
      y: cy + (wy + s.viewY) * s.zoom,
    }
  }, [])

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const s = stateRef.current
    const cx = canvas.clientWidth / 2
    const cy = canvas.clientHeight / 2
    return {
      x: (sx - cx) / s.zoom - s.viewX,
      y: (sy - cy) / s.zoom - s.viewY,
    }
  }, [])

  const findSystemAt = useCallback(
    (sx: number, sy: number): MapSystemData | null => {
      const s = stateRef.current
      if (!s.mapData) return null

      const hitRadius = NODE_RADIUS * 2.5
      let closestSystem: MapSystemData | null = null
      let closestDist = Infinity

      for (const system of s.mapData.systems) {
        const pos = worldToScreen(system.x, system.y)
        const dx = pos.x - sx
        const dy = pos.y - sy
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < hitRadius && dist < closestDist) {
          closestSystem = system
          closestDist = dist
        }
      }
      return closestSystem
    },
    [worldToScreen],
  )

  // ── Star Generation ────────────────────────────────────────────────

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
          Math.random() > 0.92
            ? Math.random() > 0.5
              ? '#aaddff'
              : '#ffddaa'
            : '#ffffff',
      })
    }
    stateRef.current.stars = stars
  }, [])

  // ── Rendering ──────────────────────────────────────────────────────

  const drawStarfield = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const s = stateRef.current

      for (const star of s.stars) {
        const x = star.x * canvas.clientWidth
        const y = star.y * canvas.clientHeight
        const twinkle =
          0.5 +
          0.5 *
            Math.sin(
              s.animationTime * 0.001 * star.twinkleSpeed + star.twinkleOffset,
            )
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
    },
    [],
  )

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

  const drawPlannedRoute = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      // Use auto-travel route if active, otherwise planned route
      const atp = autoTravelProgressRef.current
      const route = atp ? atp.route : plannedRouteRef.current
      if (!route || !route.route || route.route.length < 2) return
      const s = stateRef.current
      if (!s.mapData) return

      const systemMap = new Map(s.mapData.systems.map((sys) => [sys.id, sys]))
      const completedJumps = atp ? atp.completedJumps : 0
      const isAutoTravel = !!atp && (atp.phase === 'jumping' || atp.phase === 'undocking')

      ctx.save()

      // Draw lines between consecutive waypoints
      for (let i = 0; i < route.route.length - 1; i++) {
        const fromSys = systemMap.get(route.route[i].system_id)
        const toSys = systemMap.get(route.route[i + 1].system_id)
        if (!fromSys || !toSys) continue

        const from = worldToScreen(fromSys.x, fromSys.y)
        const to = worldToScreen(toSys.x, toSys.y)
        const isCompleted = isAutoTravel && i < completedJumps

        ctx.setLineDash(isCompleted ? [] : [10, 6])
        ctx.lineWidth = isCompleted ? 2 : 3
        ctx.strokeStyle = isCompleted ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 212, 255, 0.8)'
        ctx.shadowColor = isCompleted ? 'transparent' : 'rgba(0, 212, 255, 0.6)'
        ctx.shadowBlur = isCompleted ? 0 : 8

        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.stroke()
      }

      // Draw numbered waypoint dots
      ctx.setLineDash([])
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'

      for (let i = 0; i < route.route.length; i++) {
        const sys = systemMap.get(route.route[i].system_id)
        if (!sys) continue

        const pos = worldToScreen(sys.x, sys.y)
        const isDestination = i === route.route.length - 1
        const isCompleted = isAutoTravel && i <= completedJumps
        const isCurrent = isAutoTravel && i === completedJumps

        // Current position during auto-travel: pulsing ship indicator
        if (isCurrent) {
          const pulse = 0.5 + 0.5 * Math.sin(s.animationTime * 0.004)
          const glowRadius = 16 + pulse * 4
          const gradient = ctx.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, glowRadius)
          gradient.addColorStop(0, 'rgba(0, 212, 255, 0.5)')
          gradient.addColorStop(1, 'rgba(0, 212, 255, 0)')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2)
          ctx.fill()
        }

        // Destination: pulsing green ring
        if (isDestination && !isCompleted) {
          const pulse = 0.5 + 0.5 * Math.sin(s.animationTime * 0.003)
          const glowRadius = 14 + pulse * 4
          const gradient = ctx.createRadialGradient(pos.x, pos.y, 6, pos.x, pos.y, glowRadius)
          gradient.addColorStop(0, 'rgba(0, 255, 136, 0.4)')
          gradient.addColorStop(1, 'rgba(0, 255, 136, 0)')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2)
          ctx.fill()

          ctx.strokeStyle = `rgba(0, 255, 136, ${0.6 + pulse * 0.3})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Filled circle
        let dotColor = 'rgba(0, 212, 255, 0.9)'
        let dotRadius = 8
        if (isDestination && !isCompleted) {
          dotColor = 'rgba(0, 255, 136, 0.95)'
          dotRadius = 10
        } else if (isCompleted && !isCurrent) {
          dotColor = 'rgba(0, 212, 255, 0.35)'
          dotRadius = 6
        } else if (isCurrent) {
          dotColor = 'rgba(0, 212, 255, 1)'
          dotRadius = 9
        }
        ctx.fillStyle = dotColor
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, dotRadius, 0, Math.PI * 2)
        ctx.fill()

        // Number text
        ctx.fillStyle = isCompleted && !isCurrent ? 'rgba(5, 8, 16, 0.5)' : '#050810'
        ctx.font = 'bold 10px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), pos.x, pos.y)
      }

      ctx.restore()
    },
    [worldToScreen],
  )

  const render = useCallback(
    (ctx?: CanvasRenderingContext2D | null) => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (!ctx) ctx = canvas.getContext('2d')
      if (!ctx) return
      const s = stateRef.current
      if (!s.mapData) return

      ctx.fillStyle = '#050810'
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)

      drawStarfield(ctx)
      drawGrid(ctx)

      // Draw connections
      const drawnConnections = new Set<string>()
      for (const system of s.mapData.systems) {
        const pos1 = worldToScreen(system.x, system.y)
        for (const connId of system.connections) {
          const connKey = [system.id, connId].sort().join('-')
          if (drawnConnections.has(connKey)) continue
          drawnConnections.add(connKey)

          const connSystem = s.mapData.systems.find(
            (sys) => sys.id === connId,
          )
          if (!connSystem) continue

          const pos2 = worldToScreen(connSystem.x, connSystem.y)
          ctx.strokeStyle = LINE_COLOR
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(pos1.x, pos1.y)
          ctx.lineTo(pos2.x, pos2.y)
          ctx.stroke()
        }
      }

      // Draw planned route overlay (between connections and nodes)
      drawPlannedRoute(ctx)

      // Scale nodes down when zoomed out past threshold
      const ZOOM_THRESHOLD = 0.06
      const nodeScale = s.zoom < ZOOM_THRESHOLD ? s.zoom / ZOOM_THRESHOLD : 1
      const nr = NODE_RADIUS * nodeScale // scaled node radius

      // Draw nodes
      for (const system of s.mapData.systems) {
        const pos = worldToScreen(system.x, system.y)
        const color = system.empire_color || DEFAULT_COLOR
        const isHovered =
          s.hoveredSystem && s.hoveredSystem.id === system.id
        const isHomeSystem = system.is_home === true
        const isStronghold = system.is_stronghold === true

        // Hover glow
        if (isHovered) {
          const gradient = ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            nr * 4,
          )
          gradient.addColorStop(0, color + 'bb')
          gradient.addColorStop(0.5, color + '40')
          gradient.addColorStop(1, color + '00')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, nr * 4, 0, Math.PI * 2)
          ctx.fill()

          ctx.strokeStyle = color + '80'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, nr * 2, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Pirate stronghold
        if (isStronghold) {
          const pulsePhase =
            ((s.animationTime * 0.0015 + system.x * 0.002) %
              (Math.PI * 2))
          const pulseAlpha = 0.2 + Math.sin(pulsePhase) * 0.1
          const glowRadius = nr * 4
          const gradient = ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            glowRadius,
          )
          gradient.addColorStop(
            0,
            `rgba(255, 68, 68, ${pulseAlpha})`,
          )
          gradient.addColorStop(1, 'rgba(255, 68, 68, 0)')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2)
          ctx.fill()

          // Crosshair lines
          const chSize = nr * 2.2
          ctx.strokeStyle = `rgba(255, 68, 68, ${0.4 + Math.sin(pulsePhase) * 0.15})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(pos.x - chSize, pos.y)
          ctx.lineTo(pos.x - nr * 1.2, pos.y)
          ctx.moveTo(pos.x + nr * 1.2, pos.y)
          ctx.lineTo(pos.x + chSize, pos.y)
          ctx.moveTo(pos.x, pos.y - chSize)
          ctx.lineTo(pos.x, pos.y - nr * 1.2)
          ctx.moveTo(pos.x, pos.y + nr * 1.2)
          ctx.lineTo(pos.x, pos.y + chSize)
          ctx.stroke()
        }

        // Node
        const hasStation = isHomeSystem || system.has_station
        const nodeRadius = isHomeSystem ? nr * 1.6 : hasStation ? nr : nr * 0.8
        const hoverScale = isHovered ? 1.5 : 1.0
        ctx.fillStyle =
          isStronghold && !system.empire ? '#f97316' : color
        ctx.beginPath()
        ctx.arc(
          pos.x,
          pos.y,
          nodeRadius * hoverScale,
          0,
          Math.PI * 2,
        )
        ctx.fill()

        // Home system outer rings (capitals — extra prominent)
        if (isHomeSystem) {
          ctx.strokeStyle = color
          ctx.lineWidth = 2.5 * nodeScale
          ctx.beginPath()
          ctx.arc(
            pos.x,
            pos.y,
            nodeRadius * hoverScale + 4 * nodeScale,
            0,
            Math.PI * 2,
          )
          ctx.stroke()

          ctx.strokeStyle = color + '80'
          ctx.lineWidth = 1.5 * nodeScale
          ctx.beginPath()
          ctx.arc(
            pos.x,
            pos.y,
            nodeRadius * hoverScale + 8 * nodeScale,
            0,
            Math.PI * 2,
          )
          ctx.stroke()

          ctx.strokeStyle = color + '40'
          ctx.lineWidth = 1 * nodeScale
          ctx.beginPath()
          ctx.arc(
            pos.x,
            pos.y,
            nodeRadius * hoverScale + 12 * nodeScale,
            0,
            Math.PI * 2,
          )
          ctx.stroke()
        } else if (system.has_station) {
          // Non-capital station: single ring indicator
          ctx.strokeStyle = color + 'aa'
          ctx.lineWidth = 1.5 * nodeScale
          ctx.beginPath()
          ctx.arc(
            pos.x,
            pos.y,
            nodeRadius * hoverScale + 3 * nodeScale,
            0,
            Math.PI * 2,
          )
          ctx.stroke()
        }

        // Center dot — bright white for stations/capitals, subtle highlight for others
        ctx.fillStyle = hasStation ? '#ffffff' : color + 'cc'
        ctx.beginPath()
        ctx.arc(
          pos.x,
          pos.y,
          nodeRadius * 0.35 * hoverScale,
          0,
          Math.PI * 2,
        )
        ctx.fill()

        // System name label — hide when tooltip is showing (system has extra info)
        const hasExtraInfo = !!(system.empire || system.is_home || system.has_station || system.is_stronghold)
        const tooltipShowing = isHovered && hasExtraInfo
        if ((s.zoom > 0.15 || isHovered) && !tooltipShowing) {
          ctx.font = isHovered
            ? 'bold 14px "Space Grotesk", sans-serif'
            : '13px "Space Grotesk", sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = isHovered
            ? '#ffffff'
            : 'rgba(168, 197, 214, 0.9)'
          const labelY = pos.y + nr + 8
          ctx.fillText(system.name, pos.x, labelY)
        }
      }

    },
    [drawStarfield, drawGrid, drawPlannedRoute, worldToScreen],
  )

  // ── Tooltip ────────────────────────────────────────────────────────

  const updateTooltip = useCallback(
    (system: MapSystemData | null, mx: number, my: number) => {
      const tooltip = tooltipRef.current
      if (!tooltip) return

      // Only show tooltip for systems with info beyond just the name
      const hasExtraInfo = system && !!(system.empire || system.is_home || system.has_station || system.is_stronghold)
      if (!system || !hasExtraInfo) {
        tooltip.className = styles.tooltip
        return
      }

      if (tooltipNameRef.current) {
        tooltipNameRef.current.textContent = system.name
        tooltipNameRef.current.style.color =
          system.is_stronghold && !system.empire
            ? '#f97316'
            : system.empire_color || '#e8f4f8'
      }

      if (tooltipEmpireRef.current) {
        if (system.empire) {
          tooltipEmpireRef.current.textContent =
            EMPIRE_NAMES[system.empire] || system.empire
          tooltipEmpireRef.current.style.display = 'block'
          tooltipEmpireRef.current.style.color = ''
        } else {
          tooltipEmpireRef.current.style.display = 'none'
        }
      }

      if (tooltipTagsRef.current) {
        const tags: string[] = []
        if (system.is_home) tags.push('Capital')
        if (system.has_station) tags.push('Station')
        if (system.is_stronghold) tags.push('Pirate Stronghold')
        if (tags.length > 0) {
          tooltipTagsRef.current.textContent = tags.join(' \u00B7 ')
          tooltipTagsRef.current.style.display = 'block'
        } else {
          tooltipTagsRef.current.style.display = 'none'
        }
      }

      tooltip.style.left = mx + 15 + 'px'
      tooltip.style.top = my + 15 + 'px'
      tooltip.className = `${styles.tooltip} ${styles.tooltipVisible}`
    },
    [],
  )

  // ── View Controls ──────────────────────────────────────────────────

  const resetView = useCallback(() => {
    const s = stateRef.current
    s.viewX = 0
    s.viewY = 0
    s.zoom = DEFAULT_ZOOM
    s.targetViewX = 0
    s.targetViewY = 0
    s.targetZoom = DEFAULT_ZOOM
    render()
  }, [render])

  const zoomIn = useCallback(() => {
    const s = stateRef.current
    s.targetZoom = Math.min(MAX_ZOOM, s.targetZoom * 1.5)
  }, [])

  const zoomOut = useCallback(() => {
    const s = stateRef.current
    s.targetZoom = Math.max(MIN_ZOOM, s.targetZoom / 1.5)
  }, [])

  // ── Main Effect ────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const s = stateRef.current

    // ── Resize ───────────────────────────────────────────────────
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

    // ── Stars ────────────────────────────────────────────────────
    generateStars()

    // ── Initial Resize ───────────────────────────────────────────
    resizeCanvas()


    // ── Animation Loop ───────────────────────────────────────────
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
        Math.abs(zoomDiff) <= 0.0001 &&
        Math.abs(viewXDiff) <= 0.1 &&
        Math.abs(viewYDiff) <= 0.1

      render(ctx)

      if (viewSettled && !s.viewWasSettled) {
        s.zoom = s.targetZoom
        s.viewX = s.targetViewX
        s.viewY = s.targetViewY
      }
      s.viewWasSettled = viewSettled

      // Always keep animating for star twinkling and pulsing effects
      animFrameId = requestAnimationFrame(animationLoop)
    }

    // Start animation immediately
    animFrameId = requestAnimationFrame(animationLoop)

    // ── Fetch Map Data ───────────────────────────────────────────
    // Static data (galaxy topology + stations) is fetched once on mount.

    async function fetchStaticData() {
      try {
        const [mapResponse, stationsResponse] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'}/api/map`),
          fetch(`${process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'}/api/stations`),
        ])
        const data: MapData = await mapResponse.json()

        // Mark systems that have stations
        try {
          const stationsData = await stationsResponse.json()
          const stationSystemIds = new Set(
            (stationsData.stations || []).map((st: { system_id: string }) => st.system_id),
          )
          for (const system of data.systems) {
            if (stationSystemIds.has(system.id)) {
              system.has_station = true
            }
          }
        } catch {
          // Stations data is optional -- map still works without it
        }

        s.mapData = data

        if (loadingRef.current)
          loadingRef.current.style.display = 'none'

        render(ctx)
      } catch (err) {
        console.error('Failed to fetch map data:', err)
        if (loadingRef.current)
          loadingRef.current.textContent = 'Failed to load galaxy data'
      }
    }

    fetchStaticData()

    // ── Waypoint hit detection ───────────────────────────────────
    function findWaypointAt(sx: number, sy: number): number {
      const route = plannedRouteRef.current
      if (!route || !route.route || !s.mapData) return -1
      const systemMap = new Map(s.mapData.systems.map((sys) => [sys.id, sys]))
      const hitRadius = 12
      for (let i = 0; i < route.route.length; i++) {
        const sys = systemMap.get(route.route[i].system_id)
        if (!sys) continue
        const pos = worldToScreen(sys.x, sys.y)
        const dx = pos.x - sx
        const dy = pos.y - sy
        if (Math.sqrt(dx * dx + dy * dy) < hitRadius) return i
      }
      return -1
    }

    // ── Mouse Events ─────────────────────────────────────────────
    function onMouseDown(e: MouseEvent) {
      const pos = canvasCoords(e.clientX, e.clientY)

      // Check for waypoint drag start
      const wpIdx = findWaypointAt(pos.x, pos.y)
      if (wpIdx >= 0) {
        s.draggingWaypointIdx = wpIdx
        s.lastDragSystemId = plannedRouteRef.current!.route[wpIdx].system_id
        s.dragPreviewRoute = null
        canvas!.style.cursor = 'grabbing'
        e.preventDefault()
        return
      }

      s.isDragging = true
      s.dragStart = { x: e.clientX, y: e.clientY }
      s.viewStart = { x: s.viewX, y: s.viewY }
    }

    function onMouseMove(e: MouseEvent) {
      // Waypoint dragging
      if (s.draggingWaypointIdx >= 0) {
        const pos = canvasCoords(e.clientX, e.clientY)
        const nearestSystem = findSystemAt(pos.x, pos.y)
        if (nearestSystem && nearestSystem.id !== s.lastDragSystemId && s.mapData) {
          s.lastDragSystemId = nearestSystem.id
          const route = plannedRouteRef.current
          if (!route) return

          const startId = route.route[0].system_id
          const isEndpoint = s.draggingWaypointIdx === route.route.length - 1
          const existingVia = route.viaWaypoints || []
          const endId = isEndpoint ? nearestSystem.id : route.route[route.route.length - 1].system_id

          let preview: PlannedRoute | null
          if (isEndpoint) {
            // Dragging destination — keep via waypoints, new destination
            preview = buildRouteViaWaypoints(s.mapData.systems, startId, nearestSystem.id, existingVia, route.fuelPerJump, route.fuelAvailable)
          } else {
            // Dragging intermediate — this system becomes the (only) via waypoint
            // If there were existing via waypoints, figure out which one is being moved
            // by checking which via waypoint's route segment contains the dragged index
            const newVia = [nearestSystem.id]
            preview = buildRouteViaWaypoints(s.mapData.systems, startId, endId, newVia, route.fuelPerJump, route.fuelAvailable)
          }

          if (preview) {
            s.dragPreviewRoute = preview
            plannedRouteRef.current = preview
          }
        }
        render(ctx)
        return
      }

      if (s.isDragging) {
        const dx = e.clientX - s.dragStart.x
        const dy = e.clientY - s.dragStart.y
        s.viewX = s.viewStart.x + dx / s.zoom
        s.viewY = s.viewStart.y + dy / s.zoom
        s.targetViewX = s.viewX
        s.targetViewY = s.viewY
        render(ctx)
      } else {
        const pos = canvasCoords(e.clientX, e.clientY)
        const system = findSystemAt(pos.x, pos.y)
        if (system !== s.hoveredSystem) {
          s.hoveredSystem = system
          render(ctx)
        }
        updateTooltip(system, pos.x, pos.y)

        // Show move cursor when hovering over a draggable waypoint
        const wpIdx = findWaypointAt(pos.x, pos.y)
        canvas!.style.cursor = wpIdx >= 0 ? 'move' : (system ? 'pointer' : 'grab')
      }
    }

    function onMouseUp(e: MouseEvent) {
      // Commit waypoint drag
      if (s.draggingWaypointIdx >= 0) {
        const preview = s.dragPreviewRoute
        s.draggingWaypointIdx = -1
        s.dragPreviewRoute = null
        s.lastDragSystemId = ''
        if (preview && onPlannedRouteChangeRef.current) {
          onPlannedRouteChangeRef.current(preview)
        }
        return
      }

      const dx = e.clientX - s.dragStart.x
      const dy = e.clientY - s.dragStart.y
      const wasDrag = Math.abs(dx) > 5 || Math.abs(dy) > 5

      if (!wasDrag && onSystemSelectRef.current) {
        const pos = canvasCoords(e.clientX, e.clientY)
        const system = findSystemAt(pos.x, pos.y)
        if (system) onSystemSelectRef.current(system)
      }

      s.isDragging = false
    }

    function onMouseLeave() {
      // Cancel waypoint drag on leave
      if (s.draggingWaypointIdx >= 0) {
        s.draggingWaypointIdx = -1
        s.dragPreviewRoute = null
        s.lastDragSystemId = ''
        plannedRouteRef.current = plannedRoute ?? null
        render(ctx)
      }
      s.isDragging = false
      s.hoveredSystem = null
      if (tooltipRef.current) {
        tooltipRef.current.className = styles.tooltip
      }
      render(ctx)
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const clampedDelta = Math.max(-100, Math.min(100, e.deltaY))
      const zoomFactor = Math.exp(-clampedDelta * ZOOM_SENSITIVITY)
      s.targetZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, s.targetZoom * zoomFactor),
      )

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

    // ── Touch Events ─────────────────────────────────────────────
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
        s.dragStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
        s.initialTouchPos = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
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
        render(ctx)
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

        const newZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, s.zoom * scale),
        )
        s.zoom = newZoom
        s.targetZoom = newZoom

        const newWorldX = (newCenter.x - cx) / s.zoom - s.viewX
        const newWorldY = (newCenter.y - cy) / s.zoom - s.viewY
        s.viewX += newWorldX - worldX
        s.viewY += newWorldY - worldY

        if (s.lastPinchCenter) {
          const panDx = newCenter.x - s.lastPinchCenter.x
          const panDy = newCenter.y - s.lastPinchCenter.y
          s.viewX += panDx / s.zoom
          s.viewY += panDy / s.zoom
        }

        s.targetViewX = s.viewX
        s.targetViewY = s.viewY
        s.lastTouchDistance = newDistance
        s.lastPinchCenter = newCenter
        render(ctx)
      }
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault()

      const touchDuration = Date.now() - s.touchStartTime
      const wasTap = touchDuration < 300

      if (
        wasTap &&
        e.changedTouches.length === 1 &&
        s.initialTouchPos
      ) {
        const touch = e.changedTouches[0]
        const dx = touch.clientX - s.initialTouchPos.x
        const dy = touch.clientY - s.initialTouchPos.y
        const wasMove = Math.abs(dx) > 10 || Math.abs(dy) > 10

        if (!wasMove && onSystemSelectRef.current) {
          const tpos = canvasCoords(touch.clientX, touch.clientY)
          const system = findSystemAt(tpos.x, tpos.y)
          if (system) onSystemSelectRef.current(system)
        }
      }

      if (e.touches.length === 0) {
        s.isDragging = false
        s.lastTouchDistance = null
        s.lastPinchCenter = null
        s.initialTouchPos = null
      } else if (e.touches.length === 1) {
        s.isDragging = true
        s.dragStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
        s.viewStart = { x: s.viewX, y: s.viewY }
        s.lastTouchDistance = null
        s.lastPinchCenter = null
      }
    }

    // ── Register Listeners ───────────────────────────────────────
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, {
      passive: false,
    })
    canvas.addEventListener('touchmove', onTouchMove, {
      passive: false,
    })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })

    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => resizeCanvas())
      resizeObserver.observe(containerRef.current)
    }

    // ── Cleanup ──────────────────────────────────────────────────
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
  }, [render, generateStars, canvasCoords, findSystemAt, updateTooltip, worldToScreen])

  // ── JSX ────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={styles.mapContainer}>
      {/* Canvas */}
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* Tooltip */}
      <div ref={tooltipRef} className={styles.tooltip}>
        <div ref={tooltipNameRef} className={styles.tooltipName} />
        <div ref={tooltipEmpireRef} className={styles.tooltipEmpire} />
        <div ref={tooltipTagsRef} className={styles.tooltipTags} />
      </div>

      {/* Zoom Controls */}
      <div className={styles.zoomControls}>
        <button
          className={styles.zoomBtn}
          onClick={resetView}
          aria-label="Reset view"
          title="Reset View"
        >
          {'\u2302'}
        </button>
        <button
          className={styles.zoomBtn}
          onClick={zoomIn}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          className={styles.zoomBtn}
          onClick={zoomOut}
          aria-label="Zoom out"
        >
          {'\u2212'}
        </button>
      </div>

      {/* Loading */}
      <div ref={loadingRef} className={styles.loading}>
        Loading Galaxy
      </div>

    </div>
  )
})
