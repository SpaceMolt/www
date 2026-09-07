import { afterEach, expect, test } from 'bun:test'
import { createListRequest } from './listRequest'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('late empty response from an old filter cannot replace the new battle list', async () => {
  const responses: ((response: Response) => void)[] = []
  globalThis.fetch = (() => new Promise<Response>(resolve => responses.push(resolve))) as typeof fetch
  let visible: string[] = []
  const request = createListRequest<string[]>({
    success: data => { visible = data }, failure: () => {}, settled: () => {},
  })
  const oldFilter = request.run('/api/battles?category=pvp')
  const newFilter = request.run('/api/battles?category=pirate')
  responses[1](Response.json(['pirate battle']))
  await newFilter
  responses[0](Response.json([]))
  await oldFilter
  expect(visible).toEqual(['pirate battle'])
})

function harness(timeoutMs?: number) {
  const pending: { resolve: (response: Response) => void; reject: (error: Error) => void; signal: AbortSignal }[] = []
  globalThis.fetch = ((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    pending.push({ resolve, reject, signal: init.signal! })
  })) as typeof fetch
  let visible: string[] = []
  let errors = 0
  let settled = 0
  const request = createListRequest<string[]>({
    success: data => { visible = data },
    failure: () => { errors++ },
    settled: () => { settled++ },
  }, timeoutMs)
  return { request, pending, state: () => ({ visible, errors, settled }) }
}

test('poll skips pending foreground and pending poll; foreground cancels poll', async () => {
  const h = harness()
  const initial = h.request.run('/initial')
  await h.request.run('/poll', true)
  expect(h.pending).toHaveLength(1)
  h.pending[0].resolve(Response.json(['initial']))
  await initial
  const poll = h.request.run('/poll', true)
  await h.request.run('/another-poll', true)
  expect(h.pending).toHaveLength(2)
  const more = h.request.run('/load-more')
  expect(h.pending[1].signal.aborted).toBe(true)
  h.pending[1].resolve(Response.json([]))
  await poll
  expect(h.state()).toEqual({ visible: ['initial'], errors: 0, settled: 1 })
  h.pending[2].resolve(Response.json(['initial', 'more']))
  await more
  expect(h.state().visible).toEqual(['initial', 'more'])
})

test('stale failed load-more cannot report an error or settle the new filter', async () => {
  const h = harness()
  const more = h.request.run('/old?limit=100')
  h.request.cancel()
  const filter = h.request.run('/new?limit=50')
  expect(h.pending[0].signal.aborted).toBe(true)
  h.pending[0].reject(new Error('network error'))
  await more
  expect(h.state()).toEqual({ visible: [], errors: 0, settled: 0 })
  h.pending[1].resolve(Response.json(['new']))
  await filter
  expect(h.state().visible).toEqual(['new'])
})

test('refresh failure keeps the last list; a successful genuinely empty refresh clears it', async () => {
  const h = harness()
  const initial = h.request.run('/initial')
  h.pending[0].resolve(Response.json(['battle']))
  await initial
  const failed = h.request.run('/poll', true)
  h.pending[1].resolve(new Response('unavailable', { status: 503 }))
  await failed
  expect(h.state()).toEqual({ visible: ['battle'], errors: 1, settled: 2 })
  const empty = h.request.run('/poll', true)
  h.pending[2].resolve(Response.json([]))
  await empty
  expect(h.state().visible).toEqual([])
})

test('unmount while JSON is decoding cannot update the list or loading state', async () => {
  const h = harness()
  let finishJson!: (value: string[]) => void
  const json = new Promise<string[]>(resolve => { finishJson = resolve })
  const request = h.request.run('/initial')
  h.pending[0].resolve({ ok: true, json: () => json } as Response)
  await Promise.resolve()
  h.request.cancel()
  finishJson(['late'])
  await request
  expect(h.pending[0].signal.aborted).toBe(true)
  expect(h.state()).toEqual({ visible: [], errors: 0, settled: 0 })
})

test('a hung request times out, allowing a later poll to recover', async () => {
  const h = harness(5)
  const hung = h.request.run('/initial')
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(h.pending[0].signal.aborted).toBe(true)
  expect(h.state()).toEqual({ visible: [], errors: 1, settled: 1 })
  const recovery = h.request.run('/poll', true)
  h.pending[1].resolve(Response.json(['recovered']))
  await recovery
  h.pending[0].resolve(Response.json([]))
  await hung
  expect(h.state()).toEqual({ visible: ['recovered'], errors: 1, settled: 2 })
})
