'use client'

import { useEffect, useCallback, useState } from 'react'
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
import { useGame } from '../../GameProvider'
import styles from './ShipCatalog.module.css'

const EMPIRES = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim']
const TIERS = [1, 2, 3, 4, 5]
const CATEGORIES = ['Civilian', 'Combat', 'Commercial', 'Exploration', 'Industrial']
const CLASSES = ['Assault', 'Courier', 'Explorer', 'Fighter', 'Freighter', 'Gas Harvester', 'Ice Harvester', 'Miner', 'Raider', 'Salvager', 'Scout', 'Shuttle']

interface CatalogShip {
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

interface ShipListing {
  listing_id: string
  class_id: string
  price: number
  ship_name: string
  seller: string
}

interface CommissionQuote {
  ship_class: string
  ship_name: string
  labor_cost: number
  credits_only_total: number
  credits_only_available: boolean
  provide_materials_total: number
  build_time: number
  build_materials: { item_id: string; name: string; quantity: number }[]
  can_commission: boolean
  can_afford_credits_only: boolean
  can_afford_provide_materials: boolean
  player_credits: number
  blockers?: string[]
}

export function ShipCatalog() {
  const { state, sendCommand } = useGame()
  const [ships, setShips] = useState<CatalogShip[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedShip, setExpandedShip] = useState<string | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<{ src: string; name: string } | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Commissionable ship IDs at this station (server-checked)
  const [commissionableIds, setCommissionableIds] = useState<Set<string>>(new Set())

  // Ship market listings (cheapest per class)
  const [cheapestByClass, setCheapestByClass] = useState<Record<string, ShipListing>>({})
  const [buyTarget, setBuyTarget] = useState<{ ship: CatalogShip; listing: ShipListing } | null>(null)
  const [buying, setBuying] = useState(false)

  // Fetch commissionable IDs and ship marketplace when docked
  useEffect(() => {
    if (!state.isDocked) {
      setCheapestByClass({})
      setCommissionableIds(new Set())
      return
    }
    // Fetch all commissionable ships at this station
    sendCommand('catalog', { type: 'ships', commissionable: true, page_size: 500 }).then((result) => {
      const r = result as Record<string, unknown>
      const items = (r.items || []) as CatalogShip[]
      setCommissionableIds(new Set(items.map((s) => s.id)))
    }).catch(() => {})
    // Fetch ship marketplace listings
    sendCommand('browse_ships').then((result) => {
      const listings = ((result as Record<string, unknown>).listings || []) as ShipListing[]
      const cheapest: Record<string, ShipListing> = {}
      for (const l of listings) {
        if (!cheapest[l.class_id] || l.price < cheapest[l.class_id].price) {
          cheapest[l.class_id] = l
        }
      }
      setCheapestByClass(cheapest)
    }).catch(() => {})
  }, [state.isDocked, sendCommand])

  // Commission modal
  const [commissionShip, setCommissionShip] = useState<CatalogShip | null>(null)
  const [quote, setQuote] = useState<CommissionQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [commissioning, setCommissioning] = useState(false)

  // Filters
  const defaultEmpire = (state.isDocked && state.system?.empire) ? state.system.empire.toLowerCase() : ''
  const [empire, setEmpire] = useState(defaultEmpire)
  const [tier, setTier] = useState('')
  const [category, setCategory] = useState('')
  const [shipClass, setShipClass] = useState('')
  const [search, setSearch] = useState('')
  const [commissionableOnly, setCommissionableOnly] = useState(false)

  const fetchCatalog = useCallback((p: number) => {
    setLoading(true)
    const params: Record<string, unknown> = { type: 'ships', page: p, page_size: 20 }
    if (empire) params.empire = empire
    if (tier) params.tier = parseInt(tier, 10)
    if (category) params.category = category
    if (shipClass) params.class = shipClass
    if (search.trim()) params.search = search.trim()
    if (commissionableOnly) params.commissionable = true
    sendCommand('catalog', params).then((result) => {
      const r = result as Record<string, unknown>
      const items = ((r.items || []) as CatalogShip[]).filter((s) => tier || s.tier > 0)
      setShips(items)
      setTotal((r.total as number) || 0)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [sendCommand, empire, tier, category, shipClass, search, commissionableOnly])

  useEffect(() => {
    fetchCatalog(page)
  }, [fetchCatalog, page])

  useEffect(() => {
    setPage(1)
  }, [empire, tier, category, shipClass, search, commissionableOnly])

  const toggleExpand = useCallback((id: string) => {
    setExpandedShip((prev) => (prev === id ? null : id))
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') fetchCatalog(1)
  }, [fetchCatalog])

  // Commission modal
  const openCommission = useCallback((ship: CatalogShip) => {
    setCommissionShip(ship)
    setQuote(null)
    setQuoteLoading(true)
    sendCommand('commission_quote', { ship_class: ship.id }).then((result) => {
      setQuote(result as unknown as CommissionQuote)
      setQuoteLoading(false)
    }).catch(() => {
      setQuoteLoading(false)
    })
  }, [sendCommand])

  const handleBuyListing = useCallback(() => {
    if (!buyTarget) return
    setBuying(true)
    sendCommand('buy_listed_ship', { listing_id: buyTarget.listing.listing_id }).then(() => {
      setBuying(false)
      setBuyTarget(null)
      // Refresh listings
      sendCommand('browse_ships').then((result) => {
        const listings = ((result as Record<string, unknown>).listings || []) as ShipListing[]
        const cheapest: Record<string, ShipListing> = {}
        for (const l of listings) {
          if (!cheapest[l.class_id] || l.price < cheapest[l.class_id].price) {
            cheapest[l.class_id] = l
          }
        }
        setCheapestByClass(cheapest)
      }).catch(() => {})
    }).catch(() => {
      setBuying(false)
    })
  }, [sendCommand, buyTarget])

  const handleCommission = useCallback((provideMaterials: boolean) => {
    if (!commissionShip) return
    setCommissioning(true)
    sendCommand('commission_ship', {
      ship_class: commissionShip.id,
      provide_materials: provideMaterials,
    }).then(() => {
      setCommissioning(false)
      setCommissionShip(null)
      setQuote(null)
    }).catch(() => {
      setCommissioning(false)
    })
  }, [sendCommand, commissionShip])

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
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <button
            className={`${styles.toggleBtn} ${commissionableOnly ? styles.toggleBtnActive : ''}`}
            onClick={() => setCommissionableOnly(!commissionableOnly)}
            title="Show only commissionable ships"
            type="button"
          >
            <Hammer size={11} />
            Commissionable only
          </button>
        </div>
        <div className={styles.filterRow}>
          <select className={styles.filterSelect} value={empire} onChange={(e) => setEmpire(e.target.value)}>
            <option value="">All Empires</option>
            {EMPIRES.map((e) => (
              <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
            ))}
          </select>
          <select className={styles.filterSelect} value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">All Tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>Tier {t}</option>
            ))}
          </select>
          <select className={styles.filterSelect} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className={styles.filterSelect} value={shipClass} onChange={(e) => setShipClass(e.target.value)}>
            <option value="">All Classes</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {loading && ships.length === 0 ? (
        <div className={styles.emptyState}>Loading catalog...</div>
      ) : ships.length === 0 ? (
        <div className={styles.emptyState}>No ships found</div>
      ) : (
        <>
          <span className={styles.countLabel}>
            {total} ship class{total !== 1 ? 'es' : ''}
          </span>
          <div className={styles.shipList}>
            {ships.map((ship) => {
              const isExpanded = expandedShip === ship.id
              const imgName = ship.id.toLowerCase().replace(/\s+/g, '_')
              const imgSrc = `/images/ships/catalog/${imgName}.webp`
              const isCommissionable = commissionableIds.has(ship.id)
              return (
                <div key={ship.id} className={styles.shipCard}>
                  {/* Collapsed view */}
                  <div
                    className={styles.shipCardTop}
                    onClick={() => toggleExpand(ship.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') toggleExpand(ship.id) }}
                  >
                    <div className={styles.shipCardInfo}>
                      <div className={styles.shipCardNameRow}>
                        <span className={styles.shipCardName}>{ship.name}</span>
                        <span className={styles.shipCardBadges}>
                          {ship.tier > 0 && <span className={styles.tierBadge}>T{ship.tier}</span>}
                          {ship.faction && <span className={styles.factionBadge}>{ship.faction}</span>}
                        </span>
                      </div>
                      <span className={styles.shipCardClass}>
                        {ship.category} · {ship.class}
                      </span>
                      {ship.description && (
                        <span className={styles.shipCardDesc}>{ship.description}</span>
                      )}
                    </div>
                    {state.isDocked && (isCommissionable || cheapestByClass[ship.id]) && (
                      <div className={styles.cardActions}>
                        {isCommissionable && (
                          <button
                            className={styles.commissionBtn}
                            onClick={(e) => {
                              e.stopPropagation()
                              openCommission(ship)
                            }}
                            title="Commission this ship"
                            type="button"
                          >
                            <Hammer size={12} />
                            Commission
                          </button>
                        )}
                        {cheapestByClass[ship.id] && (
                          <button
                            className={styles.buyListingBtn}
                            onClick={(e) => {
                              e.stopPropagation()
                              setBuyTarget({ ship, listing: cheapestByClass[ship.id] })
                            }}
                            title={`Buy from ${cheapestByClass[ship.id].seller}`}
                            type="button"
                          >
                            <ShoppingCart size={12} />
                            Buy {cheapestByClass[ship.id].price.toLocaleString()} cr
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
                          alt={ship.name}
                          className={styles.shipImageExpanded}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <button
                          className={styles.fullscreenBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            setFullscreenImage({ src: imgSrc, name: ship.name })
                          }}
                          title="View full size"
                          type="button"
                        >
                          <Maximize2 size={12} />
                        </button>
                      </div>

                      <div className={styles.shipDetailsRight}>
                        <div className={styles.shipStatsRow}>
                          <div className={styles.shipStat}><Heart size={10} /><span>Hull {ship.base_hull}</span></div>
                          <div className={styles.shipStat}><Shield size={10} /><span>Shield {ship.base_shield}</span></div>
                          <div className={styles.shipStat}><Gauge size={10} /><span>Speed {ship.base_speed}</span></div>
                        </div>
                        <div className={styles.shipStatsRow}>
                          <div className={styles.shipStat}><Fuel size={10} /><span>Fuel {ship.base_fuel}</span></div>
                          <div className={styles.shipStat}><Package size={10} /><span>Cargo {ship.cargo_capacity}</span></div>
                        </div>
                        <div className={styles.shipStatsRow}>
                          <div className={styles.shipStat}><Crosshair size={10} /><span>Wpn {ship.weapon_slots}</span></div>
                          <div className={styles.shipStat}><Shield size={10} /><span>Def {ship.defense_slots}</span></div>
                          <div className={styles.shipStat}><CircuitBoard size={10} /><span>Util {ship.utility_slots}</span></div>
                        </div>

                        {ship.build_materials && ship.build_materials.length > 0 && (
                          <div className={styles.buildMats}>
                            <span className={styles.buildLabel}>Build materials:</span>
                            {ship.build_materials.map((m) => (
                              <span key={m.item_id} className={styles.buildItem}>
                                {m.item_id.replace(/_/g, ' ')} x{m.quantity}
                              </span>
                            ))}
                          </div>
                        )}

                        {ship.lore && (
                          <div className={styles.shipLore}>{ship.lore}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {total > 20 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} type="button">Prev</button>
              <span className={styles.pageInfo}>{page} / {Math.ceil(total / 20)}</span>
              <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} type="button">Next</button>
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
        <div className={styles.imageModal} onClick={() => { setCommissionShip(null); setQuote(null) }} role="dialog" aria-modal="true">
          <div className={styles.commissionModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.commissionHeader}>
              <span className={styles.commissionTitle}>
                <Hammer size={14} />
                Commission {commissionShip.name}
              </span>
              <button
                className={styles.imageModalClose}
                onClick={() => { setCommissionShip(null); setQuote(null) }}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            {quoteLoading && (
              <div className={styles.commissionLoading}>
                <Loader2 size={20} className={styles.spinner} />
                Getting quote...
              </div>
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
              const cargo = state.ship?.cargo || []
              const storageItems = state.storageData?.items || []
              const materialChecks = quote.build_materials.map((m) => {
                const inCargo = cargo.find((c) => c.item_id === m.item_id)?.quantity || 0
                const inStorage = storageItems.find((s) => s.item_id === m.item_id)?.quantity || 0
                const have = inCargo + inStorage
                return { ...m, have, enough: have >= m.quantity }
              })
              const hasAllMaterials = materialChecks.every((m) => m.enough)
              const canAffordMaterials = hasAllMaterials && quote.player_credits >= quote.provide_materials_total

              return (
              <div className={styles.commissionBody}>
                <div className={styles.commissionInfo}>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Build Time</span>
                    <span className={styles.commissionValue}>{quote.build_time} ticks (~{Math.round(quote.build_time * 10 / 60)} min)</span>
                  </div>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Your Credits</span>
                    <span className={styles.commissionValue}>{quote.player_credits.toLocaleString()} cr</span>
                  </div>
                </div>

                {/* Materials list with have/need */}
                {quote.build_materials.length > 0 && (
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
                      className={styles.commissionPayBtn}
                      onClick={() => handleCommission(false)}
                      disabled={commissioning || !quote.can_afford_credits_only}
                      title={!quote.can_afford_credits_only ? `Need ${quote.credits_only_total.toLocaleString()} cr` : undefined}
                      type="button"
                    >
                      {commissioning ? <Loader2 size={12} className={styles.spinner} /> : null}
                      Pay Credits ({quote.credits_only_total.toLocaleString()} cr)
                    </button>
                  )}
                  <button
                    className={styles.commissionPayBtn}
                    onClick={() => handleCommission(true)}
                    disabled={commissioning || !canAffordMaterials}
                    title={!hasAllMaterials ? 'Missing required materials' : !canAffordMaterials ? `Need ${quote.provide_materials_total.toLocaleString()} cr for labor` : undefined}
                    type="button"
                  >
                    {commissioning ? <Loader2 size={12} className={styles.spinner} /> : null}
                    Provide Materials ({quote.provide_materials_total.toLocaleString()} cr + materials)
                  </button>
                  <button
                    className={styles.commissionCancelBtn}
                    onClick={() => { setCommissionShip(null); setQuote(null) }}
                    disabled={commissioning}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Buy listing confirmation modal */}
      {buyTarget && (() => {
        const credits = state.player?.credits ?? 0
        const canAfford = credits >= buyTarget.listing.price
        return (
          <div className={styles.imageModal} onClick={() => setBuyTarget(null)} role="dialog" aria-modal="true">
            <div className={styles.commissionModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.commissionHeader}>
                <span className={styles.commissionTitle}>
                  <ShoppingCart size={14} />
                  Buy {buyTarget.ship.name}
                </span>
                <button
                  className={styles.imageModalClose}
                  onClick={() => setBuyTarget(null)}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
              <div className={styles.commissionBody}>
                <div className={styles.commissionInfo}>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Price</span>
                    <span className={styles.commissionValue}>{buyTarget.listing.price.toLocaleString()} cr</span>
                  </div>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Seller</span>
                    <span className={styles.commissionValue}>{buyTarget.listing.seller}</span>
                  </div>
                  <div className={styles.commissionRow}>
                    <span className={styles.commissionLabel}>Your Credits</span>
                    <span className={canAfford ? styles.commissionValue : styles.materialMissing}>
                      {credits.toLocaleString()} cr
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
                    className={styles.commissionPayBtn}
                    onClick={handleBuyListing}
                    disabled={buying || !canAfford}
                    type="button"
                  >
                    {buying ? <Loader2 size={12} className={styles.spinner} /> : <ShoppingCart size={12} />}
                    Buy for {buyTarget.listing.price.toLocaleString()} cr
                  </button>
                  <button
                    className={styles.commissionCancelBtn}
                    onClick={() => setBuyTarget(null)}
                    disabled={buying}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
