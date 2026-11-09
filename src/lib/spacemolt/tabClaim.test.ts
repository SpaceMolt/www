import { describe, expect, test } from 'bun:test'
import { claimTab, tabLockName, type TabClaim } from './tabClaim'

/** Minimal LockManager: one holder per name, ifAvailable and steal only. */
function fakeLocks() {
  const holders = new Map<string, () => void>()
  const request = (name: string, opts: LockOptions, cb: (lock: Lock | null) => unknown) =>
    new Promise((resolve, reject) => {
      if (holders.has(name) && !opts.steal) return resolve(cb(null))
      holders.get(name)?.()
      holders.set(name, () => reject(new DOMException('stolen', 'AbortError')))
      Promise.resolve(cb({ name, mode: 'exclusive' } as Lock)).then((v) => {
        holders.delete(name)
        resolve(v)
      })
    })
  return { locks: { request } as unknown as LockManager, holders }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('claimTab', () => {
  test('held without Web Locks', () => {
    const seen: TabClaim[] = []
    claimTab(undefined, 'p1', false, (c) => seen.push(c))
    expect(seen).toEqual(['held'])
  })

  test('second tab sees elsewhere, takes over, first tab sees elsewhere', async () => {
    const { locks, holders } = fakeLocks()
    const a: TabClaim[] = []
    const b: TabClaim[] = []
    claimTab(locks, 'p1', false, (c) => a.push(c))
    claimTab(locks, 'p1', false, (c) => b.push(c))
    await tick()
    expect(a).toEqual(['held'])
    expect(b).toEqual(['elsewhere'])

    const releaseB = claimTab(locks, 'p1', true, (c) => b.push(c))
    await tick()
    expect(a).toEqual(['held', 'elsewhere'])
    expect(b).toEqual(['elsewhere', 'held'])

    releaseB()
    await tick()
    expect(holders.has(tabLockName('p1'))).toBe(false)
  })

  test('different players do not conflict', async () => {
    const { locks } = fakeLocks()
    const seen: TabClaim[] = []
    claimTab(locks, 'p1', false, (c) => seen.push(c))
    claimTab(locks, 'p2', false, (c) => seen.push(c))
    await tick()
    expect(seen).toEqual(['held', 'held'])
  })
})
