'use client'

import { useReducer } from 'react'
import type {
  GameState, GameAction, StateUpdate, ChatMessage,
  Player, Ship, SystemInfo, POI, TradeOffer,
  initialGameState as _init,
} from './types'

const MAX_CHAT = 200
const MAX_EVENTS = 100

function makeEventId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function addEvent(state: GameState, type: string, message: string, data?: Record<string, unknown>): GameState {
  const entry = { id: makeEventId(), type, message, timestamp: Date.now(), data }
  const eventLog = [entry, ...state.eventLog].slice(0, MAX_EVENTS)
  return { ...state, eventLog }
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected }

    case 'WELCOME':
      return { ...state, welcome: action.payload }

    case 'REGISTERED':
      return addEvent({ ...state, authenticated: true }, 'system', 'Registration successful! Credentials saved.')

    case 'LOGGED_IN': {
      const p = action.payload
      const player = (p.player || null) as Player | null
      const ship = (p.ship || null) as Ship | null
      const system = (p.system || null) as SystemInfo | null
      const poi = (p.poi || null) as POI | null
      const pendingTrades = (p.pending_trades || []) as TradeOffer[]
      const recentChat = (p.recent_chat || []) as ChatMessage[]
      const isDocked = player ? !!(player as unknown as Record<string, unknown>).docked_at_base : false

      let newState = {
        ...state,
        authenticated: true,
        player,
        ship,
        system,
        poi,
        pendingTrades,
        recentChat,
        chatMessages: [...recentChat, ...state.chatMessages].slice(0, MAX_CHAT),
        isDocked,
      }
      newState = addEvent(newState, 'system', `Logged in as ${player?.username || 'unknown'}`)
      return newState
    }

    case 'STATE_UPDATE': {
      const su = action.payload as StateUpdate
      const newState: GameState = {
        ...state,
        currentTick: su.tick,
        player: su.player || state.player,
        ship: su.ship || state.ship,
        nearby: su.nearby || state.nearby,
        inCombat: su.in_combat || false,
        travelProgress: su.travel_progress ?? null,
        travelDestination: su.travel_destination ?? null,
        travelType: su.travel_type ?? null,
        travelArrivalTick: su.travel_arrival_tick ?? null,
        isDocked: su.player ? !!(su.player as unknown as Record<string, unknown>).docked_at_base : state.isDocked,
      }
      // If server sends player data but we're not authenticated yet,
      // the registered/logged_in messages were likely lost — treat as authenticated
      if (su.player && !state.authenticated) {
        newState.authenticated = true
      }
      return newState
    }

    case 'TICK':
      return { ...state, currentTick: action.tick }

    case 'OK': {
      const p = action.payload
      const actionName = p.action as string | undefined
      if (actionName === 'arrived') {
        // Update current POI when arriving at a new POI
        const newPoi = p.poi_data as POI | undefined
        const newState = newPoi ? { ...state, poi: newPoi } : state
        return addEvent(newState, 'travel', `Arrived at ${p.poi || 'destination'}`)
      }
      if (actionName === 'get_system') {
        // Update system and POI state from get_system response
        const sys = p.system as SystemInfo | undefined
        const poiData = p.poi as POI | undefined
        return {
          ...state,
          system: sys || state.system,
          poi: poiData || state.poi,
        }
      }
      if (actionName === 'jumped') {
        // Jumped to a new system - system name is in response, but we need
        // the full system data. Mark that we need a refresh.
        return addEvent(state, 'travel', `Arrived in ${p.system || 'system'}`)
      }
      if (actionName === 'mine') {
        return addEvent(state, 'mining', p.message as string || 'Mining started')
      }
      if (actionName === 'dock') {
        return addEvent({ ...state, isDocked: true }, 'travel', `Docked at ${p.base || 'base'}`)
      }
      if (actionName === 'undock') {
        return addEvent({ ...state, isDocked: false }, 'travel', 'Undocked from station')
      }
      if (actionName === 'travel') {
        return addEvent(state, 'travel', `Traveling to ${p.destination || 'destination'}...`)
      }
      if (actionName === 'jump') {
        return addEvent(state, 'travel', `Jumping to ${p.destination || 'system'}...`)
      }
      if (actionName === 'craft') {
        let msg = `Crafted ${p.recipe || 'item'}`
        if (p.level_up) msg += ' -- Level up!'
        return addEvent(state, 'crafting', msg)
      }
      if (actionName === 'attack') {
        return addEvent(state, 'combat', `Attacking ${p.target_name || 'target'} with ${p.weapon_name || 'weapon'}`)
      }
      if (actionName === 'buy') {
        return addEvent(state, 'trade', p.message as string || 'Purchase complete')
      }
      if (actionName === 'sell') {
        return addEvent(state, 'trade', p.message as string || 'Sale complete')
      }
      if (p.message) {
        return addEvent(state, 'info', p.message as string)
      }
      return state
    }

    case 'ERROR': {
      const errMsg = action.payload.message
      // Server says we're already logged in — treat as authenticated
      if (action.payload.code === 'already_logged_in' || errMsg.toLowerCase().includes('already logged in')) {
        return addEvent({ ...state, authenticated: true }, 'system', 'Resuming session...')
      }
      return addEvent(state, 'error', errMsg)
    }

    case 'COMBAT_UPDATE': {
      const p = action.payload
      const dmg = p.damage as number || 0
      const shieldHit = p.shield_hit as number || 0
      const hullHit = p.hull_hit as number || 0
      const msg = `Combat: ${dmg} ${p.damage_type || ''} damage (${shieldHit} shield, ${hullHit} hull)`
      return addEvent(state, 'combat', msg)
    }

    case 'PLAYER_DIED': {
      const p = action.payload
      const killer = p.killer_name as string || 'unknown'
      const msg = p.killer_id ? `Ship destroyed by ${killer}!` : 'Ship self-destructed!'
      return addEvent({ ...state, inCombat: false, isDocked: false }, 'combat', msg)
    }

    case 'MINING_YIELD': {
      const p = action.payload
      return addEvent(state, 'mining', `Mined ${p.quantity}x ${p.resource_id}`)
    }

    case 'CHAT_MESSAGE': {
      const msg = action.payload
      const chatMessages = [...state.chatMessages, msg].slice(-MAX_CHAT)
      return { ...state, chatMessages }
    }

    case 'TRADE_OFFER_RECEIVED': {
      const trade = action.payload
      const pendingTrades = [...state.pendingTrades, trade]
      return addEvent({ ...state, pendingTrades }, 'trade', `Trade offer from ${trade.from_name}`)
    }

    case 'SCAN_RESULT':
      return addEvent(state, 'info', `Scan: ${action.payload.username || 'target'} - ${action.payload.ship_class || 'unknown class'}`)

    case 'SCAN_DETECTED':
      return addEvent(state, 'warning', action.payload.message as string || 'You were scanned!')

    case 'POI_ARRIVAL':
      return addEvent(state, 'info', `${action.payload.username} arrived`)

    case 'POI_DEPARTURE':
      return addEvent(state, 'info', `${action.payload.username} departed`)

    case 'PILOTLESS_SHIP':
      return addEvent(state, 'warning', `Pilotless ship detected: ${action.payload.player_username} (${action.payload.ship_class})`)

    case 'SKILL_LEVEL_UP':
      return addEvent(state, 'info', `Skill leveled up: ${action.payload.skill_name} -> Level ${action.payload.new_level}`)

    case 'POLICE_WARNING':
      return addEvent(state, 'warning', action.payload.message as string || 'Police warning!')

    case 'ADD_EVENT':
      return { ...state, eventLog: [action.entry, ...state.eventLog].slice(0, MAX_EVENTS) }

    case 'RESET':
      return { ..._initState, connected: state.connected, welcome: state.welcome }

    default:
      return state
  }
}

const _initState: GameState = {
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
}

export function useGameState() {
  return useReducer(gameReducer, _initState)
}
