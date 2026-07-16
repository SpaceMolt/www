'use client'

import { useCallback, useMemo, useState } from 'react'
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
} from 'lucide-react'
import type { BrowseShipsResponse, StorageResponse } from '@spacemolt/lib'
import { useCargo, useCatalog, useCommandMutation, useCommandQuery, useLocationState, usePlayer, useShip } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Credits, Loading, Modal, shared } from '../../shared'
import { BugReportButton } from '../../BugReportButton'
import { buildShipCatalogContext } from '../../bugReportContext'
import styles from './ShipCatalog.module.css'

export const EMPIRES = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim']
const TIERS = [1, 2, 3, 4, 5]
const CATEGORIES = ['Civilian', 'Combat', 'Commercial', 'Exploration', 'Industrial']
const CLASSES = ['Assault', 'Courier', 'Explorer', 'Fighter', 'Freighter', 'Gas Harvester', 'Ice Harvester', 'Miner', 'Raider', 'Salvager', 'Scout', 'Shuttle']
const PAGE_SIZE = 20

export interface CatalogShip {
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
  faction?: string
}

type ShipListing = BrowseShipsResponse['listings'][number]

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

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

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
  const location = useLocationState()
  const isDocked = Boolean(location?.docked_at)
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const { data: catalog, error: catalogError } = useCatalog()

  const reportError = useCallback(
    (err: unknown) => {
      const text = errorText(err)
      uiStore.dispatch({ type: 'toast', kind: 'danger', text })
      uiStore.dispatch({ type: 'event', kind: 'danger', text })
    },
    [uiStore]
  )

  const [expandedShip, setExpandedShip] = useState<string | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<{ src: string; name: string } | null>(null)
  const [page, setPage] = useState(1)

  // Commissionable ship IDs at this station (server-checked, station-specific)
  const { data: commissionablePayload } = useCommandQuery(
    async (account) => (await account.query('spacemolt_catalog', '', { type: 'ships', commissionable: true, page_size: 500 })).structuredContent,
    [],
    { enabled: isDocked }
  )
  const commissionableIds = useMemo(() => (isDocked ? idsFromCatalogPayload(commissionablePayload) : new Set<string>()), [isDocked, commissionablePayload])

  // Ship market listings (cheapest per class)
  const { data: browseData, refetch: refetchBrowse } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_ship.browse_ships({})).structuredContent,
    [],
    { enabled: isDocked }
  )
  const cheapestByClass = useMemo(() => {
    const cheapest: Record<string, ShipListing> = {}
    for (const l of browseData?.listings ?? []) {
      if (!cheapest[l.class_id] || l.price < cheapest[l.class_id].price) {
        cheapest[l.class_id] = l
      }
    }
    return isDocked ? cheapest : {}
  }, [browseData, isDocked])

  const [buyTarget, setBuyTarget] = useState<{ ship: CatalogShip; listing: ShipListing } | null>(null)
  const [buying, setBuying] = useState(false)

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
  const [commissionableOnly, setCommissionableOnly] = useState(false)

  const allShips = useMemo(() => (catalog?.ships ?? []) as unknown as CatalogShip[], [catalog])

  const filteredShips = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allShips.filter((s) => {
      if (empire && (s.faction ?? '').toLowerCase() !== empire) return false
      if (!matchesTierFilter(s, tier)) return false
      if (category && s.category !== category) return false
      if (shipClass && s.class !== shipClass) return false
      if (commissionableOnly && !commissionableIds.has(s.id)) return false
      if (q && !`${s.name} ${s.description ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allShips, empire, tier, category, shipClass, commissionableOnly, commissionableIds, search])

  const total = filteredShips.length
  const pageStart = (page - 1) * PAGE_SIZE
  const ships = filteredShips.slice(pageStart, pageStart + PAGE_SIZE)

  const resetPage = useCallback(() => setPage(1), [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedShip((prev) => (prev === id ? null : id))
  }, [])

  // Commission modal
  const openCommission = useCallback((ship: CatalogShip) => {
    setCommissionShip(ship)
  }, [])

  const handleBuyListing = useCallback(() => {
    if (!buyTarget) return
    setBuying(true)
    mutate((c) => c.spacemolt_ship.buy_listed_ship({ id: buyTarget.listing.listing_id }), { label: 'buy_listed_ship' })
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

  const handleCommission = useCallback(
    (provideMaterials: boolean) => {
      if (!commissionShip) return
      setCommissioning(true)
      mutate((c) => c.spacemolt_ship.commission_ship({ id: commissionShip.id, provide_materials: provideMaterials }), { label: 'commission_ship' })
        .then(() => {
          setCommissioning(false)
          setCommissionShip(null)
        })
        .catch((err) => {
          setCommissioning(false)
          reportError(err)
        })
    },
    [mutate, commissionShip, reportError]
  )

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
          <button
            className={`${styles.toggleBtn} ${commissionableOnly ? styles.toggleBtnActive : ''}`}
            onClick={() => { setCommissionableOnly(!commissionableOnly); resetPage() }}
            title="Show only commissionable ships"
            type="button"
          >
            <Hammer size={11} />
            Commissionable only
          </button>
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
              const imgSrc = `/images/ships/catalog/${imgName}.webp`
              const isCommissionable = commissionableIds.has(catShip.id)
              return (
                <div key={catShip.id} className={styles.shipCard}>
                  {/* Collapsed view */}
                  <div
                    className={styles.shipCardTop}
                    onClick={() => toggleExpand(catShip.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') toggleExpand(catShip.id) }}
                  >
                    <div className={styles.shipCardInfo}>
                      <div className={styles.shipCardNameRow}>
                        <span className={styles.shipCardName}>{catShip.name}</span>
                        <span className={styles.shipCardBadges}>
                          {catShip.tier > 0 && <span className={shared.badgeOrange}>T{catShip.tier}</span>}
                          {catShip.faction && <span className={shared.badgeCyan}>{catShip.faction}</span>}
                        </span>
                        <BugReportButton contextType="ship" entityName={catShip.name} entityContext={buildShipCatalogContext(catShip)} />
                      </div>
                      <span className={styles.shipCardClass}>
                        {catShip.category} · {catShip.class}
                      </span>
                      {catShip.description && (
                        <span className={styles.shipCardDesc}>{catShip.description}</span>
                      )}
                    </div>
                    {isDocked && (isCommissionable || cheapestByClass[catShip.id]) && (
                      <div className={styles.cardActions}>
                        {isCommissionable && (
                          <button
                            className={styles.commissionBtn}
                            onClick={(e) => {
                              e.stopPropagation()
                              openCommission(catShip)
                            }}
                            title="Commission this ship"
                            type="button"
                          >
                            <Hammer size={12} />
                            Commission
                          </button>
                        )}
                        {cheapestByClass[catShip.id] && (
                          <button
                            className={styles.buyListingBtn}
                            onClick={(e) => {
                              e.stopPropagation()
                              setBuyTarget({ ship: catShip, listing: cheapestByClass[catShip.id] })
                            }}
                            title={`Buy from ${cheapestByClass[catShip.id].seller}`}
                            type="button"
                          >
                            <ShoppingCart size={12} />
                            Buy <Credits amount={cheapestByClass[catShip.id].price} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div className={styles.shipDetails}>
                      <div className={styles.shipImageWrap}>
                        <img
                          src={imgSrc}
                          alt={catShip.name}
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

      {/* Fullscreen image modal */}
      {fullscreenImage && (
        <div className={styles.imageModal} onClick={() => setFullscreenImage(null)} role="dialog" aria-modal="true">
          <button className={styles.imageModalClose} onClick={() => setFullscreenImage(null)} type="button"><X size={20} /></button>
          <img src={fullscreenImage.src} alt={fullscreenImage.name} className={styles.imageModalImg} onClick={(e) => e.stopPropagation()} />
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
                    <span className={styles.commissionLabel}>Required Materials</span>
                    {materialChecks.map((m) => (
                      <div key={m.item_id} className={styles.commissionMaterialRow}>
                        <span>{m.name}</span>
                        <span className={m.enough ? styles.materialHave : styles.materialMissing}>
                          {m.have}/{m.quantity}
                        </span>
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
                  {quote.credits_only_available && (
                    <button
                      className={shared.accentBtn}
                      onClick={() => handleCommission(false)}
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
                    onClick={() => handleCommission(true)}
                    disabled={commissioning || !canAffordMaterials}
                    title={!hasAllMaterials ? 'Missing required materials' : !canAffordMaterials ? `Need ${quote.provide_materials_total.toLocaleString()} cr for labor` : undefined}
                    type="button"
                  >
                    {commissioning ? <Loader2 size={12} className={shared.spinner} /> : null}
                    Provide Materials (<Credits amount={quote.provide_materials_total} /> + materials)
                  </button>
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
