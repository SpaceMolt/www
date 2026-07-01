// Game state types — re-exported from @/lib/gameTypes.
// Only types with no server schema equivalent are defined here.

import type {
  Player,
  Ship,
  CargoItem,
  SystemInfo,
  SystemPOI,
  SystemConnection,
  NearbyPlayer,
  POI,
  Base,
  MapSystem,
  ShipClass,
  PlayerStats,
  ViewMarketResponse,
  ViewOrdersResponse,
  ViewStorageResponse,
  ListShipsResponse,
  BrowseShipsResponse,
  GetMissionsResponse,
  GetWrecksResponse,
  GetBaseResponse,
  FactionInfoResponse,
  CatalogResponse,
  CompletedMissionsResponse,
  MarketItem,
  OrderEntry,
  StorageItem,
  StorageShip,
  StorageGift,
  FleetShip,
  Mission,
  MissionObjective,
  Wreck,
  FactionMember,
  ShowroomShip,
  FactionDetail,
  Facility,
} from '@/lib/gameTypes'

export type {
  Player,
  Ship,
  CargoItem,
  SystemInfo,
  SystemPOI,
  SystemConnection,
  NearbyPlayer,
  POI,
  Base,
  MapSystem,
  ShipClass,
  PlayerStats,
  ViewMarketResponse,
  ViewOrdersResponse,
  ViewStorageResponse,
  ListShipsResponse,
  BrowseShipsResponse,
  GetMissionsResponse,
  GetWrecksResponse,
  GetBaseResponse,
  FactionInfoResponse,
  CatalogResponse,
  CompletedMissionsResponse,
  MarketItem,
  OrderEntry,
  StorageItem,
  StorageShip,
  StorageGift,
  FleetShip,
  Mission,
  MissionObjective,
  Wreck,
  FactionMember,
  ShowroomShip,
  FactionDetail,
  Facility,
}

// Aliases for backward compat with panel imports
export type MarketData = ViewMarketResponse
export type OrdersData = ViewOrdersResponse
export type StorageData = ViewStorageResponse
export type FleetData = ListShipsResponse
export type ShowroomData = BrowseShipsResponse

// === Client-only types (no server schema) ===

// WebSocket-only messages not in v2 API
export interface WelcomePayload {
  version: string
  release_date: string
  release_notes: string[]
  tick_rate: number
  current_tick: number
  server_time: number
  motd?: string
  game_info: string
  website: string
  help_text: string
  terms: string
}

export interface StateUpdate {
  tick: number
  player: Player
  ship: Ship
  nearby?: NearbyPlayer[]
  in_combat?: boolean
  travel_progress?: number
  travel_destination?: string
  travel_type?: string
  travel_arrival_tick?: number
}

// Battle state — derived from the server's battle_started / battle_update
// WebSocket pushes (which the server streams to participants every tick).
export interface BattleSideState {
  side_id: number
  player_count: number
  faction_id?: string
}

export interface BattleParticipantState {
  player_id: string
  username: string
  side_id: number
  zone?: string
  ship_class?: string
  ship_name?: string
  hull_pct?: number
  shield_pct?: number
  stance?: string
}

export interface BattleState {
  battle_id: string
  system_id?: string
  your_side_id?: number
  your_zone?: string
  your_stance?: string
  your_target_id?: string
  auto_pilot?: boolean
  sides: BattleSideState[]
  participants: BattleParticipantState[]
}

export interface ChatMessage {
  id: string
  channel: string
  sender_id: string
  sender: string
  content: string
  timestamp?: string
  timestamp_utc?: string
  target_id?: string
  target_name?: string
}

export interface TradeOffer {
  trade_id: string
  from_player: string
  from_name: string
  to_player?: string
  to_name?: string
  offer_items: { item_id: string; quantity: number }[]
  offer_credits: number
  request_items: { item_id: string; quantity: number }[]
  request_credits: number
}

export interface EventLogEntry {
  id: string
  type: string
  message: string
  timestamp: number
  data?: Record<string, unknown>
}

// Crafting types — server returns via catalog but no dedicated schema for recipe details
export interface Recipe {
  id: string
  name: string
  description?: string
  category: string
  required_skills: Record<string, number>
  inputs: { item_id: string; quantity: number }[]
  outputs: { item_id: string; quantity: number; quality_mod?: boolean }[]
  crafting_time: number
  base_quality?: number
  skill_quality_mod?: number
}

export interface RecipesData {
  recipes: Record<string, Recipe>
  total?: number
  page?: number
}

// Crafting is queued, not instant: a `craft`/`recycle` enqueues a job that runs
// over ticks. These mirror the gameserver apiresponses for craft jobs/quotes
// (internal/apiresponses/facility_jobs.go).
export interface CraftStorageItem {
  item_id: string
  name?: string
  quantity: number
}

// One job in the player's queue (craft action=queue → CraftQueueResponse.jobs).
export interface CraftJobView {
  job_id: string
  venue?: string
  recipe: string
  mode: string // "craft" | "recycle"
  produces?: CraftStorageItem[]
  runs_total: number
  runs_done: number
  runs_remaining: number
  progress: number // 0..1 of the in-flight run
  eta_ticks: number
  position: number
  orderer: string
  external?: boolean
  status: string
  facility_id: string
  // last_sync_tick is client-only: the currentTick at the moment this job's
  // runs_done/progress were last confirmed by the server (a fetch or a
  // crafting_update push). Used to interpolate live progress between syncs —
  // see estimateJobProgress in panels/facilities/craftProgress.ts.
  last_sync_tick?: number
}

// FacilityEntry.production (internal/apiresponses/facility.go) — the
// throughput/backlog/rental snapshot needed to pick a crafting venue and to
// manage a facility's job queue. Not yet in the cached OpenAPI spec
// (src/lib/openapi-v2.json), so typed locally rather than via gameTypes.ts
// until that's refreshed.
export interface FacilityProduction {
  recipe?: string
  output_per_run?: number
  ticks_per_run?: number
  items_per_hour?: number
  queued_runs: number
  queued_items: number
  backlog_ticks: number
  public?: boolean
  rental_fee_per_run?: number
}

export type FacilityWithProduction = Facility & {
  production?: FacilityProduction
  // custom_name is the owner-assigned name (facility.go); also not yet in
  // the cached spec.
  custom_name?: string
}

// Result of a dry_run craft/recycle: a cost + time quote, nothing queued.
export interface CraftQuote {
  recipe: string
  mode: string
  quantity: number
  runs: number
  venue: string
  venue_type: string // "workshop" | "facility"
  external?: boolean
  produces?: CraftStorageItem[]
  cost: { inputs?: CraftStorageItem[]; labor?: number; fee?: number }
  credits_total: number
  have_inputs: boolean
  have_credits: boolean
  effective_time_per_run: number
  est_completion_tick: number
  message: string
}

export interface SkillsData {
  skills: Record<string, { level: number; xp: number; next_level_xp: number }>
  message?: string
}

// Enriched module instance from get_status response (top-level 'modules' field)
export interface EnrichedShipModule {
  id?: string         // v1 format
  module_id?: string  // v2 format
  type_id: string
  name: string
  type: 'weapon' | 'defense' | 'mining' | 'utility'
  size: number
  wear: number
  wear_status: string
  cpu_usage: number
  power_usage: number
  damage?: number
  damage_type?: string
  range?: number
  cooldown?: number
  reach?: number
  shield_bonus?: number
  armor_bonus?: number
  hull_bonus?: number
  speed_penalty?: number
  shield_recharge_bonus?: number
  damage_reduction?: number
  mining_power?: number
  mining_range?: number
  harvest_power?: number
  harvest_range?: number
  speed_bonus?: number
  cargo_bonus?: number
  power_bonus?: number
  cpu_bonus?: number
  scanner_power?: number
  cloak_strength?: number
  fuel_efficiency?: number
  survey_power?: number
  magazine_size?: number
  current_ammo?: number
  ammo_type?: string
  loaded_ammo_name?: string
}

// Ship catalog — uses different shape from BrowseShipsResponse
export interface ShipClassInfo {
  id: string
  name: string
  description: string
  class: string
  price: number
  base_hull: number
  base_shield: number
  base_shield_recharge?: number
  base_armor?: number
  base_speed: number
  base_fuel: number
  cargo_capacity: number
  cpu_capacity: number
  power_capacity: number
  weapon_slots: number
  defense_slots: number
  utility_slots: number
  default_modules?: string[]
  required_skills?: Record<string, number>
  required_items?: { item_id: string; quantity: number }[]
}

export interface ShipCatalogData {
  ships: ShipClassInfo[]
  count: number
  message: string
}

// === Game State ===

export interface GameState {
  connected: boolean
  authenticated: boolean
  welcome: WelcomePayload | null
  player: Player | null
  ship: Ship | null
  system: SystemInfo | null
  poi: POI | null
  nearby: NearbyPlayer[]
  inCombat: boolean
  /** Live battle snapshot from battle_started/battle_update pushes; null when not in a battle */
  battleStatus: BattleState | null
  isDocked: boolean
  travelProgress: number | null
  travelDestination: string | null
  travelType: string | null
  travelArrivalTick: number | null
  currentTick: number
  chatMessages: ChatMessage[]
  eventLog: EventLogEntry[]
  pendingTrades: TradeOffer[]
  recentChat: ChatMessage[]
  marketData: MarketData | null
  ordersData: OrdersData | null
  shipCatalog: ShipCatalogData | null
  showroomData: ShowroomData | null
  fleetData: FleetData | null
  storageData: StorageData | null
  recipesData: RecipesData | null
  skillsData: SkillsData | null
  /** Non-null while a mutation is in-flight (HTTP request or tick-queued) */
  pendingAction: { command: string; startedAt: number; estimatedMs?: number } | null
  /** Enriched installed modules from get_status (separate from ship.modules which is just IDs) */
  shipModules: EnrichedShipModule[]
  /**
   * The player's queued craft/recycle jobs across all venues. Shared here
   * (rather than local panel state) so a crafting_update push can patch it
   * live even when CraftingPanel isn't the component that queued the job.
   * null = not yet fetched.
   */
  craftJobs: CraftJobView[] | null
}

export const initialGameState: GameState = {
  connected: false,
  authenticated: false,
  welcome: null,
  player: null,
  ship: null,
  system: null,
  poi: null,
  nearby: [],
  inCombat: false,
  battleStatus: null,
  isDocked: false,
  travelProgress: null,
  travelDestination: null,
  travelType: null,
  travelArrivalTick: null,
  currentTick: 0,
  chatMessages: [],
  eventLog: [],
  pendingTrades: [],
  recentChat: [],
  marketData: null,
  ordersData: null,
  shipCatalog: null,
  showroomData: null,
  fleetData: null,
  storageData: null,
  recipesData: null,
  skillsData: null,
  pendingAction: null,
  shipModules: [],
  craftJobs: null,
}

// === WebSocket Message Types ===

export interface WSMessage {
  type: string
  payload?: Record<string, unknown>
}

export type GameAction =
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'WELCOME'; payload: WelcomePayload }
  | { type: 'REGISTERED'; payload: { password: string; player_id: string } }
  | { type: 'LOGGED_IN'; payload: Record<string, unknown> }
  | { type: 'STATE_UPDATE'; payload: StateUpdate }
  | { type: 'TICK'; tick: number }
  | { type: 'OK'; payload: Record<string, unknown> }
  | { type: 'ERROR'; payload: { code: string; message: string } }
  | { type: 'COMBAT_UPDATE'; payload: Record<string, unknown> }
  | { type: 'BATTLE_PUSH'; kind: string; payload: Record<string, unknown> }
  | { type: 'PLAYER_DIED'; payload: Record<string, unknown> }
  | { type: 'MINING_YIELD'; payload: Record<string, unknown> }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'TRADE_OFFER_RECEIVED'; payload: TradeOffer }
  | { type: 'SCAN_RESULT'; payload: Record<string, unknown> }
  | { type: 'SCAN_DETECTED'; payload: Record<string, unknown> }
  | { type: 'POI_ARRIVAL'; payload: Record<string, unknown> }
  | { type: 'POI_DEPARTURE'; payload: Record<string, unknown> }
  | { type: 'PILOTLESS_SHIP'; payload: Record<string, unknown> }
  | { type: 'SKILL_LEVEL_UP'; payload: Record<string, unknown> }
  | { type: 'POLICE_WARNING'; payload: Record<string, unknown> }
  | { type: 'ADD_EVENT'; entry: EventLogEntry }
  | { type: 'SET_MARKET_DATA'; payload: MarketData }
  | { type: 'SET_ORDERS_DATA'; payload: OrdersData }
  | { type: 'SET_SHIP_CATALOG'; payload: ShipCatalogData }
  | { type: 'SET_SHOWROOM_DATA'; payload: ShowroomData }
  | { type: 'SET_FLEET_DATA'; payload: FleetData }
  | { type: 'SET_STORAGE_DATA'; payload: StorageData }
  | { type: 'SET_RECIPES_DATA'; payload: RecipesData }
  | { type: 'MERGE_RECIPES_DATA'; payload: RecipesData }
  | { type: 'SET_SKILLS_DATA'; payload: SkillsData }
  | { type: 'STATUS_POLL'; payload: { player: Player; ship: Ship; modules?: EnrichedShipModule[]; dockedAt?: string } }
  | { type: 'SET_NEARBY'; payload: NearbyPlayer[] }
  | { type: 'SET_PENDING_ACTION'; command: string; estimatedMs?: number }
  | { type: 'CLEAR_PENDING_ACTION' }
  | { type: 'SET_CRAFT_JOBS'; payload: CraftJobView[] }
  | { type: 'ADD_CRAFT_JOB'; job: CraftJobView }
  | { type: 'REMOVE_CRAFT_JOB'; jobId: string }
  | {
      type: 'PATCH_CRAFT_JOBS'
      tick: number
      jobs: { job_id: string; runs_done_delta: number; runs_remaining: number; completed: boolean }[]
    }
  | { type: 'RESET' }
