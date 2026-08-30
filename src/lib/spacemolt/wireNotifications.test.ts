import { describe, expect, test } from 'bun:test'
import { Account } from '@spacemolt/lib'
import { createUiStore } from './uiStore'
import { wireNotifications } from './wireNotifications'
import { connectAccount, mockFactory } from './testing/mockSocket'

async function fixture() {
  const { factory, sockets } = mockFactory()
  const account = new Account({ url: 'ws://test/ws/v2', webSocketFactory: factory })
  await connectAccount(account, () => sockets.at(-1)!)
  const store = createUiStore()
  const unwire = wireNotifications(account, store)
  const send = (type: string, payload: Record<string, unknown>) => sockets.at(-1)!.serverSend({ type, payload })
  return { store, send, close: () => { unwire(); account.close() } }
}

describe('battle notifications', () => {
  test('spectator alerts preserve participation and pending recovery', async () => {
    const f = await fixture()
    try {
      const revision = f.store.getState().battleRevision
      f.send('battle_alert', {
        battle_id: 'nearby', participants: [], sides: [], system_id: 'sol',
        message: 'A battle is underway in Sol!',
      })
      expect(f.store.getState().inCombat).toBe(false)
      expect(f.store.getState().activeBattleId).toBeNull()
      expect(f.store.getState().lastBattleId).toBeNull()
      expect(f.store.getState().battleRevision).toBe(revision)
      expect(f.store.getState().eventLog[0]?.text).toBe('A battle is underway in Sol!')
    } finally { f.close() }
  })

  test('starts retain IDs; another pilot leaving does not end your fight', async () => {
    const f = await fixture()
    try {
      f.send('battle_started', { battle_id: 'one', participants: [], sides: [], system_id: 'sol' })
      expect(f.store.getState().activeBattleId).toBe('one')
      f.send('battle_left', { player_id: 'other', username: 'Other', reason: 'fled' })
      expect(f.store.getState().inCombat).toBe(true)
      f.send('battle_left', { player_id: 'plr_1', username: 'Nova', reason: 'fled' })
      expect(f.store.getState().inCombat).toBe(false)
      expect(f.store.getState().lastBattleId).toBe('one')
      f.send('battle_started', { battle_id: 'two', participants: [], sides: [], system_id: 'sol' })
      expect(f.store.getState().activeBattleId).toBe('two')
      f.send('battle_ended', { battle_id: 'one', duration: 1, reason: 'victory', ships_destroyed: 1, total_damage: 1, winning_side: 0 })
      expect(f.store.getState().activeBattleId).toBe('two')
      f.send('player_died', { killer_name: 'Other' })
      expect(f.store.getState().inCombat).toBe(false)
      expect(f.store.getState().lastBattleId).toBe('two')
    } finally { f.close() }
  })
})
