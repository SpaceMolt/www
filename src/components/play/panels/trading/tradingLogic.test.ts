import { describe, expect, test } from 'bun:test'
import type { MarketBook, ViewMarketResponse } from '@spacemolt/lib'
import { chunk, describeBulk, mergeLiveBook, sumBulk } from './tradingLogic'
import { mergeTradeSnapshot } from '@/lib/spacemolt/wireNotifications'

type MarketItem = ViewMarketResponse['items'][number]

const item = (over: Partial<MarketItem>): MarketItem => ({
  item_id: 'iron_ore', item_name: 'Iron Ore', category: 'ore',
  buy_orders: [], sell_orders: [], best_buy: 0, best_buy_qty: 0, best_sell: 0, best_sell_qty: 0,
  buy_price: 0, buy_quantity: 0, sell_price: 0, sell_quantity: 0, ...over,
})

const book = (items: MarketBook['items'] extends Map<string, infer V> ? V[] : never): MarketBook => ({
  base_id: 'b', tick: 1, items: new Map(items.map((i) => [i.item_id, i])),
})

describe('mergeLiveBook', () => {
  test('replaces levels, keeps my_quantity at matching prices, recomputes best and spread', () => {
    const snapshot = [item({
      sell_orders: [{ price_each: 10, quantity: 5, my_quantity: 5 }, { price_each: 12, quantity: 3 }],
      buy_orders: [{ price_each: 6, quantity: 4 }],
    })]
    const [merged] = mergeLiveBook(snapshot, book([{
      item_id: 'iron_ore',
      sell_orders: [{ price_each: 10, quantity: 2 }, { price_each: 9, quantity: 1 }],
      buy_orders: [{ price_each: 7, quantity: 8 }, { price_each: 6, quantity: 1 }],
    }]))
    expect(merged.sell_orders).toEqual([{ price_each: 10, quantity: 2, my_quantity: 2 }, { price_each: 9, quantity: 1 }])
    expect([merged.best_sell, merged.best_sell_qty, merged.best_buy, merged.best_buy_qty]).toEqual([9, 1, 7, 8])
    expect(merged.spread).toBe(2)
  })

  test('leaves items the book lacks, adds new book items with orders, skips empty ones', () => {
    const fuel = item({ item_id: 'fuel', sell_orders: [{ price_each: 1, quantity: 9 }] })
    const merged = mergeLiveBook([fuel], book([
      { item_id: 'gold', item_name: 'Gold', category: 'ore', buy_orders: [{ price_each: 50, quantity: 1 }], sell_orders: [] },
      { item_id: 'tin', buy_orders: [], sell_orders: [] },
    ]))
    expect(merged.map((m) => m.item_id)).toEqual(['fuel', 'gold'])
    expect(merged[0]).toBe(fuel)
    expect(merged[1].best_buy).toBe(50)
  })

  test('no book returns the snapshot', () => {
    const snapshot = [item({})]
    expect(mergeLiveBook(snapshot, null)).toBe(snapshot)
  })
})

test('chunk splits into server-sized batches', () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  expect(chunk(Array.from({ length: 51 }, (_, i) => i)).map((c) => c.length)).toEqual([50, 1])
})

test('sumBulk totals bulk chunks and keeps the first error', () => {
  const outcome = sumBulk([
    { kind: 'bulk', results: [{ success: true }, { success: false, error: 'not enough items' }] },
    { kind: 'bulk', results: [{ success: false, error: 'later' }, { success: true }] },
    { kind: 'single', message: 'ok' },
  ])
  expect(outcome).toEqual({ ok: 3, failed: 2, firstError: 'not enough items' })
  expect(describeBulk('Created', outcome)).toBe('Created 3, 2 failed: not enough items')
  expect(describeBulk('Cancelled', { ok: 4, failed: 0 })).toBe('Cancelled 4')
})

test('mergeTradeSnapshot keeps known trades, adds new ones, drops closed ones', () => {
  const known = { trade_id: 't1', offerer_id: 'p1', offerer_name: 'Ann', station_id: 'base_a' }
  const gone = { trade_id: 't0', offerer_id: 'p0' }
  const merged = mergeTradeSnapshot([gone, known], [
    { trade_id: 't1', expires_at: '', offer_items: [], request_items: [] },
    { trade_id: 't2', expires_at: '', offerer_name: 'Bo', offer_credits: 5, offer_items: [], request_items: [] },
  ])
  expect(merged[0]).toBe(known)
  expect(merged.map((t) => t.trade_id)).toEqual(['t1', 't2'])
  expect(merged[1]).toMatchObject({ offerer_id: '', offerer_name: 'Bo', offer_credits: 5 })
})
