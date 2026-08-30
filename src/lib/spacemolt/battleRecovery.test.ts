import { describe, expect, test } from 'bun:test'
import { Account, type GetBattleStatusResponse } from '@spacemolt/lib'
import { createAccountStore } from './accountStore'
import { createUiStore } from './uiStore'
import { battleViewFromStatus, wireBattleRecovery } from './battleRecovery'
import { connectAccount, mockFactory } from './testing/mockSocket'

const status = (battle_id = 'one', is_participant = true): GetBattleStatusResponse => ({
  battle_id, is_participant, system_id: 'sol', sides: [], participants: [],
})
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

async function fixture(retryDelayMs?: number) {
  const { factory, sockets } = mockFactory()
  const account = new Account({ url: 'ws://test/ws/v2', webSocketFactory: factory })
  await connectAccount(account, () => sockets.at(-1)!)
  const accountStore = createAccountStore(account)
  const ui = createUiStore()
  const requests: string[] = []
  sockets.at(-1)!.onClientSend = (frame) => {
    if (frame.tool === 'spacemolt_battle' && frame.action === 'status') requests.push(frame.request_id!)
  }
  const stop = wireBattleRecovery(accountStore, ui, retryDelayMs)
  const reply = (value: GetBattleStatusResponse, index = requests.length - 1) => {
    sockets.at(-1)!.serverSend({ type: 'result', request_id: requests[index], payload: { result: 'ok', structuredContent: value } })
  }
  const fail = (code: string) => sockets.at(-1)!.serverSend({
    type: 'error', request_id: requests.at(-1), payload: { code, message: code },
  })
  return { accountStore, ui, requests, reply, fail, stop, close: () => { stop(); accountStore.dispose() } }
}

describe('battle recovery', () => {
  test('retries transient failures only three times, retaining disabled replay state', async () => {
    const f = await fixture(50)
    try {
      f.ui.dispatch({ type: 'battle_started', battleId: 'one' })
      f.accountStore.setPhase('ready')
      for (let attempt = 1; attempt <= 3; attempt++) {
        expect(f.requests).toHaveLength(attempt)
        f.fail('server_error')
        await new Promise(resolve => setTimeout(resolve, 80))
      }
      expect(f.requests).toHaveLength(3)
      expect(f.ui.getState()).toMatchObject({ activeBattleId: 'one', lastBattleId: 'one', battleSyncPending: true })
      f.ui.dispatch({ type: 'battle_started', battleId: 'current' })
      expect(f.ui.getState().battleSyncPending).toBe(false)
    } finally { f.close() }
  })

  test('a retry can confirm absence without losing the retained replay', async () => {
    const f = await fixture(50)
    try {
      f.ui.dispatch({ type: 'battle_started', battleId: 'one' })
      f.accountStore.setPhase('ready')
      f.fail('server_error')
      await new Promise(resolve => setTimeout(resolve, 80))
      expect(f.requests).toHaveLength(2)
      f.fail('not_in_battle')
      await new Promise(resolve => setTimeout(resolve, 80))
      expect(f.requests).toHaveLength(2)
      expect(f.ui.getState()).toMatchObject({ inCombat: false, lastBattleId: 'one', battleSyncPending: false })
    } finally { f.close() }
  })

  test('new lifecycle pushes, phase changes, and cleanup cancel scheduled retries', async () => {
    for (const interrupt of ['push', 'phase', 'dispose']) {
      const f = await fixture(50)
      try {
        f.accountStore.setPhase('ready')
        f.fail('server_error')
        await flush()
        if (interrupt === 'push') f.ui.dispatch({ type: 'battle_started', battleId: 'current' })
        else if (interrupt === 'phase') f.accountStore.setPhase('reconnecting')
        else f.stop()
        await new Promise(resolve => setTimeout(resolve, 80))
        expect(f.requests).toHaveLength(1)
      } finally { f.close() }
    }
  })

  test('normalizes your live controls but never promotes a spectator roster', () => {
    const snapshot: GetBattleStatusResponse = { ...status(), participants: [{
      player_id: 'plr_1', username: 'Nova', auto_pilot: true, side_id: 2,
      stance: 'brace', zone: 'mid', target_id: 'enemy', hull_pct: 70,
    }] }
    expect(battleViewFromStatus(snapshot, 'plr_1', 50)).toMatchObject({
      battle_id: 'one', tick: 50, your_side_id: 2, your_stance: 'brace',
      your_zone: 'mid', your_target_id: 'enemy', auto_pilot: true,
    })
    expect(battleViewFromStatus({ ...snapshot, is_participant: false }, 'plr_1', 50)).toBeNull()
  })

  test('queries on initial ready and reconnect; spectator status ends only participation', async () => {
    const f = await fixture()
    try {
      expect(f.requests).toHaveLength(0)
      f.accountStore.setPhase('ready')
      expect(f.requests).toHaveLength(1)
      f.reply(status())
      await flush()
      expect(f.ui.getState().activeBattleId).toBe('one')
      f.accountStore.setPhase('reconnecting')
      f.accountStore.setPhase('ready')
      expect(f.requests).toHaveLength(2)
      f.reply(status('nearby', false))
      await flush()
      expect(f.ui.getState().activeBattleId).toBeNull()
      expect(f.ui.getState().lastBattleId).toBe('one')
    } finally { f.close() }
  })

  test('a newer push supersedes an in-flight snapshot', async () => {
    const f = await fixture()
    try {
      f.accountStore.setPhase('ready')
      f.ui.dispatch({ type: 'battle_started', battleId: 'new' })
      f.reply(status('old'))
      await flush()
      expect(f.ui.getState().activeBattleId).toBe('new')
    } finally { f.close() }
  })

  test('an old battle end cannot cancel recovery of current participation', async () => {
    const f = await fixture()
    try {
      f.ui.dispatch({ type: 'battle_started', battleId: 'current' })
      f.accountStore.setPhase('ready')
      f.ui.dispatch({ type: 'battle_ended', battleId: 'old' })
      f.reply(status('current'))
      await flush()
      expect(f.ui.getState()).toMatchObject({ activeBattleId: 'current', battleSyncPending: false })
    } finally { f.close() }
  })

  test('end before the first recovered snapshot cannot resurrect the battle', async () => {
    const f = await fixture()
    try {
      f.accountStore.setPhase('ready')
      f.ui.dispatch({ type: 'battle_ended', battleId: 'one' })
      f.reply(status())
      await flush()
      expect(f.ui.getState().activeBattleId).toBeNull()
      expect(f.ui.getState().lastBattleId).toBe('one')
    } finally { f.close() }
  })

  test('disconnect and cleanup invalidate pending snapshots', async () => {
    const f = await fixture()
    try {
      f.accountStore.setPhase('ready')
      f.accountStore.setPhase('reconnecting')
      f.reply(status())
      await flush()
      expect(f.ui.getState().inCombat).toBe(false)
      f.accountStore.setPhase('ready')
      f.stop()
      f.ui.dispatch({ type: 'reset' })
      f.reply(status())
      await flush()
      expect(f.ui.getState().lastBattleId).toBeNull()
    } finally { f.close() }
  })

  test('not_in_battle clears participation; other errors preserve the last known fight', async () => {
    const f = await fixture()
    try {
      f.ui.dispatch({ type: 'battle_started', battleId: 'one' })
      f.accountStore.setPhase('ready')
      f.fail('server_error')
      await flush()
      expect(f.ui.getState().activeBattleId).toBe('one')
      // The replay remains available, but old membership is not command authority.
      expect(f.ui.getState().battleSyncPending).toBe(true)
      f.accountStore.setPhase('reconnecting')
      f.accountStore.setPhase('ready')
      f.fail('not_in_battle')
      await flush()
      expect(f.ui.getState().inCombat).toBe(false)
      expect(f.ui.getState().battleSyncPending).toBe(false)
      expect(f.ui.getState().lastBattleId).toBe('one')
    } finally { f.close() }
  })
})
