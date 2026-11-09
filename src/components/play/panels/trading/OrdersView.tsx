'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ClipboardList,
  RefreshCw,
  X,
  Plus,
  Users,
  Pencil,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  Tags,
} from 'lucide-react'
import { useCargo, useCommandMutation, useCommandQuery, useLocationState, usePlayer, useStations } from '@/lib/spacemolt'
import type { Commands, MutationResult } from '@spacemolt/lib'
import { ConfirmAction, Credits, errorMessage, shared } from '../../shared'
import { usePlay } from '../../PlayProvider'
import { getItem, formatItemId } from '@/data/catalog'
import { BulkOrderForm, type InventoryRow } from './BulkOrderForm'
import { chunk } from '../../shared/itemSelection'
import { BULK_ORDER_LIMIT, stationsInOrdersHint, sumBulk } from './tradingLogic'
import { usePersonalStorage } from './StorageView'
import styles from './OrdersView.module.css'
import { timeAgoOrDate } from '@/lib/format'

type SortBy = 'newest' | 'oldest' | 'price_asc' | 'price_desc'
const PAGE_SIZE = 50

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

/** Tradeable cargo + station storage, merged per item. */
function mergeInventory(stacks: Array<{ item_id?: string; quantity?: number }>): InventoryRow[] {
  const map = new Map<string, InventoryRow>()
  for (const { item_id, quantity } of stacks) {
    if (!item_id || !quantity || quantity <= 0) continue
    const cat = getItem(item_id)
    if (cat?.tradeable === false) continue
    const prev = map.get(item_id)
    map.set(item_id, { item_id, name: cat?.name ?? formatItemId(item_id), quantity: (prev?.quantity ?? 0) + quantity })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function OrdersView() {
  const { uiStore } = usePlay()
  const location = useLocationState()
  const dockedAt = location?.docked_at ?? ''
  const isDocked = Boolean(dockedAt)
  const player = usePlayer()
  const hasFaction = Boolean(player?.faction_id)
  const cargo = useCargo()
  const mutate = useCommandMutation()

  const toast = useCallback(
    (kind: 'danger' | 'warning' | 'success', text: string) => uiStore.dispatch({ type: 'toast', kind, text }),
    [uiStore],
  )

  // Undocked, view any station's orders by id; defaults to the last station we docked at.
  const [stationInput, setStationInput] = useState(dockedAt)
  useEffect(() => { if (dockedAt) setStationInput(dockedAt) }, [dockedAt])
  // Docked, another station picked from the chips below; managing orders is for the docked station only.
  const [otherStation, setOtherStation] = useState('')
  useEffect(() => { setOtherStation('') }, [dockedAt])
  const stationId = isDocked ? otherStation || undefined : stationInput.trim() || undefined
  const canView = isDocked || Boolean(stationId)
  const isHere = isDocked && !otherStation
  const stationNames = useStations().data
  const stationName = (id: string) => stationNames?.find((s) => s.id === id)?.name ?? formatItemId(id)

  const [page, setPage] = useState(1)
  const [orderType, setOrderType] = useState<'' | 'buy' | 'sell'>('')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [repricing, setRepricing] = useState(false)
  /** A new page, filter, or station shows different orders: start over at page 1 with nothing selected. */
  const resetView = (nextPage = 1) => { setPage(nextPage); setSelected(new Set()); setRepricing(false) }
  useEffect(() => { resetView() }, [dockedAt])

  const filters = {
    page, page_size: PAGE_SIZE, sort_by: sortBy, station_id: stationId,
    order_type: orderType || undefined, search: search || undefined,
  }

  const { data: storageData } = usePersonalStorage({ enabled: isDocked })

  const { data: personalOrdersData, error: ordersError, refetch: refetchPersonalOrders } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_market.view_orders({ scope: 'personal', ...filters })).structuredContent,
    [dockedAt, stationId, page, orderType, sortBy, search],
    { enabled: canView },
  )

  const { data: factionOrdersData } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_market.view_orders({ scope: 'faction', page_size: PAGE_SIZE, station_id: stationId })).structuredContent,
    [dockedAt, stationId, hasFaction],
    { enabled: canView && hasFaction },
  )

  const inventory = useMemo(
    () => mergeInventory([...(cargo ?? []), ...(storageData?.items ?? [])]),
    [cargo, storageData],
  )

  const [showForm, setShowForm] = useState(false)
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<{ message: string; run: () => void } | null>(null)
  const [busy, setBusy] = useState(false)

  /** Runs each call in turn (the lib serializes mutations anyway), then reports one combined result. */
  const runBatches = useCallback(async (verb: string, label: string, calls: Array<(c: Commands) => Promise<MutationResult>>) => {
    setBusy(true)
    const details: unknown[] = []
    try {
      for (const call of calls) details.push((await mutate(call, { label })).delta.details)
    } catch (err) {
      toast('danger', errorMessage(err))
    }
    setBusy(false)
    if (details.length > 0) {
      const { failed, text } = sumBulk(verb, details)
      toast(failed > 0 ? 'warning' : 'success', text)
    }
    setSelected(new Set())
    setRepricing(false)
    refetchPersonalOrders()
  }, [mutate, toast, refetchPersonalOrders])

  // scope:'personal' returns every order this player placed, including ones
  // placed under the faction (Company Store); exclude those here since the
  // scope:'faction' query below already lists them (with the placing member's name).
  const personalOrders = (personalOrdersData?.orders ?? []).filter((o) => !o.faction_order)
  const factionOrders = factionOrdersData?.orders ?? []
  const allSelected = personalOrders.length > 0 && personalOrders.every((o) => selected.has(o.order_id))

  const toggleSelected = (orderId: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(orderId)) next.delete(orderId)
    else next.add(orderId)
    return next
  })

  const cancelSelected = () => {
    const ids = [...selected]
    setConfirm({
      message: `Cancel ${ids.length} order${ids.length === 1 ? '' : 's'}? Escrow and items return to you.`,
      run: () => runBatches('Orders cancelled:', 'cancel_order', chunk(ids, BULK_ORDER_LIMIT).map((order_ids) => (c) => c.spacemolt_market.cancel_order({ order_ids }))),
    })
  }

  const cancelAll = () => setConfirm({
    message: 'Cancel all your orders at this station?',
    run: () => runBatches('Orders cancelled:', 'cancel_order', [(c) => c.spacemolt_market.cancel_order({ order_id: 'all' })]),
  })

  const startReprice = (ids: Set<string>) => {
    setSelected(ids)
    setPrices(Object.fromEntries(personalOrders.filter((o) => ids.has(o.order_id)).map((o) => [o.order_id, String(o.price_each)])))
    setRepricing(true)
  }

  const changedPrices = personalOrders
    .filter((o) => selected.has(o.order_id))
    .map((o) => ({ order_id: o.order_id, new_price: parseInt(prices[o.order_id] ?? '', 10) || 0, old: o.price_each }))
    .filter((o) => o.new_price > 0 && o.new_price !== o.old)
    .map(({ order_id, new_price }) => ({ order_id, new_price }))

  const applyReprice = () => changedPrices.length > 0 && setConfirm({
    message: `Change the price of ${changedPrices.length} order${changedPrices.length === 1 ? '' : 's'}? Raising a sell price costs a 1% fee; buy escrow adjusts.`,
    run: () => runBatches('Orders repriced:', 'modify_order', chunk(changedPrices, BULK_ORDER_LIMIT).map((orders) => (c) => c.spacemolt_market.modify_order({ orders }))),
  })

  const handleCancelOrder = (orderId: string, name: string) => setConfirm({
    message: `Cancel your ${name} order?`,
    run: () => runBatches('Orders cancelled:', 'cancel_order', [(c) => c.spacemolt_market.cancel_order({ order_id: orderId })]),
  })

  const total = personalOrdersData?.total ?? 0
  // Every station with your orders, read from the hint view_orders sends with any station's orders.
  const ordersAt = stationsInOrdersHint(personalOrdersData?.hint)
  const viewing = stationId ?? dockedAt
  const pickStation = (id: string) => {
    if (isDocked) setOtherStation(id === dockedAt ? '' : id)
    else setStationInput(id)
    resetView()
  }
  const totalPages = personalOrdersData?.total_pages ?? 1

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.sectionLabel}>
          <ClipboardList size={12} />
          Your Orders ({total})
          {personalOrdersData?.base && <span className={styles.formHint}> at {personalOrdersData.base}</span>}
        </span>
        <div className={styles.toolbarActions}>
          <button
            className={shared.actionBtn}
            onClick={() => setShowForm(!showForm)}
            disabled={!isDocked}
            title={isDocked ? 'Create new orders' : 'Dock to create orders'}
            type="button"
          >
            <Plus size={13} />
            New
          </button>
          <button className={shared.refreshBtn} onClick={refetchPersonalOrders} title="Refresh orders" type="button">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {ordersAt.length > 0 && (
        <div className={styles.optionRow}>
          <span>Orders at:</span>
          {ordersAt.map((id) => (
            <button
              key={id}
              className={id === viewing ? shared.accentBtn : shared.subtleBtn}
              onClick={() => pickStation(id)}
              type="button"
            >
              {stationName(id)}{id === dockedAt ? ' (here)' : ''}
            </button>
          ))}
        </div>
      )}

      {!isDocked && (
        <div className={styles.optionRow}>
          <input
            className={styles.formInput}
            type="text"
            placeholder="Station id, e.g. nexus_base"
            value={stationInput}
            onChange={(e) => { setStationInput(e.target.value); resetView() }}
            title="View your orders at another station"
          />
          <span className={styles.formHint}>Dock to cancel or change orders.</span>
        </div>
      )}

      {showForm && isDocked && (
        <BulkOrderForm inventory={inventory} onCreated={refetchPersonalOrders} onClose={() => setShowForm(false)} />
      )}

      {/* Filters */}
      <div className={styles.optionRow}>
        <div className={styles.autocompleteInputWrap}>
          <Search size={11} />
          <input
            className={styles.autocompleteInput}
            type="text"
            placeholder="Search item name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onBlur={() => { if (searchInput.trim() !== search) { setSearch(searchInput.trim()); resetView() } }}
          />
        </div>
        <select className={styles.formInput} value={orderType} onChange={(e) => { setOrderType(e.target.value as '' | 'buy' | 'sell'); resetView() }}>
          <option value="">Buy and sell</option>
          <option value="sell">Sell only</option>
          <option value="buy">Buy only</option>
        </select>
        <select className={styles.formInput} value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortBy); resetView() }}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="price_desc">Price high-low</option>
          <option value="price_asc">Price low-high</option>
        </select>
      </div>

      {/* Bulk actions */}
      {isHere && personalOrders.length > 0 && (
        <div className={styles.optionRow}>
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(personalOrders.map((o) => o.order_id)))}
            /> Select page
          </label>
          {repricing ? (
            <>
              <button className={shared.confirmBtn} onClick={applyReprice} disabled={busy || changedPrices.length === 0} type="button">
                <Check size={11} /> Apply {changedPrices.length} price{changedPrices.length === 1 ? '' : 's'}
              </button>
              <button className={shared.subtleBtn} onClick={() => setRepricing(false)} type="button">Stop repricing</button>
            </>
          ) : (
            <>
              <button className={shared.actionBtn} onClick={() => startReprice(selected)} disabled={busy || selected.size === 0} type="button">
                <Tags size={11} /> Reprice ({selected.size})
              </button>
              <button className={shared.dangerBtn} onClick={cancelSelected} disabled={busy || selected.size === 0} type="button">
                <X size={11} /> Cancel ({selected.size})
              </button>
            </>
          )}
          <button className={shared.dangerBtn} onClick={cancelAll} disabled={busy} type="button" title="Cancel every order you have at this station">
            <X size={11} /> Cancel all here
          </button>
        </div>
      )}

      {confirm && (
        <ConfirmAction
          message={confirm.message}
          onConfirm={() => { confirm.run(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Personal orders list */}
      {!canView ? (
        <div className={shared.dockedOnly}>Dock at a base, or enter a station id, to see your orders</div>
      ) : !personalOrdersData ? (
        <div className={styles.loading}>{ordersError || 'Loading orders...'}</div>
      ) : personalOrders.length === 0 ? (
        <div className={shared.emptyState}>{search || orderType ? 'No orders match your filters' : 'No active orders'}</div>
      ) : (
        <div className={styles.orderList}>
          {personalOrders.map((order) => {
            const isRepricing = repricing && selected.has(order.order_id)
            const name = order.item_name ?? formatItemId(order.item_id)
            return (
              <div key={order.order_id} className={styles.orderCard}>
                <div className={styles.orderTop}>
                  {isHere && (
                    <input type="checkbox" checked={selected.has(order.order_id)} onChange={() => toggleSelected(order.order_id)} aria-label={`Select ${name} order`} />
                  )}
                  <OrderBadge type={order.order_type} />
                  <span className={styles.orderItemName}>{name}</span>
                  {isHere && (
                    <>
                      <button
                        className={shared.iconBtn}
                        onClick={() => startReprice(new Set([order.order_id]))}
                        title="Modify price"
                        type="button"
                      >
                        <Pencil size={11} />
                      </button>
                      <button className={shared.dangerBtn} onClick={() => handleCancelOrder(order.order_id, name)} title="Cancel order" type="button">
                        <X size={12} />
                      </button>
                    </>
                  )}
                </div>
                <div className={styles.orderDetails}>
                  <span className={styles.orderDetail}>
                    Qty: {order.remaining}/{order.quantity}
                  </span>
                  {isRepricing ? (
                    <span className={styles.modifyInline}>
                      <span className={styles.modifyLabel}>New price:</span>
                      <input
                        className={styles.modifyInput}
                        type="number"
                        min={1}
                        value={prices[order.order_id] ?? ''}
                        onChange={(e) => setPrices((prev) => ({ ...prev, [order.order_id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyReprice() }}
                      />
                      {order.order_type === 'sell' && parseInt(prices[order.order_id] ?? '', 10) > order.price_each && (
                        <span className={styles.modifyFeeNote}>1% fee on price increase</span>
                      )}
                    </span>
                  ) : (
                    <span className={styles.orderDetail}>
                      Price: <Credits amount={order.price_each} />
                    </span>
                  )}
                  {order.listing_fee > 0 && (
                    <span className={styles.orderDetailDim}>
                      Fee: <Credits amount={order.listing_fee} />
                    </span>
                  )}
                </div>
                <div className={styles.orderMeta}>{formatDate(order.created_at)}</div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.optionRow}>
          <button className={shared.subtleBtn} onClick={() => resetView(page - 1)} disabled={page <= 1} type="button">
            <ChevronLeft size={11} /> Prev
          </button>
          <span className={styles.formHint}>Page {personalOrdersData?.page ?? page} of {totalPages}</span>
          <button className={shared.subtleBtn} onClick={() => resetView(page + 1)} disabled={!personalOrdersData?.has_more} type="button">
            Next <ChevronRight size={11} />
          </button>
        </div>
      )}

      {/* Faction orders */}
      {factionOrders.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.sectionLabel}>
            <Users size={12} />
            Faction Orders ({factionOrdersData?.total ?? factionOrders.length})
            {factionOrdersData?.has_more && <span className={styles.formHint}> showing first {factionOrders.length}</span>}
          </div>
          <div className={styles.orderList}>
            {factionOrders.map((order) => (
              <div key={order.order_id} className={`${styles.orderCard} ${styles.factionCard}`}>
                <div className={styles.orderTop}>
                  <OrderBadge type={order.order_type} />
                  <span className={styles.orderItemName}>{order.item_name ?? formatItemId(order.item_id)}</span>
                  {order.created_by && <span className={styles.createdBy}>by {order.created_by}</span>}
                </div>
                <div className={styles.orderDetails}>
                  <span className={styles.orderDetail}>
                    Qty: {order.remaining}/{order.quantity}
                  </span>
                  <span className={styles.orderDetail}>
                    Price: <Credits amount={order.price_each} />
                  </span>
                </div>
                <div className={styles.orderMeta}>{formatDate(order.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <RecentFills />
    </div>
  )
}

const OrderBadge = ({ type }: { type: string }) => (
  <span className={`${styles.orderTypeBadge} ${type === 'sell' ? styles.badgeSell : styles.badgeBuy}`}>{type.toUpperCase()}</span>
)

/** Exchange fills from the action log (the durable record), refetched on each fill push. */
function RecentFills() {
  const { data } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_social.get_action_log({ event_type: 'trading.exchange_fill', page_size: 10 })).structuredContent,
    [],
    { refreshOnEvents: ['exchange_fill'] },
  )
  const fills = data?.entries ?? []
  if (fills.length === 0) return null
  return (
    <>
      <div className={styles.sectionLabel}>Recent Fills</div>
      <div className={styles.orderList}>
        {fills.map((f) => (
          <div key={f.id} className={styles.orderCard}>
            <div className={styles.orderTop}><span className={styles.orderItemName}>{f.summary}</span></div>
            <div className={styles.orderMeta} title={f.created_at}>{timeAgoOrDate(f.created_at)}</div>
          </div>
        ))}
      </div>
    </>
  )
}
