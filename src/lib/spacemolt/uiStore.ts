'use client'

/**
 * UI-local game state the lib deliberately does not cache: the event log,
 * chat, pending trades, toasts, live battle view, and craft-job list. Fed by
 * wireNotifications and read via useSyncExternalStore, mirroring the
 * accountStore pattern.
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { NotificationPayloads } from '@spacemolt/lib'

export type ChatMessage = NotificationPayloads['chat_message']
export type BattleView = NotificationPayloads['battle_update']
export type TradeOffer = NotificationPayloads['trade_offer_received']
export type CraftJob = NotificationPayloads['crafting_update']['jobs'] extends Array<infer J> | undefined
  ? J
  : Record<string, unknown>

export type EventKind = 'info' | 'success' | 'warning' | 'danger' | 'chat' | 'combat'

export interface EventLogEntry {
  id: number
  at: number
  kind: EventKind
  text: string
}

export interface Toast {
  id: number
  kind: EventKind
  text: string
}

export interface UiState {
  eventLog: EventLogEntry[]
  chatMessages: ChatMessage[]
  pendingTrades: TradeOffer[]
  toasts: Toast[]
  battle: BattleView | null
  inCombat: boolean
  craftJobs: CraftJob[] | null
}

export type UiAction =
  | { type: 'event'; kind: EventKind; text: string; at?: number }
  | { type: 'toast'; kind: EventKind; text: string }
  | { type: 'dismiss_toast'; id: number }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'seed_chat'; messages: ChatMessage[] }
  | { type: 'trade_received'; trade: TradeOffer }
  | { type: 'trade_closed'; tradeId: string }
  | { type: 'seed_trades'; trades: TradeOffer[] }
  | { type: 'battle_update'; battle: BattleView }
  | { type: 'battle_ended' }
  | { type: 'set_craft_jobs'; jobs: CraftJob[] }
  | { type: 'reset' }

const EVENT_LOG_LIMIT = 200
const CHAT_LIMIT = 200

export const initialUiState: UiState = {
  eventLog: [],
  chatMessages: [],
  pendingTrades: [],
  toasts: [],
  battle: null,
  inCombat: false,
  craftJobs: null,
}

let nextId = 1

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'event':
      return {
        ...state,
        eventLog: [
          { id: nextId++, at: action.at ?? Date.now(), kind: action.kind, text: action.text },
          ...state.eventLog,
        ].slice(0, EVENT_LOG_LIMIT),
      }
    case 'toast':
      return { ...state, toasts: [...state.toasts, { id: nextId++, kind: action.kind, text: action.text }] }
    case 'dismiss_toast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'chat':
      return { ...state, chatMessages: [...state.chatMessages, action.message].slice(-CHAT_LIMIT) }
    case 'seed_chat':
      return { ...state, chatMessages: action.messages.slice(-CHAT_LIMIT) }
    case 'trade_received':
      return { ...state, pendingTrades: [...state.pendingTrades, action.trade] }
    case 'trade_closed':
      return { ...state, pendingTrades: state.pendingTrades.filter((t) => t.trade_id !== action.tradeId) }
    case 'seed_trades':
      return { ...state, pendingTrades: action.trades }
    case 'battle_update':
      return { ...state, battle: action.battle, inCombat: true }
    case 'battle_ended':
      return { ...state, battle: null, inCombat: false }
    case 'set_craft_jobs':
      return { ...state, craftJobs: action.jobs }
    case 'reset':
      return initialUiState
  }
}

export interface UiStore {
  getState: () => UiState
  dispatch: (action: UiAction) => void
  subscribe: (callback: () => void) => () => void
}

export function createUiStore(): UiStore {
  let state = initialUiState
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    dispatch: (action) => {
      state = uiReducer(state, action)
      for (const callback of [...listeners]) callback()
    },
    subscribe: (callback) => {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },
  }
}

export function useUiSlice<T>(store: UiStore, select: (state: UiState) => T): T {
  const getSnapshot = useCallback(() => select(store.getState()), [store, select])
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
