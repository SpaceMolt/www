/**
 * Proves the analytics Proxy holds against the *real* @spacemolt/lib command
 * facade, not just a hand-rolled stand-in. The facade is generated code, so its
 * two-level shape is an assumption worth pinning: if a lib upgrade flattens it
 * or turns namespaces into class instances, these fail rather than silently
 * emitting nothing.
 */
import { describe, expect, test } from 'bun:test'
import { Account } from '@spacemolt/lib'
import { instrumentCommands, type GameActionEvent } from '@/lib/analytics/gameActions'
import { connectAccount, mockFactory, type MockSocket } from './testing/mockSocket'
import { wsUrlFromHttpBase } from './AccountProvider'

async function readyAccount() {
  const { factory, sockets } = mockFactory()
  const account = new Account({ url: 'ws://test/ws/v2', webSocketFactory: factory })
  const socket = () => {
    const s = sockets.at(-1)
    if (!s) throw new Error('no socket created')
    return s
  }
  await connectAccount(account, socket)
  return { account, socket }
}

/** Answers a mutation with the pending -> action_result two-phase sequence. */
function serve(socket: MockSocket, action: string) {
  socket.onClientSend = (frame, s) => {
    if (frame.action !== action) return
    s.serverSend({
      type: 'result',
      request_id: frame.request_id,
      payload: { result: 'pending', structuredContent: { pending: true, command: action, message: 'queued' } },
    })
    s.serverSend({
      type: 'action_result',
      request_id: frame.request_id,
      payload: {
        command: action,
        tick: 110,
        result: { queue: { has_pending: false } },
      },
    })
  }
}

describe('wsUrlFromHttpBase', () => {
  test('maps http origins to the ws/v2 endpoint', () => {
    expect(wsUrlFromHttpBase('https://game.spacemolt.com')).toBe('wss://game.spacemolt.com/ws/v2')
    expect(wsUrlFromHttpBase('http://localhost:8080/')).toBe('ws://localhost:8080/ws/v2')
  })
})

describe('instrumentCommands against the real facade', () => {
  test('emits game_action for a real tracked mutation', async () => {
    const { account, socket } = await readyAccount()
    const events: GameActionEvent[] = []
    const commands = instrumentCommands(account.commands, (e) => events.push(e))
    serve(socket(), 'mine')

    await commands.spacemolt.mine()

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ command: 'mine', namespace: 'spacemolt', outcome: 'ok' })
    expect(events[0]!.duration_ms).toBeGreaterThanOrEqual(0)
  })

  test('stays silent for a real read command', async () => {
    const { account, socket } = await readyAccount()
    const events: GameActionEvent[] = []
    const commands = instrumentCommands(account.commands, (e) => events.push(e))
    socket().onClientSend = (frame, s) => {
      if (frame.action === 'get_system') {
        s.serverSend({
          type: 'result',
          request_id: frame.request_id,
          payload: { result: 'ok', structuredContent: { id: 'sol', name: 'Sol' } },
        })
      }
    }

    await commands.spacemolt.get_system({ id: 'sol' })

    expect(events).toEqual([])
  })

  test('the real facade is still two levels of plain namespace objects', async () => {
    const { account } = await readyAccount()

    expect(typeof account.commands.spacemolt).toBe('object')
    expect(typeof account.commands.spacemolt.mine).toBe('function')
    expect(typeof account.commands.spacemolt_market.view_market).toBe('function')
  })

  test('instrumented commands still reach the socket unchanged', async () => {
    const { account, socket } = await readyAccount()
    const commands = instrumentCommands(account.commands, () => {})
    serve(socket(), 'jump')

    await commands.spacemolt.jump({ id: 'alpha_centauri' })

    const jump = socket().sent.find((f) => f.action === 'jump')
    expect(jump).toBeDefined()
    expect(jump!.payload).toEqual({ id: 'alpha_centauri' })
  })
})
