'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Store,
  RefreshCw,
  Coins,
  Heart,
  Shield,
  Tag,
  ShoppingCart,
  AlertTriangle,
  User,
  X,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { ActionButton } from '../../ActionButton'
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

interface BrowseShipsResponse {
  base_name: string
  listings: ShipListing[]
}

export function MarketplaceView() {
  const { state, sendCommand } = useGame()
  const isDocked = state.isDocked
  const credits = state.player?.credits ?? 0
  const fleet = state.fleetData

  const [listings, setListings] = useState<BrowseShipsResponse | null>(null)
  const [loadingBrowse, setLoadingBrowse] = useState(false)
  const [buyConfirm, setBuyConfirm] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)

  // List ship form state
  const [listShipId, setListShipId] = useState('')
  const [listPrice, setListPrice] = useState('')
  const [loadingList, setLoadingList] = useState(false)

  // Track event log to detect responses
  const lastEventLenRef = useRef(state.eventLog.length)

  // Watch event log for responses
  useEffect(() => {
    if (state.eventLog.length <= lastEventLenRef.current) {
      lastEventLenRef.current = state.eventLog.length
      return
    }

    const newCount = state.eventLog.length - lastEventLenRef.current
    lastEventLenRef.current = state.eventLog.length

    for (let i = 0; i < newCount; i++) {
      const entry = state.eventLog[i]
      if (!entry) continue

      const data = entry.data as Record<string, unknown> | undefined
      if (!data) continue

      if (data.action === 'browse_ships' && data.listings) {
        setListings(data as unknown as BrowseShipsResponse)
        setLoadingBrowse(false)
      }
      if (data.action === 'buy_listed_ship') {
        setBuyConfirm(null)
        // Refresh listings after purchase
        sendCommand('browse_ships')
      }
      if (data.action === 'list_ship_for_sale') {
        setLoadingList(false)
        setListShipId('')
        setListPrice('')
        // Refresh listings and fleet
        sendCommand('browse_ships')
        sendCommand('list_ships')
      }
      if (data.action === 'cancel_ship_listing') {
        setCancelConfirm(null)
        sendCommand('browse_ships')
      }
    }
  }, [state.eventLog, sendCommand])

  // Auto-fetch when docked
  useEffect(() => {
    if (isDocked && !listings) {
      setLoadingBrowse(true)
      sendCommand('browse_ships')
      setTimeout(() => setLoadingBrowse(false), 5000)
    }
  }, [isDocked, listings, sendCommand])

  // Also fetch fleet data for listing ships
  useEffect(() => {
    if (isDocked && !fleet) {
      sendCommand('list_ships')
    }
  }, [isDocked, fleet, sendCommand])

  const handleRefresh = useCallback(() => {
    setLoadingBrowse(true)
    sendCommand('browse_ships')
    setTimeout(() => setLoadingBrowse(false), 5000)
  }, [sendCommand])

  const handleBuy = useCallback(
    (listingId: string) => {
      sendCommand('buy_listed_ship', { listing_id: listingId })
      setBuyConfirm(null)
    },
    [sendCommand]
  )

  const handleListShip = useCallback(() => {
    if (!listShipId || !listPrice) return
    const price = parseInt(listPrice, 10)
    if (isNaN(price) || price <= 0) return
    setLoadingList(true)
    sendCommand('list_ship_for_sale', { ship_id: listShipId, price })
    setTimeout(() => setLoadingList(false), 5000)
  }, [listShipId, listPrice, sendCommand])

  const handleCancelListing = useCallback(
    (listingId: string) => {
      sendCommand('cancel_ship_listing', { listing_id: listingId })
      setCancelConfirm(null)
    },
    [sendCommand]
  )

  if (!isDocked) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>
              <Store size={16} />
            </span>
            Marketplace
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.dockedOnly}>
            <Store size={16} style={{ marginBottom: '0.25rem', opacity: 0.6 }} />
            <br />
            Dock at a base to browse ship listings
          </div>
        </div>
      </div>
    )
  }

  // Determine which listings are from the current player (for cancel)
  const playerName = state.player?.username

  // Separate own listings from others
  const ownListings = listings?.listings.filter(
    (l) => l.seller === playerName
  ) ?? []
  const otherListings = listings?.listings.filter(
    (l) => l.seller !== playerName
  ) ?? []

  // Non-active ships at this base for listing
  const availableShips = fleet?.ships.filter(
    (s) => !s.is_active && s.location_base_id === state.poi?.base_id
  ) ?? []

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>
            <Store size={16} />
          </span>
          Marketplace
          {listings?.base_name && (
            <span className={styles.baseName}>{listings.base_name}</span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            title="Refresh listings"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Credits display */}
        <div className={styles.creditsBar}>
          <span className={styles.creditsIcon}>
            <Coins size={14} />
          </span>
          <span className={styles.creditsLabel}>Credits</span>
          <span className={styles.creditsValue}>
            {credits.toLocaleString()}
          </span>
        </div>

        {/* Ships for sale */}
        <span className={styles.sectionTitle}>Ships For Sale</span>

        {loadingBrowse && !listings && (
          <div className={styles.emptyState}>Loading listings...</div>
        )}

        {listings && otherListings.length === 0 && ownListings.length === 0 && (
          <div className={styles.emptyState}>No ships listed at this base</div>
        )}

        {otherListings.length > 0 && (
          <>
            <span className={styles.countLabel}>
              {otherListings.length} listing{otherListings.length !== 1 ? 's' : ''} available
            </span>
            <div className={styles.listingsList}>
              {otherListings.map((listing) => (
                <ListingCard
                  key={listing.listing_id}
                  listing={listing}
                  credits={credits}
                  isOwn={false}
                  buyConfirm={buyConfirm}
                  cancelConfirm={cancelConfirm}
                  onBuyRequest={(id) => setBuyConfirm(id)}
                  onBuyConfirm={handleBuy}
                  onBuyDismiss={() => setBuyConfirm(null)}
                  onCancelRequest={(id) => setCancelConfirm(id)}
                  onCancelConfirm={handleCancelListing}
                  onCancelDismiss={() => setCancelConfirm(null)}
                />
              ))}
            </div>
          </>
        )}

        {/* Own listings */}
        {ownListings.length > 0 && (
          <>
            <span className={styles.sectionTitle}>Your Listings</span>
            <div className={styles.listingsList}>
              {ownListings.map((listing) => (
                <ListingCard
                  key={listing.listing_id}
                  listing={listing}
                  credits={credits}
                  isOwn={true}
                  buyConfirm={buyConfirm}
                  cancelConfirm={cancelConfirm}
                  onBuyRequest={(id) => setBuyConfirm(id)}
                  onBuyConfirm={handleBuy}
                  onBuyDismiss={() => setBuyConfirm(null)}
                  onCancelRequest={(id) => setCancelConfirm(id)}
                  onCancelConfirm={handleCancelListing}
                  onCancelDismiss={() => setCancelConfirm(null)}
                />
              ))}
            </div>
          </>
        )}

        {/* List a ship for sale */}
        <span className={styles.sectionTitle}>List a Ship</span>
        <div className={styles.listForm}>
          <div className={styles.listFormRow}>
            <span className={styles.inputLabel}>Ship</span>
            <select
              className={styles.selectInput}
              value={listShipId}
              onChange={(e) => setListShipId(e.target.value)}
            >
              <option value="">Select a ship...</option>
              {availableShips.map((ship) => (
                <option key={ship.ship_id} value={ship.ship_id}>
                  {ship.class_name || ship.class_id}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.listFormRow}>
            <span className={styles.inputLabel}>Price</span>
            <input
              className={styles.textInput}
              type="number"
              min="1"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="Credits"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleListShip()
              }}
            />
          </div>
          <ActionButton
            label="List for Sale"
            icon={<Tag size={12} />}
            onClick={handleListShip}
            disabled={!listShipId || !listPrice || parseInt(listPrice, 10) <= 0}
            loading={loadingList}
            size="sm"
          />
          {availableShips.length === 0 && (
            <div className={styles.emptyState}>
              No ships available to list. Ships must be inactive and docked here.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface ListingCardProps {
  listing: ShipListing
  credits: number
  isOwn: boolean
  buyConfirm: string | null
  cancelConfirm: string | null
  onBuyRequest: (id: string) => void
  onBuyConfirm: (id: string) => void
  onBuyDismiss: () => void
  onCancelRequest: (id: string) => void
  onCancelConfirm: (id: string) => void
  onCancelDismiss: () => void
}

function ListingCard({
  listing,
  credits,
  isOwn,
  buyConfirm,
  cancelConfirm,
  onBuyRequest,
  onBuyConfirm,
  onBuyDismiss,
  onCancelRequest,
  onCancelConfirm,
  onCancelDismiss,
}: ListingCardProps) {
  const canAfford = credits >= listing.price

  return (
    <div className={isOwn ? styles.listingCardOwn : styles.listingCard}>
      <div className={styles.listingTop}>
        <div className={styles.listingInfo}>
          <span className={styles.listingName}>{listing.ship_name}</span>
          <span className={styles.listingClass}>{listing.class_id}</span>
        </div>
        <span className={canAfford ? styles.listingPrice : styles.listingPriceUnaffordable}>
          {listing.price.toLocaleString()} cr
        </span>
      </div>

      {/* Badges and stats */}
      <div className={styles.listingBadges}>
        {listing.category && (
          <span className={styles.categoryBadge}>{listing.category}</span>
        )}
        {listing.tier > 0 && (
          <span className={styles.tierBadge}>T{listing.tier}</span>
        )}
      </div>

      <div className={styles.listingStatsRow}>
        <div className={styles.listingStat}>
          <span className={styles.listingStatIcon}><Heart size={10} /></span>
          <span className={styles.listingStatLabel}>Hull</span>
          <span className={styles.listingStatValue}>
            {listing.hull}/{listing.max_hull}
          </span>
        </div>
      </div>

      {/* Seller */}
      {!isOwn && listing.seller && (
        <div className={styles.listingSeller}>
          <User size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.2rem' }} />
          {listing.seller}
        </div>
      )}

      {/* Buy confirmation */}
      {buyConfirm === listing.listing_id && (
        <div className={styles.confirmBuyOverlay}>
          <ShoppingCart size={14} style={{ color: 'var(--void-purple)', flexShrink: 0 }} />
          <span className={styles.confirmText}>
            Buy {listing.ship_name} for {listing.price.toLocaleString()} cr?
          </span>
          <div className={styles.confirmActions}>
            <ActionButton
              label="Buy"
              onClick={() => onBuyConfirm(listing.listing_id)}
              size="sm"
            />
            <ActionButton
              label="No"
              onClick={onBuyDismiss}
              size="sm"
              variant="secondary"
            />
          </div>
        </div>
      )}

      {/* Cancel confirmation */}
      {cancelConfirm === listing.listing_id && (
        <div className={styles.confirmOverlay}>
          <AlertTriangle size={14} style={{ color: 'var(--claw-red)', flexShrink: 0 }} />
          <span className={styles.confirmText}>
            Cancel this listing?
          </span>
          <div className={styles.confirmActions}>
            <ActionButton
              label="Yes"
              onClick={() => onCancelConfirm(listing.listing_id)}
              size="sm"
              variant="danger"
            />
            <ActionButton
              label="No"
              onClick={onCancelDismiss}
              size="sm"
              variant="secondary"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {buyConfirm !== listing.listing_id && cancelConfirm !== listing.listing_id && (
        <div className={styles.listingActions}>
          {!isOwn && (
            <ActionButton
              label="Buy"
              icon={<ShoppingCart size={12} />}
              onClick={() => onBuyRequest(listing.listing_id)}
              disabled={!canAfford}
              size="sm"
            />
          )}
          {isOwn && (
            <ActionButton
              label="Cancel Listing"
              icon={<X size={12} />}
              onClick={() => onCancelRequest(listing.listing_id)}
              size="sm"
              variant="danger"
            />
          )}
        </div>
      )}
    </div>
  )
}
