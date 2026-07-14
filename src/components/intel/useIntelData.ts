'use client'

// Data layer for the strategic intelligence map. Owns all fetching, polling,
// and SSE reconciliation so the page and canvas stay presentation-only.
//
// Request budget: the aggregate endpoints exist precisely so we never fan out
// per-player requests — one snapshot poll (20s), one movements poll (60s), and
// the shared SSE feed cover the whole fleet.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVisiblePoll } from '@/lib/useVisiblePoll'
import { subscribeToEvents } from '@/lib/sharedEventSource'
import type {
  IntelAgent,
  IntelMapResponse,
  IntelMapSystem,
  IntelMovement,
  IntelMovementsResponse,
  PublicMapResponse,
  PublicStation,
  PublicStationsResponse,
  TrailSegment,
  TransitMarker,
} from '@/lib/intelTypes'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

const INTEL_POLL_MS = 20_000
const MOVEMENTS_POLL_MS = 60_000
const MOVEMENTS_LIMIT = 2000
const RATE_LIMIT_BACKOFF_MS = 60_000
/** Debounce for movements refetch while the user is typing in the agent filter */
const FILTER_REFETCH_DEBOUNCE_MS = 600

// Same palette the public map uses for travel paths
const TRAIL_COLORS = [
  '#ff6b6b', // red
  '#4ecdc4', // teal
  '#ffe66d', // yellow
  '#a855f7', // purple
  '#fb923c', // orange
  '#38bdf8', // sky blue
  '#f472b6', // pink
  '#22d3ee', // cyan
]

/** Stable palette pick per agent so colors don't shuffle as filters change */
function trailColorFor(agentId: string): string {
  let hash = 0
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) | 0
  }
  return TRAIL_COLORS[Math.abs(hash) % TRAIL_COLORS.length]
}

export const FACTION_FILTER_ALL = ''
export const FACTION_FILTER_INDEPENDENT = '__independent__'

export interface FactionOption {
  id: string
  label: string
}

interface UseIntelDataOptions {
  authHeaders: () => Promise<Record<string, string>>
  /** Gate all fetching on auth being ready */
  enabled: boolean
  filterText: string
  factionFilter: string
  showHidden: boolean
  /** Movements window in minutes */
  trailsWindow: number
}

interface ActivityEventPayload {
  type: string
  data?: Record<string, string | boolean | number>
}

export interface UseIntelDataResult {
  systems: IntelMapSystem[]
  systemsById: Map<string, IntelMapSystem>
  /** Every station in the galaxy, keyed by system. Public knowledge, never fogged. */
  stationsBySystem: Map<string, PublicStation[]>
  agents: IntelAgent[]
  filteredAgents: IntelAgent[]
  exploredSet: Set<string>
  intelSet: Set<string>
  agentsBySystem: Map<string, IntelAgent[]>
  trails: TrailSegment[]
  transits: TransitMarker[]
  trailColors: Map<string, string>
  factionOptions: FactionOption[]
  currentTick: number | null
  tickAnchorMs: number
  movementsTruncated: boolean
  loading: boolean
  error: string | null
  rateLimited: boolean
  retry: () => void
}

export function useIntelData({
  authHeaders,
  enabled,
  filterText,
  factionFilter,
  showHidden,
  trailsWindow,
}: UseIntelDataOptions): UseIntelDataResult {
  const [systems, setSystems] = useState<IntelMapSystem[]>([])
  const [stations, setStations] = useState<PublicStation[]>([])
  const [intel, setIntel] = useState<IntelMapResponse | null>(null)
  // Faction-scoped snapshot; null when no faction filter is active.
  const [narrowed, setNarrowed] = useState<IntelMapResponse | null>(null)
  // Client wall-clock at the moment current_tick was received. The canvas
  // advances the tick off this to interpolate between 20s polls; anchoring on
  // the server's generated_at instead would import any clock skew.
  const [tickAnchorMs, setTickAnchorMs] = useState(() => Date.now())
  const [movements, setMovements] = useState<IntelMovement[]>([])
  const [movementsTruncated, setMovementsTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  const backoffUntilRef = useRef(0)
  const authHeadersRef = useRef(authHeaders)
  authHeadersRef.current = authHeaders

  const noteResponse = useCallback((status: number): string | null => {
    if (status === 401) {
      return 'Session expired — sign in again to view fleet intel.'
    }
    if (status === 429) {
      backoffUntilRef.current = Date.now() + RATE_LIMIT_BACKOFF_MS
      setRateLimited(true)
      return null // banner handled via rateLimited, keep stale data on screen
    }
    return `Game server returned ${status}`
  }, [])

  const fetchGalaxy = useCallback(async () => {
    const res = await fetch(`${GAME_SERVER}/api/map`)
    if (!res.ok) throw new Error(`map fetch failed (${res.status})`)
    const data: PublicMapResponse = await res.json()
    setSystems(data.systems || [])
  }, [])

  // Every base in the galaxy — empire capitals, pirate dens, and the stations
  // player factions have founded. Public and unauthenticated, so a failure here
  // costs the station layer and nothing else.
  const fetchStations = useCallback(async () => {
    const res = await fetch(`${GAME_SERVER}/api/stations`)
    if (!res.ok) throw new Error(`stations fetch failed (${res.status})`)
    const data: PublicStationsResponse = await res.json()
    setStations(data.stations || [])
  }, [])

  const fetchIntel = useCallback(async () => {
    if (Date.now() < backoffUntilRef.current) return
    const headers = await authHeadersRef.current()
    const res = await fetch(`${GAME_SERVER}/api/intel-map`, { headers })
    if (!res.ok) {
      const msg = noteResponse(res.status)
      if (msg) setError(msg)
      return
    }
    setRateLimited(false)
    setError(null)
    setIntel(await res.json())
    setTickAnchorMs(Date.now())
  }, [noteResponse])

  // A second, narrowed snapshot for the active faction. The unfiltered one stays
  // the source of truth for the agent list and the faction dropdown — narrowing
  // that would leave nothing to switch back to.
  const fetchNarrowed = useCallback(async (playerIds: string) => {
    if (!playerIds) {
      setNarrowed(null)
      return
    }
    if (Date.now() < backoffUntilRef.current) return
    const headers = await authHeadersRef.current()
    const res = await fetch(
      `${GAME_SERVER}/api/intel-map?players=${encodeURIComponent(playerIds)}`,
      { headers },
    )
    if (!res.ok) {
      // An older gameserver ignores ?players and returns the full snapshot; a
      // failure here just means the fog does not narrow. Never blank the map.
      noteResponse(res.status)
      return
    }
    setNarrowed(await res.json())
  }, [noteResponse])

  const fetchMovements = useCallback(async (minutes: number, playerIds: string[] | null) => {
    if (Date.now() < backoffUntilRef.current) return
    const headers = await authHeadersRef.current()
    // `hours` rides along for a gameserver that predates `minutes` — without it
    // an older server would ignore the window entirely and pin trails to its 24h
    // default. A server that understands `minutes` prefers it and ignores `hours`.
    const params = new URLSearchParams({
      minutes: String(minutes),
      hours: String(Math.max(1, Math.round(minutes / 60))),
      limit: String(MOVEMENTS_LIMIT),
    })
    if (playerIds && playerIds.length > 0) params.set('players', playerIds.join(','))
    const res = await fetch(`${GAME_SERVER}/api/intel-map/movements?${params}`, { headers })
    if (!res.ok) {
      noteResponse(res.status)
      return
    }
    const data: IntelMovementsResponse = await res.json()
    setMovements(data.movements || [])
    setMovementsTruncated(!!data.truncated)
  }, [noteResponse])

  // ── Derived: agent filtering ─────────────────────────────────────────

  const agents = useMemo(() => intel?.agents ?? [], [intel])

  const filteredAgents = useMemo(() => {
    const text = filterText.trim().toLowerCase()
    return agents.filter((a) => {
      if (!showHidden && a.hidden) return false
      if (factionFilter === FACTION_FILTER_INDEPENDENT) {
        if (a.faction_id) return false
      } else if (factionFilter !== FACTION_FILTER_ALL) {
        if (a.faction_id !== factionFilter) return false
      }
      if (text && !a.username.toLowerCase().includes(text)) return false
      return true
    })
  }, [agents, filterText, factionFilter, showHidden])

  // Narrow the movements query to the filtered agents when the user has
  // actually filtered the list — keeps trails in sync with the sidebar
  // without refetching for the no-filter common case.
  const filteredIdsKey = useMemo(() => {
    if (filteredAgents.length === agents.length) return ''
    return filteredAgents.map((a) => a.id).sort().join(',')
  }, [filteredAgents, agents])

  // Scope for the *snapshot* refetch, which narrows the fog of war and the
  // faction-intel overlay server-side — the parts the client cannot filter,
  // because only the server knows which systems each agent explored.
  //
  // Keyed on the faction filter alone, deliberately: the text filter is a
  // sidebar convenience, and folding it in here would refetch the whole galaxy
  // snapshot on every keystroke.
  const factionScopeKey = useMemo(() => {
    if (factionFilter === FACTION_FILTER_ALL) return ''
    const scoped = agents.filter((a) =>
      factionFilter === FACTION_FILTER_INDEPENDENT ? !a.faction_id : a.faction_id === factionFilter,
    )
    return scoped.map((a) => a.id).sort().join(',')
  }, [agents, factionFilter])

  // ── Initial load ─────────────────────────────────────────────────────

  const initialLoadedRef = useRef(false)
  const trailsWindowRef = useRef(trailsWindow)
  trailsWindowRef.current = trailsWindow
  const filteredIdsKeyRef = useRef(filteredIdsKey)
  filteredIdsKeyRef.current = filteredIdsKey

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.allSettled([
        fetchGalaxy(),
        fetchIntel(),
        fetchMovements(trailsWindowRef.current, null),
        fetchStations(),
      ])
      // Galaxy topology and the fleet snapshot are both required; a failed
      // movements or stations fetch just costs that one layer.
      if (results[0].status === 'rejected' || results[1].status === 'rejected') {
        setError('Could not reach game server')
      }
    } catch {
      setError('Could not reach game server')
    } finally {
      setLoading(false)
    }
  }, [fetchGalaxy, fetchIntel, fetchMovements, fetchStations])

  useEffect(() => {
    if (!enabled || initialLoadedRef.current) return
    initialLoadedRef.current = true
    loadAll()
  }, [enabled, loadAll])

  const retry = useCallback(() => {
    backoffUntilRef.current = 0
    setRateLimited(false)
    loadAll()
  }, [loadAll])

  // ── Polling (visibility-aware) ───────────────────────────────────────

  useVisiblePoll(() => {
    if (!enabled) return
    // Transient network failures during a poll keep the stale snapshot on
    // screen; the next poll retries.
    fetchIntel().catch(() => {})
  }, INTEL_POLL_MS)

  useVisiblePoll(() => {
    if (!enabled) return
    fetchMovements(
      trailsWindowRef.current,
      filteredIdsKeyRef.current ? filteredIdsKeyRef.current.split(',') : null,
    ).catch(() => {})
  }, MOVEMENTS_POLL_MS)

  // Keep the faction-scoped snapshot fresh alongside the full one, so the fog of
  // war under a faction filter does not freeze at whatever it was when the
  // filter was applied.
  const factionScopeKeyRef = useRef(factionScopeKey)
  factionScopeKeyRef.current = factionScopeKey

  useVisiblePoll(() => {
    if (!enabled || !factionScopeKeyRef.current) return
    fetchNarrowed(factionScopeKeyRef.current).catch(() => {})
  }, INTEL_POLL_MS)

  // Refetch immediately when the faction selection changes.
  useEffect(() => {
    if (!enabled || !initialLoadedRef.current) return
    fetchNarrowed(factionScopeKey).catch(() => {})
  }, [enabled, factionScopeKey, fetchNarrowed])

  // Refetch movements when the window or the active agent filter changes
  // (debounced — the text filter changes on every keystroke).
  const firstFilterEffectRef = useRef(true)
  useEffect(() => {
    if (!enabled || !initialLoadedRef.current) return
    if (firstFilterEffectRef.current) {
      firstFilterEffectRef.current = false
      return
    }
    const timer = setTimeout(() => {
      fetchMovements(trailsWindow, filteredIdsKey ? filteredIdsKey.split(',') : null).catch(() => {})
    }, FILTER_REFETCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [enabled, trailsWindow, filteredIdsKey, fetchMovements])

  // ── SSE: optimistic marker moves for owned agents ────────────────────
  // Cloaked agents don't emit public SSE events; the 20s poll reconciles.

  const agentsRef = useRef(agents)
  agentsRef.current = agents
  const systemsRef = useRef(systems)
  systemsRef.current = systems

  useEffect(() => {
    if (!enabled) return
    const unsubscribe = subscribeToEvents((raw) => {
      let event: ActivityEventPayload
      try {
        event = JSON.parse(raw)
      } catch {
        return
      }
      if (event.type !== 'jump' && event.type !== 'travel') return
      const player = event.data?.player
      if (typeof player !== 'string') return
      const agent = agentsRef.current.find((a) => a.username === player)
      if (!agent) return

      if (event.type === 'jump') {
        // Jump events carry the destination system id in to_system.
        const toId = event.data?.to_system
        if (typeof toId !== 'string' || toId === agent.system) return
        const toSystem = systemsRef.current.find((s) => s.id === toId)
        if (!toSystem) return
        const fromId = agent.system

        setIntel((prev) => {
          if (!prev) return prev
          const explored = prev.explored_systems.includes(toSystem.id)
            ? prev.explored_systems
            : [...prev.explored_systems, toSystem.id]
          return {
            ...prev,
            explored_systems: explored,
            agents: prev.agents.map((a) =>
              a.id === agent.id
                ? { ...a, system: toSystem.id, poi: undefined, docked_at: undefined, in_transit: undefined }
                : a,
            ),
          }
        })
        setMovements((prev) => [
          ...prev,
          {
            player_id: agent.id,
            username: agent.username,
            from: fromId,
            to: toSystem.id,
            first_visit: false,
            at: new Date().toISOString(),
          },
        ])
      } else {
        // travel = intra-system POI move; system is unchanged, just update the POI.
        const toPoi = event.data?.to_poi
        if (typeof toPoi !== 'string') return
        setIntel((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            agents: prev.agents.map((a) =>
              a.id === agent.id ? { ...a, poi: toPoi, in_transit: undefined } : a,
            ),
          }
        })
      }
    })
    return unsubscribe
  }, [enabled])

  // ── Derived memos for the canvas ─────────────────────────────────────

  const systemsById = useMemo(() => new Map(systems.map((s) => [s.id, s])), [systems])

  // Stations are public knowledge, so this is deliberately NOT scoped to the
  // fleet's fog of war: a station in a system nobody has visited still draws.
  // Hiding it would tell the operator less than the public map does.
  const stationsBySystem = useMemo(() => {
    const map = new Map<string, PublicStation[]>()
    for (const station of stations) {
      const list = map.get(station.system_id)
      if (list) list.push(station)
      else map.set(station.system_id, [station])
    }
    return map
  }, [stations])

  // Everything derived from what the fleet *knows* reads the scoped snapshot, so
  // selecting a faction narrows the fog of war and the intel overlay too — not
  // just the agent list. Falls back to the full snapshot when nothing is scoped,
  // and while the narrowed one is still in flight.
  const scoped = narrowed ?? intel

  const exploredSet = useMemo(() => new Set(scoped?.explored_systems ?? []), [scoped])

  const intelSet = useMemo(
    () => new Set(Object.keys(scoped?.faction_intel?.systems ?? {})),
    [scoped],
  )

  const agentsBySystem = useMemo(() => {
    const map = new Map<string, IntelAgent[]>()
    for (const agent of filteredAgents) {
      // Agents mid-jump are drawn as transit dots, not system badges
      if (agent.in_transit?.type === 'jump') continue
      const list = map.get(agent.system)
      if (list) list.push(agent)
      else map.set(agent.system, [agent])
    }
    return map
  }, [filteredAgents])

  const transits = useMemo<TransitMarker[]>(
    () =>
      filteredAgents
        .filter((a) => a.in_transit?.type === 'jump')
        .map((a) => ({
          agentId: a.id,
          from: a.in_transit!.from,
          to: a.in_transit!.to,
          startTick: a.in_transit!.start_tick,
          arrivalTick: a.in_transit!.arrival_tick,
        })),
    [filteredAgents],
  )

  const trailColors = useMemo(() => {
    const map = new Map<string, string>()
    for (const agent of filteredAgents) map.set(agent.id, trailColorFor(agent.id))
    return map
  }, [filteredAgents])

  const trails = useMemo<TrailSegment[]>(() => {
    if (movements.length === 0 || filteredAgents.length === 0) return []
    const filteredIds = new Set(filteredAgents.map((a) => a.id))
    const windowMs = trailsWindow * 60_000
    const now = Date.now()
    const segments: TrailSegment[] = []
    for (const move of movements) {
      if (!filteredIds.has(move.player_id)) continue
      if (move.from === move.to) continue
      const at = Date.parse(move.at)
      const age = Number.isNaN(at) ? 1 : Math.min(1, Math.max(0, (now - at) / windowMs))
      segments.push({
        agentId: move.player_id,
        color: trailColorFor(move.player_id),
        from: move.from,
        to: move.to,
        age,
      })
    }
    return segments
  }, [movements, filteredAgents, trailsWindow])

  const factionOptions = useMemo<FactionOption[]>(() => {
    const seen = new Map<string, string>()
    for (const agent of agents) {
      if (agent.faction_id && !seen.has(agent.faction_id)) {
        seen.set(agent.faction_id, agent.faction_name || agent.faction_tag || agent.faction_id)
      }
    }
    return Array.from(seen, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    )
  }, [agents])

  return {
    systems,
    systemsById,
    stationsBySystem,
    agents,
    filteredAgents,
    exploredSet,
    intelSet,
    agentsBySystem,
    trails,
    transits,
    trailColors,
    factionOptions,
    currentTick: intel?.current_tick ?? null,
    tickAnchorMs,
    movementsTruncated,
    loading,
    error,
    rateLimited,
    retry,
  }
}
