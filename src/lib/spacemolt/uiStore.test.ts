import { describe, expect, test } from 'bun:test'
import { createUiStore, initialUiState, uiReducer, type ChatMessage, type TradeOffer } from './uiStore'

const chat = (content: string): ChatMessage => ({ content, channel: 'local', sender: 'Nova' }) as ChatMessage
const trade = (trade_id: string): TradeOffer => ({ trade_id }) as TradeOffer

describe('uiReducer', () => {
  test('events prepend and are capped', () => {
    let state = initialUiState
    for (let i = 0; i < 205; i++) {
      state = uiReducer(state, { type: 'event', kind: 'info', text: `e${i}` })
    }
    expect(state.eventLog.length).toBe(200)
    expect(state.eventLog[0]?.text).toBe('e204')
  })

  test('trade lifecycle: received then closed by id', () => {
    let state = uiReducer(initialUiState, { type: 'trade_received', trade: trade('t1') })
    state = uiReducer(state, { type: 'trade_received', trade: trade('t2') })
    state = uiReducer(state, { type: 'trade_closed', tradeId: 't1' })
    expect(state.pendingTrades.map((t) => t.trade_id)).toEqual(['t2'])
  })

  test('battle update sets inCombat; battle_ended clears it', () => {
    let state = uiReducer(initialUiState, { type: 'battle_update', battle: { tick: 1 } as never })
    expect(state.inCombat).toBe(true)
    state = uiReducer(state, { type: 'battle_ended' })
    expect(state.inCombat).toBe(false)
    expect(state.battle).toBeNull()
  })

  test('store notifies subscribers and supports unsubscribe', () => {
    const store = createUiStore()
    let notified = 0
    const unsubscribe = store.subscribe(() => notified++)
    store.dispatch({ type: 'chat', message: chat('hi') })
    unsubscribe()
    store.dispatch({ type: 'chat', message: chat('again') })
    expect(notified).toBe(1)
    expect(store.getState().chatMessages.length).toBe(2)
  })

  test('seed_chat replaces and caps the buffer', () => {
    const messages = Array.from({ length: 250 }, (_, i) => chat(`m${i}`))
    const state = uiReducer(initialUiState, { type: 'seed_chat', messages })
    expect(state.chatMessages.length).toBe(200)
    expect(state.chatMessages.at(-1)?.content).toBe('m249')
  })
})
