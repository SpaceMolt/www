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

  const fighter = (player_id: string, kind: string) =>
    ({ player_id, kind, username: player_id, side_id: 0, zone: 'outer' })

  test('bystander alerts for creature fights log nothing', async () => {
    const f = await fixture()
    try {
      const before = f.store.getState().eventLog.length
      f.send('battle_alert', {
        battle_id: 'hunt', sides: [], system_id: 'lhs_1140',
        participants: [fighter('other', 'player'), fighter('crt_1', 'creature')],
        message: 'A battle is underway in LHS 1140!',
      })
      expect(f.store.getState().eventLog.length).toBe(before)
    } finally { f.close() }
  })

  test('creature alerts still log when you are a participant', async () => {
    const f = await fixture()
    try {
      f.send('battle_alert', {
        battle_id: 'hunted', sides: [], system_id: 'lhs_1140',
        participants: [fighter('plr_1', 'player'), fighter('crt_1', 'creature')],
        message: 'Void Eel is attacking you!',
      })
      expect(f.store.getState().eventLog[0]?.text).toBe('Void Eel is attacking you!')
    } finally { f.close() }
  })

  test('bystander alerts for non-creature fights still log', async () => {
    const f = await fixture()
    try {
      f.send('battle_alert', {
        battle_id: 'pvp', sides: [], system_id: 'lhs_1140',
        participants: [fighter('other', 'player'), fighter('prt_1', 'pirate')],
        message: 'A battle is underway in LHS 1140!',
      })
      expect(f.store.getState().eventLog[0]?.text).toBe('A battle is underway in LHS 1140!')
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

test('station sale notification retains treasury terms through acceptance', async () => {
  const f = await fixture()
  const sale = {
    trade_id: 'station-sale', offerer_name: 'Seller', station_id: 'outpost-1',
    seller_faction_id: 'seller-faction', buyer_faction_id: 'buyer-faction',
    request_credits: 12_000_000, labor_cost: 1_000_000, transfer_tax: 3_000_000,
  }
  try {
    f.send('trade_offer_received', sale)
    expect(f.store.getState().pendingTrades[0]).toMatchObject(sale)
    f.send('trade_complete', { trade_id: sale.trade_id, station_id: sale.station_id })
    expect(f.store.getState().pendingTrades).toEqual([])
  } finally { f.close() }
})

describe('ignored pushes now reach the event log', () => {
  test('commission complete names the ship and base', async () => {
    const f = await fixture()
    try {
      f.send('ship_commission_complete', {
        tick: 1, commission_id: 'c1', ship_id: 's1', ship_class: 'hauler', ship_name: 'Mule', base_id: 'b1', base_name: 'Sol Yard',
      })
      expect(f.store.getState().eventLog[0]).toMatchObject({ kind: 'success', text: 'Commission complete: Mule is docked at Sol Yard', toast: true })
    } finally { f.close() }
  })

  test('alliance proposal (own wording, not the agent-facing message) and hold start warn', async () => {
    const f = await fixture()
    try {
      f.send('faction_alliance_proposal', {
        from_faction_id: 'f1', from_faction_name: 'Red', from_faction_tag: 'RED', message: 'Red [RED] proposes an alliance. Use faction_accept_ally to ratify.',
      })
      expect(f.store.getState().eventLog[0]).toMatchObject({ kind: 'warning', text: 'Red proposes an alliance. Accept it in the Faction tab.' })
      f.send('hold_update', { event: 'started', holder_name: 'Pirate', message: 'Pirate is holding you' })
      expect(f.store.getState().eventLog[0]).toMatchObject({ kind: 'warning', text: 'Pirate is holding you' })
      f.send('hold_update', { event: 'ended', reason: 'paid', message: '' })
      expect(f.store.getState().eventLog[0]).toMatchObject({ kind: 'info', text: 'Warp hold ended' })
    } finally { f.close() }
  })
})
