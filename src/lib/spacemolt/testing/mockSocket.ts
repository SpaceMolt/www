/**
 * Scriptable WebSocketLike for driving a real @spacemolt/lib Account in bun
 * tests — the same pattern the library's own test suite uses. serverSend
 * pushes a frame to the client; onClientSend observes/answers outbound
 * frames.
 */
import type { Account } from '@spacemolt/lib'

interface FrameRecord {
  tool?: string
  action?: string
  request_id?: string
  payload?: Record<string, unknown>
  [key: string]: unknown
}

type Listener = (event: { data?: unknown; code?: number; reason?: string }) => void

export class MockSocket {
  readonly sent: FrameRecord[] = []
  onClientSend?: (frame: FrameRecord, socket: MockSocket) => void
  private listeners = new Map<string, Listener[]>()

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  private emit(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  open(): void {
    this.emit('open')
  }

  send(data: string): void {
    const frame = JSON.parse(data) as FrameRecord
    this.sent.push(frame)
    this.onClientSend?.(frame, this)
  }

  serverSend(frame: Record<string, unknown>): void {
    this.emit('message', { data: JSON.stringify(frame) })
  }

  close(code?: number, reason?: string): void {
    this.emit('close', { code: code ?? 1000, reason })
  }

  /** Simulate a server-side close (e.g. 4001 session_replaced). */
  serverClose(code: number, reason = ''): void {
    this.emit('close', { code, reason })
  }
}

export function mockFactory(): { factory: (url: string) => MockSocket; sockets: MockSocket[] } {
  const sockets: MockSocket[] = []
  return {
    factory: () => {
      const socket = new MockSocket()
      sockets.push(socket)
      queueMicrotask(() => socket.open())
      return socket
    },
    sockets,
  }
}

export const WELCOME_PAYLOAD = {
  version: '0.508.0',
  release_date: '2026-07-16',
  release_notes: [],
  tick_rate: 10,
  current_tick: 100,
  server_time: 1,
  game_info: '',
  website: '',
  help_text: '',
  terms: '',
}

/** Connect + authenticate a real Account against a scripted socket. */
export async function connectAccount(account: Account, socket: () => MockSocket): Promise<void> {
  const connectPromise = account.connect()
  await Promise.resolve() // let the factory's queued open() fire
  socket().serverSend({ type: 'welcome', payload: WELCOME_PAYLOAD })
  await connectPromise
  socket().onClientSend = (frame, s) => {
    if (frame.action === 'login_token') {
      s.serverSend({
        type: 'logged_in',
        request_id: frame.request_id,
        payload: { player: { id: 'plr_1', username: 'Nova' } },
      })
    } else if (frame.action === 'get_status') {
      s.serverSend({
        type: 'result',
        request_id: frame.request_id,
        payload: {
          result: 'ok',
          structuredContent: {
            player: { username: 'Nova', credits: 5000 },
            ship: { class_id: 'shuttle', fuel: 100 },
            location: { system_id: 'sol', poi_id: 'earth_station' },
            cargo: [],
            queue: { has_pending: false },
          },
        },
      })
    }
  }
  await account.authenticate({ kind: 'login_token', token: 'tok_test' })
}
