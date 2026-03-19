'use client'

import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useWebSocket } from './useWebSocket'
import { useGameState } from './useGameState'
import { GameApi } from '@/lib/gameApi'
import type {
  GameState, WSMessage, GameAction, WelcomePayload, StateUpdate, ChatMessage, TradeOffer,
  ShipCatalogData, ShowroomData, FleetData, StorageData, MarketData, OrdersData,
  RecipesData, SkillsData, Player, Ship, NearbyPlayer,
} from './types'

interface GameContextValue {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  /** Raw WS send — only for initial login_token auth handshake */
  send: (msg: WSMessage) => void
  sendCommand: (type: string, payload?: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** HTTP v2 API client — available after session is created */
  api: GameApi | null
  /** Set the API instance after auth completes */
  setApi: (api: GameApi) => void
  connect: () => void
  disconnect: () => void
  readyState: number
  sessionReplaced: boolean
  onSwitchPlayer?: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

interface GameProviderProps {
  children: ReactNode
  onSwitchPlayer?: () => void
}

export function GameProvider({ children, onSwitchPlayer }: GameProviderProps) {
  const [state, dispatch] = useGameState()
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
  const sendRef = useRef<(msg: WSMessage) => void>(() => {})
  const apiRef = useRef<GameApi | null>(null)

  // Legacy callback tracking — only used during transition for WS-originated responses
  const pendingCallbacksRef = useRef<Map<string, (payload: Record<string, unknown>) => void>>(new Map())
  const reqIdRef = useRef(0)

  const onMessage = useCallback((msg: WSMessage) => {
    const d = dispatchRef.current
    const p = msg.payload || {}

    switch (msg.type) {
      case 'welcome':
        d({ type: 'WELCOME', payload: p as unknown as WelcomePayload })
        break
      case 'registered':
        d({ type: 'REGISTERED', payload: p as { password: string; player_id: string } })
        break
      case 'logged_in':
        d({ type: 'LOGGED_IN', payload: p })
        break
      case 'state_update':
        d({ type: 'STATE_UPDATE', payload: p as unknown as StateUpdate })
        break
      case 'tick':
        d({ type: 'TICK', tick: (p.tick as number) || 0 })
        break
      case 'action_result': {
        // Deferred mutation result from the engine (travel, jump, mine, attack, etc.)
        const arTick = p.tick as number
        if (arTick > 0) d({ type: 'TICK', tick: arTick })

        const result = (p.result || {}) as Record<string, unknown>
        d({ type: 'OK', payload: result })

        const arAction = result.action as string | undefined
        // Resolve pending sendCommand promise using _req_id or command field
        const arReqId = (result._req_id || p._req_id) as string | undefined
        const arCommand = p.command as string | undefined
        const arKey = arReqId || arCommand
        if (arKey) {
          const cb = pendingCallbacksRef.current.get(arKey)
          if (cb) {
            pendingCallbacksRef.current.delete(arKey)
            cb(result)
          }
        }

        // Auto-refresh system data after arriving at a POI or jumping to a new system
        if (arAction === 'arrived' || arAction === 'jumped') {
          sendRef.current({ type: 'get_system' })
        }

        // Handle auto dock/undock flags
        if (p.auto_docked) {
          d({ type: 'OK', payload: { action: 'dock', base: 'station' } })
        }
        if (p.auto_undocked) {
          d({ type: 'OK', payload: { action: 'undock' } })
        }
        break
      }
      case 'action_error': {
        // Deferred mutation error from the engine
        const aeTick = p.tick as number
        if (aeTick > 0) d({ type: 'TICK', tick: aeTick })

        d({ type: 'ERROR', payload: { code: (p.code as string) || 'action_error', message: (p.message as string) || 'Action failed' } })

        // Resolve pending sendCommand promise
        const aeReqId = p._req_id as string | undefined
        const aeCommand = p.command as string | undefined
        const aeKey = aeReqId || aeCommand
        if (aeKey) {
          const cb = pendingCallbacksRef.current.get(aeKey)
          if (cb) {
            pendingCallbacksRef.current.delete(aeKey)
            cb({ error: true, code: p.code, message: p.message } as Record<string, unknown>)
          }
        }
        break
      }
      case 'ok': {
        d({ type: 'OK', payload: p })
        window.dispatchEvent(new CustomEvent('spacemolt:ok', { detail: p }))
        const action = (p as Record<string, unknown>).action as string | undefined
        // Resolve pending sendCommand promise if any
        const okReqId = (p as Record<string, unknown>)._req_id as string | undefined
        const okKey = okReqId || action
        if (okKey) {
          const cb = pendingCallbacksRef.current.get(okKey)
          if (cb) {
            pendingCallbacksRef.current.delete(okKey)
            cb(p as Record<string, unknown>)
          }
        }
        // Auto-refresh system data after arriving at a POI or jumping to a new system
        if (action === 'arrived' || action === 'jumped') {
          sendRef.current({ type: 'get_system' })
        }
        // Route get_status responses to STATUS_POLL
        if (action === 'get_status') {
          const player = (p as Record<string, unknown>).player as Player | undefined
          const ship = (p as Record<string, unknown>).ship as Ship | undefined
          if (player && ship) {
            d({ type: 'STATUS_POLL', payload: { player, ship } })
          }
        }
        // Route get_nearby responses to SET_NEARBY
        if (action === 'get_nearby') {
          const players = ((p as Record<string, unknown>).players || []) as NearbyPlayer[]
          const pirates = ((p as Record<string, unknown>).pirates || []) as NearbyPlayer[]
          d({ type: 'SET_NEARBY', payload: [...players, ...pirates] })
        }
        // catalog response: convert items array to recipes map
        if (action === 'catalog' && (p.type as string) === 'recipes' && Array.isArray(p.items)) {
          const recipes: Record<string, unknown> = {}
          for (const item of p.items as Array<{ id: string }>) { recipes[item.id] = item }
          d({ type: 'MERGE_RECIPES_DATA', payload: { recipes, total: p.total as number, page: p.page as number } as unknown as RecipesData })
        }
        // Classify responses without action field by structure
        if (!action) {
          // shipyard_showroom: has base_id + shipyard_level + ships array
          if ('shipyard_level' in p && Array.isArray(p.ships) && 'base_id' in p) {
            d({ type: 'SET_SHOWROOM_DATA', payload: p as unknown as ShowroomData })
          }
          // get_ships: has ships array + count + message (ship catalog)
          else if (Array.isArray(p.ships) && 'count' in p && 'message' in p && !('active_ship_id' in p)) {
            d({ type: 'SET_SHIP_CATALOG', payload: p as unknown as ShipCatalogData })
          }
          // list_ships: has ships array + count + active_ship_id (player fleet)
          else if (Array.isArray(p.ships) && 'count' in p && ('active_ship_id' in p || !('message' in p))) {
            d({ type: 'SET_FLEET_DATA', payload: p as unknown as FleetData })
          }
          // view_storage: has base_id + items array
          else if ('base_id' in p && Array.isArray(p.items) && !('shipyard_level' in p)) {
            d({ type: 'SET_STORAGE_DATA', payload: p as unknown as StorageData })
          }
          // get_recipes: has recipes object (map of recipe_id -> recipe)
          else if ('recipes' in p && typeof p.recipes === 'object' && !Array.isArray(p.recipes)) {
            d({ type: 'SET_RECIPES_DATA', payload: p as unknown as RecipesData })
          }
          // catalog recipes (no action field): has type='recipes' + items array
          else if ((p.type as string) === 'recipes' && Array.isArray(p.items) && 'total' in p) {
            const recipes: Record<string, unknown> = {}
            for (const item of p.items as Array<{ id: string }>) { recipes[item.id] = item }
            d({ type: 'MERGE_RECIPES_DATA', payload: { recipes, total: p.total as number, page: p.page as number } as unknown as RecipesData })
          }
          // get_skills: has skills object + message
          else if ('skills' in p && typeof p.skills === 'object' && 'message' in p) {
            d({ type: 'SET_SKILLS_DATA', payload: p as unknown as SkillsData })
          }
          // get_status: has player + ship + modules (no action field)
          else if ('player' in p && 'ship' in p && 'modules' in p) {
            const player = p.player as Player | undefined
            const ship = p.ship as Ship | undefined
            if (player && ship) {
              d({ type: 'STATUS_POLL', payload: { player, ship } })
            }
          }
          // get_base_wrecks: has wrecks array
          else if (Array.isArray(p.wrecks)) {
            window.dispatchEvent(new CustomEvent('spacemolt:wrecks', { detail: p.wrecks }))
          }
        }
        break
      }
      case 'rate_limited': {
        const retryAfter = p.retry_after as number | undefined
        const rlMsg = retryAfter
          ? `Rate limited. Retry after tick ${retryAfter}.`
          : (p.message as string) || 'Rate limited. Wait for next tick.'
        d({ type: 'ERROR', payload: { code: 'rate_limited', message: rlMsg } })
        break
      }
      case 'error':
        d({ type: 'ERROR', payload: p as { code: string; message: string } })
        break
      case 'combat_update':
        d({ type: 'COMBAT_UPDATE', payload: p })
        break
      case 'player_died':
        d({ type: 'PLAYER_DIED', payload: p })
        break
      case 'mining_yield':
        d({ type: 'MINING_YIELD', payload: p })
        break
      case 'chat_message':
        d({ type: 'CHAT_MESSAGE', payload: p as unknown as ChatMessage })
        break
      case 'trade_offer_received':
        d({ type: 'TRADE_OFFER_RECEIVED', payload: p as unknown as TradeOffer })
        break
      case 'scan_result':
        d({ type: 'SCAN_RESULT', payload: p })
        break
      case 'scan_detected':
        d({ type: 'SCAN_DETECTED', payload: p })
        break
      case 'poi_arrival':
        d({ type: 'POI_ARRIVAL', payload: p })
        break
      case 'poi_departure':
        d({ type: 'POI_DEPARTURE', payload: p })
        break
      case 'pilotless_ship':
        d({ type: 'PILOTLESS_SHIP', payload: p })
        break
      case 'skill_level_up':
        d({ type: 'SKILL_LEVEL_UP', payload: p })
        break
      case 'police_warning':
      case 'police_spawn':
      case 'police_combat':
        d({ type: 'POLICE_WARNING', payload: p })
        break
      case 'drone_update':
      case 'drone_destroyed':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'drone',
          message: (p.message as string) || `Drone ${msg.type === 'drone_destroyed' ? 'destroyed' : 'update'}`,
          timestamp: Date.now(),
        }})
        break
      case 'base_raid_update':
      case 'base_destroyed':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'base',
          message: (p.message as string) || `Base ${msg.type === 'base_destroyed' ? 'destroyed' : 'under attack'}`,
          timestamp: Date.now(),
        }})
        break
      case 'reconnected':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'system',
          message: (p.message as string) || 'Reconnected to ship',
          timestamp: Date.now(),
        }})
        break
      case 'queue_cleared':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'system',
          message: 'Action queue cleared',
          timestamp: Date.now(),
        }})
        break
    }
  }, [])

  const onConnect = useCallback(() => {
    dispatchRef.current({ type: 'SET_CONNECTED', connected: true })
  }, [])

  const onDisconnect = useCallback((reason?: 'session_replaced' | 'error') => {
    dispatchRef.current({ type: 'SET_CONNECTED', connected: false })
    if (reason === 'session_replaced') {
      dispatchRef.current({ type: 'ADD_EVENT', entry: {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: 'system',
        message: 'Session replaced by another tab or device',
        timestamp: Date.now(),
      }})
    }
  }, [])

  const { connect, disconnect, send, readyState, sessionReplaced } = useWebSocket({
    onMessage,
    onConnect,
    onDisconnect,
  })
  sendRef.current = send

  // Keep refs for polling to avoid stale closures in setInterval
  const readyStateRef = useRef(readyState)
  readyStateRef.current = readyState
  const stateRef = useRef(state)
  stateRef.current = state

  // Poll get_status every 5 seconds via HTTP v2 when authenticated
  useEffect(() => {
    if (!state.authenticated) return
    const interval = setInterval(async () => {
      if (!stateRef.current.authenticated || !apiRef.current) return
      try {
        const result = await apiRef.current.command('get_status') as Record<string, unknown>
        const player = result.player as Player | undefined
        const ship = result.ship as Ship | undefined
        if (player && ship) {
          dispatchRef.current({ type: 'STATUS_POLL', payload: { player, ship } })
        }
      } catch {
        // Polling failure is non-critical
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [state.authenticated])

  // Poll get_nearby every 10 seconds via HTTP v2 when authenticated and not docked
  useEffect(() => {
    if (!state.authenticated || state.isDocked) return
    const interval = setInterval(async () => {
      if (!stateRef.current.authenticated || stateRef.current.isDocked || !apiRef.current) return
      try {
        const result = await apiRef.current.command('get_nearby') as Record<string, unknown>
        const players = (result.players || []) as NearbyPlayer[]
        const pirates = (result.pirates || []) as NearbyPlayer[]
        dispatchRef.current({ type: 'SET_NEARBY', payload: [...players, ...pirates] })
      } catch {
        // Polling failure is non-critical
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [state.authenticated, state.isDocked])

  /**
   * Send a command via HTTP v2 API. Falls back to WebSocket if API not available.
   * The response is dispatched to the reducer via OK action (same as WS path)
   * for backward compatibility during migration.
   */
  const sendCommand = useCallback((type: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const api = apiRef.current
    if (api) {
      // HTTP v2 path — command goes over HTTP, response is immediate
      return api.command(type, payload).then((result) => {
        const r = (result || {}) as Record<string, unknown>
        // Dispatch through the reducer for state updates (same as WS OK handler)
        dispatchRef.current({ type: 'OK', payload: r })
        // Auto-refresh system data after navigation
        const action = r.action as string | undefined
        if (action === 'arrived' || action === 'jumped') {
          api.command('get_system').then((sysResult) => {
            dispatchRef.current({ type: 'OK', payload: (sysResult || {}) as Record<string, unknown> })
          }).catch(() => {})
        }
        return r
      }).catch((err) => {
        const errPayload = {
          error: true,
          code: err.code || 'command_error',
          message: err.message || 'Command failed',
        }
        dispatchRef.current({ type: 'ERROR', payload: { code: errPayload.code, message: errPayload.message } })
        return errPayload as Record<string, unknown>
      })
    }

    // Fallback: WebSocket path (used before API session is established)
    return new Promise((resolve) => {
      const reqId = `${type}:${++reqIdRef.current}`
      pendingCallbacksRef.current.set(reqId, resolve)
      const msg: WSMessage = { type }
      if (payload) msg.payload = { ...payload, _req_id: reqId }
      else msg.payload = { _req_id: reqId }
      send(msg)
    })
  }, [send])

  const setApi = useCallback((api: GameApi) => {
    apiRef.current = api
  }, [])

  const value: GameContextValue = {
    state,
    dispatch,
    send,
    sendCommand,
    api: apiRef.current,
    setApi,
    connect,
    disconnect,
    readyState,
    sessionReplaced,
    onSwitchPlayer,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
