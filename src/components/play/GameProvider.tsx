'use client'

import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useWebSocket } from './useWebSocket'
import { useGameState } from './useGameState'
import { GameApi, MUTATION_COMMANDS } from '@/lib/gameApi'
import type {
  GameState, WSMessage, GameAction, WelcomePayload, StateUpdate, ChatMessage, TradeOffer,
  MarketData, OrdersData, StorageData, FleetData, ShowroomData, ShipCatalogData,
  RecipesData, SkillsData, Player, Ship, NearbyPlayer, EnrichedShipModule,
} from './types'

interface GameContextValue {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  /** Raw WS send — only for login_token auth in PlayClient */
  wsSend: (msg: WSMessage) => void
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

// HTTP v2 mutations opt every request into v2 state deltas (see gameserver's
// WrapWithDelta/buildArrivalDelta), so ANY mutation response that isn't a bare
// `{queued: true}` ack — a completed dock/mine/craft/salvage/etc. just as much
// as a deferred travel/jump arrival delivered later over WS — comes back as a
// V2GameState with the original typed response (action, poi, base, message,
// recipe, xp_gained, ...) nested entirely under `details` instead of at the
// top level. Merge `details` back over the top level so callers keep seeing
// the flat shape they did before v2 deltas existed, while still keeping any
// delta-only fields (player/ship/location/etc.) that have no top-level
// equivalent in `details`.
export function unwrapActionResult(rawResult: Record<string, unknown>): Record<string, unknown> {
  const details = rawResult.details
  return details && typeof details === 'object'
    ? { ...rawResult, ...(details as Record<string, unknown>) }
    : rawResult
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
  const apiRef = useRef<GameApi | null>(null)

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

        const result = unwrapActionResult((p.result || {}) as Record<string, unknown>)
        d({ type: 'OK', payload: result })

        const arAction = result.action as string | undefined

        // Auto-refresh system and POI data after navigation via HTTP v2
        if (arAction === 'arrived' || arAction === 'jumped') {
          apiRef.current?.command('get_system').then((sysResult) => {
            d({ type: 'OK', payload: (sysResult || {}) as Record<string, unknown> })
          }).catch(() => {})
          apiRef.current?.command('get_poi').then((poiResult) => {
            const pr = (poiResult || {}) as Record<string, unknown>
            const poiData = pr.poi as Record<string, unknown> | undefined
            const richResources = pr.resources as Array<Record<string, unknown>> | undefined
            if (poiData) {
              if (richResources && Array.isArray(richResources)) {
                poiData.resources = richResources
              }
              d({ type: 'OK', payload: { action: 'get_poi', poi: poiData } })
            }
          }).catch(() => {})
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
        break
      }
      case 'ok': {
        // WS ok messages are rare now — mostly login_token auth responses.
        // Data-setting commands go through HTTP v2 → sendCommand → typed dispatch.
        d({ type: 'OK', payload: p })
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
      // Battle notifications — drive combat state (inCombat + live battle snapshot)
      case 'battle_started':
      case 'battle_joined':
      case 'battle_update':
      case 'battle_damage':
      case 'battle_left':
      case 'battle_ended':
      case 'battle_alert':
        d({ type: 'BATTLE_PUSH', kind: msg.type, payload: p })
        break
      // Pirate encounters
      case 'pirate_radio':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'combat',
          message: (p.message as string) || 'Pirate radio broadcast',
          timestamp: Date.now(),
        }})
        break
      case 'pirate_destroyed':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'combat',
          message: (p.message as string) || 'Pirate destroyed',
          timestamp: Date.now(),
        }})
        break
      // Trade completions
      case 'trade_complete':
      case 'trade_declined':
      case 'trade_cancelled':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'trade',
          message: (p.message as string) || msg.type.replace(/_/g, ' '),
          timestamp: Date.now(),
        }})
        break
      // Crafting completions — each tick a queued job deposits output, the
      // server pushes a crafting_update naming what was made and where. Surface
      // it in the event log so async crafting is visible without polling.
      case 'crafting_update': {
        const jobs = (p.jobs as Array<Record<string, unknown>>) || []
        for (const j of jobs) {
          const recipe = (j.recipe as string) || 'job'
          const mode = (j.mode as string) === 'recycle' ? 'Recycled' : 'Crafted'
          const deposited = ((j.deposited as Array<Record<string, unknown>>) || [])
            .map((dItem) => `${dItem.quantity}x ${dItem.item_name || dItem.item_id}`)
            .join(', ')
          const completed = !!j.completed
          const remaining = (j.runs_remaining as number) ?? 0
          let message = `${mode} ${recipe}`
          if (deposited) message += ` → ${deposited}`
          if (completed) message += ' (job complete)'
          else if (remaining > 0) message += ` (${remaining} run${remaining === 1 ? '' : 's'} left)`
          d({ type: 'ADD_EVENT', entry: {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            type: 'crafting',
            message,
            timestamp: Date.now(),
          }})
        }
        // Also patch the live job-queue state so progress bars update
        // immediately instead of waiting for a manual refresh.
        if (jobs.length > 0) {
          d({
            type: 'PATCH_CRAFT_JOBS',
            tick: (p.tick as number) ?? 0,
            jobs: jobs.map(j => ({
              job_id: j.job_id as string,
              runs_done_delta: (j.runs_done as number) ?? 0,
              runs_remaining: (j.runs_remaining as number) ?? 0,
              completed: !!j.completed,
            })),
          })
        }
        break
      }
      // Skill XP gain
      case 'skill_xp_gain':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'info',
          message: `+${p.xp_gained || '?'} XP: ${((p.skill_id as string) || 'unknown').replace(/_/g, ' ')}`,
          timestamp: Date.now(),
        }})
        break
      // Player kill
      case 'player_kill':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'combat',
          message: (p.message as string) || `Destroyed ${p.victim || 'target'}`,
          timestamp: Date.now(),
        }})
        break
      // Gameplay tips
      case 'gameplay_tip':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'info',
          message: (p.message as string) || (p.tip as string) || 'Tip',
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

  // Keep refs for polling to avoid stale closures in setInterval
  const stateRef = useRef(state)
  stateRef.current = state

  // Poll get_status every 5 seconds via HTTP v2 when authenticated
  useEffect(() => {
    if (!state.authenticated) return
    const interval = setInterval(async () => {
      if (!stateRef.current.authenticated || !apiRef.current) return
      try {
        const [statusResult, cargoResult] = await Promise.all([
          apiRef.current.command('get_status') as Promise<Record<string, unknown>>,
          apiRef.current.command('get_cargo') as Promise<Record<string, unknown>>,
        ])
        const player = statusResult.player as Player | undefined
        const ship = statusResult.ship as Ship | undefined
        const modules = statusResult.modules as EnrichedShipModule[] | undefined
        if (player && ship) {
          // Merge cargo data from v2 get_cargo (has enriched item names)
          const cargoItems = cargoResult.cargo as Array<Record<string, unknown>> | undefined
          if (cargoItems && Array.isArray(cargoItems)) {
            // v2 uses item_name, ship type uses name — normalize
            (ship as Record<string, unknown>).cargo = cargoItems.map(c => ({
              item_id: c.item_id,
              name: c.item_name || c.name || c.item_id,
              quantity: c.quantity,
              size: c.size,
            }))
          }
          // v2 get_cargo includes ship with cargo_used/cargo_capacity
          const cargoShip = cargoResult.ship as Record<string, unknown> | undefined
          if (cargoShip) {
            if (typeof cargoShip.cargo_used === 'number') (ship as Record<string, unknown>).cargo_used = cargoShip.cargo_used
            if (typeof cargoShip.cargo_capacity === 'number') (ship as Record<string, unknown>).cargo_capacity = cargoShip.cargo_capacity
          }
          // Extract docked state from location data
          const location = statusResult.location as Record<string, unknown> | undefined
          const dockedAt = location?.docked_at as string | undefined
          dispatchRef.current({ type: 'STATUS_POLL', payload: { player, ship, modules, dockedAt } })
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
   * Send a command via HTTP v2 API. Dispatches typed reducer actions for
   * data-setting commands; falls back to generic OK dispatch for the rest.
   */
  const sendCommand = useCallback((type: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const api = apiRef.current
    if (!api) {
      return Promise.reject(new Error('API not initialized — auth may not be complete'))
    }

    const isMutation = MUTATION_COMMANDS.has(type)
    if (isMutation) {
      let estimatedMs: number | undefined
      // Estimate travel time from POI distance and ship speed
      if (type === 'travel' && payload?.target_poi) {
        const s = stateRef.current
        const ship = s.ship
        const currentPoi = s.poi
        const targetPoi = s.system?.pois?.find(
          (p: { id: string }) => p.id === payload.target_poi
        )
        if (ship && currentPoi?.position && targetPoi?.position) {
          const dx = (targetPoi.position.x ?? 0) - (currentPoi.position.x ?? 0)
          const dy = (targetPoi.position.y ?? 0) - (currentPoi.position.y ?? 0)
          const distance = Math.sqrt(dx * dx + dy * dy)
          const speed = Math.max(0.1, ship.speed ?? 1)
          const travelTicks = Math.max(1, Math.ceil(distance / speed))
          estimatedMs = travelTicks * 10000
        }
      } else if (type === 'jump') {
        const speed = stateRef.current.ship?.speed ?? 1
        estimatedMs = Math.max(10, 70 - 10 * speed) * 1000
      }
      dispatchRef.current({ type: 'SET_PENDING_ACTION', command: type, estimatedMs })
    }

    return api.command(type, payload).then((result) => {
      const r = unwrapActionResult((result || {}) as Record<string, unknown>)
      const d = dispatchRef.current

      // Dispatch typed actions for data-setting commands
      switch (type) {
        case 'get_status': {
          // Route through STATUS_POLL, not generic OK (avoids "Current game state" event spam)
          const player = r.player as Player | undefined
          const ship = r.ship as Ship | undefined
          const modules = r.modules as EnrichedShipModule[] | undefined
          const loc = r.location as Record<string, unknown> | undefined
          const dockedAtStatus = loc?.docked_at as string | undefined
          if (player && ship) {
            d({ type: 'STATUS_POLL', payload: { player, ship, modules, dockedAt: dockedAtStatus } })
          }
          break
        }
        case 'view_market':
          d({ type: 'SET_MARKET_DATA', payload: r as unknown as MarketData })
          break
        case 'view_orders':
          d({ type: 'SET_ORDERS_DATA', payload: r as unknown as OrdersData })
          break
        case 'view_storage':
          d({ type: 'SET_STORAGE_DATA', payload: r as unknown as StorageData })
          break
        case 'list_ships':
          d({ type: 'SET_FLEET_DATA', payload: r as unknown as FleetData })
          break
        case 'shipyard_showroom':
          d({ type: 'SET_SHOWROOM_DATA', payload: r as unknown as ShowroomData })
          break
        case 'get_ships':
          d({ type: 'SET_SHIP_CATALOG', payload: r as unknown as ShipCatalogData })
          break
        case 'get_skills':
          d({ type: 'SET_SKILLS_DATA', payload: r as unknown as SkillsData })
          break
        case 'get_poi': {
          // Merge rich POI data (description, resources) into state.poi
          // The top-level 'resources' array has display names; merge into poi.resources
          const poiData = r.poi as Record<string, unknown> | undefined
          const richResources = r.resources as Array<Record<string, unknown>> | undefined
          if (poiData) {
            if (richResources && Array.isArray(richResources)) {
              poiData.resources = richResources
            }
            d({ type: 'OK', payload: { action: 'get_poi', poi: poiData } })
          }
          break
        }
        case 'catalog':
          if ((r.type as string) === 'recipes' && Array.isArray(r.items)) {
            const recipes: Record<string, unknown> = {}
            for (const item of r.items as Array<{ id: string }>) { recipes[item.id] = item }
            d({ type: 'MERGE_RECIPES_DATA', payload: { recipes, total: r.total as number, page: r.page as number } as unknown as RecipesData })
          }
          break
        default:
          // Inject action name for commands whose v2 response doesn't include one,
          // so the reducer can identify the response type
          if (!r.action) {
            r.action = type
          }
          d({ type: 'OK', payload: r })
          break
      }

      // Auto-refresh system and POI data after navigation
      const action = r.action as string | undefined
      if (action === 'arrived' || action === 'jumped') {
        api.command('get_system').then((sysResult) => {
          d({ type: 'OK', payload: (sysResult || {}) as Record<string, unknown> })
        }).catch(() => {})
        api.command('get_poi').then((poiResult) => {
          const pr = (poiResult || {}) as Record<string, unknown>
          const poiData = pr.poi as Record<string, unknown> | undefined
          const richResources = pr.resources as Array<Record<string, unknown>> | undefined
          if (poiData) {
            if (richResources && Array.isArray(richResources)) {
              poiData.resources = richResources
            }
            d({ type: 'OK', payload: { action: 'get_poi', poi: poiData } })
          }
        }).catch(() => {})
      }
      if (isMutation) {
        dispatchRef.current({ type: 'CLEAR_PENDING_ACTION' })
      }
      return r
    }).catch((err) => {
      if (isMutation) {
        dispatchRef.current({ type: 'CLEAR_PENDING_ACTION' })
      }
      const errPayload = {
        error: true,
        code: err.code || 'command_error',
        message: err.message || 'Command failed',
      }
      dispatchRef.current({ type: 'ERROR', payload: { code: errPayload.code, message: errPayload.message } })
      return errPayload as Record<string, unknown>
    })
  }, [])

  const setApi = useCallback((api: GameApi) => {
    apiRef.current = api
  }, [])

  const value: GameContextValue = {
    state,
    dispatch,
    wsSend: send,
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
