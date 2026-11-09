'use client'

import { useState, useCallback } from 'react'
import { AlertTriangle, X, Tag, Loader2 } from 'lucide-react'
import type { BrowseShipsResponse } from '@spacemolt/lib'
import { useCommandMutation, useCommandQuery, useLocationState, usePlayer } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Credits, Loading, Modal, ConfirmAction, errorMessage, shared } from '../../shared'
import styles from './SellView.module.css'

type ShipBuyOrder = NonNullable<BrowseShipsResponse['buy_orders']>[number]

/** Your side of the ship exchange: your listings, selling a stored ship, other pilots' buy orders here, and your buy orders anywhere. */
export function SellView() {
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const player = usePlayer()
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

  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)

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

  // Your ship buy orders across all bases; cancel works anywhere. Place them from the Ships tab.
  const { data: myBuyOrders, refetch: refetchMyBuyOrders } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_ship.view_ship_buy_orders()).structuredContent,
    [],
  )
  const [shipConfirm, setShipConfirm] = useState<{ message: string; run: () => Promise<unknown> } | null>(null)

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
      {/* Your listings */}
      {loadingBrowse && listings.length === 0 && (
        <Loading message="Loading listings..." />
      )}

      {!loadingBrowse && ownListings.length === 0 && availableShips.length === 0 && otherBuyOrders.length === 0 && !myBuyOrders?.orders?.length && (
        <div className={shared.emptyState}>No listings, stored ships, or buy orders here. Store a ship at this base to sell it.</div>
      )}

      {ownListings.length > 0 && (
        <>
          <span className={shared.sectionTitle}>Your Listings</span>
          <div className={styles.listingsList}>
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
                  {match && (
                    <button
                      className={shared.warningBtn}
                      title="Sell your stored ship into this order"
                      onClick={() => setShipConfirm({
                        message: `Sell your ${match.class_name || match.class_id} for ${order.price.toLocaleString()} cr?`,
                        run: () => mutate((c) => c.spacemolt_ship.sell_ship_to_order({ id: order.order_id, ship_id: match.ship_id }), { label: 'sell_ship_to_order' }),
                      })}
                      type="button"
                    >
                      <Tag size={12} /> Sell
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Sell a ship: inactive ships docked here */}
      {availableShips.length > 0 && (
        <>
          <span className={shared.sectionTitle}>Sell a Ship</span>
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
        </>
      )}

      {/* Your buy orders at every base */}
      {(myBuyOrders?.orders ?? []).length > 0 && (
        <span className={shared.sectionTitle}>Your Ship Buy Orders</span>
      )}
      {(myBuyOrders?.orders ?? []).length > 0 && (
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
