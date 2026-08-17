/**
 * Unit tests for the ship-catalog tier filter predicate.
 *
 * Regression coverage for dc#626957: with no tier selected the catalogue must
 * show every ship (including tier-0 ships), and selecting a tier must match
 * that tier exactly. The `tier` argument is the raw <select> value (a string).
 */
import { test, expect } from 'bun:test'
import {
  matchesTierFilter,
  EMPIRES,
  fetchCommissionableShipIds,
  commissionableCatalogRequest,
  COMMISSIONABLE_PAGE_SIZE,
  MAX_COMMISSIONABLE_PAGES,
} from './ShipCatalog'
import { expectExactEmpireKeys } from '@/test/canonicalEmpires'

test('no tier selected shows every ship, including tier 0', () => {
  expect(matchesTierFilter({ tier: 0 }, '')).toBe(true)
  expect(matchesTierFilter({ tier: 1 }, '')).toBe(true)
  expect(matchesTierFilter({ tier: 5 }, '')).toBe(true)
})

test('selecting a tier matches that tier exactly', () => {
  expect(matchesTierFilter({ tier: 3 }, '3')).toBe(true)
  expect(matchesTierFilter({ tier: 2 }, '3')).toBe(false)
  expect(matchesTierFilter({ tier: 0 }, '3')).toBe(false)
})

test('selecting tier 1 does not accidentally include tier 0', () => {
  expect(matchesTierFilter({ tier: 1 }, '1')).toBe(true)
  expect(matchesTierFilter({ tier: 0 }, '1')).toBe(false)
})

test('EMPIRES filter options are exactly the 5 canonical empire ids (no stray, typo\'d, or missing entries)', () => {
  expectExactEmpireKeys(EMPIRES)
})

/**
 * Regression coverage for dc#108959: the shipyard tab asked for one 500-item
 * page of commissionable ships, but the server clamps `page_size` to 50 and
 * sorts commissionable hulls cheapest-first. Every hull past the 50th (the
 * expensive ones) therefore lost its Commission button. The client must walk
 * every page the server reports.
 */

/** Fake server: clamps page_size like the real catalog and paginates `ids`. */
function fakeCatalog(ids: string[], opts: { omitTotalPages?: boolean } = {}) {
  const calls: number[] = []
  const query = async (page: number) => {
    calls.push(page)
    const size = COMMISSIONABLE_PAGE_SIZE
    const start = (page - 1) * size
    const payload: Record<string, unknown> = {
      items: ids.slice(start, start + size).map((id) => ({ id })),
      total: ids.length,
      page,
      page_size: size,
    }
    if (!opts.omitTotalPages) payload.total_pages = Math.max(1, Math.ceil(ids.length / size))
    return payload
  }
  return { calls, query }
}

test('collects every commissionable id across pages, not just the first 50', async () => {
  const ids = Array.from({ length: 137 }, (_, i) => `ship_${i}`)
  const { calls, query } = fakeCatalog(ids)

  const result = await fetchCommissionableShipIds(query)

  expect(result.size).toBe(137)
  expect(result.has('ship_0')).toBe(true)
  expect(result.has('ship_136')).toBe(true)
  expect(calls).toEqual([1, 2, 3])
})

test('a single page of results costs exactly one request', async () => {
  const { calls, query } = fakeCatalog(['ship_a', 'ship_b'])
  const result = await fetchCommissionableShipIds(query)
  expect([...result]).toEqual(['ship_a', 'ship_b'])
  expect(calls).toEqual([1])
})

test('an empty commissionable set costs one request and yields no ids', async () => {
  const { calls, query } = fakeCatalog([])
  const result = await fetchCommissionableShipIds(query)
  expect(result.size).toBe(0)
  expect(calls).toEqual([1])
})

test('missing total_pages falls back to total/page_size instead of truncating', async () => {
  const ids = Array.from({ length: 60 }, (_, i) => `ship_${i}`)
  const { calls, query } = fakeCatalog(ids, { omitTotalPages: true })
  const result = await fetchCommissionableShipIds(query)
  expect(result.size).toBe(60)
  expect(calls).toEqual([1, 2])
})

test('an undefined or malformed payload yields no ids and no extra requests', async () => {
  let calls = 0
  const result = await fetchCommissionableShipIds(async () => {
    calls++
    return undefined
  })
  expect(result.size).toBe(0)
  expect(calls).toBe(1)
})

test('a server that always claims more pages is bounded and stops on an empty page', async () => {
  let calls = 0
  const liar = await fetchCommissionableShipIds(async (page) => {
    calls++
    return { items: [{ id: `ship_${page}` }], total_pages: 9999, total: 999999, page_size: COMMISSIONABLE_PAGE_SIZE }
  })
  expect(calls).toBe(MAX_COMMISSIONABLE_PAGES)
  expect(liar.size).toBe(MAX_COMMISSIONABLE_PAGES)

  let emptyCalls = 0
  const stops = await fetchCommissionableShipIds(async (page) => {
    emptyCalls++
    return { items: page === 1 ? [{ id: 'ship_1' }] : [], total_pages: 9999 }
  })
  expect(emptyCalls).toBe(2)
  expect(stops.size).toBe(1)
})

test('the request the panel sends asks for one clamp-sized page at a time', () => {
  // The bug was the request itself: page_size 500 with no page argument, which
  // the server clamped to a single cheapest-first page of 50.
  expect(commissionableCatalogRequest(1)).toEqual({ type: 'ships', commissionable: true, page_size: 50, page: 1 })
  expect(commissionableCatalogRequest(4).page).toBe(4)
  expect(COMMISSIONABLE_PAGE_SIZE).toBeLessThanOrEqual(50)
})

test('a failed later page keeps the ids already collected', async () => {
  const result = await fetchCommissionableShipIds(async (page) => {
    if (page > 1) throw new Error('network')
    return { items: [{ id: 'ship_1' }, { id: 'ship_2' }], total_pages: 3, total: 120, page_size: COMMISSIONABLE_PAGE_SIZE }
  })
  expect([...result]).toEqual(['ship_1', 'ship_2'])
})

test('a failed first page propagates so the panel can show the error', async () => {
  await expect(fetchCommissionableShipIds(async () => { throw new Error('network') })).rejects.toThrow('network')
})
