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

export interface SkillsData {
  skills: Record<string, { level: number; xp: number; next_level_xp: number }>
  message?: string
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
  pendingAction: { command: string; startedAt: number } | null
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
  | { type: 'STATUS_POLL'; payload: { player: Player; ship: Ship } }
  | { type: 'SET_NEARBY'; payload: NearbyPlayer[] }
  | { type: 'SET_PENDING_ACTION'; command: string }
  | { type: 'CLEAR_PENDING_ACTION' }
  | { type: 'RESET' }
