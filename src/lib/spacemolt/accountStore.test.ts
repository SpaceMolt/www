import { describe, expect, test } from 'bun:test'
import { Account } from '@spacemolt/lib'
import { createAccountStore } from './accountStore'
import { connectAccount, mockFactory, type MockSocket } from './testing/mockSocket'

async function readyStore() {
  const { factory, sockets } = mockFactory()
  const account = new Account({ url: 'ws://test/ws/v2', webSocketFactory: factory })
  const store = createAccountStore(account)
  const socket = () => {
    const s = sockets.at(-1)
    if (!s) throw new Error('no socket created')
    return s
  }
  await connectAccount(account, socket)
  return { account, store, socket }
}

function serveMine(socket: MockSocket, tick: number) {
  socket.onClientSend = (frame, s) => {
    if (frame.action === 'mine') {
      s.serverSend({
        type: 'result',
        request_id: frame.request_id,
        payload: { result: 'pending', structuredContent: { pending: true, command: 'mine', message: 'queued' } },
      })
      s.serverSend({
        type: 'action_result',
        request_id: frame.request_id,
        payload: {
          command: 'mine',
          tick,
          result: { cargo: [{ item_id: 'iron_ore', quantity: 5 }], queue: { has_pending: false } },
        },
      })
    }
  }
}

describe('createAccountStore', () => {
  test('seeds state from get_status and serves sections by reference', async () => {
    const { store } = await readyStore()
    expect(store.getSection('player')?.username).toBe('Nova')
    expect(store.getSection('location')?.system_id).toBe('sol')
  })

  test('notifies exactly the changed sections; section reference changes', async () => {
    const { account, store, socket } = await readyStore()
    const cargoBefore = store.getSection('cargo')
    const playerBefore = store.getSection('player')

    let cargoNotified = 0
    let playerNotified = 0
    store.subscribe('cargo', () => cargoNotified++)
    store.subscribe('player', () => playerNotified++)

    serveMine(socket(), 110)
    await account.mutate('spacemolt', 'mine')

    expect(cargoNotified).toBe(1)
    expect(playerNotified).toBe(0)
    expect(store.getSection('cargo')).not.toBe(cargoBefore)
    expect(store.getSection('player')).toBe(playerBefore)
    expect(store.getSection('cargo')?.[0]?.quantity).toBe(5)
  })

  test('unsubscribe stops notifications for that listener only', async () => {
    const { account, store, socket } = await readyStore()
    let first = 0
    let second = 0
    const unsubscribeFirst = store.subscribe('cargo', () => first++)
    store.subscribe('cargo', () => second++)

    serveMine(socket(), 111)
    await account.mutate('spacemolt', 'mine')
    unsubscribeFirst()
    serveMine(socket(), 112)
    await account.mutate('spacemolt', 'mine')

    expect(first).toBe(1)
    expect(second).toBe(2)
  })

  test('tick subscribers fire as the observed game clock advances', async () => {
    const { account, store, socket } = await readyStore()
    expect(store.getCurrentTick()).toBe(100) // welcome.current_tick

    let tickNotified = 0
    store.subscribe('tick', () => tickNotified++)
    serveMine(socket(), 150)
    await account.mutate('spacemolt', 'mine')

    expect(store.getCurrentTick()).toBe(150)
    expect(tickNotified).toBeGreaterThanOrEqual(1)
  })

  test('session_replaced close lands in the session_replaced phase', async () => {
    const { store, socket } = await readyStore()
    expect(store.getPhase()).toBe('connecting') // provider sets ready; store starts at connecting

    let phaseNotified = 0
    store.subscribe('phase', () => phaseNotified++)
    socket().serverClose(4001, 'session replaced')
    await Promise.resolve()

    expect(store.getPhase()).toBe('session_replaced')
    expect(phaseNotified).toBe(1)
  })

  test('pendingAction set/clear notifies the pending key', async () => {
    const { store } = await readyStore()
    const seen: Array<string | null> = []
    store.subscribe('pending', () => seen.push(store.getPendingAction()?.command ?? null))

    store.setPendingAction({ command: 'jump', startedAt: 1 })
    store.clearPendingAction()
    store.clearPendingAction() // idempotent — no extra notify

    expect(seen).toEqual(['jump', null])
  })

  test('market_update pushes bump the market version and notify subscribers', async () => {
    const { store, socket } = await readyStore()
    let notified = 0
    store.subscribe('market', () => notified++)

    socket().serverSend({ type: 'market_update', payload: { base_id: 'earth_station', items: [] } })

    expect(store.getMarketVersion()).toBe(1)
    expect(notified).toBe(1)
  })

  test('dispose unwires listeners and closes the account connection', async () => {
    const { account, store, socket } = await readyStore()
    let notified = 0
    store.subscribe('market', () => notified++)

    store.dispose()
    socket().serverSend({ type: 'market_update', payload: { base_id: 'earth_station', items: [] } })

    expect(notified).toBe(0)
    expect(account.authenticated).toBe(false)
  })
})
