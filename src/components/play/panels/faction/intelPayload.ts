import type { ViewMarketResponse } from '@spacemolt/lib'

/** One `submit_trade_intel` station entry from the docked market (server decodes strictly: no extra fields). */
export function tradeIntelStation(market: ViewMarketResponse, systemId?: string) {
  return {
    base_id: market.base_id,
    station_name: market.base,
    ...(systemId ? { system_id: systemId } : {}),
    items: market.items
      .filter((i) => i.best_buy > 0 || i.best_sell > 0)
      .map((i) => ({
        item_id: i.item_id,
        item_name: i.item_name,
        best_buy: i.best_buy,
        best_sell: i.best_sell,
        buy_volume: i.buy_quantity,
        sell_volume: i.sell_quantity,
      })),
  }
}
