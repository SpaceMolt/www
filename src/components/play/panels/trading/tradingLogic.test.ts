import { describe, expect, test } from 'bun:test'
import type { MarketBook, ViewMarketResponse } from '@spacemolt/lib'
import { giftFromLog, mergeLiveBook, sumBulk } from './tradingLogic'
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

test('sumBulk totals bulk chunks and keeps the first error', () => {
  const outcome = sumBulk('Created', [
    { kind: 'bulk', results: [{ success: true }, { success: false, error: 'not enough items' }] },
    { kind: 'bulk', results: [{ success: false, error: 'later' }, { success: true }] },
    { kind: 'single', message: 'ok' },
  ])
  expect(outcome).toEqual({ failed: 2, text: 'Created 3, 2 failed: not enough items' })
  expect(sumBulk('Cancelled', [{}, {}, {}, {}])).toEqual({ failed: 0, text: 'Cancelled 4' })
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

describe('giftFromLog', () => {
  const at = '2026-11-08T10:00:00Z'
  test('reads single, bulk, credit and ship gift receipts', () => {
    expect(giftFromLog({ id: 1, created_at: at, data: { sender: 'Nova', item_id: 'iron_ore', quantity: 5, credits: 100 } }))
      .toEqual({ id: 1, at, sender: 'Nova', items: [{ item_id: 'iron_ore', quantity: 5 }], credits: 100 })
    expect(giftFromLog({ id: 2, created_at: at, data: { sender: 'Nova', items: { iron_ore: 3, copper_ore: 2 } } }).items)
      .toEqual([{ item_id: 'iron_ore', quantity: 3 }, { item_id: 'copper_ore', quantity: 2 }])
    expect(giftFromLog({ id: 3, created_at: at, data: { sender: 'Nova', class_id: 'prospect' } }).shipClass).toBe('prospect')
  })
})

describe('giftFromLog with production receipt shapes', () => {
  const at = '2026-11-09T12:00:00Z'
  test('single item from storage', () => {
    expect(giftFromLog({ id: 10, created_at: at, data: { sender: 'Alpha Test', source: 'storage', item_id: 'liquid_hydrogen', quantity: 177, recipient: 'Bravo Test' } }))
      .toEqual({ id: 10, at, sender: 'Alpha Test', items: [{ item_id: 'liquid_hydrogen', quantity: 177 }], credits: 0 })
  })
  test('bulk items map', () => {
    expect(giftFromLog({ id: 11, created_at: at, data: { items: { null_matter: 75 }, sender: 'Alpha Test', source: 'storage', recipient: 'Bravo Test' } }))
      .toEqual({ id: 11, at, sender: 'Alpha Test', items: [{ item_id: 'null_matter', quantity: 75 }], credits: 0 })
  })
  test('credits only', () => {
    expect(giftFromLog({ id: 12, created_at: at, data: { sender: 'Alpha Test', credits: 9118, recipient: 'Bravo Test' } }))
      .toEqual({ id: 12, at, sender: 'Alpha Test', items: [], credits: 9118 })
  })
  test('ship gift (ship.gift_received)', () => {
    expect(giftFromLog({ id: 13, created_at: at, data: { sender: 'Alpha Test', base_id: 'grand_exchange_station', ship_id: 'abc123', class_id: 'frost_dividend', recipient: 'Bravo Test' } }))
      .toEqual({ id: 13, at, sender: 'Alpha Test', items: [], credits: 0, shipClass: 'frost_dividend' })
  })
})
