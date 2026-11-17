'use client'

import { useEffect, useState } from 'react'
import { ItemChips, Notes } from '../../shared'
import { formatNumber } from '@/lib/format'

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const SHOWN = 12

type Entry = {
  item_id: string
  item_name: string
  best_bid: number
  best_ask: number
  bid_quantity_station_mgr?: number
  ask_quantity_station_mgr?: number
}

/** The station manager's open orders, biggest by value first, as chips. */
function chipsOf(items: Entry[], side: 'bid' | 'ask') {
  const qty = (e: Entry) => (side === 'bid' ? e.bid_quantity_station_mgr : e.ask_quantity_station_mgr) ?? 0
  const price = (e: Entry) => (side === 'bid' ? e.best_bid : e.best_ask)
  const rows = items.filter((e) => qty(e) > 0).sort((a, b) => qty(b) * price(b) - qty(a) * price(a))
  const chips = rows.slice(0, SHOWN).map((e) => ({
    id: e.item_id,
    name: e.item_name,
    value: `${formatNumber(qty(e))} @ ${formatNumber(price(e))} cr`,
    tip: side === 'bid'
      ? `The station wants ${formatNumber(qty(e))}. Best bid ${formatNumber(price(e))} cr. A player can hold the best bid.`
      : `The station sells ${formatNumber(qty(e))}. Best ask ${formatNumber(price(e))} cr. A player can hold the best ask.`,
  }))
  return { chips, more: rows.length - chips.length }
}

const titleOf = (label: string, more: number) => (more > 0 ? `${label} (top ${SHOWN}, ${more} more)` : label)

/**
 * What the station manager buys and sells here, from the public station market
 * summary. Player-owned stations have no manager, so they show nothing.
 */
export function StationDemand({ baseId }: { baseId: string }) {
  const [items, setItems] = useState<Entry[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    setItems(null)
    setFailed(false)
    fetch(`${API_BASE}/api/market/station/${encodeURIComponent(baseId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { items?: Entry[] }) => live && setItems(d.items ?? []))
      .catch(() => live && setFailed(true))
    return () => { live = false }
  }, [baseId])

  if (failed) return <Notes notes={['Market data is not available for this station.']} />
  if (!items) return null
  const buys = chipsOf(items, 'bid')
  const sells = chipsOf(items, 'ask')
  if (!buys.chips.length && !sells.chips.length) return <Notes notes={['The station has no open buy or sell orders here.']} />

  return (
    <>
      <ItemChips title={titleOf('Station is buying', buys.more)} items={buys.chips} />
      <ItemChips title={titleOf('Station is selling', sells.more)} items={sells.chips} />
    </>
  )
}
