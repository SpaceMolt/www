'use client'

import { useEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserCircle, Search, Skull, Swords, Crosshair, Rocket, Coins, Flag, Hammer,
  Sparkles, Satellite, Compass,
} from 'lucide-react'
import styles from './GalaxyMap.module.css'

// ── Types ──────────────────────────────────────────────────────────────

interface SystemData {
  id: string
  name: string
  x: number
  y: number
  empire?: string
  empire_color?: string
  is_home?: boolean
  is_stronghold?: boolean
  has_station?: boolean
  online: number
  connections: string[]
}

interface MapData {
  systems: SystemData[]
}

interface POIData {
  id: string
  name: string
  type: string
  has_base: boolean
  online: number
  players?: PlayerData[]
  base_id?: string
  station_name?: string
  station_empire?: string
  station_condition?: string
  station_services?: string[]
}

interface PlayerData {
  username: string
  clan_tag?: string
  status?: string
  primary_color?: string
  secondary_color?: string
}

interface SystemDetailData {
  description?: string
  security_status?: string
  is_stronghold?: boolean
  pois: POIData[]
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

interface ActivityEvent {
  type: string
  data?: Record<string, string | boolean | number>
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
const URL_UPDATE_DELAY = 300
const DEFAULT_ZOOM = 0.08

const TRAVEL_PATH_COLORS = [
  '#ff6b6b', // red
  '#4ecdc4', // teal
  '#ffe66d', // yellow
  '#a855f7', // purple
  '#fb923c', // orange
  '#38bdf8', // sky blue
  '#f472b6', // pink
  '#22d3ee', // cyan
]

const EMPIRE_NAMES: Record<string, string> = {
  solarian: 'Solarian Confederacy',
  voidborn: 'Voidborn Collective',
  crimson: 'Crimson Pact',
  nebula: 'Nebula Trade Federation',
  outerrim: 'Outer Rim Explorers',
}

const POI_TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  planet: { icon: 'P', color: '#4A90D9' },
  moon: { icon: 'M', color: '#8B8B8B' },
  sun: { icon: 'S', color: '#FFD700' },
  asteroid_belt: { icon: 'A', color: '#8B4513' },
  asteroid: { icon: 'a', color: '#A0522D' },
  nebula: { icon: 'N', color: '#9B59B6' },
  gas_cloud: { icon: 'G', color: '#1ABC9C' },
  relic: { icon: 'R', color: '#F39C12' },
  station: { icon: 'B', color: '#00FFFF' },
  jump_gate: { icon: 'J', color: '#E74C3C' },
}

const TOAST_SZ = 16

const ICON_MAP: Record<string, ReactNode> = {
  player_joined: <UserCircle size={TOAST_SZ} />,
  system_discovered: <Search size={TOAST_SZ} />,
  player_destroyed: <Skull size={TOAST_SZ} />,
  combat: <Swords size={TOAST_SZ} />,
  weapon_fired: <Crosshair size={TOAST_SZ} />,
  travel: <Rocket size={TOAST_SZ} />,
  trade: <Coins size={TOAST_SZ} />,
  faction_created: <Flag size={TOAST_SZ} />,
  craft: <Hammer size={TOAST_SZ} />,
  jump: <Sparkles size={TOAST_SZ} />,
}

// ── Helper: clear all children from an element (safe alternative to innerHTML = '') ──

function clearChildren(el: HTMLElement) {
  while (el.firstChild) {
    el.removeChild(el.firstChild)
  }
}

// ── Component ──────────────────────────────────────────────────────────

interface GalaxyMapProps {
  fullPage?: boolean
}

export function GalaxyMap({ fullPage = false }: GalaxyMapProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipNameRef = useRef<HTMLDivElement>(null)
  const tooltipEmpireRef = useRef<HTMLDivElement>(null)
  const tooltipOnlineRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef<HTMLDivElement>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  const [toastData, setToastData] = useState<{ icon: ReactNode; text: string; time: string } | null>(null)
  const poiPanelRef = useRef<HTMLDivElement>(null)
  const poiPanelTitleRef = useRef<HTMLDivElement>(null)
  const poiPanelEmpireRef = useRef<HTMLDivElement>(null)
  const poiPanelDescRef = useRef<HTMLDivElement>(null)
  const poiPanelTagsRef = useRef<HTMLDivElement>(null)
  const poiPanelContentRef = useRef<HTMLDivElement>(null)
  const statSystemsRef = useRef<HTMLSpanElement>(null)
  const statOnlineRef = useRef<HTMLSpanElement>(null)
  const controlHintRef = useRef<HTMLDivElement>(null)
  const scrollHintRef = useRef<HTMLDivElement>(null)
  const scrollHintTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const travelTrackerRef = useRef<HTMLDivElement>(null)

  // Mutable state refs (not React state -- canvas animation loop manages these)
  const stateRef = useRef({
    mapData: null as MapData | null,
    hoveredSystem: null as SystemData | null,
    selectedSystem: null as SystemData | null,
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
    urlUpdateTimeout: null as ReturnType<typeof setTimeout> | null,
    activityToastTimeout: null as ReturnType<typeof setTimeout> | null,
    stars: [] as Star[],
    expandedPOIs: new Set<string>(),
    currentPOIData: [] as POIData[],
    lastTouchDistance: null as number | null,
    lastPinchCenter: null as { x: number; y: number } | null,
    touchStartTime: 0,
    initialTouchPos: null as { x: number; y: number } | null,
    travelHistory: new Map<string, string[]>(),
    selectedTravelPlayers: new Set<string>(),
    travelPings: [] as { wx: number; wy: number; startTime: number; color: string }[],
    pendingSystemId: null as string | null,
  })

  // ── Travel Tracker State ──────────────────────────────────────────
  const [travelDropdownOpen, setTravelDropdownOpen] = useState(false)
  const [travelFilter, setTravelFilter] = useState('')
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
  const [travelPlayerList, setTravelPlayerList] = useState<string[]>([])

  // ── Helpers ────────────────────────────────────────────────────────

  const worldToScreen = useCallback((wx: number, wy: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const s = stateRef.current
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    return {
      x: cx + (wx + s.viewX) * s.zoom,
      y: cy + (wy + s.viewY) * s.zoom,
    }
  }, [])

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const s = stateRef.current
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    return {
      x: (sx - cx) / s.zoom - s.viewX,
      y: (sy - cy) / s.zoom - s.viewY,
    }
  }, [])

  const findSystemAt = useCallback(
    (sx: number, sy: number): SystemData | null => {
      const s = stateRef.current
      if (!s.mapData) return null

      const hitRadius = NODE_RADIUS * 2.5
      let closestSystem: SystemData | null = null
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

  // ── URL State ──────────────────────────────────────────────────────

  const parseUrlState = useCallback(() => {
    if (!fullPage) return
    const params = new URLSearchParams(window.location.search)
    const x = parseFloat(params.get('x') || '')
    const y = parseFloat(params.get('y') || '')
    const z = parseFloat(params.get('z') || '')
    const s = stateRef.current

    if (!isNaN(x) && !isNaN(y)) {
      s.viewX = x
      s.viewY = y
      s.targetViewX = x
      s.targetViewY = y
    }
    if (!isNaN(z) && z >= MIN_ZOOM && z <= MAX_ZOOM) {
      s.zoom = z
      s.targetZoom = z
    }

    // If a system ID is in the URL, open it once data loads
    const systemParam = params.get('system')
    if (systemParam) {
      s.pendingSystemId = systemParam
    }
  }, [fullPage])

  const updateUrlState = useCallback(() => {
    if (!fullPage) return
    const s = stateRef.current
    if (s.urlUpdateTimeout) clearTimeout(s.urlUpdateTimeout)
    s.urlUpdateTimeout = setTimeout(() => {
      const params = new URLSearchParams()
      params.set('x', s.viewX.toFixed(1))
      params.set('y', s.viewY.toFixed(1))
      params.set('z', s.zoom.toFixed(4))
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState({}, '', newUrl)
    }, URL_UPDATE_DELAY)
  }, [fullPage])

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
        const x = star.x * canvas.width
        const y = star.y * canvas.height
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
      const endWorld = screenToWorld(canvas.width, canvas.height)
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
          ctx.lineTo(screen.x, canvas.height)
          ctx.stroke()
        }

        for (let wy = startY; wy <= endWorld.y; wy += level.size) {
          const screen = worldToScreen(0, wy)
          ctx.beginPath()
          ctx.moveTo(0, screen.y)
          ctx.lineTo(canvas.width, screen.y)
          ctx.stroke()
        }
      }
    },
    [screenToWorld, worldToScreen],
  )

  const drawTravelPaths = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const s = stateRef.current
      if (!s.mapData || s.selectedTravelPlayers.size === 0) return

      // Build name→system lookup
      const systemByName = new Map<string, SystemData>()
      for (const sys of s.mapData.systems) {
        systemByName.set(sys.name, sys)
      }

      let colorIndex = 0
      for (const playerName of s.selectedTravelPlayers) {
        const history = s.travelHistory.get(playerName)
        if (!history || history.length < 2) {
          colorIndex++
          continue
        }

        const color = TRAVEL_PATH_COLORS[colorIndex % TRAVEL_PATH_COLORS.length]
        colorIndex++

        // Resolve screen positions
        const points: { x: number; y: number }[] = []
        for (const sysName of history) {
          const sys = systemByName.get(sysName)
          if (sys) {
            points.push(worldToScreen(sys.x, sys.y))
          }
        }

        if (points.length < 2) continue

        ctx.save()

        // Draw dashed path with glow
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5
        ctx.shadowColor = color
        ctx.shadowBlur = 8
        ctx.setLineDash([8, 6])
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.stroke()

        // Draw arrowhead on the last segment
        if (points.length >= 2) {
          const from = points[points.length - 2]
          const to = points[points.length - 1]
          const angle = Math.atan2(to.y - from.y, to.x - from.x)
          const arrowLen = 12
          ctx.setLineDash([])
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.moveTo(to.x, to.y)
          ctx.lineTo(
            to.x - arrowLen * Math.cos(angle - Math.PI / 6),
            to.y - arrowLen * Math.sin(angle - Math.PI / 6),
          )
          ctx.lineTo(
            to.x - arrowLen * Math.cos(angle + Math.PI / 6),
            to.y - arrowLen * Math.sin(angle + Math.PI / 6),
          )
          ctx.closePath()
          ctx.fill()
        }

        // Draw numbered waypoint dots
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        for (let i = 0; i < points.length; i++) {
          const p = points[i]
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = '#050810'
          ctx.font = 'bold 10px "JetBrains Mono", monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(i + 1), p.x, p.y)
        }

        ctx.restore()
      }
    },
    [worldToScreen],
  )

  const PING_DURATION = 2000 // ms
  const PING_MAX_RADIUS = 80

  const drawTravelPings = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const s = stateRef.current
      if (s.travelPings.length === 0) return

      // Remove expired pings
      s.travelPings = s.travelPings.filter(
        (p) => s.animationTime - p.startTime < PING_DURATION,
      )

      ctx.save()
      for (const ping of s.travelPings) {
        const elapsed = s.animationTime - ping.startTime
        const t = elapsed / PING_DURATION // 0→1

        const pos = worldToScreen(ping.wx, ping.wy)

        // Draw 3 expanding rings staggered in time
        for (let ring = 0; ring < 3; ring++) {
          const ringT = Math.max(0, t - ring * 0.15)
          if (ringT <= 0 || ringT >= 1) continue

          const ease = 1 - Math.pow(1 - ringT, 3) // ease-out cubic
          const radius = ease * PING_MAX_RADIUS
          const alpha = (1 - ringT) * 0.7

          ctx.beginPath()
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
          ctx.strokeStyle = ping.color
          ctx.lineWidth = 3 - ringT * 2
          ctx.globalAlpha = alpha
          ctx.shadowColor = ping.color
          ctx.shadowBlur = 15
          ctx.stroke()
        }

        // Draw a bright center flash that fades
        if (t < 0.5) {
          const flashAlpha = 1 - t * 2
          ctx.globalAlpha = flashAlpha * 0.6
          ctx.fillStyle = ping.color
          ctx.shadowColor = ping.color
          ctx.shadowBlur = 30
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, 6 + (1 - flashAlpha) * 10, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
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
      ctx.fillRect(0, 0, canvas.width, canvas.height)

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

      // Draw travel paths (above connections, below nodes)
      drawTravelPaths(ctx)

      // Draw nodes
      for (const system of s.mapData.systems) {
        const pos = worldToScreen(system.x, system.y)
        const color = system.empire_color || DEFAULT_COLOR
        const isHovered =
          s.hoveredSystem && s.hoveredSystem.id === system.id
        const isSelected =
          s.selectedSystem && s.selectedSystem.id === system.id
        const hasPlayers = system.online > 0
        const isHomeSystem = system.is_home === true
        const isStronghold = system.is_stronghold === true

        // Pulsing glow for systems with online players
        if (hasPlayers) {
          const pulsePhase =
            ((s.animationTime * 0.002 + system.x * 0.001) %
              (Math.PI * 2))
          const pulseScale = 1 + Math.sin(pulsePhase) * 0.3
          const pulseAlpha = 0.3 + Math.sin(pulsePhase) * 0.15

          const glowRadius = NODE_RADIUS * 3 * pulseScale
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
            `rgba(45, 212, 191, ${pulseAlpha})`,
          )
          gradient.addColorStop(1, 'rgba(45, 212, 191, 0)')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2)
          ctx.fill()
        }

        // Selected system highlight
        if (isSelected) {
          const selectPhase =
            (s.animationTime * 0.003) % (Math.PI * 2)
          const selectAlpha = 0.6 + Math.sin(selectPhase) * 0.2

          ctx.strokeStyle = `rgba(255, 255, 255, ${selectAlpha})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, NODE_RADIUS * 2.5, 0, Math.PI * 2)
          ctx.stroke()

          const gradient = ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            NODE_RADIUS * 3,
          )
          gradient.addColorStop(0, color + '40')
          gradient.addColorStop(1, color + '00')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, NODE_RADIUS * 3, 0, Math.PI * 2)
          ctx.fill()
        }

        // Hover glow
        if (isHovered) {
          const gradient = ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            NODE_RADIUS * 4,
          )
          gradient.addColorStop(0, color + 'bb')
          gradient.addColorStop(0.5, color + '40')
          gradient.addColorStop(1, color + '00')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, NODE_RADIUS * 4, 0, Math.PI * 2)
          ctx.fill()

          ctx.strokeStyle = color + '80'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, NODE_RADIUS * 2, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Pirate stronghold
        if (isStronghold) {
          const pulsePhase =
            ((s.animationTime * 0.0015 + system.x * 0.002) %
              (Math.PI * 2))
          const pulseAlpha = 0.2 + Math.sin(pulsePhase) * 0.1
          const glowRadius = NODE_RADIUS * 4
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
          const chSize = NODE_RADIUS * 2.2
          ctx.strokeStyle = `rgba(255, 68, 68, ${0.4 + Math.sin(pulsePhase) * 0.15})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(pos.x - chSize, pos.y)
          ctx.lineTo(pos.x - NODE_RADIUS * 1.2, pos.y)
          ctx.moveTo(pos.x + NODE_RADIUS * 1.2, pos.y)
          ctx.lineTo(pos.x + chSize, pos.y)
          ctx.moveTo(pos.x, pos.y - chSize)
          ctx.lineTo(pos.x, pos.y - NODE_RADIUS * 1.2)
          ctx.moveTo(pos.x, pos.y + NODE_RADIUS * 1.2)
          ctx.lineTo(pos.x, pos.y + chSize)
          ctx.stroke()
        }

        // Node
        const nodeRadius = isHomeSystem ? NODE_RADIUS * 1.6 : NODE_RADIUS
        const hoverScale = isHovered ? 1.5 : 1.0
        ctx.fillStyle =
          isStronghold && !system.empire ? '#ff4444' : color
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
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(
            pos.x,
            pos.y,
            nodeRadius * hoverScale + 4,
            0,
            Math.PI * 2,
          )
          ctx.stroke()

          ctx.strokeStyle = color + '80'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(
            pos.x,
            pos.y,
            nodeRadius * hoverScale + 8,
            0,
            Math.PI * 2,
          )
          ctx.stroke()

          ctx.strokeStyle = color + '40'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(
            pos.x,
            pos.y,
            nodeRadius * hoverScale + 12,
            0,
            Math.PI * 2,
          )
          ctx.stroke()
        } else if (system.has_station) {
          // Non-capital station: single ring indicator
          ctx.strokeStyle = color + 'aa'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(
            pos.x,
            pos.y,
            nodeRadius * hoverScale + 3,
            0,
            Math.PI * 2,
          )
          ctx.stroke()
        }

        // Bright center
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(
          pos.x,
          pos.y,
          nodeRadius * 0.35 * hoverScale,
          0,
          Math.PI * 2,
        )
        ctx.fill()

        // Player count badge
        if (hasPlayers) {
          const countText = system.online.toString()
          ctx.font = 'bold 11px "JetBrains Mono", monospace'
          const textWidth = ctx.measureText(countText).width
          const badgeWidth = Math.max(textWidth + 8, 18)
          const badgeHeight = 14
          const badgeX = pos.x
          const badgeY = pos.y + NODE_RADIUS + 10

          ctx.fillStyle = 'rgba(45, 212, 191, 0.9)'
          ctx.beginPath()
          ctx.roundRect(
            badgeX - badgeWidth / 2,
            badgeY - badgeHeight / 2,
            badgeWidth,
            badgeHeight,
            3,
          )
          ctx.fill()

          ctx.fillStyle = '#050810'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(countText, badgeX, badgeY)
        }

        // System name label
        if (s.zoom > 0.15 || isHovered) {
          ctx.font = isHovered
            ? 'bold 14px "Space Grotesk", sans-serif'
            : '13px "Space Grotesk", sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = isHovered
            ? '#ffffff'
            : 'rgba(168, 197, 214, 0.9)'
          const labelY = hasPlayers
            ? pos.y + NODE_RADIUS + 22
            : pos.y + NODE_RADIUS + 8
          ctx.fillText(system.name, pos.x, labelY)
        }
      }

      // Draw travel pings (on top of everything)
      drawTravelPings(ctx)
    },
    [drawStarfield, drawGrid, drawTravelPaths, drawTravelPings, worldToScreen],
  )

  // ── Tooltip ────────────────────────────────────────────────────────

  const updateTooltip = useCallback(
    (system: SystemData | null, mx: number, my: number) => {
      const tooltip = tooltipRef.current
      if (!tooltip) return

      if (!system) {
        tooltip.className = styles.tooltip
        return
      }

      if (tooltipNameRef.current) {
        tooltipNameRef.current.textContent = system.name
        tooltipNameRef.current.style.color =
          system.is_stronghold && !system.empire
            ? '#ff4444'
            : system.empire_color || '#e8f4f8'
      }

      if (tooltipEmpireRef.current) {
        if (system.is_stronghold) {
          tooltipEmpireRef.current.textContent = system.empire
            ? (EMPIRE_NAMES[system.empire] || system.empire) +
              ' \u00B7 Pirate Stronghold'
            : 'Pirate Stronghold'
          tooltipEmpireRef.current.style.display = 'block'
          tooltipEmpireRef.current.style.color = '#ff6b6b'
        } else if (system.empire) {
          tooltipEmpireRef.current.textContent =
            EMPIRE_NAMES[system.empire] || system.empire
          tooltipEmpireRef.current.style.display = 'block'
          tooltipEmpireRef.current.style.color = ''
        } else {
          tooltipEmpireRef.current.style.display = 'none'
          tooltipEmpireRef.current.style.color = ''
        }
      }

      if (tooltipOnlineRef.current) {
        if (system.online > 0) {
          tooltipOnlineRef.current.textContent = `${system.online} player${system.online > 1 ? 's' : ''} online`
          tooltipOnlineRef.current.className = `${styles.tooltipOnline} ${styles.tooltipOnlineActive}`
        } else {
          tooltipOnlineRef.current.textContent = 'No players online'
          tooltipOnlineRef.current.className = styles.tooltipOnline
        }
      }

      tooltip.style.left = mx + 15 + 'px'
      tooltip.style.top = my + 15 + 'px'
      tooltip.className = `${styles.tooltip} ${styles.tooltipVisible}`
    },
    [],
  )

  // ── POI Panel ──────────────────────────────────────────────────────

  const closePOIPanel = useCallback(() => {
    const panel = poiPanelRef.current
    if (panel) {
      panel.className = styles.poiPanel
    }
    stateRef.current.selectedSystem = null
  }, [])

  const renderEmptyState = useCallback(
    (icon: string, message: string, hint: string | null) => {
      const content = poiPanelContentRef.current
      if (!content) return
      clearChildren(content)

      const container = document.createElement('div')
      container.className = styles.poiPanelEmpty

      const iconEl = document.createElement('div')
      iconEl.className = styles.poiPanelEmptyIcon
      iconEl.textContent = icon
      container.appendChild(iconEl)

      const msgEl = document.createElement('div')
      msgEl.textContent = message
      container.appendChild(msgEl)

      if (hint) {
        const hintEl = document.createElement('div')
        hintEl.className = styles.poiPanelEmptyHint
        hintEl.textContent = hint
        container.appendChild(hintEl)
      }

      content.appendChild(container)
    },
    [],
  )

  const createPlayerItem = useCallback((player: PlayerData) => {
    const playerEl = document.createElement('div')
    playerEl.className = styles.poiPlayer

    const avatar = document.createElement('div')
    avatar.className = styles.playerAvatar
    const primaryColor = player.primary_color || '#4A90D9'
    const secondaryColor = player.secondary_color || '#2a5a8a'
    avatar.style.setProperty('--p-primary', primaryColor)
    avatar.style.setProperty('--p-secondary', secondaryColor)

    const initials = document.createElement('span')
    initials.className = styles.playerAvatarInitials
    initials.textContent = player.username.substring(0, 2).toUpperCase()
    avatar.appendChild(initials)
    playerEl.appendChild(avatar)

    const info = document.createElement('div')
    info.className = styles.playerInfo

    const nameRow = document.createElement('div')
    nameRow.className = styles.playerNameRow

    if (player.clan_tag) {
      const tag = document.createElement('span')
      tag.className = styles.playerClanTag
      tag.textContent = '[' + player.clan_tag + ']'
      nameRow.appendChild(tag)
    }

    const username = document.createElement('span')
    username.className = styles.playerUsername
    username.textContent = player.username
    nameRow.appendChild(username)

    info.appendChild(nameRow)

    if (player.status) {
      const status = document.createElement('div')
      status.className = styles.playerStatus
      status.textContent = player.status
      info.appendChild(status)
    }

    playerEl.appendChild(info)
    return playerEl
  }, [])

  const createPOIItem = useCallback(
    (poi: POIData, renderPOIsFn: (pois: POIData[]) => void) => {
      const s = stateRef.current
      const typeInfo = POI_TYPE_ICONS[poi.type] || {
        icon: '?',
        color: '#5a6a7a',
      }
      const isExpanded = s.expandedPOIs.has(poi.id)
      const hasPlayers = poi.players && poi.players.length > 0

      const item = document.createElement('div')
      item.className = `${styles.poiItem}${isExpanded ? ` ${styles.poiItemExpanded}` : ''}`
      item.onclick = () => {
        if (s.expandedPOIs.has(poi.id)) {
          s.expandedPOIs.delete(poi.id)
        } else {
          s.expandedPOIs.add(poi.id)
        }
        if (s.currentPOIData.length > 0) {
          renderPOIsFn(s.currentPOIData)
        }
      }

      // Icon
      const icon = document.createElement('div')
      icon.className = styles.poiIcon
      icon.style.background = typeInfo.color + '15'
      icon.style.color = typeInfo.color
      icon.textContent = typeInfo.icon
      item.appendChild(icon)

      // Info container
      const info = document.createElement('div')
      info.className = styles.poiInfo

      const name = document.createElement('div')
      name.className = styles.poiName
      name.textContent = poi.name
      info.appendChild(name)

      const meta = document.createElement('div')
      meta.className = styles.poiMeta

      const typeSpan = document.createElement('span')
      typeSpan.className = styles.poiType
      typeSpan.textContent = poi.type.replace(/_/g, ' ')
      meta.appendChild(typeSpan)

      if (poi.has_base) {
        const baseBadge = document.createElement('span')
        baseBadge.className = styles.poiBaseBadge
        baseBadge.textContent = 'Base'
        meta.appendChild(baseBadge)
      }

      if (poi.station_condition) {
        const condBadge = document.createElement('span')
        condBadge.className = styles.poiStationCondition
        const condColors: Record<string, string> = {
          thriving: 'var(--bio-green)',
          operational: 'var(--laser-blue)',
          struggling: 'var(--warning-yellow)',
          critical: 'var(--claw-red)',
        }
        condBadge.style.color = condColors[poi.station_condition] || 'var(--chrome-silver)'
        condBadge.textContent = poi.station_condition
        meta.appendChild(condBadge)
      }

      info.appendChild(meta)

      // Station detail link
      if (poi.has_base && poi.base_id && isExpanded) {
        const stationLink = document.createElement('a')
        stationLink.className = styles.poiStationLink
        stationLink.href = `/stations/${poi.base_id}`
        stationLink.textContent = 'View Station Details \u2192'
        stationLink.onclick = (e) => e.stopPropagation()
        info.appendChild(stationLink)
      }

      // Player list (if expanded)
      if (isExpanded && hasPlayers && poi.players) {
        const playersList = document.createElement('div')
        playersList.className = styles.poiPlayersList

        poi.players.forEach((player) => {
          playersList.appendChild(createPlayerItem(player))
        })

        info.appendChild(playersList)
      }

      item.appendChild(info)

      // Online badge
      const badge = document.createElement('div')
      badge.className = `${styles.poiOnlineBadge}${poi.online === 0 ? ` ${styles.poiOnlineBadgeEmpty}` : ''}`
      badge.textContent = poi.online > 0 ? String(poi.online) : '\u2014'
      item.appendChild(badge)

      return item
    },
    [createPlayerItem],
  )

  // Use a ref to hold renderPOIs to break the circular dependency
  const renderPOIsRef = useRef<(pois: POIData[]) => void>(() => {})

  const renderPOIs = useCallback(
    (pois: POIData[]) => {
      const content = poiPanelContentRef.current
      if (!content) return
      const s = stateRef.current
      s.currentPOIData = pois
      clearChildren(content)

      if (pois.length === 0) {
        renderEmptyState('\u25CB', 'No points of interest', null)
        return
      }

      const totalOnline = pois.reduce((sum, p) => sum + p.online, 0)
      const totalVisiblePlayers = pois.reduce(
        (sum, p) => sum + (p.players?.length || 0),
        0,
      )

      // System player summary
      const summary = document.createElement('div')
      summary.className = `${styles.systemPlayersSummary}${totalOnline === 0 ? ` ${styles.systemPlayersSummaryEmpty}` : ''}`

      const summaryIcon = document.createElement('div')
      summaryIcon.className = styles.systemPlayersSummaryIcon
      summary.appendChild(summaryIcon)

      const summaryText = document.createElement('span')
      summaryText.className = styles.systemPlayersSummaryText
      if (totalOnline > 0) {
        const visibleNote =
          totalVisiblePlayers < totalOnline
            ? ` (${totalOnline - totalVisiblePlayers} anonymous)`
            : ''
        summaryText.textContent = `${totalOnline} player${totalOnline !== 1 ? 's' : ''} in system${visibleNote}`
      } else {
        summaryText.textContent = 'No players in system'
      }
      summary.appendChild(summaryText)
      content.appendChild(summary)

      // Sort: players first, then bases, then by name
      pois.sort((a, b) => {
        if (a.online !== b.online) return b.online - a.online
        if (a.has_base !== b.has_base) return a.has_base ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      const activePOIs = pois.filter((p) => p.online > 0)
      const inactivePOIs = pois.filter((p) => p.online === 0)

      const createSection = (title: string, sectionPois: POIData[]) => {
        const section = document.createElement('div')
        section.className = styles.poiSection

        const header = document.createElement('div')
        header.className = styles.poiSectionHeader
        header.textContent = title
        section.appendChild(header)

        sectionPois.forEach((poi) => {
          section.appendChild(createPOIItem(poi, renderPOIsRef.current))
        })

        return section
      }

      if (activePOIs.length > 0) {
        content.appendChild(
          createSection('\u25CF Active Locations', activePOIs),
        )
      }

      if (inactivePOIs.length > 0) {
        content.appendChild(
          createSection('\u25CB Other Locations', inactivePOIs),
        )
      }
    },
    [renderEmptyState, createPOIItem],
  )

  // Keep the ref up to date
  renderPOIsRef.current = renderPOIs

  const showPOIPanel = useCallback(
    async (system: SystemData) => {
      const s = stateRef.current
      s.selectedSystem = system

      if (poiPanelTitleRef.current) {
        poiPanelTitleRef.current.textContent = system.name
        poiPanelTitleRef.current.style.color =
          system.is_stronghold && !system.empire
            ? '#ff4444'
            : system.empire_color || '#e8f4f8'
      }

      if (poiPanelEmpireRef.current) {
        if (system.empire) {
          poiPanelEmpireRef.current.textContent =
            EMPIRE_NAMES[system.empire] || system.empire
          poiPanelEmpireRef.current.style.display = 'block'
        } else {
          poiPanelEmpireRef.current.style.display = 'none'
        }
      }

      if (poiPanelDescRef.current) {
        poiPanelDescRef.current.style.display = 'none'
        poiPanelDescRef.current.textContent = ''
      }

      if (poiPanelTagsRef.current) {
        clearChildren(poiPanelTagsRef.current)
        poiPanelTagsRef.current.style.display = 'none'
      }

      renderEmptyState('\u25CE', 'Loading system data...', null)
      if (poiPanelRef.current) {
        poiPanelRef.current.className = `${styles.poiPanel} ${styles.poiPanelVisible}`
      }

      try {
        const response = await fetch(
          `https://game.spacemolt.com/api/map/system/${system.id}`,
        )
        if (!response.ok) throw new Error('Failed to fetch')
        const data: SystemDetailData = await response.json()

        if (data.description && poiPanelDescRef.current) {
          poiPanelDescRef.current.textContent = data.description
          poiPanelDescRef.current.style.display = 'block'
        }

        if (poiPanelTagsRef.current) {
          clearChildren(poiPanelTagsRef.current)

          if (data.security_status) {
            const secTag = document.createElement('span')
            const secLower = data.security_status.toLowerCase()
            let tagClass = `${styles.poiPanelTag} ${styles.poiPanelTagSecurity}`
            if (secLower === 'lawless')
              tagClass = `${styles.poiPanelTag} ${styles.poiPanelTagSecurityLawless}`
            else if (secLower === 'frontier')
              tagClass = `${styles.poiPanelTag} ${styles.poiPanelTagSecurityFrontier}`
            secTag.className = tagClass
            secTag.textContent = data.security_status
            poiPanelTagsRef.current.appendChild(secTag)
          }

          if (data.is_stronghold) {
            const shTag = document.createElement('span')
            shTag.className = `${styles.poiPanelTag} ${styles.poiPanelTagStronghold}`
            shTag.textContent = 'Pirate Stronghold'
            poiPanelTagsRef.current.appendChild(shTag)
          }

          // Station link tag
          const stationPOI = (data.pois || []).find(
            (p: POIData) => p.has_base && p.base_id,
          )
          if (stationPOI) {
            const stationTag = document.createElement('a')
            stationTag.className = `${styles.poiPanelTag} ${styles.poiPanelTagStation}`
            stationTag.textContent = 'View Station \u2192'
            stationTag.href = `/stations/${stationPOI.base_id}`
            stationTag.onclick = (e) => e.stopPropagation()
            poiPanelTagsRef.current.appendChild(stationTag)
          }

          if (poiPanelTagsRef.current.childNodes.length > 0) {
            poiPanelTagsRef.current.style.display = 'flex'
          }
        }

        renderPOIs(data.pois || [])
      } catch (err) {
        console.error('Failed to fetch POI data:', err)
        renderEmptyState(
          '!',
          'Failed to load system data',
          'Check your connection and try again',
        )
      }
    },
    [renderEmptyState, renderPOIs],
  )

  // ── Activity Toast ─────────────────────────────────────────────────

  const showActivityToast = useCallback(
    (icon: ReactNode, text: string, time: string) => {
      const s = stateRef.current
      setToastData({ icon, text, time: time || '' })
      if (toastRef.current) {
        toastRef.current.className = `${styles.activityToast} ${styles.activityToastVisible}`
      }

      if (s.activityToastTimeout) clearTimeout(s.activityToastTimeout)
      s.activityToastTimeout = setTimeout(() => {
        if (toastRef.current) {
          toastRef.current.className = styles.activityToast
        }
      }, 4000)
    },
    [],
  )

  const handleActivityEvent = useCallback(
    (event: ActivityEvent) => {
      const icon = ICON_MAP[event.type] || <Satellite size={TOAST_SZ} />
      let text = ''

      switch (event.type) {
        case 'player_joined':
          text = `${event.data?.username || 'A pilot'} joined the game`
          break
        case 'system_discovered':
          text = `${event.data?.discoverer || 'Someone'} discovered ${event.data?.system_name || 'a new system'}`
          break
        case 'player_destroyed':
          if (event.data?.cause === 'self_destruct') {
            text = `${event.data?.victim || 'A pilot'} self-destructed`
          } else if (event.data?.cause === 'police') {
            text = `${event.data?.victim || 'A pilot'} was destroyed by police`
          } else {
            text = `${event.data?.victim || 'A pilot'} was destroyed`
            if (event.data?.killer) text += ` by ${event.data.killer}`
          }
          break
        case 'weapon_fired':
          text = `${event.data?.attacker || 'A pilot'} fired ${event.data?.weapon_name || 'a weapon'} at ${event.data?.defender || 'a target'}`
          break
        case 'travel':
          text = `${event.data?.player || 'A pilot'} traveled to ${event.data?.to_poi || 'a new location'}`
          break
        case 'jump':
          if (event.data?.first_discovery) {
            text = `${event.data?.player || 'A pilot'} made first jump to ${event.data?.to_system_name || 'unknown'}`
          }
          break
        default:
          return
      }

      if (text) {
        const now = new Date()
        const time = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
        showActivityToast(icon, text, time)
      }
    },
    [showActivityToast],
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
    updateUrlState()
  }, [render, updateUrlState])

  const zoomIn = useCallback(() => {
    const s = stateRef.current
    s.targetZoom = Math.min(MAX_ZOOM, s.targetZoom * 1.5)
  }, [])

  const zoomOut = useCallback(() => {
    const s = stateRef.current
    s.targetZoom = Math.max(MIN_ZOOM, s.targetZoom / 1.5)
  }, [])

  const toggleTravelPlayer = useCallback((player: string) => {
    setSelectedPlayers((prev) => {
      const next = new Set(prev)
      if (next.has(player)) {
        next.delete(player)
      } else {
        next.add(player)
      }
      stateRef.current.selectedTravelPlayers = next
      return next
    })
  }, [])

  // ── Body class for hiding shared layout elements (fullPage only) ──

  useEffect(() => {
    if (!fullPage) return
    document.body.classList.add('map-page')
    return () => {
      document.body.classList.remove('map-page')
    }
  }, [fullPage])

  // ── Close travel dropdown on outside click ────────────────────────
  useEffect(() => {
    if (!travelDropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (travelTrackerRef.current && !travelTrackerRef.current.contains(e.target as Node)) {
        setTravelDropdownOpen(false)
        setTravelFilter('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [travelDropdownOpen])

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
      if (fullPage) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      } else {
        const container = containerRef.current
        if (container) {
          canvas.width = container.clientWidth
          canvas.height = container.clientHeight
        }
      }
      render(ctx)
    }

    // ── URL State ────────────────────────────────────────────────
    parseUrlState()

    // ── Stars ────────────────────────────────────────────────────
    generateStars()

    // ── Initial Resize ───────────────────────────────────────────
    resizeCanvas()

    // ── Control Hint ─────────────────────────────────────────────
    const isTouchDevice =
      'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isTouchDevice && controlHintRef.current) {
      controlHintRef.current.textContent = 'Pinch to zoom, drag to pan'
    }

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
        updateUrlState()
      }
      s.viewWasSettled = viewSettled

      // Always keep animating for star twinkling and pulsing effects
      animFrameId = requestAnimationFrame(animationLoop)
    }

    // Start animation immediately
    animFrameId = requestAnimationFrame(animationLoop)

    // ── Fetch Map Data ───────────────────────────────────────────
    async function fetchMapData() {
      try {
        const [mapResponse, stationsResponse] = await Promise.all([
          fetch('https://game.spacemolt.com/api/map'),
          fetch('https://game.spacemolt.com/api/stations'),
        ])
        const data: MapData = await mapResponse.json()

        // Mark systems that have stations
        try {
          const stationsData = await stationsResponse.json()
          const stationSystems = new Set(
            (stationsData.stations || []).map((st: { system_id: string }) => st.system_id),
          )
          for (const system of data.systems) {
            if (stationSystems.has(system.id)) {
              system.has_station = true
            }
          }
        } catch {
          // Stations data is optional — map still works without it
        }

        s.mapData = data

        const totalOnline = data.systems.reduce(
          (sum, sys) => sum + sys.online,
          0,
        )
        if (statSystemsRef.current)
          statSystemsRef.current.textContent = String(
            data.systems.length,
          )
        if (statOnlineRef.current)
          statOnlineRef.current.textContent = String(totalOnline)
        if (loadingRef.current)
          loadingRef.current.style.display = 'none'

        // Handle pending system from URL parameter
        if (s.pendingSystemId) {
          const pendingSystem = data.systems.find(sys => sys.id === s.pendingSystemId)
          if (pendingSystem) {
            // Center view on this system
            s.targetViewX = -pendingSystem.x
            s.targetViewY = -pendingSystem.y
            s.viewX = -pendingSystem.x
            s.viewY = -pendingSystem.y
            s.targetZoom = 0.5
            s.zoom = 0.5
            showPOIPanel(pendingSystem)
          }
          s.pendingSystemId = null
        }

        render(ctx)
      } catch (err) {
        console.error('Failed to fetch map data:', err)
        if (loadingRef.current)
          loadingRef.current.textContent = 'Failed to load galaxy data'
      }
    }

    fetchMapData()
    const fetchInterval = setInterval(fetchMapData, 30000)

    // ── SSE Activity Feed ────────────────────────────────────────
    let eventSource: EventSource | null = null
    let sseReconnectTimeout: ReturnType<typeof setTimeout> | null = null
    const playerLastSystem = new Map<string, string>()

    function trackPlayerSystem(player: string, systemName: string) {
      const lastSystem = playerLastSystem.get(player)
      if (lastSystem === systemName) return
      playerLastSystem.set(player, systemName)
      const history = s.travelHistory.get(player) || []
      const isMove = history.length > 0 && history[history.length - 1] !== systemName
      history.push(systemName)
      if (history.length > 5) history.shift()
      s.travelHistory.set(player, history)

      // Trigger ping animation if this player is being tracked
      if (isMove && s.selectedTravelPlayers.has(player) && s.mapData) {
        const sys = s.mapData.systems.find((ss) => ss.name === systemName)
        if (sys) {
          const idx = Array.from(s.selectedTravelPlayers).indexOf(player)
          const color = TRAVEL_PATH_COLORS[idx % TRAVEL_PATH_COLORS.length]
          s.travelPings.push({ wx: sys.x, wy: sys.y, startTime: s.animationTime, color })
        }
      }
    }

    function connectActivityFeed() {
      try {
        eventSource = new EventSource(
          'https://game.spacemolt.com/events',
        )
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as ActivityEvent

            // Track player system changes for travel paths
            const player = data.data?.player
            if (player) {
              const sysName = data.type === 'jump'
                ? data.data?.to_system_name
                : data.data?.system_name
              if (sysName) {
                trackPlayerSystem(String(player), String(sysName))
              }
            }
            handleActivityEvent(data)
          } catch {
            // ignore parse errors
          }
        }
        eventSource.onerror = () => {
          if (eventSource) eventSource.close()
          sseReconnectTimeout = setTimeout(connectActivityFeed, 5000)
        }
      } catch {
        // SSE not supported
      }
    }

    connectActivityFeed()

    // ── Travel History Sync ───────────────────────────────────────
    let lastTravelKeys = ''
    const travelSyncInterval = setInterval(() => {
      const keys = Array.from(s.travelHistory.keys()).sort().join(',')
      if (keys !== lastTravelKeys) {
        lastTravelKeys = keys
        setTravelPlayerList(keys ? keys.split(',') : [])
      }
    }, 2000)

    // ── Mouse Events ─────────────────────────────────────────────
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
        render(ctx)
      } else {
        const system = findSystemAt(e.clientX, e.clientY)
        if (system !== s.hoveredSystem) {
          s.hoveredSystem = system
          render(ctx)
        }
        updateTooltip(system, e.clientX, e.clientY)
      }
    }

    function onMouseUp(e: MouseEvent) {
      const dx = e.clientX - s.dragStart.x
      const dy = e.clientY - s.dragStart.y
      const wasDrag = Math.abs(dx) > 5 || Math.abs(dy) > 5

      if (!wasDrag) {
        const system = findSystemAt(e.clientX, e.clientY)
        if (system) {
          if (fullPage) {
            showPOIPanel(system)
          } else {
            router.push(`/map?system=${system.id}`)
          }
        }
      } else {
        updateUrlState()
      }

      s.isDragging = false
    }

    function onMouseLeave() {
      s.isDragging = false
      s.hoveredSystem = null
      if (tooltipRef.current) {
        tooltipRef.current.className = styles.tooltip
      }
      render(ctx)
    }

    function showScrollHint() {
      const el = scrollHintRef.current
      if (!el) return
      el.classList.add(styles.scrollHintVisible)
      if (scrollHintTimerRef.current) clearTimeout(scrollHintTimerRef.current)
      scrollHintTimerRef.current = setTimeout(() => {
        el.classList.remove(styles.scrollHintVisible)
      }, 1500)
    }

    function onWheel(e: WheelEvent) {
      // In embedded mode, require Ctrl/Cmd to zoom; otherwise let the page scroll
      if (!fullPage && !e.ctrlKey && !e.metaKey) {
        showScrollHint()
        return
      }
      e.preventDefault()
      const clampedDelta = Math.max(-100, Math.min(100, e.deltaY))
      const zoomFactor = Math.exp(-clampedDelta * ZOOM_SENSITIVITY)
      s.targetZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, s.targetZoom * zoomFactor),
      )

      // Zoom toward mouse position
      const cx = canvas!.width / 2
      const cy = canvas!.height / 2
      const worldX = (e.clientX - cx) / s.zoom - s.viewX
      const worldY = (e.clientY - cy) / s.zoom - s.viewY

      const tempZoom = s.zoom
      s.zoom = s.targetZoom
      const newWorldX = (e.clientX - cx) / s.zoom - s.viewX
      const newWorldY = (e.clientY - cy) / s.zoom - s.viewY
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
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      }
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

        const cx = canvas!.width / 2
        const cy = canvas!.height / 2
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

        if (!wasMove) {
          const system = findSystemAt(
            touch.clientX,
            touch.clientY,
          )
          if (system) {
            if (fullPage) {
              showPOIPanel(system)
            } else {
              router.push(`/map?system=${system.id}`)
            }
          }
        }
      }

      if (e.touches.length === 0) {
        s.isDragging = false
        s.lastTouchDistance = null
        s.lastPinchCenter = null
        s.initialTouchPos = null
        updateUrlState()
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

    if (fullPage) {
      window.addEventListener('resize', resizeCanvas)
    } else if (containerRef.current) {
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
      if (fullPage) {
        window.removeEventListener('resize', resizeCanvas)
      }
      if (resizeObserver) resizeObserver.disconnect()
      cancelAnimationFrame(animFrameId)
      clearInterval(fetchInterval)
      clearInterval(travelSyncInterval)
      if (eventSource) eventSource.close()
      if (sseReconnectTimeout) clearTimeout(sseReconnectTimeout)
      if (s.urlUpdateTimeout) clearTimeout(s.urlUpdateTimeout)
      if (s.activityToastTimeout) clearTimeout(s.activityToastTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── JSX ────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className={fullPage ? styles.mapPage : styles.mapEmbed}>
      {/* Control hint (fullPage only) */}
      {fullPage && (
        <div className={styles.controlHint} ref={controlHintRef}>
          Scroll to zoom, drag to pan
        </div>
      )}

      {/* Scroll hint (embedded only) */}
      {!fullPage && (
        <div className={styles.scrollHint} ref={scrollHintRef}>
          Use {typeof navigator !== 'undefined' && /Mac|iPhone/.test(navigator.userAgent) ? '\u2318' : 'Ctrl'} + scroll to zoom
        </div>
      )}

      {/* Canvas */}
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* Tooltip */}
      <div ref={tooltipRef} className={styles.tooltip}>
        <div ref={tooltipNameRef} className={styles.tooltipName} />
        <div ref={tooltipEmpireRef} className={styles.tooltipEmpire} />
        <div ref={tooltipOnlineRef} className={styles.tooltipOnline} />
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendTitle}>Empires</div>
        <div className={styles.legendItem}>
          <div
            className={styles.legendDot}
            style={{ background: '#4A90D9' }}
          />
          <span className={styles.legendLabel}>Solarian</span>
        </div>
        <div className={styles.legendItem}>
          <div
            className={styles.legendDot}
            style={{ background: '#00FFFF' }}
          />
          <span className={styles.legendLabel}>Voidborn</span>
        </div>
        <div className={styles.legendItem}>
          <div
            className={styles.legendDot}
            style={{ background: '#DC143C' }}
          />
          <span className={styles.legendLabel}>Crimson</span>
        </div>
        <div className={styles.legendItem}>
          <div
            className={styles.legendDot}
            style={{ background: '#FFD700' }}
          />
          <span className={styles.legendLabel}>Nebula</span>
        </div>
        <div className={styles.legendItem}>
          <div
            className={styles.legendDot}
            style={{ background: '#4169E1' }}
          />
          <span className={styles.legendLabel}>Outer Rim</span>
        </div>
        <div className={styles.legendItem}>
          <div
            className={styles.legendDot}
            style={{ background: '#5a6a7a' }}
          />
          <span className={styles.legendLabel}>Neutral</span>
        </div>
        <div className={styles.legendItem}>
          <div
            className={styles.legendDot}
            style={{
              background: '#ff4444',
              boxShadow: '0 0 6px rgba(255,68,68,0.6)',
            }}
          />
          <span className={styles.legendLabel}>Pirate Stronghold</span>
        </div>
      </div>

      {/* Stats (top-left) */}
      <div className={styles.stats}>
        <div className={styles.statsHeader}>
          <span className={styles.statStatusDot} />
          <span>Live</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Systems:</span>
          <span className={styles.statValue} ref={statSystemsRef}>
            -
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Online:</span>
          <span className={styles.statValue} ref={statOnlineRef}>
            -
          </span>
        </div>
      </div>

      {/* Travel Tracker (fullPage only) */}
      {fullPage && <div className={styles.travelTracker} ref={travelTrackerRef}>
        <button
          className={`${styles.travelTrackerBtn}${travelDropdownOpen ? ` ${styles.travelTrackerBtnActive}` : ''}`}
          onClick={() => setTravelDropdownOpen((o) => !o)}
        >
          <span className={styles.travelTrackerIcon}><Compass size={16} /></span>
          <span>Travel Tracker</span>
          {selectedPlayers.size > 0 && (
            <span className={styles.travelTrackerBadge}>
              {selectedPlayers.size}
            </span>
          )}
        </button>
        {travelDropdownOpen && (
          <div className={styles.travelDropdown}>
            {travelPlayerList.length === 0 ? (
              <div className={styles.travelDropdownEmpty}>
                No player activity recorded yet. Waiting for SSE events...
              </div>
            ) : (
              <>
              <input
                type="text"
                className={styles.travelFilterInput}
                placeholder="Filter players…"
                value={travelFilter}
                onChange={(e) => setTravelFilter(e.target.value)}
                autoFocus
              />
              <div className={styles.travelDropdownList}>
                {travelPlayerList.filter((player) => {
                  if (!travelFilter) return true
                  const query = travelFilter.toLowerCase()
                  const name = player.toLowerCase()
                  let qi = 0
                  for (let ni = 0; ni < name.length && qi < query.length; ni++) {
                    if (name[ni] === query[qi]) qi++
                  }
                  return qi === query.length
                }).map((player, i) => {
                  const isSelected = selectedPlayers.has(player)
                  const color = TRAVEL_PATH_COLORS[
                    Array.from(selectedPlayers).indexOf(player) % TRAVEL_PATH_COLORS.length
                  ]
                  const jumpCount = stateRef.current.travelHistory.get(player)?.length || 0
                  return (
                    <label key={player} className={styles.travelPlayerRow}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTravelPlayer(player)}
                        className={styles.travelCheckbox}
                      />
                      {isSelected && (
                        <span
                          className={styles.travelColorDot}
                          style={{ background: color }}
                        />
                      )}
                      <span className={styles.travelPlayerName}>{player}</span>
                      <span className={styles.travelJumpCount}>
                        {jumpCount} system{jumpCount !== 1 ? 's' : ''}
                      </span>
                    </label>
                  )
                })}
              </div>
              </>
            )}
          </div>
        )}
      </div>}

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

      {/* Activity Toast */}
      <div ref={toastRef} className={styles.activityToast}>
        <span className={styles.activityToastIcon}>{toastData?.icon}</span>
        <span className={styles.activityToastText}>{toastData?.text}</span>
        <div className={styles.activityToastTime}>{toastData?.time}</div>
      </div>

      {/* POI Panel (fullPage only) */}
      {fullPage && (
        <div ref={poiPanelRef} className={styles.poiPanel}>
          <div className={styles.poiPanelHeader}>
            <div>
              <div ref={poiPanelTitleRef} className={styles.poiPanelTitle}>
                System
              </div>
              <div
                ref={poiPanelEmpireRef}
                className={styles.poiPanelEmpire}
              />
              <div
                ref={poiPanelTagsRef}
                className={styles.poiPanelTags}
              />
              <div
                ref={poiPanelDescRef}
                className={styles.poiPanelDesc}
              />
            </div>
            <button
              className={styles.poiPanelClose}
              onClick={closePOIPanel}
              aria-label="Close"
            >
              {'\u00D7'}
            </button>
          </div>
          <div
            ref={poiPanelContentRef}
            className={styles.poiPanelContent}
          >
            <div className={styles.poiPanelEmpty}>
              <div className={styles.poiPanelEmptyIcon}>{'\u25CE'}</div>
              <div>Loading system data...</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
