'use client'

import { useState } from 'react'
import { Search, ShoppingCart, X, Loader2 } from 'lucide-react'
import type { FacilityListingEntry } from '@spacemolt/lib'
import { useCommandMutation, useCommandQuery, usePlayer } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Credits, Loading, Modal, errorMessage, shared } from '../../shared'
import { titleCase } from '@/lib/format'
import { isOwnListing } from './facilityActions'
import styles from './facilities.module.css'

/** Facilities listed for sale at the docked station: browse, buy, and cancel your own listings. */
export function SalesView({ onRefresh }: { onRefresh: () => void }) {
  const player = usePlayer()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const [typeFilter, setTypeFilter] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [filters, setFilters] = useState<{ facility_type?: string; max_price?: number }>({})
  const [buying, setBuying] = useState<FacilityListingEntry | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const { data, loading, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_facility.browse_for_sale(filters)).structuredContent,
    [filters.facility_type, filters.max_price],
  )
  const hasFaction = Boolean(player?.faction_id)
  const { data: faction } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_faction.info({ limit: 1 })).structuredContent,
    [player?.faction_id],
    { enabled: hasFaction },
  )
  const me = { username: player?.username, factionName: faction?.name }

  const applyFilters = () => setFilters({
    facility_type: typeFilter.trim() || undefined,
    max_price: Number(maxPrice) > 0 ? Number(maxPrice) : undefined,
  })

  const act = async (listing: FacilityListingEntry, kind: 'buy' | 'cancel') => {
    setBusy(listing.listing_id)
    try {
      const r = kind === 'buy'
        ? await mutate((c) => c.spacemolt_facility.buy_listing({ listing_id: listing.listing_id }), { label: 'facility_buy_listing' })
        : await mutate((c) => c.spacemolt_facility.cancel_listing({ listing_id: listing.listing_id }), { label: 'facility_cancel_listing' })
      const details = r.delta.details as { message?: string } | undefined
      uiStore.dispatch({ type: 'event', kind: 'success', text: details?.message ?? `${kind === 'buy' ? 'Bought' : 'Cancelled listing for'} ${listing.facility_name ?? listing.definition_id}` })
      setBuying(null)
      refetch()
      onRefresh()
    } catch (err) {
      uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) })
    }
    setBusy(null)
  }

  const credits = player?.credits ?? 0
  return (
    <>
      <div className={styles.searchRow}>
        <div className={styles.searchInputWrap}>
          <Search size={12} className={styles.searchIcon} />
          <input
            className={`${shared.textInput} ${styles.searchInput}`}
            placeholder="Facility type id..."
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
          />
        </div>
        <input
          className={shared.textInput}
          type="number"
          min={0}
          placeholder="Max price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
          style={{ width: '7rem' }}
        />
        <button className={shared.actionBtn} onClick={applyFilters} type="button">
          <Search size={11} /> Search
        </button>
      </div>

      {loading && !data && <Loading message="Loading listings..." />}
      {data && data.listings.length === 0 && (
        <div className={shared.emptyState}>No facilities for sale at {data.base_name}. List one of yours from My Facilities or Faction.</div>
      )}
      {data && data.listings.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            For sale at {data.base_name}
            <span className={styles.sectionCount}>({data.count})</span>
          </div>
          {data.listings.map((l) => {
            const own = isOwnListing(l, me)
            return (
              <div key={l.listing_id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>{l.facility_name ?? titleCase(l.definition_id)}</span>
                  {l.level != null && <span className={styles.typeLevel}>L{l.level}</span>}
                  {l.category && <span className={shared.badgeGrey}>{titleCase(l.category)}</span>}
                  {l.under_construction && <span className={shared.badgeOrange}>Under construction</span>}
                  <span className={styles.typeCost}><Credits amount={l.price} /></span>
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.metaItem}>Seller: {l.seller_name ?? l.seller_type}</span>
                  {l.build_cost != null && <span className={styles.metaItem}>Build cost <Credits amount={l.build_cost} /></span>}
                  {l.skill_met === false && <span className={`${styles.metaItem} ${styles.maintenanceWarning}`}>Skill level {l.required_skill_level} needed</span>}
                  {l.compatibility_note && <span className={styles.metaItem}>{l.compatibility_note}</span>}
                </div>
                <div className={styles.cardActions}>
                  {own ? (
                    <button className={shared.subtleBtn} onClick={() => act(l, 'cancel')} disabled={busy === l.listing_id} type="button">
                      {busy === l.listing_id ? <Loader2 size={11} className={shared.spinner} /> : <X size={11} />} Cancel listing
                    </button>
                  ) : (
                    <button className={shared.accentBtn} onClick={() => setBuying(l)} type="button">
                      <ShoppingCart size={11} /> Buy
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {buying && (
        <Modal
          title={`Buy ${buying.facility_name ?? buying.definition_id}`}
          icon={<ShoppingCart size={14} />}
          onClose={() => setBuying(null)}
          actions={
            <>
              <button
                className={shared.confirmBtn}
                onClick={() => act(buying, 'buy')}
                disabled={busy === buying.listing_id || credits < buying.price}
                type="button"
              >
                {busy === buying.listing_id ? <Loader2 size={11} className={shared.spinner} /> : <ShoppingCart size={11} />}
                Buy for <Credits amount={buying.price} />
              </button>
              <button className={shared.subtleBtn} onClick={() => setBuying(null)} type="button">Cancel</button>
            </>
          }
        >
          <div className={styles.costBreakdown}>
            <div className={styles.costRow}>
              <span className={styles.costLabel}>Price</span>
              <span className={styles.costValue}><Credits amount={buying.price} /></span>
            </div>
            <div className={styles.costRow}>
              <span className={styles.costLabel}>Your credits</span>
              <span className={credits >= buying.price ? styles.costValue : styles.materialMissing}><Credits amount={credits} /></span>
            </div>
            <div className={styles.costRow}>
              <span className={styles.costLabel}>Seller</span>
              <span className={styles.costValue}>{buying.seller_name ?? buying.seller_type}</span>
            </div>
          </div>
          <div className={styles.cardDescription}>The facility becomes yours at this station. You pay its rent from now on.</div>
        </Modal>
      )}
    </>
  )
}
