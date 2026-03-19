'use client'

/**
 * HTTP v2 API client for the SpaceMolt game server.
 *
 * Replaces WebSocket-based sendCommand for all player-initiated actions.
 * Commands go through POST /api/v2/{tool}/{action} with typed responses.
 */

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface V2Session {
  id: string
  player_id?: string
  created_at: string
  expires_at: string
}

export interface V2Error {
  code: string
  message: string
  retry_after?: number
  pending_command?: string
}

export interface V2Notification {
  id: string
  type: string
  timestamp: string
  msg_type: string
  data: unknown
}

export interface V2Response<T = unknown> {
  result?: string | T
  structuredContent?: T
  notifications?: V2Notification[]
  session?: V2Session
  error?: V2Error
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class GameApiError extends Error {
  code: string
  retryAfter?: number
  pendingCommand?: string

  constructor(err: V2Error) {
    super(err.message)
    this.name = 'GameApiError'
    this.code = err.code
    this.retryAfter = err.retry_after
    this.pendingCommand = err.pending_command
  }
}

// ---------------------------------------------------------------------------
// v1 command → v2 tool/action mapping
// ---------------------------------------------------------------------------

interface V2Route {
  tool: string
  action: string
  /** Map of v1 param name → v2 param name (for params that differ) */
  params?: Record<string, string>
}

/**
 * Maps v1 command names (used by existing sendCommand calls) to v2 tool/action.
 * Param renames translate v1 payload keys to v2 keys.
 * Params not listed here pass through unchanged.
 */
const COMMAND_MAP: Record<string, V2Route> = {
  // auth
  login: { tool: 'spacemolt_auth', action: 'login' },
  login_token: { tool: 'spacemolt_auth', action: 'login_token' },
  register: { tool: 'spacemolt_auth', action: 'register' },
  logout: { tool: 'spacemolt_auth', action: 'logout' },
  claim: { tool: 'spacemolt_auth', action: 'claim' },

  // navigation
  travel: { tool: 'spacemolt', action: 'travel', params: { target_poi: 'id' } },
  jump: { tool: 'spacemolt', action: 'jump', params: { target_system: 'id' } },
  dock: { tool: 'spacemolt', action: 'dock' },
  undock: { tool: 'spacemolt', action: 'undock' },
  get_system: { tool: 'spacemolt', action: 'get_system' },
  search_systems: { tool: 'spacemolt', action: 'search_systems' },
  find_route: { tool: 'spacemolt', action: 'find_route', params: { target_system: 'id' } },
  survey_system: { tool: 'spacemolt', action: 'survey_system' },

  // mining & items
  mine: { tool: 'spacemolt', action: 'mine' },
  jettison: { tool: 'spacemolt', action: 'jettison', params: { item_id: 'id' } },
  use_item: { tool: 'spacemolt', action: 'use_item', params: { item_id: 'id' } },

  // trading (buy/sell from station)
  buy: { tool: 'spacemolt', action: 'buy', params: { item_id: 'id' } },
  sell: { tool: 'spacemolt', action: 'sell', params: { item_id: 'id' } },

  // combat
  attack: { tool: 'spacemolt', action: 'attack', params: { target_id: 'id' } },
  scan: { tool: 'spacemolt', action: 'scan', params: { target_id: 'id' } },
  cloak: { tool: 'spacemolt', action: 'cloak' },
  self_destruct: { tool: 'spacemolt', action: 'self_destruct' },

  // ship management
  install_mod: { tool: 'spacemolt', action: 'install_mod', params: { module_id: 'id' } },
  uninstall_mod: { tool: 'spacemolt', action: 'uninstall_mod', params: { module_id: 'id' } },
  repair_module: { tool: 'spacemolt', action: 'repair_module', params: { module_id: 'id' } },
  refuel: { tool: 'spacemolt', action: 'refuel' },
  repair: { tool: 'spacemolt', action: 'repair' },
  craft: { tool: 'spacemolt', action: 'craft', params: { recipe_id: 'id' } },

  // queries
  get_status: { tool: 'spacemolt', action: 'get_status' },
  get_ship: { tool: 'spacemolt', action: 'get_ship' },
  get_cargo: { tool: 'spacemolt', action: 'get_cargo' },
  get_nearby: { tool: 'spacemolt', action: 'get_nearby' },
  get_skills: { tool: 'spacemolt', action: 'get_skills' },
  get_version: { tool: 'spacemolt', action: 'get_version' },
  get_poi: { tool: 'spacemolt', action: 'get_poi' },
  get_base: { tool: 'spacemolt', action: 'get_base' },
  get_map: { tool: 'spacemolt', action: 'get_map' },
  get_ships: { tool: 'spacemolt', action: 'get_ships' },
  help: { tool: 'spacemolt', action: 'help' },

  // missions
  get_missions: { tool: 'spacemolt', action: 'get_missions' },
  get_active_missions: { tool: 'spacemolt', action: 'get_active_missions' },
  accept_mission: { tool: 'spacemolt', action: 'accept_mission', params: { mission_id: 'id' } },
  complete_mission: { tool: 'spacemolt', action: 'complete_mission', params: { mission_id: 'id' } },
  abandon_mission: { tool: 'spacemolt', action: 'abandon_mission', params: { mission_id: 'id' } },
  completed_missions: { tool: 'spacemolt', action: 'completed_missions' },
  view_completed_mission: { tool: 'spacemolt', action: 'view_completed_mission' },

  // market / exchange
  view_market: { tool: 'spacemolt_market', action: 'view_market' },
  view_orders: { tool: 'spacemolt_market', action: 'view_orders' },
  create_sell_order: { tool: 'spacemolt_market', action: 'create_sell_order' },
  create_buy_order: { tool: 'spacemolt_market', action: 'create_buy_order' },
  cancel_order: { tool: 'spacemolt_market', action: 'cancel_order' },
  modify_order: { tool: 'spacemolt_market', action: 'modify_order' },
  estimate_purchase: { tool: 'spacemolt_market', action: 'estimate_purchase' },
  analyze_market: { tool: 'spacemolt_market', action: 'analyze_market' },

  // storage
  view_storage: { tool: 'spacemolt_storage', action: 'view' },
  deposit_items: { tool: 'spacemolt_storage', action: 'deposit' },
  withdraw_items: { tool: 'spacemolt_storage', action: 'withdraw' },
  send_gift: { tool: 'spacemolt_storage', action: 'deposit' }, // gift is a deposit to another player

  // ship exchange
  list_ships: { tool: 'spacemolt_ship', action: 'list_ships' },
  switch_ship: { tool: 'spacemolt_ship', action: 'switch_ship' },
  sell_ship: { tool: 'spacemolt_ship', action: 'sell_ship' },
  buy_ship: { tool: 'spacemolt_ship', action: 'buy_listed_ship' },
  browse_ships: { tool: 'spacemolt_ship', action: 'browse_ships' },
  buy_listed_ship: { tool: 'spacemolt_ship', action: 'buy_listed_ship' },
  shipyard_showroom: { tool: 'spacemolt_ship', action: 'browse_ships' },
  commission_ship: { tool: 'spacemolt_ship', action: 'commission_ship' },
  commission_quote: { tool: 'spacemolt_ship', action: 'commission_quote' },
  commission_status: { tool: 'spacemolt_ship', action: 'commission_status' },
  claim_commission: { tool: 'spacemolt_ship', action: 'claim_commission' },
  cancel_commission: { tool: 'spacemolt_ship', action: 'cancel_commission' },

  // battle
  get_battle_status: { tool: 'spacemolt_battle', action: 'status' },
  battle: { tool: 'spacemolt_battle', action: 'stance' }, // default; caller may override action

  // catalog
  catalog: { tool: 'spacemolt_catalog', action: 'help' }, // catalog passes params directly

  // social
  chat: { tool: 'spacemolt_social', action: 'chat' },
  get_chat_history: { tool: 'spacemolt_social', action: 'get_chat_history' },
  set_status: { tool: 'spacemolt_social', action: 'set_status' },
  set_colors: { tool: 'spacemolt_social', action: 'set_colors' },
  set_anonymous: { tool: 'spacemolt_social', action: 'set_status' },
  get_action_log: { tool: 'spacemolt_social', action: 'get_action_log' },

  // notes
  get_notes: { tool: 'spacemolt_social', action: 'get_notes' },
  create_note: { tool: 'spacemolt_social', action: 'create_note' },
  write_note: { tool: 'spacemolt_social', action: 'write_note' },
  read_note: { tool: 'spacemolt_social', action: 'read_note' },

  // captain's log
  captains_log_add: { tool: 'spacemolt_social', action: 'captains_log_add' },
  captains_log_list: { tool: 'spacemolt_social', action: 'captains_log_list' },
  captains_log_get: { tool: 'spacemolt_social', action: 'captains_log_get' },

  // forum
  forum_list: { tool: 'spacemolt_social', action: 'forum_list' },
  forum_get_thread: { tool: 'spacemolt_social', action: 'forum_get_thread' },
  forum_create_thread: { tool: 'spacemolt_social', action: 'forum_create_thread' },
  forum_reply: { tool: 'spacemolt_social', action: 'forum_reply' },
  forum_upvote: { tool: 'spacemolt_social', action: 'forum_upvote' },

  // faction
  create_faction: { tool: 'spacemolt_faction', action: 'create' },
  join_faction: { tool: 'spacemolt_faction', action: 'join' },
  leave_faction: { tool: 'spacemolt_fleet', action: 'leave' },
  faction_info: { tool: 'spacemolt_faction', action: 'info' },
  faction_list: { tool: 'spacemolt_faction', action: 'list' },
  faction_invite: { tool: 'spacemolt_fleet', action: 'invite' },
  faction_kick: { tool: 'spacemolt_fleet', action: 'kick' },
  faction_promote: { tool: 'spacemolt_faction', action: 'promote' },
  faction_get_invites: { tool: 'spacemolt_faction', action: 'get_invites' },
  faction_decline_invite: { tool: 'spacemolt_faction', action: 'decline_invite' },
  faction_set_ally: { tool: 'spacemolt_faction', action: 'set_ally' },
  faction_set_enemy: { tool: 'spacemolt_faction', action: 'set_enemy' },
  faction_declare_war: { tool: 'spacemolt_faction', action: 'declare_war' },
  faction_propose_peace: { tool: 'spacemolt_faction', action: 'propose_peace' },
  faction_accept_peace: { tool: 'spacemolt_faction', action: 'accept_peace' },
  faction_edit: { tool: 'spacemolt_faction_admin', action: 'edit' },
  faction_rooms: { tool: 'spacemolt_faction', action: 'rooms' },
  faction_visit_room: { tool: 'spacemolt_faction', action: 'visit_room' },
  faction_write_room: { tool: 'spacemolt_faction', action: 'write_room' },
  faction_delete_room: { tool: 'spacemolt_faction', action: 'delete_room' },
  faction_submit_intel: { tool: 'spacemolt_intel', action: 'submit_intel' },
  faction_query_intel: { tool: 'spacemolt_intel', action: 'query_intel' },
  faction_intel_status: { tool: 'spacemolt_intel', action: 'intel_status' },

  // salvage / wrecks / insurance
  get_wrecks: { tool: 'spacemolt_salvage', action: 'wrecks' },
  loot_wreck: { tool: 'spacemolt_salvage', action: 'loot' },
  salvage_wreck: { tool: 'spacemolt_salvage', action: 'salvage' },
  tow_wreck: { tool: 'spacemolt_salvage', action: 'tow' },
  release_tow: { tool: 'spacemolt_salvage', action: 'release' },
  sell_wreck: { tool: 'spacemolt_salvage', action: 'sell' },
  scrap_wreck: { tool: 'spacemolt_salvage', action: 'scrap' },
  get_insurance_quote: { tool: 'spacemolt_salvage', action: 'quote' },
  buy_insurance: { tool: 'spacemolt_salvage', action: 'insure' },
  set_home_base: { tool: 'spacemolt_salvage', action: 'set_home' },

  // P2P trading
  trade_offer: { tool: 'spacemolt_transfer', action: 'trade_offer' },
  trade_accept: { tool: 'spacemolt_transfer', action: 'trade_accept' },
  trade_decline: { tool: 'spacemolt_transfer', action: 'trade_decline' },
  trade_cancel: { tool: 'spacemolt_transfer', action: 'trade_cancel' },
  get_trades: { tool: 'spacemolt_transfer', action: 'get_trades' },

  // facility
  facility: { tool: 'spacemolt_facility', action: 'list' }, // action-dispatched; caller provides action

  // base
  build_base: { tool: 'spacemolt', action: 'help' }, // hidden
  get_base_cost: { tool: 'spacemolt', action: 'help' }, // hidden
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export type NotificationHandler = (notifications: V2Notification[]) => void

export class GameApi {
  private sessionId: string | null = null
  private onNotifications: NotificationHandler | null = null
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || GAME_SERVER) + '/api/v2'
  }

  setNotificationHandler(handler: NotificationHandler) {
    this.onNotifications = handler
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  /** Create an unauthenticated HTTP v2 session. */
  async createSession(): Promise<V2Session> {
    const resp = await fetch(`${this.baseUrl}/session`, { method: 'POST' })
    const data = (await resp.json()) as V2Response
    if (data.error) throw new GameApiError(data.error)
    this.sessionId = data.session!.id
    return data.session!
  }

  /** Authenticate the session using a ws-token. */
  async loginToken(token: string): Promise<V2Response> {
    return this.callRaw('spacemolt_auth', 'login_token', { token })
  }

  /**
   * Execute a command using v1 command name and v1 params.
   * Routes through the v2 API with automatic param translation.
   * Returns the structuredContent (or result if no structuredContent).
   */
  async command(v1Command: string, v1Params?: Record<string, unknown>): Promise<unknown> {
    const route = COMMAND_MAP[v1Command]
    if (!route) {
      throw new Error(`Unknown command: ${v1Command}. Add it to COMMAND_MAP in gameApi.ts`)
    }

    // Translate v1 param names to v2 param names
    let v2Params: Record<string, unknown> = {}
    if (v1Params) {
      const renames = route.params || {}
      for (const [k, v] of Object.entries(v1Params)) {
        const v2Key = renames[k] || k
        v2Params[v2Key] = v
      }
    }

    // For action-dispatched tools (storage, facility, battle), the v1 "action"
    // field maps to different v2 actions. The route.action is the default,
    // but some commands override it based on the v1 params.
    let action = route.action

    // Special case: catalog sends type as a param, not as action
    if (v1Command === 'catalog') {
      return this.callStructured('spacemolt_catalog', 'help', v2Params)
    }

    // Special case: battle dispatches on action field
    if (v1Command === 'battle' && v1Params?.action) {
      action = v1Params.action as string
      delete v2Params.action
    }

    return this.callStructured(route.tool, action, v2Params)
  }

  /**
   * Low-level call returning the full V2Response wrapper.
   */
  async callRaw(tool: string, action: string, params?: Record<string, unknown>): Promise<V2Response> {
    if (!this.sessionId) {
      throw new Error('No session. Call createSession() first.')
    }

    const resp = await fetch(`${this.baseUrl}/${tool}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': this.sessionId,
      },
      body: JSON.stringify(params || {}),
    })

    const data = (await resp.json()) as V2Response

    // Process piggybacked notifications
    if (data.notifications && this.onNotifications) {
      this.onNotifications(data.notifications as V2Notification[])
    }

    // Update session info
    if (data.session) {
      this.sessionId = data.session.id
    }

    if (data.error) {
      throw new GameApiError(data.error)
    }

    return data
  }

  /**
   * Call that extracts structuredContent, falling back to result.
   */
  async callStructured<T = unknown>(tool: string, action: string, params?: Record<string, unknown>): Promise<T> {
    const data = await this.callRaw(tool, action, params)
    return (data.structuredContent ?? data.result) as T
  }
}
