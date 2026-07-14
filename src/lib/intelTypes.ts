// Types for the strategic intelligence map (/intel).
//
// Mirrors the gameserver's aggregate intel endpoints:
//   GET /api/intel-map                — fleet-wide snapshot (agents, fog of war, faction intel)
//   GET /api/intel-map/system/{id}    — per-system detail (POIs, contacts, stations, intel entries)
//   GET /api/intel-map/movements      — recent jump history for trail rendering
// plus the public GET /api/map galaxy topology.

// ── Public galaxy topology (GET /api/map) ──────────────────────────────

export interface IntelMapSystem {
  id: string
  name: string
  x: number
  y: number
  empire?: string
  empire_color?: string
  is_home?: boolean
  is_stronghold?: boolean
  /** Non-cloaked players in the system right now — the public map counts these too. */
  online?: number
  connections: string[]
}

export interface PublicMapResponse {
  systems: IntelMapSystem[]
}

// ── Stations (GET /api/stations) ───────────────────────────────────────
//
// Public and unauthenticated, and it already carries every base in the galaxy:
// the five empire capitals, the pirate dens, and every station a player faction
// has founded. Recon joins it onto the galaxy topology by system_id, which is
// why a station layer needs no new endpoint.

export interface PublicStation {
  id: string
  name: string
  description?: string
  empire?: string
  empire_name?: string
  faction_id?: string
  faction_name?: string
  faction_tag?: string
  faction_color?: string
  system_id: string
  system_name?: string
  services?: string[]
  condition?: string
  condition_text?: string
  satisfaction_pct?: number
  facility_count?: number
  defense_level?: number
}

export interface PublicStationsResponse {
  stations: PublicStation[]
}

// ── Fleet snapshot (GET /api/intel-map) ────────────────────────────────

export interface IntelInTransit {
  /** "jump" = system-to-system (from/to are system ids); "travel" = POI move (from/to are POI ids) */
  type: 'jump' | 'travel'
  from: string
  to: string
  /** Both ends of the flight — together they place the agent along it. */
  start_tick: number
  arrival_tick: number
}

export interface IntelAgent {
  id: string
  username: string
  hidden: boolean
  empire: string
  faction_id?: string
  faction_tag?: string
  faction_name?: string
  system: string
  poi?: string
  docked_at?: string
  online: boolean
  cloaked: boolean
  in_transit?: IntelInTransit
  ship_class: string
  ship_name: string
  fuel: number
  max_fuel: number
  last_active_at: string
}

export interface KnownWormhole {
  id: string
  entry_system: string
  entry_poi: string
  exit_system: string
  exit_poi: string
  expires_at: string
}

export interface FactionIntelSource {
  faction_id: string
  tag: string
  name: string
  intel_level: number
  system_count: number
  via_ally_of?: string
}

export interface FactionIntelSystemSummary {
  sources: string[]
  latest_tick: number
  poi_count: number
  has_resources: boolean
}

export interface FactionIntel {
  sources: FactionIntelSource[]
  systems: Record<string, FactionIntelSystemSummary>
}

export interface IntelMapResponse {
  generated_at: string
  current_tick: number
  agents: IntelAgent[]
  explored_systems: string[]
  revealed_pois: string[]
  known_wormholes: KnownWormhole[]
  faction_intel: FactionIntel
}

// ── System detail (GET /api/intel-map/system/{id}) ─────────────────────

export interface IntelSystemInfo {
  id: string
  name: string
  empire?: string
  description?: string
  police_level?: number
  security_status?: string
  is_stronghold?: boolean
  connections: string[]
}

/**
 * How fresh a deposit reading is — not who fetched it. 'live' = it describes the
 * deposit as it is right now, whether an agent is standing on it or an L2 intel
 * pool rebuilt it from canonical state. 'faction_intel' = a stored snapshot that
 * may be stale; check resource_age_ticks before trusting the quantity.
 */
export type IntelResourceSource = 'live' | 'faction_intel'

export interface IntelSystemPoi {
  id: string
  name: string
  type: string
  class?: string
  base_id?: string
  /** true = revealed deep-core site */
  hidden?: boolean
  x?: number
  y?: number
  online?: number

  station_name?: string
  station_empire?: string
  /** A faction station sits in lawless space, so empire is empty and these carry the owner. */
  station_faction_id?: string
  station_faction_name?: string
  station_faction_tag?: string
  station_faction_color?: string
  station_condition?: string
  station_services?: string[]

  /** Non-cloaked players standing here, exactly as the public map lists them. */
  players?: IntelPoiPlayer[]

  /** Same shape the faction pool reports, whoever took the reading. */
  resources?: IntelEntryResource[]
  resource_source?: IntelResourceSource
  resource_as_of_tick?: number
  /** 0 (or absent) when the reading is live */
  resource_age_ticks?: number
}

export interface IntelPoiPlayer {
  username: string
  clan_tag?: string
  primary_color?: string
  secondary_color?: string
  status?: string
}

export interface NearbyContact {
  player_id: string
  username: string
  status?: string
  clan_tag?: string
  ship_class?: string
  ship_name?: string
  faction_tag?: string
  in_combat?: boolean
  offline?: boolean
}

export interface NearbyByPoi {
  nearby: NearbyContact[]
  pirates: NearbyContact[]
  empire_npcs: NearbyContact[]
  creatures: NearbyContact[]
  count: number
  offline_collapsed: number
  pirate_count: number
  empire_npc_count: number
  creature_count: number
  poi_id: string
  /** Faint cloaked contact hint; may be absent */
  unknown_signature?: boolean
}

export interface StationFacility {
  id: string
  name: string
  description?: string
  category?: string
  level?: number
  service_type?: string
}

export interface StationMarketRow {
  item_id: string
  item_name: string
  category?: string
  base_value?: number
  best_bid: number
  best_ask: number
  bid_quantity: number
  ask_quantity: number
  spread?: number
  spread_pct?: number
}

export interface IntelStation {
  base_id: string
  name: string
  faction_id?: string
  faction_name?: string
  faction_tag?: string
  faction_color?: string
  condition?: string
  condition_text?: string
  satisfaction_pct?: number
  services?: string[]
  facilities?: StationFacility[]
  market?: StationMarketRow[]
}

export interface IntelEntryConnection {
  system_id: string
  name: string
  distance?: number
}

export interface IntelEntryResource {
  resource_id: string
  richness?: number | string
  remaining?: number
  remaining_display?: string
  max_remaining?: number
  depletion_percent?: number
}

export interface IntelEntryPoi {
  id: string
  type: string
  name: string
  class?: string
  position?: Record<string, number>
  base_id?: string
  base_name?: string
  resources?: IntelEntryResource[]
}

export interface FactionIntelEntryBody {
  system_id: string
  name: string
  description?: string
  empire?: string
  police_level?: number
  connections?: IntelEntryConnection[]
  pois?: IntelEntryPoi[]
  submitted_by?: string
  submitter_name?: string
  submitted_at_tick?: number
  auto_synced?: boolean
}

export interface SystemIntelEntry {
  source_faction_id: string
  source_tag: string
  intel_level: number
  live: boolean
  via_ally_of?: string
  entry: FactionIntelEntryBody
}

export interface IntelSystemDetailResponse {
  system: IntelSystemInfo
  /**
   * false = the fleet knows nothing here beyond what the public map tells
   * anonymous visitors, and the response is that public baseline. The system is
   * still dimmed on the map — this says "no intel", not "no data".
   */
  has_intel: boolean
  pois: IntelSystemPoi[]
  agents_here: string[]
  nearby_by_poi: Record<string, NearbyByPoi>
  stations: IntelStation[]
  intel_entries: SystemIntelEntry[]
}

// ── Movements (GET /api/intel-map/movements) ───────────────────────────

export interface IntelMovement {
  player_id: string
  username: string
  from: string
  to: string
  first_visit: boolean
  at: string
}

export interface IntelMovementsResponse {
  movements: IntelMovement[]
  truncated: boolean
  window_minutes: number
  window_hours: number
}

// ── Derived client-side shapes ──────────────────────────────────────────

/** One agent jump rendered as a trail polyline segment */
export interface TrailSegment {
  agentId: string
  color: string
  from: string
  to: string
  /** 0 = newest .. 1 = oldest within the trails window */
  age: number
}

/** Agent currently mid-jump, rendered as an animated dot on the from→to line */
export interface TransitMarker {
  agentId: string
  from: string
  to: string
  startTick: number
  arrivalTick: number
}

export interface IntelLayerState {
  fog: boolean
  intel: boolean
  stations: boolean
  trails: boolean
  agents: boolean
}
