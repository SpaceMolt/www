'use client'

import { isMobileBase, MobileBaseDetails, type MobileBaseIdentity } from '@/components/MobileBaseDetails'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Heart,
  Shield,
  Gauge,
  Fuel,
  Package,
  Crosshair,
  CircuitBoard,
  Maximize2,
  X,
  Search,
  Hammer,
  Loader2,
  ShoppingCart,
  Users,
  User,
  ClipboardList,
  Lock,
  Check,
  MapPin,
} from 'lucide-react'
import type { BrowseShipsResponse, StorageResponse } from '@spacemolt/lib'
import { useCargo, useCatalog, useCommandMutation, useCommandQuery, useLocationState, usePlayer, useShip, useSkills, useStations } from '@/lib/spacemolt'
import { getShip, groupBy } from '@/data/catalog'
import { usePlay } from '../../PlayProvider'
import { ConfirmAction, Credits, Loading, Modal, errorMessage, shared } from '../../shared'
import { useStationServices } from '../../hooks/useGates'
import { BugReportButton } from '../../BugReportButton'
import { buildShipCatalogContext } from '../../bugReportContext'
import styles from './ShipCatalog.module.css'
import listingStyles from './SellView.module.css'
import { shipBlockReasons, type GatedShip } from './shipAccess'
import { imageUrl } from '@/data/images'

export const EMPIRES = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim']
const TIERS = [1, 2, 3, 4, 5]
const CATEGORIES = ['Civilian', 'Combat', 'Commercial', 'Exploration', 'Industrial']
const CLASSES = ['Assault', 'Courier', 'Explorer', 'Fighter', 'Freighter', 'Gas Harvester', 'Ice Harvester', 'Miner', 'Mobile Base', 'Raider', 'Salvager', 'Scout', 'Shuttle']
const PAGE_SIZE = 20

export interface CatalogShip extends MobileBaseIdentity, GatedShip {
  base_shield_recharge?: number
  id: string
  name: string
  class: string
  category: string
  tier: number
  description: string
  lore: string
  base_hull: number
  base_shield: number
  base_armor: number
  base_speed: number
  base_fuel: number
  cargo_capacity: number
  cpu_capacity: number
  power_capacity: number
  weapon_slots: number
  defense_slots: number
  utility_slots: number
  build_materials?: { item_id: string; quantity: number }[]
  build_time?: number
}

/** A listing tagged with the station that holds it. */
type ShipListing = BrowseShipsResponse['listings'][number] & { base_id: string; base_name: string }

/** Tags each listing in a browse_ships response with its station. */
function tagListings(resp: BrowseShipsResponse | undefined): ShipListing[] {
  if (!resp) return []
  return resp.listings.map((l) => ({ ...l, base_id: resp.base_id, base_name: resp.base_name }))
}

/** Concurrent browse_ships calls while searching all stations; keeps the sweep well under the per-session query limit. */
export const BROWSE_BATCH = 5

/**
 * Listings at every station, by one browse_ships call per station. A station
 * that refuses (uncharted frontier, gone) is skipped, so one failure does not
 * hide the rest.
 */
export async function browseAllStations(
  baseIds: string[],
  browse: (baseId: string) => Promise<BrowseShipsResponse | undefined>,
): Promise<ShipListing[]> {
  const out: ShipListing[] = []
  for (let i = 0; i < baseIds.length; i += BROWSE_BATCH) {
    const results = await Promise.allSettled(baseIds.slice(i, i + BROWSE_BATCH).map(browse))
    for (const r of results) if (r.status === 'fulfilled') out.push(...tagListings(r.value))
  }
  return out
}

/** How long one all-stations sweep is reused, so reopening the catalog does not query every station again. */
export const LISTINGS_TTL_MS = 60_000
const listingsCache = new WeakMap<object, { at: number; listings: Promise<ShipListing[]> }>()

/** The account's all-stations sweep, keyed by its stable `commands` object and reused until it is LISTINGS_TTL_MS old. */
export function cachedListings(account: object, sweep: () => Promise<ShipListing[]>, now = Date.now()): Promise<ShipListing[]> {
  const hit = listingsCache.get(account)
  if (hit && now - hit.at < LISTINGS_TTL_MS) return hit.listings
  const listings = sweep()
  listingsCache.set(account, { at: now, listings })
  return listings
}

/** Drops the cached sweep, so the next read sees a purchase at once. */
export const clearListingsCache = (account: object) => listingsCache.delete(account)

/**
 * Whether a catalog ship passes the tier dropdown filter.
 *
 * `tier` is the raw <select> value: '' means "All Tiers" (show everything),
 * otherwise it's a stringified tier number ('1'..'5') that must match the
 * ship's numeric tier exactly. Tier-0 ships were previously dropped because
 * the old predicate fell back to `s.tier > 0` when no tier was selected.
 */
export function matchesTierFilter(ship: { tier: number }, tier: string): boolean {
  return !tier || parseInt(tier, 10) === ship.tier
}

/** The server clamps `page_size` to 50, so a larger request buys nothing. */
export const COMMISSIONABLE_PAGE_SIZE = 50
/** Hard ceiling on catalog requests, so a bad `total_pages` cannot loop. */
export const MAX_COMMISSIONABLE_PAGES = 20

/** IDs from a `spacemolt_catalog` bare-tool query response (loosely typed). */
function idsFromCatalogPayload(payload: Record<string, unknown> | undefined): Set<string> {
  const items = payload && Array.isArray(payload.items) ? payload.items : []
  const ids = new Set<string>()
  for (const item of items) {
    if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string') {
      ids.add((item as Record<string, unknown>).id as string)
    }
  }
  return ids
}

/** Page count from a catalog response: `total_pages` if the server sent a
 * usable one, else derived from `total`/`page_size`, else a single page. */
function pageCountOf(payload: Record<string, unknown> | undefined): number {
  const declared = payload?.total_pages
  if (typeof declared === 'number' && Number.isFinite(declared) && declared >= 1) {
    return Math.floor(declared)
  }
  const total = payload?.total
  const pageSize = payload?.page_size
  if (typeof total === 'number' && typeof pageSize === 'number' && total > 0 && pageSize > 0) {
    return Math.ceil(total / pageSize)
  }
  return 1
}

/** The `spacemolt_catalog` request for one page of commissionable ships. */
export function commissionableCatalogRequest(page: number): Record<string, unknown> {
  return { type: 'ships', commissionable: true, page_size: COMMISSIONABLE_PAGE_SIZE, page }
}

/**
 * Collect every commissionable ship id at this station.
 *
 * dc#108959: the server clamps `page_size` to 50 and returns commissionable
 * hulls cheapest-first, so reading only page 1 hides the most expensive hulls
 * behind a missing Commission button. Walk the pages the server declares,
 * bounded by `MAX_COMMISSIONABLE_PAGES` and by the first empty page. A failed
 * later page keeps the ids already collected — a partial list still shows more
 * Commission buttons than none.
 */
export async function fetchCommissionableShipIds(
  queryPage: (page: number) => Promise<Record<string, unknown> | undefined>,
): Promise<Set<string>> {
  const first = await queryPage(1)
  const ids = idsFromCatalogPayload(first)
  const lastPage = Math.min(pageCountOf(first), MAX_COMMISSIONABLE_PAGES)
  for (let page = 2; page <= lastPage; page++) {
    let pageIds: Set<string>
    try {
      pageIds = idsFromCatalogPayload(await queryPage(page))
    } catch {
      break
    }
    if (pageIds.size === 0) break
    for (const id of pageIds) ids.add(id)
  }
  return ids
}

/** `spacemolt_storage.view` returns a union keyed by variant; only the
 * personal/faction variants carry `items`. */
function storageItemsOf(resp: StorageResponse | undefined): { item_id: string; quantity: number }[] {
  if (!resp || !('items' in resp)) return []
  return resp.items
}

function StatWithDelta({ label, value, currentValue }: { label: string; value: number; currentValue?: number }) {
  const delta = currentValue != null ? value - currentValue : null
  return (
    <span>
      {label} {value}
      {delta != null && delta !== 0 && (
        <span className={delta > 0 ? styles.deltaPositive : styles.deltaNegative}>
          {' '}({delta > 0 ? '+' : ''}{delta})
        </span>
      )}
      {delta === 0 && currentValue != null && (
        <span className={styles.deltaNeutral}> (=)</span>
      )}
    </span>
  )
}

export function ShipCatalog() {
  const ship = useShip()
  const cargo = useCargo() ?? []
  const player = usePlayer()
  const credits = player?.credits ?? 0
  // Undefined until skills load, so no class shows a false Piloting block meanwhile.
  const skills = useSkills()
  const piloting = skills ? skills.piloting?.level ?? 0 : undefined
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const hasShipyard = useStationServices().includes('shipyard')
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const { data: catalog, error: catalogError } = useCatalog()

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorMessage(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
    },
    [uiStore]
  )

  const [expandedShip, setExpandedShip] = useState<string | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<{ src: string; name: string } | null>(null)
  useEffect(() => {
    if (!fullscreenImage) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreenImage(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreenImage])
  const [page, setPage] = useState(1)

  // Commissionable ship IDs at this station (server-checked, station-specific)
  const { data: commissionableFromServer } = useCommandQuery(
    async (account) =>
      fetchCommissionableShipIds(
        async (page) => (await account.query('spacemolt_catalog', '', commissionableCatalogRequest(page))).structuredContent
      ),
    [],
    { enabled: isDocked }
  )
  const commissionableIds = useMemo(
    () => (isDocked && commissionableFromServer ? commissionableFromServer : new Set<string>()),
    [isDocked, commissionableFromServer]
  )

  const { data: stationList } = useStations()
  const stations = useMemo(() => (stationList ?? []).filter((s) => !s.wrecked), [stationList])

  // Other pilots' listings at every station, cheapest first per class. Your own are on the Sell tab.
  const { data: browseData, loading: browseLoading, refetch: refetchBrowse } = useCommandQuery(
    async (account) =>
      cachedListings(account.commands, () =>
        browseAllStations(stations.map((s) => s.base_id), async (baseId) =>
          (await account.commands.spacemolt_ship.browse_ships({ base_id: baseId })).structuredContent)),
    [stations],
    { enabled: stations.length > 0 }
  )
  const listingsByClass = useMemo(() => {
    const others = (browseData ?? []).filter((l) => l.seller !== player?.username)
    return groupBy([...others].sort((a, b) => a.price - b.price), (l) => l.class_id)
  }, [browseData, player?.username])
  // buy_listed_ship only works at the listing's own station.
  const buyableHere = (l: ShipListing) => l.base_id === location?.docked_at

  const [buyTarget, setBuyTarget] = useState<{ ship: Pick<CatalogShip, 'name'>; listing: ShipListing } | null>(null)
  const [buying, setBuying] = useState(false)

  // Ship buy order for the expanded class
  const [orderPrice, setOrderPrice] = useState('')
  const [orderConfirm, setOrderConfirm] = useState(false)

  // Commission modal
  const [commissionShip, setCommissionShip] = useState<CatalogShip | null>(null)
  const [commissioning, setCommissioning] = useState(false)

  const { data: quote, loading: quoteLoading } = useCommandQuery(
    async (account) => {
      if (!commissionShip) return undefined
      return (await account.commands.spacemolt_ship.commission_quote({ id: commissionShip.id })).structuredContent
    },
    [commissionShip?.id],
    { enabled: Boolean(commissionShip) }
  )

  const { data: storageResp } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_storage.view({})).structuredContent,
    [],
    { enabled: Boolean(commissionShip) }
  )
  const storageItemsList = storageItemsOf(storageResp)

  // Filters
  const defaultEmpire = isDocked && location?.empire ? location.empire.toLowerCase() : ''
  const [empire, setEmpire] = useState(defaultEmpire)
  const [tier, setTier] = useState('')
  const [category, setCategory] = useState('')
  const [shipClass, setShipClass] = useState('')
  const [search, setSearch] = useState('')
  const [buyHereOnly, setBuyHereOnly] = useState(false)
  const [commissionHereOnly, setCommissionHereOnly] = useState(false)
  const [canFlyOnly, setCanFlyOnly] = useState(false)

  // The spec's ShipClass omits mobile_base and marks every stat optional; the dump always carries them.
  const allShips = useMemo(() => (catalog?.ships ?? []) as unknown as CatalogShip[], [catalog])
  // Legacy and other hulls outside the public catalog can still be listed and bought here.
  const otherListings = useMemo(() => {
    const known = new Set(allShips.map((s) => s.id))
    return Object.entries(listingsByClass).filter(([classId]) => !known.has(classId)).flatMap(([, ls]) => ls)
  }, [allShips, listingsByClass])

  const blockReasons = useCallback(
    (s: CatalogShip) => shipBlockReasons(s, { piloting, standings: player?.standings, commissionable: commissionableIds.has(s.id) }),
    [piloting, player?.standings, commissionableIds]
  )
  // place_ship_buy_order always rejects prestige and starter hulls (gameserver ship_buy_orders.go).
  const canOrder = (s: CatalogShip) => hasShipyard && blockReasons(s).length === 0 && !getShip(s.id)?.starter_ship &&
    !(s.prestige_lock || s.required_achievement || s.required_faction_achievement)

  const filteredShips = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allShips.filter((s) => {
      if (empire && (s.faction ?? '').toLowerCase() !== empire) return false
      if (!matchesTierFilter(s, tier)) return false
      if (category && s.category !== category) return false
      if (shipClass && s.class !== shipClass) return false
      if (buyHereOnly && !listingsByClass[s.id]) return false
      if (commissionHereOnly && !commissionableIds.has(s.id)) return false
      if (canFlyOnly && blockReasons(s).length > 0) return false
      if (q && !`${s.name} ${s.description ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allShips, empire, tier, category, shipClass, buyHereOnly, listingsByClass, commissionHereOnly, commissionableIds, canFlyOnly, blockReasons, search])

  const total = filteredShips.length
  const pageStart = (page - 1) * PAGE_SIZE
  const ships = filteredShips.slice(pageStart, pageStart + PAGE_SIZE)

  const resetPage = useCallback(() => setPage(1), [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedShip((prev) => (prev === id ? null : id))
    setOrderPrice('')
    setOrderConfirm(false)
  }, [])

  const handleBuyListing = useCallback(() => {
    if (!buyTarget) return
    setBuying(true)
    mutate((c) => c.spacemolt_ship.buy_listed_ship({ id: buyTarget.listing.listing_id }).finally(() => clearListingsCache(c)), { label: 'buy_listed_ship' })
      .then(() => {
        setBuying(false)
        setBuyTarget(null)
        refetchBrowse()
      })
      .catch((err) => {
        setBuying(false)
        reportError(err)
      })
  }, [mutate, buyTarget, refetchBrowse, reportError])

  const placeOrder = (catShip: CatalogShip) => {
    setOrderConfirm(false)
    mutate((c) => c.spacemolt_ship.place_ship_buy_order({ id: catShip.id, price: parseInt(orderPrice, 10) }), { label: 'place_ship_buy_order' })
      .then(() => {
        setOrderPrice('')
        uiStore.dispatch({ type: 'toast', kind: 'success', text: `Placed a buy order for a ${catShip.name}` })
      })
      .catch(reportError)
  }

  const handleCommission = useCallback(
    (funding: { provide_materials?: boolean; fund_from_faction?: boolean }) => {
      if (!commissionShip) return
      setCommissioning(true)
      mutate((c) => c.spacemolt_ship.commission_ship({ id: commissionShip.id, ...funding }), { label: 'commission_ship' })
        .then((result) => {
          setCommissioning(false)
          setCommissionShip(null)
          const message = (result.delta.details as { message?: string } | undefined)?.message
          uiStore.dispatch({ type: 'toast', kind: 'success', text: message ?? `Commissioned ${commissionShip.name}` })
        })
        .catch((err) => {
          setCommissioning(false)
          reportError(err)
        })
    },
    [mutate, commissionShip, reportError, uiStore]
  )

  const toggles = [
    { label: 'For sale', title: 'Show only ships listed for sale at any station', on: buyHereOnly, set: setBuyHereOnly, icon: <ShoppingCart size={11} /> },
    { label: 'Commission here', title: 'Show only ships you can commission at this shipyard', on: commissionHereOnly, set: setCommissionHereOnly, icon: <Hammer size={11} /> },
    { label: 'Can fly', title: 'Hide ships your piloting, reputation, or a prestige lock blocks', on: canFlyOnly, set: setCanFlyOnly, icon: <Check size={11} /> },
  ]

  return (
    <>
      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.topRow}>
          <div className={styles.searchRow}>
            <Search size={12} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search ships..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
            />
          </div>
        </div>
        {browseLoading && <span className={styles.countLabel}>Searching listings at {stations.length} stations...</span>}
        <div className={styles.filterRow}>
          {toggles.map((t) => (
            <button
              key={t.label}
              className={`${styles.toggleBtn} ${t.on ? styles.toggleBtnActive : ''}`}
              onClick={() => { t.set(!t.on); resetPage() }}
              title={t.title}
              aria-pressed={t.on}
              type="button"
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.filterRow}>
          <select className={styles.filterSelect} value={empire} onChange={(e) => { setEmpire(e.target.value); resetPage() }}>
            <option value="">All Empires</option>
            {EMPIRES.map((e) => (
              <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
            ))}
          </select>
          <select className={styles.filterSelect} value={tier} onChange={(e) => { setTier(e.target.value); resetPage() }}>
            <option value="">All Tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>Tier {t}</option>
            ))}
          </select>
          <select className={styles.filterSelect} value={category} onChange={(e) => { setCategory(e.target.value); resetPage() }}>
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className={styles.filterSelect} value={shipClass} onChange={(e) => { setShipClass(e.target.value); resetPage() }}>
            <option value="">All Classes</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {!catalog && !catalogError ? (
        <Loading message="Loading catalog..." />
      ) : catalogError ? (
        <div className={shared.emptyState}>Failed to load ship catalog: {catalogError}</div>
      ) : ships.length === 0 ? (
        <div className={shared.emptyState}>No ships found</div>
      ) : (
        <>
          <span className={styles.countLabel}>
            {total} ship class{total !== 1 ? 'es' : ''}
          </span>
          <div className={styles.shipList}>
            {ships.map((catShip) => {
              const isExpanded = expandedShip === catShip.id
              const imgName = catShip.id.toLowerCase().replace(/\s+/g, '_')
              const imgSrc = imageUrl(`ships/catalog/${imgName}.webp`)
              const isCommissionable = commissionableIds.has(catShip.id)
              const listings = listingsByClass[catShip.id] ?? []
              const reasons = blockReasons(catShip)
              const blocked = reasons.length > 0
              return (
                <div key={catShip.id} className={styles.shipCard}>
                  {/* Collapsed view */}
                  <div
                    className={styles.shipCardTop}
                    onClick={() => toggleExpand(catShip.id)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleExpand(catShip.id)
                      }
                    }}
                  >
                    <div className={styles.shipCardInfo}>
                      <div className={styles.shipCardNameRow}>
                        <span className={styles.shipCardName}>{catShip.name}</span>
                        <span className={styles.shipCardBadges}>
                          {catShip.tier > 0 && <span className={shared.badgeOrange}>T{catShip.tier}</span>}
                          {catShip.faction && <span className={shared.badgeCyan}>{catShip.faction}</span>}
                          {catShip.category && <span className={shared.badgeGreen}>{catShip.category}</span>}
                        </span>
                        <BugReportButton contextType="ship" entityName={catShip.name} entityContext={buildShipCatalogContext(catShip)} />
                      </div>
                      <span className={styles.shipCardClass}>
                        {catShip.category} · {catShip.class}
                      </span>
                      <span className={styles.shipCardBadges}>
                        {listings.length > 0 && (
                          <span className={shared.badgePurple}>
                            {listings.length} for sale from <Credits amount={listings[0].price} />
                          </span>
                        )}
                        {isCommissionable && <span className={shared.badgeCyan} title="You can commission this ship here">Commission</span>}
                        {blocked
                          ? <span className={styles.blockReason}><Lock size={10} /> {reasons.join(' · ')}</span>
                          : <span className={shared.badgeGreen}>Can fly</span>}
                      </span>
                      {catShip.description && (
                        <span className={styles.shipCardDesc}>{catShip.description}</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div className={styles.shipDetails}>
                      <div className={styles.shipImageWrap}>
                        <Image
                          src={imgSrc}
                          alt={catShip.name}
                          width={600}
                          height={450}
                          className={styles.shipImageExpanded}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <button
                          className={styles.fullscreenBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            setFullscreenImage({ src: imgSrc, name: catShip.name })
                          }}
                          title="View full size"
                          type="button"
                        >
                          <Maximize2 size={12} />
                        </button>
                      </div>

                      <div className={styles.shipDetailsRight}>
                        {isMobileBase(catShip) ? <>
                          <p>Hull {catShip.base_hull} · Shield {catShip.base_shield} · Armor {catShip.base_armor} · Shield recharge {catShip.base_shield_recharge ?? 0}/tick</p>
                          <MobileBaseDetails ship={catShip} />
                        </> : <>
                          <div className={styles.shipStatsRow}>
                            <div className={styles.shipStat}><Heart size={10} /><StatWithDelta label="Hull" value={catShip.base_hull} currentValue={ship?.max_hull} /></div>
                            <div className={styles.shipStat}><Shield size={10} /><StatWithDelta label="Shield" value={catShip.base_shield} currentValue={ship?.max_shield} /></div>
                            <div className={styles.shipStat}><Gauge size={10} /><StatWithDelta label="Speed" value={catShip.base_speed} currentValue={ship?.speed} /></div>
                          </div>
                          <div className={styles.shipStatsRow}>
                            <div className={styles.shipStat}><Fuel size={10} /><StatWithDelta label="Fuel" value={catShip.base_fuel} currentValue={ship?.max_fuel} /></div>
                            <div className={styles.shipStat}><Package size={10} /><StatWithDelta label="Cargo" value={catShip.cargo_capacity} currentValue={ship?.cargo_capacity} /></div>
                          </div>
                          <div className={styles.shipStatsRow}>
                            <div className={styles.shipStat}><Crosshair size={10} /><StatWithDelta label="Wpn" value={catShip.weapon_slots} currentValue={ship?.weapon_slots} /></div>
                            <div className={styles.shipStat}><Shield size={10} /><StatWithDelta label="Def" value={catShip.defense_slots} currentValue={ship?.defense_slots} /></div>
                            <div className={styles.shipStat}><CircuitBoard size={10} /><StatWithDelta label="Util" value={catShip.utility_slots} currentValue={ship?.utility_slots} /></div>
                          </div>

                        </>}
                        {catShip.build_materials && catShip.build_materials.length > 0 && (
                          <div className={styles.buildMats}>
                            <span className={styles.buildLabel}>Build materials:</span>
                            {catShip.build_materials.map((m) => (
                              <span key={m.item_id} className={styles.buildItem}>
                                {m.item_id.replace(/_/g, ' ')} x{m.quantity}
                              </span>
                            ))}
                          </div>
                        )}

                        {catShip.lore && (
                          <div className={styles.shipLore}>{catShip.lore}</div>
                        )}

                      {/* Get one: listings, commission, buy order. A blocked class shows none of these. */}
                      {listings.length > 0 && (
                        <div className={listingStyles.listingsList}>
                          <span className={shared.sectionTitle}>For Sale</span>
                          {listings.map((listing) => {
                            const canAfford = credits >= listing.price
                            return (
                              <div key={listing.listing_id} className={listingStyles.sellCard}>
                                <div className={listingStyles.listingStatsRow}>
                                  <span className={canAfford ? listingStyles.listingPrice : listingStyles.listingPriceUnaffordable}>
                                    <Credits amount={listing.price} />
                                  </span>
                                  <span className={listingStyles.listingStat}><Heart size={10} /> {listing.hull}/{listing.max_hull}</span>
                                  <span className={listingStyles.listingStat}><CircuitBoard size={10} /> {listing.modules_count ?? 0} modules</span>
                                  <span className={listingStyles.listingStat}><User size={10} /> {listing.seller}</span>
                                  <span className={listingStyles.listingStat}><MapPin size={10} /> {listing.base_name}</span>
                                </div>
                                {!blocked && buyableHere(listing) && (
                                  <button
                                    className={shared.accentBtn}
                                    onClick={() => setBuyTarget({ ship: catShip, listing })}
                                    disabled={!canAfford}
                                    title={canAfford ? `Buy from ${listing.seller}` : `Need ${(listing.price - credits).toLocaleString()} more credits`}
                                    type="button"
                                  >
                                    <ShoppingCart size={12} /> Buy
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {isDocked && (isCommissionable || canOrder(catShip)) && (
                        <div className={listingStyles.modalRow}>
                          {isCommissionable && (
                            <button
                              className={styles.commissionBtn}
                              onClick={() => setCommissionShip(catShip)}
                              title="Commission this ship"
                              type="button"
                            >
                              <Hammer size={12} />
                              Commission
                            </button>
                          )}
                          {canOrder(catShip) && (orderConfirm ? (
                            <ConfirmAction
                              message={`Escrow ${parseInt(orderPrice, 10).toLocaleString()} cr plus sales tax for a ${catShip.name} buy order here?`}
                              variant="accent"
                              onConfirm={() => placeOrder(catShip)}
                              onCancel={() => setOrderConfirm(false)}
                            />
                          ) : (
                            <>
                              <input
                                className={shared.textInput}
                                type="number"
                                min="1"
                                placeholder="Offer (cr)"
                                aria-label={`Buy order offer for ${catShip.name}`}
                                value={orderPrice}
                                onChange={(e) => setOrderPrice(e.target.value)}
                              />
                              <button
                                className={shared.accentBtn}
                                onClick={() => setOrderConfirm(true)}
                                disabled={!(parseInt(orderPrice, 10) > 0)}
                                title="Place a standing order; a seller here can fill it any time"
                                type="button"
                              >
                                <ClipboardList size={12} /> Place Buy Order
                              </button>
                            </>
                          ))}
                        </div>
                      )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {total > PAGE_SIZE && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} type="button">Prev</button>
              <span className={styles.pageInfo}>{page} / {Math.ceil(total / PAGE_SIZE)}</span>
              <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={page * PAGE_SIZE >= total} type="button">Next</button>
            </div>
          )}
        </>
      )}
      {otherListings.length > 0 && (
        <div className={listingStyles.listingsList}>
          <span className={shared.sectionTitle}>Other listings</span>
          {otherListings.map((listing) => (
            <div key={listing.listing_id} className={listingStyles.sellCard}>
              <div className={listingStyles.listingStatsRow}>
                <span>{listing.ship_name ?? listing.class_id}</span>
                <span className={(player?.credits ?? 0) >= listing.price ? listingStyles.listingPrice : listingStyles.listingPriceUnaffordable}>
                  <Credits amount={listing.price} />
                </span>
                <span className={listingStyles.listingStat}><Heart size={10} /> {listing.hull}/{listing.max_hull}</span>
                <span className={listingStyles.listingStat}><User size={10} /> {listing.seller}</span>
                <span className={listingStyles.listingStat}><MapPin size={10} /> {listing.base_name}</span>
              </div>
              {buyableHere(listing) && <button
                className={shared.accentBtn}
                onClick={() => setBuyTarget({ ship: { name: listing.ship_name ?? listing.class_id }, listing })}
                disabled={(player?.credits ?? 0) < listing.price}
                type="button"
              >
                <ShoppingCart size={12} /> Buy
              </button>}
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen image modal */}
      {fullscreenImage && (
        <div className={styles.imageModal} onClick={() => setFullscreenImage(null)} role="dialog" aria-modal="true" aria-label={fullscreenImage.name}>
          <button className={styles.imageModalClose} onClick={() => setFullscreenImage(null)} type="button" aria-label="Close"><X size={20} /></button>
          <Image src={fullscreenImage.src} alt={fullscreenImage.name} width={1600} height={1200} className={styles.imageModalImg} onClick={(e) => e.stopPropagation()} />
          <div className={styles.imageModalName}>{fullscreenImage.name}</div>
        </div>
      )}

      {/* Commission modal */}
      {commissionShip && (
        <Modal
          title={`Commission ${commissionShip.name}`}
          icon={<Hammer size={14} />}
          onClose={() => setCommissionShip(null)}
        >
            {quoteLoading && (
              <Loading message="Getting quote..." />
            )}

            {!quoteLoading && !quote && (
              <div className={styles.commissionError}>Failed to get commission quote.</div>
            )}

            {quote && !quote.can_commission && (
              <div className={styles.commissionError}>
                This ship cannot be commissioned at this shipyard.
                {quote.blockers && quote.blockers.map((b, i) => (
                  <div key={i} className={styles.commissionBlocker}>{b.replace(/\s*Use\s+provide_materials.*$/i, '')}</div>
                ))}
              </div>
            )}

            {quote && quote.can_commission && (() => {
              // Check local inventory (cargo + storage) for materials
              const buildMaterials = quote.build_materials ?? []
              const materialChecks = buildMaterials.map((m) => {
                const inCargo = cargo.find((c) => c.item_id === m.item_id)?.quantity ?? 0
                const inStorage = storageItemsList.find((s) => s.item_id === m.item_id)?.quantity ?? 0
                const have = inCargo + inStorage
                return { ...m, have, enough: have >= m.quantity }
              })
              const hasAllMaterials = materialChecks.every((m) => m.enough)
              const playerCredits = quote.player_credits ?? 0
              const canAffordMaterials = hasAllMaterials && playerCredits >= quote.provide_materials_total

              return (
              <div className={styles.commissionBody}>
                <div className={styles.commissionInfo}>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Build Time</span>
                    <span className={styles.commissionValue}>{quote.build_time ?? 0} ticks (~{Math.round((quote.build_time ?? 0) * 10 / 60)} min)</span>
                  </div>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Your Credits</span>
                    <span className={styles.commissionValue}><Credits amount={playerCredits} /></span>
                  </div>
                </div>

                {/* Materials list with have/need */}
                {buildMaterials.length > 0 && (
                  <div className={styles.commissionMaterials}>
                    <span className={styles.commissionLabel}>
                      Required Materials{quote.faction_funded_only && ' (from faction storage)'}
                    </span>
                    {materialChecks.map((m) => (
                      <div key={m.item_id} className={styles.commissionMaterialRow}>
                        <span>{m.name}</span>
                        {quote.faction_funded_only ? (
                          <span>x{m.quantity}</span>
                        ) : (
                          <span className={m.enough ? styles.materialHave : styles.materialMissing}>
                            {m.have}/{m.quantity}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Blockers */}
                {quote.blockers && quote.blockers.length > 0 && (
                  <div className={styles.commissionBlockers}>
                    {quote.blockers.map((b, i) => (
                      <div key={i} className={styles.commissionBlocker}>{b.replace(/\s*Use\s+provide_materials.*$/i, '')}</div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className={styles.commissionActions}>
                  {quote.faction_funded_only ? (
                    <button
                      className={shared.accentBtn}
                      onClick={() => handleCommission({ fund_from_faction: true })}
                      disabled={commissioning}
                      title="Materials come from faction storage; the treasury pays labor and any royalty"
                      type="button"
                    >
                      {commissioning ? <Loader2 size={12} className={shared.spinner} /> : <Users size={12} />}
                      Fund from Faction{quote.labor_cost != null && <> (<Credits amount={quote.labor_cost} /> labor)</>}
                    </button>
                  ) : (
                    <>
                    {quote.credits_only_available && (
                      <button
                        className={shared.accentBtn}
                        onClick={() => handleCommission({})}
                        disabled={commissioning || !quote.can_afford_credits_only}
                        title={!quote.can_afford_credits_only ? `Need ${quote.credits_only_total.toLocaleString()} cr` : undefined}
                        type="button"
                      >
                        {commissioning ? <Loader2 size={12} className={shared.spinner} /> : null}
                        Pay Credits (<Credits amount={quote.credits_only_total} />)
                      </button>
                    )}
                    <button
                      className={shared.accentBtn}
                      onClick={() => handleCommission({ provide_materials: true })}
                      disabled={commissioning || !canAffordMaterials}
                      title={!hasAllMaterials ? 'Missing required materials' : !canAffordMaterials ? `Need ${quote.provide_materials_total.toLocaleString()} cr for labor` : undefined}
                      type="button"
                    >
                      {commissioning ? <Loader2 size={12} className={shared.spinner} /> : null}
                      Provide Materials (<Credits amount={quote.provide_materials_total} /> + materials)
                    </button>
                    </>
                  )}
                  <button
                    className={shared.subtleBtn}
                    onClick={() => setCommissionShip(null)}
                    disabled={commissioning}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              )
            })()}
        </Modal>
      )}

      {/* Buy listing confirmation modal */}
      {buyTarget && (() => {
        const credits = player?.credits ?? 0
        const canAfford = credits >= buyTarget.listing.price
        return (
          <Modal
            title={`Buy ${buyTarget.ship.name}`}
            icon={<ShoppingCart size={14} />}
            onClose={() => setBuyTarget(null)}
          >
              <div className={styles.commissionBody}>
                <div className={styles.commissionInfo}>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Price</span>
                    <span className={styles.commissionValue}><Credits amount={buyTarget.listing.price} /></span>
                  </div>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Seller</span>
                    <span className={styles.commissionValue}>{buyTarget.listing.seller}</span>
                  </div>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Your Credits</span>
                    <span className={canAfford ? styles.commissionValue : styles.materialMissing}>
                      <Credits amount={credits} />
                    </span>
                  </div>
                  {!canAfford && (
                    <div className={styles.commissionBlocker}>
                      You need {(buyTarget.listing.price - credits).toLocaleString()} more credits
                    </div>
                  )}
                </div>
                <div className={styles.commissionActions}>
                  <button
                    className={shared.accentBtn}
                    onClick={handleBuyListing}
                    disabled={buying || !canAfford}
                    type="button"
                  >
                    {buying ? <Loader2 size={12} className={shared.spinner} /> : <ShoppingCart size={12} />}
                    Buy for <Credits amount={buyTarget.listing.price} />
                  </button>
                  <button
                    className={shared.subtleBtn}
                    onClick={() => setBuyTarget(null)}
                    disabled={buying}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
          </Modal>
        )
      })()}
    </>
  )
}
