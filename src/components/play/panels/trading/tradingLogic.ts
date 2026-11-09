import type { MarketBook, ViewMarketResponse } from '@spacemolt/lib'

type MarketItem = ViewMarketResponse['items'][number]
type Level = MarketItem['buy_orders'][number]
type LiveLevel = { price_each: number; quantity: number; source?: string }

/** Server cap on orders[] per create_*_order / modify_order call. */
export const BULK_ORDER_LIMIT = 50

/** A market row with no orders: an item the snapshot does not list yet. */
export const emptyMarketItem = (item_id: string, item_name: string, category: string): MarketItem => ({
  item_id, item_name, category,
  buy_orders: [], sell_orders: [], best_buy: 0, best_buy_qty: 0, best_sell: 0, best_sell_qty: 0,
  buy_price: 0, buy_quantity: 0, sell_price: 0, sell_quantity: 0,
})

/** Live levels carry no my_quantity; keep ours from the last view_market at the same price, capped by what is left. */
const withMine = (live: LiveLevel[], old: Level[]): Level[] =>
  live.map((level) => {
    const mine = old.find((o) => o.price_each === level.price_each)?.my_quantity
    return mine ? { ...level, my_quantity: Math.min(mine, level.quantity) } : level
  })

const best = (levels: Level[], pick: (a: number, b: number) => number) =>
  levels.reduce<Level | null>((top, l) => (!top || pick(l.price_each, top.price_each) === l.price_each ? l : top), null)

/**
 * Overlay the live order book (subscribe_market + market_update pushes) on a view_market snapshot.
 * Items the book does not carry (fuel, Company Store orders) keep their snapshot levels.
 */
export function mergeLiveBook(items: MarketItem[], book: MarketBook | null): MarketItem[] {
  if (!book) return items
  const merged = items.map((item) => {
    const live = book.items.get(item.item_id)
    if (!live) return item
    const buy_orders = withMine(live.buy_orders, item.buy_orders)
    const sell_orders = withMine(live.sell_orders, item.sell_orders)
    const bid = best(buy_orders, Math.max)
    const ask = best(sell_orders, Math.min)
    return {
      ...item,
      buy_orders,
      sell_orders,
      best_buy: bid?.price_each ?? 0,
      best_buy_qty: bid?.quantity ?? 0,
      best_sell: ask?.price_each ?? 0,
      best_sell_qty: ask?.quantity ?? 0,
      spread: bid && ask ? ask.price_each - bid.price_each : undefined,
    }
  })
  const known = new Set(items.map((i) => i.item_id))
  const added = [...book.items.values()]
    .filter((live) => !known.has(live.item_id) && (live.buy_orders.length > 0 || live.sell_orders.length > 0))
    .map((live) => mergeLiveBook([emptyMarketItem(live.item_id, live.item_name ?? live.item_id, live.category ?? 'other')], book)[0])
  return [...merged, ...added]
}

type BulkResult = { success: boolean; error?: string }
type BulkOutcome = { ok: number; failed: number; firstError?: string }

/**
 * Sum the per-entry results of bulk create/modify/cancel responses (one per chunk) and word them after `verb`.
 * Single-mode responses count as one success.
 */
export function sumBulk(verb: string, details: unknown[]): { failed: number; text: string } {
  const { ok, failed, firstError } = details.reduce<BulkOutcome>((acc, d) => {
    const results = (d as { results?: BulkResult[] } | undefined)?.results
    if (!results) return { ...acc, ok: acc.ok + 1 }
    const failures = results.filter((r) => !r.success)
    return {
      ok: acc.ok + results.length - failures.length,
      failed: acc.failed + failures.length,
      firstError: acc.firstError ?? failures.find((f) => f.error)?.error,
    }
  }, { ok: 0, failed: 0 })
  return { failed, text: failed === 0 ? `${verb} ${ok}` : `${verb} ${ok}, ${failed} failed${firstError ? `: ${firstError}` : ''}` }
}

/**
 * One received gift, read back from its action-log receipt. The gameserver's gift receipts (`trading.gift_received`, `ship.gift_received`) carry the
 * sender and either item_id+quantity, a bulk `items` map, credits, or a ship class_id.
 */
export function giftFromLog(entry: { id: number; created_at: string; data?: object }) {
  const d = (entry.data ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' ? v : 0)
  const bulk = d.items && typeof d.items === 'object' ? Object.entries(d.items as Record<string, unknown>) : []
  const items = typeof d.item_id === 'string'
    ? [{ item_id: d.item_id, quantity: num(d.quantity) }]
    : bulk.map(([item_id, quantity]) => ({ item_id, quantity: num(quantity) }))
  return {
    id: entry.id,
    at: entry.created_at,
    sender: typeof d.sender === 'string' ? d.sender : 'someone',
    items,
    credits: num(d.credits),
    ...(typeof d.class_id === 'string' && { shipClass: d.class_id }),
  }
}

/**
 * Station ids with active orders, from view_orders' hint ("2 buy orders and 1 sell orders on the
 * market at sol_central, nexus_base (...)"). The hint is prose; this returns [] if its wording changes.
 */
export function stationsInOrdersHint(hint?: string): string[] {
  const list = hint?.match(/on the market at (.+?) \(/)?.[1]
  return list ? list.split(', ').filter(Boolean) : []
}
