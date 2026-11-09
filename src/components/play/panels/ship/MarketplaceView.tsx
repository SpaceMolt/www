'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Heart,
  ShoppingCart,
  AlertTriangle,
  User,
  X,
  Tag,
  Loader2,
  ClipboardList,
} from 'lucide-react'
import type { BrowseShipsResponse } from '@spacemolt/lib'
import { useCommandMutation, useCommandQuery, useLocationState, usePlayer } from '@/lib/spacemolt'
import { allShips } from '@/data/catalog'
import { usePlay } from '../../PlayProvider'
import { Credits, Loading, Modal, ConfirmAction, errorMessage, shared } from '../../shared'
import styles from './MarketplaceView.module.css'

type ShipListing = BrowseShipsResponse['listings'][number]
type ShipBuyOrder = NonNullable<BrowseShipsResponse['buy_orders']>[number]

export function MarketplaceView() {
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const player = usePlayer()
  const credits = player?.credits ?? 0
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()

  const { data: browseData, loading: loadingBrowse, refetch: refetchListings } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_ship.browse_ships({})).structuredContent,
    [],
    { enabled: isDocked }
  )
  const listings = browseData?.listings ?? []

  const { data: fleet, refetch: refetchFleet } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_ship.list_ships()).structuredContent,
    [],
    { enabled: isDocked, refreshOnSections: ['ship'] }
  )

  const [buyConfirm, setBuyConfirm] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [buying, setBuying] = useState(false)

  // Sell modal
  const [sellShipId, setSellShipId] = useState<string | null>(null)
  const [sellPrice, setSellPrice] = useState('')
  const [selling, setSelling] = useState(false)

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorMessage(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    },
    [uiStore]
  )

  // Ship buy orders: mine across all bases, plus a form to place one here.
  const { data: myBuyOrders, refetch: refetchMyBuyOrders } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_ship.view_ship_buy_orders()).structuredContent,
    [],
  )
  const [orderClass, setOrderClass] = useState('')
  const [orderPrice, setOrderPrice] = useState('')
  const [shipConfirm, setShipConfirm] = useState<{ message: string; run: () => Promise<unknown> } | null>(null)
  const shipClasses = useMemo(() => [...allShips()].sort((a, b) => a.name.localeCompare(b.name)), [])

  const runShipOrder = useCallback(async (run: () => Promise<unknown>) => {
    setShipConfirm(null)
    try {
      await run()
      refetchListings()
      refetchFleet()
      refetchMyBuyOrders()
    } catch (err) {
      reportError(err)
    }
  }, [refetchListings, refetchFleet, refetchMyBuyOrders, reportError])

  const placeOrder = () => {
    const price = parseInt(orderPrice, 10)
    const name = shipClasses.find((c) => c.id === orderClass)?.name ?? orderClass
    setShipConfirm({
      message: `Escrow ${price.toLocaleString()} cr plus sales tax for a ${name} buy order here?`,
      run: () => mutate((c) => c.spacemolt_ship.place_ship_buy_order({ id: orderClass, price }), { label: 'place_ship_buy_order' })
        .then(() => { setOrderClass(''); setOrderPrice('') }),
    })
  }

  const handleBuy = useCallback(
    (listingId: string) => {
      setBuying(true)
      mutate((c) => c.spacemolt_ship.buy_listed_ship({ id: listingId }), { label: 'buy_listed_ship' })
        .then(() => {
          setBuying(false)
          setBuyConfirm(null)
          refetchListings()
          refetchFleet()
        })
        .catch((err) => {
          setBuying(false)
          reportError(err)
        })
    },
    [mutate, refetchListings, refetchFleet, reportError]
  )

  const handleCancelListing = useCallback(
    (listingId: string) => {
      mutate((c) => c.spacemolt_ship.cancel_ship_listing({ id: listingId }), { label: 'cancel_ship_listing' })
        .then(() => {
          setCancelConfirm(null)
          refetchListings()
        })
        .catch(reportError)
    },
    [mutate, refetchListings, reportError]
  )

  const handleSell = useCallback(() => {
    if (!sellShipId || !sellPrice) return
    const price = parseInt(sellPrice, 10)
    if (isNaN(price) || price <= 0) return
    setSelling(true)
    mutate((c) => c.spacemolt_ship.list_ship_for_sale({ id: sellShipId, price }), { label: 'list_ship_for_sale' })
      .then(() => {
        setSelling(false)
        setSellShipId(null)
        setSellPrice('')
        refetchListings()
        refetchFleet()
      })
      .catch((err) => {
        setSelling(false)
        reportError(err)
      })
  }, [sellShipId, sellPrice, mutate, refetchListings, refetchFleet, reportError])

  if (!isDocked) {
    return (
      <div className={shared.dockedOnly}>
        Dock at a base to browse ship listings
      </div>
    )
  }

  const playerName = player?.username
  const ownListings = listings.filter((l) => l.seller === playerName)
  const otherListings = listings.filter((l) => l.seller !== playerName)

  // Ships available to sell: inactive, docked at this base
  const dockedAt = location?.docked_at ?? undefined
  const availableShips = fleet?.ships.filter(
    (s) => !s.is_active && s.location_base_id === dockedAt
  ) ?? []

  const otherBuyOrders = (browseData?.buy_orders ?? []).filter((o) => o.buyer !== playerName)

  // Ship being sold (for modal)
  const sellShipInfo = availableShips.find((s) => s.ship_id === sellShipId)

  return (
    <>
      {/* Ships for sale */}
      {loadingBrowse && listings.length === 0 && (
        <Loading message="Loading listings..." />
      )}

      {!loadingBrowse && otherListings.length === 0 && ownListings.length === 0 && (
        <div className={shared.emptyState}>No ships currently for sale at this base.</div>
      )}

      {(otherListings.length > 0 || ownListings.length > 0) && (
        <>
          <span className={shared.sectionTitle}>Ships For Sale</span>
          <div className={styles.listingsList}>
            {/* Other players' listings */}
            {otherListings.map((listing) => {
              const canAfford = credits >= listing.price
              return (
                <div key={listing.listing_id} className={styles.listingCard}>
                  <div className={styles.listingTop}>
                    <div className={styles.listingInfo}>
                      <span className={styles.listingName}>{listing.ship_name}</span>
                      <span className={styles.listingClass}>{listing.class_id}</span>
                    </div>
                    <span className={canAfford ? styles.listingPrice : styles.listingPriceUnaffordable}>
                      <Credits amount={listing.price} />
                    </span>
                  </div>
                  <div className={styles.listingBadges}>
                    {listing.category && <span className={shared.badgeGreen}>{listing.category}</span>}
                    {(listing.tier ?? 0) > 0 && <span className={shared.badgeCyan}>T{listing.tier}</span>}
                  </div>
                  <div className={styles.listingStatsRow}>
                    <div className={styles.listingStat}>
                      <Heart size={10} /> Hull {listing.hull}/{listing.max_hull}
                    </div>
                    <div className={styles.listingStat}>
                      <User size={10} /> {listing.seller}
                    </div>
                  </div>

                  {buyConfirm === listing.listing_id ? (
                    <ConfirmAction
                      message={`Buy for ${listing.price.toLocaleString()} cr?`}
                      icon={<ShoppingCart size={14} style={{ color: 'var(--void-purple)', flexShrink: 0 }} />}
                      onConfirm={() => handleBuy(listing.listing_id)}
                      onCancel={() => setBuyConfirm(null)}
                      confirmDisabled={buying || !canAfford}
                      variant="accent"
                    />
                  ) : (
                    <button
                      className={shared.accentBtn}
                      onClick={() => setBuyConfirm(listing.listing_id)}
                      disabled={!canAfford}
                      title={!canAfford ? `Need ${(listing.price - credits).toLocaleString()} more credits` : undefined}
                      type="button"
                    >
                      <ShoppingCart size={12} /> Buy
                    </button>
                  )}
                </div>
              )
            })}

            {/* Own listings */}
            {ownListings.map((listing) => (
              <div key={listing.listing_id} className={styles.listingCardOwn}>
                <div className={styles.listingTop}>
                  <div className={styles.listingInfo}>
                    <span className={styles.listingName}>{listing.ship_name}</span>
                    <span className={styles.listingClass}>{listing.class_id}</span>
                  </div>
                  <span className={styles.listingPrice}><Credits amount={listing.price} /></span>
                </div>
                <div className={styles.listingBadges}>
                  <span className={shared.badgeGreen}>Your listing</span>
                </div>
                {cancelConfirm === listing.listing_id ? (
                  <ConfirmAction
                    message="Cancel listing?"
                    icon={<AlertTriangle size={14} style={{ color: 'var(--claw-red)', flexShrink: 0 }} />}
                    onConfirm={() => handleCancelListing(listing.listing_id)}
                    onCancel={() => setCancelConfirm(null)}
                  />
                ) : (
                  <button className={shared.dangerBtn} onClick={() => setCancelConfirm(listing.listing_id)} type="button">
                    <X size={12} /> Cancel Listing
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {shipConfirm && (
        <ConfirmAction
          message={shipConfirm.message}
          variant="accent"
          onConfirm={() => runShipOrder(shipConfirm.run)}
          onCancel={() => setShipConfirm(null)}
        />
      )}

      {/* Other pilots' standing ship buy orders at this base */}
      {otherBuyOrders.length > 0 && (
        <>
          <span className={shared.sectionTitle}>Wanted Here</span>
          <div className={styles.listingsList}>
            {otherBuyOrders.map((order) => {
              const match = availableShips.find((s) => s.class_id === order.class_id)
              return (
                <div key={order.order_id} className={styles.sellCard}>
                  <div className={styles.listingInfo}>
                    <span className={styles.listingName}>{order.class_name || order.class_id}</span>
                    <span className={styles.listingClass}>{order.buyer}</span>
                  </div>
                  <span className={styles.listingPrice}><Credits amount={order.price} /></span>
                  <button
                    className={shared.warningBtn}
                    disabled={!match}
                    title={match ? 'Sell your stored ship into this order' : 'You have no matching inactive ship docked here'}
                    onClick={() => match && setShipConfirm({
                      message: `Sell your ${match.class_name || match.class_id} for ${order.price.toLocaleString()} cr?`,
                      run: () => mutate((c) => c.spacemolt_ship.sell_ship_to_order({ id: order.order_id, ship_id: match.ship_id }), { label: 'sell_ship_to_order' }),
                    })}
                    type="button"
                  >
                    <Tag size={12} /> Sell
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Sell a ship */}
      <span className={shared.sectionTitle}>Sell a Ship</span>
      {availableShips.length === 0 ? (
        <div className={shared.emptyState}>No ships available to sell. Ships must be inactive and docked here.</div>
      ) : (
        <div className={styles.listingsList}>
          {availableShips.map((ship) => (
            <div key={ship.ship_id} className={styles.sellCard}>
              <div className={styles.listingInfo}>
                <span className={styles.listingName}>{ship.class_name || ship.class_id}</span>
              </div>
              <button
                className={shared.warningBtn}
                onClick={() => { setSellShipId(ship.ship_id); setSellPrice('') }}
                type="button"
              >
                <Tag size={12} /> Sell
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ship buy orders */}
      <span className={shared.sectionTitle}>Your Ship Buy Orders</span>
      <div className={styles.modalRow}>
        <select className={shared.textInput} value={orderClass} onChange={(e) => setOrderClass(e.target.value)} aria-label="Ship class">
          <option value="">Choose a ship class...</option>
          {shipClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className={shared.textInput} type="number" min="1" placeholder="Offer (cr)" value={orderPrice} onChange={(e) => setOrderPrice(e.target.value)} />
        <button
          className={shared.accentBtn}
          onClick={placeOrder}
          disabled={!orderClass || !(parseInt(orderPrice, 10) > 0)}
          title="Place a standing order; a seller here can fill it any time"
          type="button"
        >
          <ClipboardList size={12} /> Place Order
        </button>
      </div>
      {(myBuyOrders?.orders ?? []).length === 0 ? (
        <div className={shared.emptyState}>No open ship buy orders.</div>
      ) : (
        <div className={styles.listingsList}>
          {myBuyOrders?.orders.map((order: ShipBuyOrder) => (
            <div key={order.order_id} className={styles.sellCard}>
              <div className={styles.listingInfo}>
                <span className={styles.listingName}>{order.class_name || order.class_id}</span>
                <span className={styles.listingClass}>{order.base_name || order.base_id}{order.being_built ? ' (being built)' : ''}</span>
              </div>
              <span className={styles.listingPrice}><Credits amount={order.price} /></span>
              <button
                className={shared.dangerBtn}
                onClick={() => setShipConfirm({
                  message: `Cancel your ${order.class_name || order.class_id} buy order and refund the escrow?`,
                  run: () => mutate((c) => c.spacemolt_ship.cancel_ship_buy_order({ id: order.order_id }), { label: 'cancel_ship_buy_order' }),
                })}
                type="button"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sell modal */}
      {sellShipId && sellShipInfo && (
        <Modal
          title={`Sell ${sellShipInfo.class_name || sellShipInfo.class_id}`}
          icon={<Tag size={14} />}
          onClose={() => setSellShipId(null)}
          actions={
            <>
              <button
                className={shared.confirmBtn}
                onClick={handleSell}
                disabled={selling || !sellPrice || parseInt(sellPrice, 10) <= 0}
                type="button"
              >
                {selling ? <Loader2 size={12} className={shared.spinner} /> : <Tag size={12} />}
                List for Sale
              </button>
              <button className={shared.subtleBtn} onClick={() => setSellShipId(null)} disabled={selling} type="button">
                Cancel
              </button>
            </>
          }
        >
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Asking Price</span>
            <input
              className={shared.textInput}
              type="number"
              min="1"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="Credits"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSell() }}
            />
          </div>
        </Modal>
      )}
    </>
  )
}
