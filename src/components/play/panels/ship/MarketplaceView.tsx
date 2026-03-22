'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Store,
  Coins,
  Heart,
  ShoppingCart,
  AlertTriangle,
  User,
  X,
  Tag,
  Loader2,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import styles from './MarketplaceView.module.css'

interface ShipListing {
  listing_id: string
  class_id: string
  price: number
  ship_name: string
  category: string
  tier: number
  hull: number
  max_hull: number
  seller: string
}

export function MarketplaceView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const credits = state.player?.credits ?? 0
  const fleet = state.fleetData

  const [listings, setListings] = useState<ShipListing[]>([])
  const [loadingBrowse, setLoadingBrowse] = useState(false)
  const [buyConfirm, setBuyConfirm] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [buying, setBuying] = useState(false)

  // Sell modal
  const [sellShipId, setSellShipId] = useState<string | null>(null)
  const [sellPrice, setSellPrice] = useState('')
  const [selling, setSelling] = useState(false)

  const fetchListings = useCallback(() => {
    setLoadingBrowse(true)
    sendCommand('browse_ships').then((resp) => {
      const data = resp as Record<string, unknown>
      setListings((data.listings || []) as ShipListing[])
      setLoadingBrowse(false)
    }).catch(() => setLoadingBrowse(false))
  }, [sendCommand])

  // Auto-fetch when docked
  useEffect(() => {
    if (isDocked) {
      fetchListings()
      if (!fleet) sendCommand('list_ships')
    }
  }, [isDocked]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuy = useCallback((listingId: string) => {
    setBuying(true)
    sendCommand('buy_listed_ship', { listing_id: listingId }).then(() => {
      setBuying(false)
      setBuyConfirm(null)
      fetchListings()
    }).catch(() => setBuying(false))
  }, [sendCommand, fetchListings])

  const handleCancelListing = useCallback((listingId: string) => {
    sendCommand('cancel_ship_listing', { listing_id: listingId }).then(() => {
      setCancelConfirm(null)
      fetchListings()
    })
  }, [sendCommand, fetchListings])

  const handleSell = useCallback(() => {
    if (!sellShipId || !sellPrice) return
    const price = parseInt(sellPrice, 10)
    if (isNaN(price) || price <= 0) return
    setSelling(true)
    sendCommand('list_ship_for_sale', { ship_id: sellShipId, price }).then(() => {
      setSelling(false)
      setSellShipId(null)
      setSellPrice('')
      fetchListings()
      sendCommand('list_ships')
    }).catch(() => setSelling(false))
  }, [sellShipId, sellPrice, sendCommand, fetchListings])

  if (!isDocked) {
    return (
      <div className={styles.dockedOnly}>
        Dock at a base to browse ship listings
      </div>
    )
  }

  const playerName = state.player?.username
  const ownListings = listings.filter((l) => l.seller === playerName)
  const otherListings = listings.filter((l) => l.seller !== playerName)

  // Ships available to sell: inactive, docked at this base
  const availableShips = fleet?.ships.filter(
    (s) => !s.is_active && s.location_base_id === state.poi?.base_id
  ) ?? []

  // Ship being sold (for modal)
  const sellShipInfo = availableShips.find((s) => s.ship_id === sellShipId)

  return (
    <>
      {/* Ships for sale */}
      {loadingBrowse && listings.length === 0 && (
        <div className={styles.emptyState}>
          <Loader2 size={14} className={styles.spinner} /> Loading listings...
        </div>
      )}

      {!loadingBrowse && otherListings.length === 0 && ownListings.length === 0 && (
        <div className={styles.emptyState}>No ships currently for sale at this base.</div>
      )}

      {(otherListings.length > 0 || ownListings.length > 0) && (
        <>
          <span className={styles.sectionTitle}>Ships For Sale</span>
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
                      {listing.price.toLocaleString()} cr
                    </span>
                  </div>
                  <div className={styles.listingBadges}>
                    {listing.category && <span className={styles.categoryBadge}>{listing.category}</span>}
                    {listing.tier > 0 && <span className={styles.tierBadge}>T{listing.tier}</span>}
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
                    <div className={styles.confirmOverlay}>
                      <ShoppingCart size={14} style={{ color: 'var(--void-purple)', flexShrink: 0 }} />
                      <span className={styles.confirmText}>
                        Buy for {listing.price.toLocaleString()} cr?
                      </span>
                      <button className={styles.buyBtn} onClick={() => handleBuy(listing.listing_id)} disabled={buying || !canAfford} type="button">
                        {buying ? <Loader2 size={11} className={styles.spinner} /> : null} Yes
                      </button>
                      <button className={styles.cancelActionBtn} onClick={() => setBuyConfirm(null)} type="button">No</button>
                    </div>
                  ) : (
                    <button
                      className={styles.buyBtn}
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
                  <span className={styles.listingPrice}>{listing.price.toLocaleString()} cr</span>
                </div>
                <div className={styles.listingBadges}>
                  <span className={styles.ownBadge}>Your listing</span>
                </div>
                {cancelConfirm === listing.listing_id ? (
                  <div className={styles.confirmOverlay}>
                    <AlertTriangle size={14} style={{ color: 'var(--claw-red)', flexShrink: 0 }} />
                    <span className={styles.confirmText}>Cancel listing?</span>
                    <button className={styles.cancelActionBtn} onClick={() => handleCancelListing(listing.listing_id)} type="button">Yes</button>
                    <button className={styles.buyBtn} onClick={() => setCancelConfirm(null)} type="button">No</button>
                  </div>
                ) : (
                  <button className={styles.cancelActionBtn} onClick={() => setCancelConfirm(listing.listing_id)} type="button">
                    <X size={12} /> Cancel Listing
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sell a ship */}
      <span className={styles.sectionTitle}>Sell a Ship</span>
      {availableShips.length === 0 ? (
        <div className={styles.emptyState}>No ships available to sell. Ships must be inactive and docked here.</div>
      ) : (
        <div className={styles.listingsList}>
          {availableShips.map((ship) => (
            <div key={ship.ship_id} className={styles.sellCard}>
              <div className={styles.listingInfo}>
                <span className={styles.listingName}>{ship.class_name || ship.class_id}</span>
              </div>
              <button
                className={styles.sellBtn}
                onClick={() => { setSellShipId(ship.ship_id); setSellPrice('') }}
                type="button"
              >
                <Tag size={12} /> Sell
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sell modal */}
      {sellShipId && sellShipInfo && (
        <div className={styles.modalBackdrop} onClick={() => setSellShipId(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                <Tag size={14} />
                Sell {sellShipInfo.class_name || sellShipInfo.class_id}
              </span>
              <button className={styles.modalClose} onClick={() => setSellShipId(null)} type="button">
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Asking Price</span>
                <input
                  className={styles.priceInput}
                  type="number"
                  min="1"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="Credits"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSell() }}
                />
              </div>
              <div className={styles.modalActions}>
                <button
                  className={styles.confirmSellBtn}
                  onClick={handleSell}
                  disabled={selling || !sellPrice || parseInt(sellPrice, 10) <= 0}
                  type="button"
                >
                  {selling ? <Loader2 size={12} className={styles.spinner} /> : <Tag size={12} />}
                  List for Sale
                </button>
                <button className={styles.cancelActionBtn} onClick={() => setSellShipId(null)} disabled={selling} type="button">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
