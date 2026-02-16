'use client'

import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react'
import { useWebSocket } from './useWebSocket'
import { useGameState } from './useGameState'
import type { GameState, WSMessage, GameAction, WelcomePayload, StateUpdate, ChatMessage, TradeOffer } from './types'

interface GameContextValue {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  send: (msg: WSMessage) => void
  sendCommand: (type: string, payload?: Record<string, unknown>) => void
  connect: () => void
  disconnect: () => void
  readyState: number
}

const GameContext = createContext<GameContextValue | null>(null)

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

interface GameProviderProps {
  children: ReactNode
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useGameState()
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
  const sendRef = useRef<(msg: WSMessage) => void>(() => {})

  const onMessage = useCallback((msg: WSMessage) => {
    const d = dispatchRef.current
    const p = msg.payload || {}

    switch (msg.type) {
      case 'welcome':
        d({ type: 'WELCOME', payload: p as unknown as WelcomePayload })
        break
      case 'registered':
        d({ type: 'REGISTERED', payload: p as { password: string; player_id: string } })
        // Dispatch CustomEvent so AuthScreen can capture the password
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('spacemolt:registered', {
            detail: { password: (p as { password?: string }).password },
          }))
        }
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
      case 'ok':
        d({ type: 'OK', payload: p })
        // Auto-refresh system data after jumping to a new system
        if ((p as Record<string, unknown>).action === 'jumped') {
          sendRef.current({ type: 'get_system' })
        }
        break
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
          id: Date.now().toString(36),
          type: 'drone',
          message: (p.message as string) || `Drone ${msg.type === 'drone_destroyed' ? 'destroyed' : 'update'}`,
          timestamp: Date.now(),
        }})
        break
      case 'base_raid_update':
      case 'base_destroyed':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36),
          type: 'base',
          message: (p.message as string) || `Base ${msg.type === 'base_destroyed' ? 'destroyed' : 'under attack'}`,
          timestamp: Date.now(),
        }})
        break
      case 'reconnected':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36),
          type: 'system',
          message: (p.message as string) || 'Reconnected to ship',
          timestamp: Date.now(),
        }})
        break
      case 'queue_cleared':
        d({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36),
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

  const onDisconnect = useCallback(() => {
    dispatchRef.current({ type: 'SET_CONNECTED', connected: false })
  }, [])

  const { connect, disconnect, send, readyState } = useWebSocket({
    onMessage,
    onConnect,
    onDisconnect,
  })
  sendRef.current = send

  const sendCommand = useCallback((type: string, payload?: Record<string, unknown>) => {
    const msg: WSMessage = { type }
    if (payload) msg.payload = payload
    send(msg)
  }, [send])

  const value: GameContextValue = {
    state,
    dispatch,
    send,
    sendCommand,
    connect,
    disconnect,
    readyState,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
