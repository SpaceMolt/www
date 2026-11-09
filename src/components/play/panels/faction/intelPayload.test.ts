import { expect, test } from 'bun:test'
import type { ViewMarketResponse } from '@spacemolt/lib'
import { tradeIntelStation } from './intelPayload'

const item = (item_id: string, best_buy: number, best_sell: number) => ({
  item_id, item_name: item_id.toUpperCase(), best_buy, best_sell, best_buy_qty: 1, best_sell_qty: 1,
  buy_orders: [], sell_orders: [], buy_price: 0, buy_quantity: 7, sell_price: 0, sell_quantity: 3, category: 'ore',
})

test('maps the docked market to one trade-intel station and drops items with no orders', () => {
  const market = {
    action: 'view_market', base: 'Nexus Station', base_id: 'nexus_base', current_tick: 1,
    items: [item('iron_ore', 10, 12), item('empty', 0, 0)],
  } as ViewMarketResponse
  expect(tradeIntelStation(market, 'nexus_prime')).toEqual({
    base_id: 'nexus_base', station_name: 'Nexus Station', system_id: 'nexus_prime',
    items: [{ item_id: 'iron_ore', item_name: 'IRON_ORE', best_buy: 10, best_sell: 12, buy_volume: 7, sell_volume: 3 }],
  })
  expect(tradeIntelStation(market)).not.toHaveProperty('system_id')
})
