import { describe, expect, test } from 'bun:test'
import { createUiStore, initialUiState, uiReducer, type BattleView, type ChatMessage, type TradeOffer } from './uiStore'

const chat = (content: string): ChatMessage => ({ content, channel: 'local', sender: 'Nova' }) as ChatMessage
const trade = (trade_id: string): TradeOffer => ({ trade_id }) as TradeOffer
const battle = (battle_id = 'battle-1'): BattleView => ({
  battle_id, tick: 1, auto_pilot: false, participants: [], sides: [],
  your_side_id: 0, your_stance: 'fire', your_zone: 'outer',
})

describe('uiReducer', () => {
  test('pending synchronization preserves history and revision until authoritative confirmation', () => {
    const current = uiReducer(initialUiState, { type: 'battle_update', battle: battle() })
    const pending = uiReducer(current, { type: 'battle_sync_pending' })
    expect(pending).toMatchObject({ battleSyncPending: true, battle: current.battle, lastBattleId: 'battle-1', battleRevision: current.battleRevision })
    expect(uiReducer(pending, { type: 'battle_ended', battleId: 'old' })).toMatchObject({
      battleSyncPending: true, battleRevision: pending.battleRevision,
    })
    expect(uiReducer(pending, { type: 'battle_ended', battleId: 'battle-1' }).battleSyncPending).toBe(false)
    expect(uiReducer(pending, { type: 'battle_left' }).battleSyncPending).toBe(false)
    expect(uiReducer(pending, { type: 'battle_started', battleId: 'new' }).battleSyncPending).toBe(false)
    expect(uiReducer(pending, { type: 'battle_update', battle: battle() }).battleSyncPending).toBe(false)
  })

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
    let state = uiReducer(initialUiState, { type: 'battle_update', battle: battle() })
    expect(state.inCombat).toBe(true)
    state = uiReducer(state, { type: 'battle_ended', battleId: 'battle-1' })
    expect(state.inCombat).toBe(false)
    expect(state.battle).toBeNull()
    expect(state.lastBattleId).toBe('battle-1')
    expect(state.activeBattleId).toBeNull()
  })

  test('start establishes identity before the first update and reset drops history', () => {
    const state = uiReducer(initialUiState, { type: 'battle_started', battleId: 'battle-1' })
    expect(state.inCombat).toBe(true)
    expect(state.activeBattleId).toBe('battle-1')
    expect(state.lastBattleId).toBe('battle-1')
    expect(uiReducer(state, { type: 'reset' })).toEqual(initialUiState)
  })

  test('an old battle end cannot clear a newly joined battle', () => {
    const state = uiReducer(initialUiState, { type: 'battle_update', battle: battle('new') })
    expect(uiReducer(state, { type: 'battle_ended', battleId: 'old' })).toMatchObject({
      activeBattleId: 'new', lastBattleId: 'new', inCombat: true, battle: state.battle,
    })
  })

  test('leaving retains replay identity and a new battle drops old live details', () => {
    let state = uiReducer(initialUiState, { type: 'battle_update', battle: battle() })
    state = uiReducer(state, { type: 'battle_left' })
    expect(state.inCombat).toBe(false)
    expect(state.lastBattleId).toBe('battle-1')
    state = uiReducer(state, { type: 'battle_started', battleId: 'new' })
    expect(state.battle).toBeNull()
    expect(state.lastBattleId).toBe('new')
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
