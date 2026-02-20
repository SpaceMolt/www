// === Game State Types ===

export interface Player {
  id: string
  username: string
  empire: string
  credits: number
  status_message?: string
  clan_tag?: string
  primary_color?: string
  secondary_color?: string
  is_anonymous?: boolean
  is_cloaked?: boolean
  faction_id?: string
  faction_name?: string
  faction_tag?: string
  home_base_id?: string
  systems_visited?: string[]
  stats?: Record<string, number>
  skill_xp?: Record<string, number>
}

export interface Ship {
  id: string
  class: string
  name: string
  hull: number
  max_hull: number
  shield: number
  max_shield: number
  fuel: number
  max_fuel: number
  cargo_used: number
  cargo_capacity: number
  cargo: CargoItem[]
  modules: Module[]
  cpu_used: number
  cpu_capacity: number
  power_used: number
  power_capacity: number
  speed: number
  weapon_slots: number
  defense_slots: number
  utility_slots: number
}

export interface CargoItem {
  item_id: string
  name: string
  quantity: number
  size: number
}

export interface Module {
  instance_id?: string
  module_id: string
  name: string
  type: string
  slot_type: string
  quality?: number
  wear?: number
  cpu_cost: number
  power_cost: number
}

export interface SystemInfo {
  id: string
  name: string
  empire?: string
  police_level: number
  security_status?: string
  pois: POI[]
  connections: SystemConnection[]
  description?: string
}

export interface POI {
  id: string
  name: string
  type: string
  has_base: boolean
  base_id?: string
  base_name?: string
  online: number
}

export interface SystemConnection {
  system_id: string
  name: string
  distance?: number
}

export interface NearbyPlayer {
  player_id: string
  username?: string
  ship_class?: string
  clan_tag?: string
  primary_color?: string
  secondary_color?: string
  status?: string
  is_anonymous?: boolean
  is_npc?: boolean
  npc_type?: string
}

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

export interface Wreck {
  wreck_id: string
  player_name?: string
  ship_class?: string
  items: { item_id: string; name: string; quantity: number }[]
  credits?: number
  ticks_remaining: number
}

export interface MarketListing {
  listing_id?: string
  order_id?: string
  item_id: string
  item_name: string
  quantity: number
  price_each: number
  seller_id?: string
  seller_name?: string
  type?: string
  source?: string
}

export interface Skill {
  id: string
  name: string
  category: string
  description: string
  max_level: number
  current_level?: number
  current_xp?: number
  xp_to_next?: number
  prerequisites?: Record<string, number>
  bonuses?: string[]
}

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
}

export interface SkillsData {
  skills: Record<string, { level: number; xp: number; next_level_xp: number }>
  message?: string
}

export interface Faction {
  id: string
  name: string
  tag: string
  leader_id?: string
  leader_name?: string
  member_count?: number
  members?: FactionMember[]
  allies?: string[]
  enemies?: string[]
  wars?: FactionWar[]
}

export interface FactionMember {
  player_id: string
  username: string
  role: string
  joined_at?: string
}

export interface FactionWar {
  faction_id: string
  faction_name: string
  our_kills: number
  their_kills: number
  started_at: string
}

export interface BaseInfo {
  id: string
  name: string
  type: string
  owner_id?: string
  owner_name?: string
  faction_id?: string
  faction_name?: string
  defense_level: number
  health?: number
  max_health?: number
  services: string[]
  condition?: string
}

export interface Mission {
  id: string
  type: string
  title: string
  description: string
  reward_credits: number
  reward_items?: { item_id: string; quantity: number }[]
  difficulty: string
  objectives?: MissionObjective[]
  time_limit_ticks?: number
  status?: string
}

export interface MissionObjective {
  description: string
  current: number
  target: number
  completed: boolean
}

export interface Drone {
  drone_id: string
  drone_type: string
  hull: number
  max_hull: number
  damage?: number
  status: string
  target_id?: string
  bandwidth: number
}

export interface EventLogEntry {
  id: string
  type: string
  message: string
  timestamp: number
  data?: Record<string, unknown>
}

// === Response Data Types ===

export interface MarketItem {
  item_id: string
  item_name: string
  sell_orders: { price_each: number; quantity: number; source?: string }[]
  buy_orders: { price_each: number; quantity: number; source?: string }[]
  best_sell: number
  best_buy: number
  spread?: number
}

export interface MarketData {
  action: string
  base: string
  items: MarketItem[]
  message?: string
}

export interface OrderEntry {
  order_id: string
  order_type: string
  item_id: string
  item_name: string
  quantity: number
  remaining: number
  price_each: number
  listing_fee: number
  created_at: string
  faction_order?: boolean
  created_by?: string
}

export interface OrdersData {
  action: string
  base: string
  orders: OrderEntry[]
  faction_orders: OrderEntry[]
}

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

export interface FleetShip {
  ship_id: string
  class_id: string
  class_name?: string
  is_active: boolean
  modules: number
  cargo_used: number
  hull: string
  fuel: string
  location: string
  location_base_id?: string
}

export interface FleetData {
  ships: FleetShip[]
  count: number
  active_ship_id?: string
  active_ship_class?: string
}

export interface StorageItem {
  item_id: string
  name: string
  quantity: number
}

export interface StorageShip {
  ship_id: string
  class_id: string
  class_name?: string
  modules: number
  cargo_used: number
}

export interface StorageGift {
  sender: string
  sender_id: string
  timestamp: string
  items?: StorageItem[]
  credits?: number
  message?: string
}

export interface StorageData {
  base_id: string
  credits: number
  items: StorageItem[]
  ships: StorageShip[]
  gifts?: StorageGift[]
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
  fleetData: FleetData | null
  storageData: StorageData | null
  recipesData: RecipesData | null
  skillsData: SkillsData | null
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
  fleetData: null,
  storageData: null,
  recipesData: null,
  skillsData: null,
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
  | { type: 'SET_FLEET_DATA'; payload: FleetData }
  | { type: 'SET_STORAGE_DATA'; payload: StorageData }
  | { type: 'SET_RECIPES_DATA'; payload: RecipesData }
  | { type: 'SET_SKILLS_DATA'; payload: SkillsData }
  | { type: 'RESET' }
