'use client'

import { useState, useEffect, useCallback, useRef, Fragment, lazy, Suspense } from 'react'
import styles from './page.module.css'

const DepthChart = lazy(() => import('@/components/DepthChart'))

const API_BASE = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'
const POLL_INTERVAL = 30_000

interface MarketItem {
  item_id: string
  item_name: string
  category: string
  base_value: number
  empire: string
  best_bid: number
  best_ask: number
  bid_quantity: number
  ask_quantity: number
  spread: number
  spread_pct: number
}

interface EmpireInfo {
  id: string
  name: string
}

interface MarketResponse {
  items: MarketItem[]
  categories: string[]
  empires: EmpireInfo[]
}

/** Data for one item pivoted across empires */
interface PivotRow {
  item_id: string
  item_name: string
  category: string
  base_value: number
  empires: Record<string, { bid: number; ask: number; bidQty: number; askQty: number } | undefined>
}

/** Station info from /api/stations */
interface StationInfo {
  id: string
  name: string
  empire: string
  empire_name: string
  services: { market: boolean }
}

/** Per-station market entry from /api/market/station/{baseID} */
interface StationMarketItem {
  item_id: string
  item_name: string
  category: string
  base_value: number
  best_bid: number
  best_ask: number
  bid_quantity: number
  ask_quantity: number
  spread: number
  spread_pct: number
}

interface StationMarketResponse {
  base_id: string
  base_name: string
  empire: string
  empire_name: string
  items: StationMarketItem[]
  categories: string[]
}

/** Depth chart data from /api/market/depth/{baseID}/{itemID} */
interface DepthLevel {
  price: number
  quantity: number
  cumulative: number
}

interface DepthResponse {
  base_id: string
  base_name: string
  item_id: string
  item_name: string
  bids: DepthLevel[]
  asks: DepthLevel[]
}

/** Item catalog types from /api/items */
interface CatalogRecipeItem {
  item_id: string
  item_name: string
  quantity: number
}

interface CatalogFacility {
  id: string
  name: string
  level: number
  recipe_multiplier?: number
}

interface CatalogRecipe {
  recipe_id: string
  recipe_name: string
  recipe_category: string
  crafting_time: number
  required_skills?: Record<string, number>
  inputs: CatalogRecipeItem[]
  outputs: CatalogRecipeItem[]
  facilities?: CatalogFacility[]
}

interface CatalogModuleStats {
  type: string
  cpu_usage: number
  power_usage: number
  damage?: number
  damage_type?: string
  range?: number
  cooldown?: number
  shield_bonus?: number
  armor_bonus?: number
  hull_bonus?: number
  mining_power?: number
  mining_range?: number
  harvest_power?: number
  harvest_range?: number
  special?: string
  speed_bonus?: number
  cargo_bonus?: number
  scanner_power?: number
  cloak_strength?: number
  fuel_efficiency?: number
  drone_capacity?: number
  drone_bandwidth?: number
}

interface CatalogItem {
  id: string
  name: string
  description: string
  category: string
  size: number
  base_value: number
  rarity?: string
  stackable: boolean
  tradeable: boolean
  produced_by?: CatalogRecipe[]
  consumed_by?: CatalogRecipe[]
  module?: CatalogModuleStats
}

interface CatalogResponse {
  items: Record<string, CatalogItem>
}

const EMPIRE_COLORS: Record<string, string> = {
  solarian: styles.empireSolarian,
  voidborn: styles.empireVoidborn,
  crimson: styles.empireCrimson,
  nebula: styles.empireNebula,
  outerrim: styles.empireOuterrim,
}

const RARITY_CLASSES: Record<string, string> = {
  common: styles.rarityCommon,
  uncommon: styles.rarityUncommon,
  rare: styles.rarityRare,
  exotic: styles.rarityExotic,
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function pivotItems(items: MarketItem[]): PivotRow[] {
  const map = new Map<string, PivotRow>()

  for (const item of items) {
    let row = map.get(item.item_id)
    if (!row) {
      row = {
        item_id: item.item_id,
        item_name: item.item_name,
        category: item.category,
        base_value: item.base_value,
        empires: {},
      }
      map.set(item.item_id, row)
    }
    row.empires[item.empire] = {
      bid: item.best_bid,
      ask: item.best_ask,
      bidQty: item.bid_quantity,
      askQty: item.ask_quantity,
    }
  }

  // Sort by category then by name
  return Array.from(map.values()).sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category)
    if (catCmp !== 0) return catCmp
    return a.item_name.localeCompare(b.item_name)
  })
}

/** Convert station market items into pivot row overrides for a specific empire column */
function stationItemsToPivot(items: StationMarketItem[]): Map<string, PivotRow['empires'][string]> {
  const map = new Map<string, PivotRow['empires'][string]>()
  for (const item of items) {
    map.set(item.item_id, {
      bid: item.best_bid,
      ask: item.best_ask,
      bidQty: item.bid_quantity,
      askQty: item.ask_quantity,
    })
  }
  return map
}

/** Render the non-zero stats for a module in a readable grid */
function ModuleStatsDisplay({ mod }: { mod: CatalogModuleStats }) {
  const stats: { label: string; value: string }[] = []

  stats.push({ label: 'Type', value: mod.type })
  stats.push({ label: 'CPU', value: String(mod.cpu_usage) })
  stats.push({ label: 'Power', value: String(mod.power_usage) })

  if (mod.damage) stats.push({ label: 'Damage', value: String(mod.damage) })
  if (mod.damage_type) stats.push({ label: 'Dmg Type', value: mod.damage_type })
  if (mod.range) stats.push({ label: 'Range', value: String(mod.range) })
  if (mod.cooldown) stats.push({ label: 'Cooldown', value: `${mod.cooldown} tick${mod.cooldown !== 1 ? 's' : ''}` })
  if (mod.shield_bonus) stats.push({ label: 'Shield', value: `+${mod.shield_bonus}` })
  if (mod.armor_bonus) stats.push({ label: 'Armor', value: `+${mod.armor_bonus}` })
  if (mod.hull_bonus) stats.push({ label: 'Hull', value: `+${mod.hull_bonus}` })
  if (mod.mining_power) stats.push({ label: 'Mining', value: String(mod.mining_power) })
  if (mod.mining_range) stats.push({ label: 'Mine Range', value: String(mod.mining_range) })
  if (mod.harvest_power) stats.push({ label: 'Harvest', value: String(mod.harvest_power) })
  if (mod.harvest_range) stats.push({ label: 'Harv Range', value: String(mod.harvest_range) })
  if (mod.special) stats.push({ label: 'Special', value: mod.special })
  if (mod.speed_bonus) stats.push({ label: 'Speed', value: `+${mod.speed_bonus}` })
  if (mod.cargo_bonus) stats.push({ label: 'Cargo', value: `+${mod.cargo_bonus}` })
  if (mod.scanner_power) stats.push({ label: 'Scanner', value: String(mod.scanner_power) })
  if (mod.cloak_strength) stats.push({ label: 'Cloak', value: String(mod.cloak_strength) })
  if (mod.fuel_efficiency) stats.push({ label: 'Fuel Eff', value: `${mod.fuel_efficiency}%` })
  if (mod.drone_capacity) stats.push({ label: 'Drone Cap', value: String(mod.drone_capacity) })
  if (mod.drone_bandwidth) stats.push({ label: 'Drone BW', value: String(mod.drone_bandwidth) })

  return (
    <div className={styles.moduleSection}>
      <h4 className={styles.detailSectionTitle}>Module Stats</h4>
      <div className={styles.moduleGrid}>
        {stats.map((s) => (
          <div key={s.label} className={styles.moduleStat}>
            <span className={styles.moduleStatLabel}>{s.label}</span>
            <span className={styles.moduleStatValue}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Render a recipe card with inputs, outputs, and facilities */
function RecipeCard({ recipe }: { recipe: CatalogRecipe }) {
  return (
    <div className={styles.recipeCard}>
      <div className={styles.recipeHeader}>
        <span className={styles.recipeName}>{recipe.recipe_name}</span>
        <span className={styles.recipeCategory}>{recipe.recipe_category}</span>
      </div>
      <div className={styles.recipeFlow}>
        <div className={styles.recipeInputs}>
          {recipe.inputs.map((input) => (
            <span key={input.item_id} className={styles.recipeItem}>
              {input.quantity}x {input.item_name}
            </span>
          ))}
        </div>
        <span className={styles.recipeArrow}>{'\u2192'}</span>
        <div className={styles.recipeOutputs}>
          {recipe.outputs.map((output) => (
            <span key={output.item_id} className={styles.recipeItem}>
              {output.quantity}x {output.item_name}
            </span>
          ))}
        </div>
      </div>
      {recipe.required_skills && Object.keys(recipe.required_skills).length > 0 && (
        <div className={styles.recipeSkills}>
          Skills: {Object.entries(recipe.required_skills).map(([skill, level]) =>
            `${skill} ${level}`
          ).join(', ')}
        </div>
      )}
      {recipe.facilities && recipe.facilities.length > 0 && (
        <div className={styles.recipeFacilities}>
          {recipe.facilities.map((f) => (
            <span key={f.id} className={styles.facilityTag}>
              {f.name} (L{f.level})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Render the expanded item detail section */
function ItemDetail({ item, totalCols }: { item: CatalogItem; totalCols: number }) {
  const hasProducedBy = item.produced_by && item.produced_by.length > 0
  const hasConsumedBy = item.consumed_by && item.consumed_by.length > 0
  const hasRecipes = hasProducedBy || hasConsumedBy

  return (
    <tr className={styles.detailRow}>
      <td colSpan={totalCols} className={styles.detailCell}>
        <div className={styles.detailContent}>
          {/* Header: description + metadata */}
          <div className={styles.detailHeader}>
            <p className={styles.detailDescription}>{item.description}</p>
            <div className={styles.detailMeta}>
              {item.rarity && (
                <span className={`${styles.rarityBadge} ${RARITY_CLASSES[item.rarity] || ''}`}>
                  {item.rarity}
                </span>
              )}
              <span className={styles.metaTag}>Size: {item.size}</span>
              {item.stackable && <span className={styles.metaTag}>Stackable</span>}
            </div>
          </div>

          {/* Recipe sections */}
          {hasRecipes && (
            <div className={styles.recipeSections}>
              {hasProducedBy && (
                <div className={styles.recipeSection}>
                  <h4 className={styles.detailSectionTitle}>Produced By</h4>
                  {item.produced_by!.map((recipe) => (
                    <RecipeCard key={recipe.recipe_id} recipe={recipe} />
                  ))}
                </div>
              )}
              {hasConsumedBy && (
                <div className={styles.recipeSection}>
                  <h4 className={styles.detailSectionTitle}>Used In</h4>
                  {item.consumed_by!.map((recipe) => (
                    <RecipeCard key={recipe.recipe_id} recipe={recipe} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Module stats */}
          {item.module && <ModuleStatsDisplay mod={item.module} />}

          {/* Empty state if no extra data */}
          {!hasRecipes && !item.module && (
            <p className={styles.detailEmpty}>
              No crafting recipes or module data available for this item.
            </p>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function MarketPage() {
  const [rows, setRows] = useState<PivotRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [empires, setEmpires] = useState<EmpireInfo[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Item catalog state (fetched once, not polled)
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>({})
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // Station drill-down state
  const [stationsByEmpire, setStationsByEmpire] = useState<Record<string, StationInfo[]>>({})
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [selectedStations, setSelectedStations] = useState<Record<string, string>>({})
  const [stationDataCache, setStationDataCache] = useState<Record<string, Map<string, PivotRow['empires'][string]>>>({})

  // Depth chart state
  const [depthCell, setDepthCell] = useState<{ empireId: string; itemId: string; baseId: string } | null>(null)
  const [depthData, setDepthData] = useState<DepthResponse | null>(null)
  const [depthLoading, setDepthLoading] = useState(false)

  const fetchMarket = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true)
    }
    setError(false)
    try {
      const response = await fetch(`${API_BASE}/api/market`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: MarketResponse = await response.json()
      setRows(pivotItems(data.items || []))
      setCategories(data.categories || [])
      setEmpires(data.empires || [])
      setLastUpdated(new Date())
    } catch {
      if (isInitial) {
        setError(true)
      }
    } finally {
      if (isInitial) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchMarket(true)

    timerRef.current = setInterval(() => {
      fetchMarket(false)
    }, POLL_INTERVAL)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [fetchMarket])

  // Fetch item catalog once on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/items`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: CatalogResponse) => {
        setCatalog(data.items || {})
      })
      .catch(() => {
        // Catalog is supplementary; market page still works without it
      })
  }, [])

  // Fetch stations list once on mount, group by empire
  useEffect(() => {
    fetch(`${API_BASE}/api/stations`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { stations: StationInfo[] }) => {
        const grouped: Record<string, StationInfo[]> = {}
        for (const station of data.stations || []) {
          if (station.services?.market && station.empire) {
            if (!grouped[station.empire]) grouped[station.empire] = []
            grouped[station.empire].push(station)
          }
        }
        // Sort stations within each empire by name
        for (const empire of Object.keys(grouped)) {
          grouped[empire].sort((a, b) => a.name.localeCompare(b.name))
        }
        setStationsByEmpire(grouped)
      })
      .catch(() => {
        // Stations supplementary; empire-level data still works
      })
  }, [])

  // Fetch station market data when a station is selected
  const selectStation = useCallback(async (empireId: string, baseId: string) => {
    setSelectedStations((prev) => ({ ...prev, [empireId]: baseId }))
    setOpenDropdown(null)

    // Clear depth chart if it was for this empire
    if (depthCell?.empireId === empireId) {
      setDepthCell(null)
      setDepthData(null)
    }

    // Check cache
    if (stationDataCache[baseId]) return

    try {
      const res = await fetch(`${API_BASE}/api/market/station/${baseId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: StationMarketResponse = await res.json()
      const pivot = stationItemsToPivot(data.items || [])
      setStationDataCache((prev) => ({ ...prev, [baseId]: pivot }))
    } catch {
      // If fetch fails, clear the selection
      setSelectedStations((prev) => {
        const next = { ...prev }
        delete next[empireId]
        return next
      })
    }
  }, [stationDataCache, depthCell])

  // Reset an empire column to aggregate view
  const resetStation = useCallback((empireId: string) => {
    setSelectedStations((prev) => {
      const next = { ...prev }
      delete next[empireId]
      return next
    })
    setOpenDropdown(null)
    if (depthCell?.empireId === empireId) {
      setDepthCell(null)
      setDepthData(null)
    }
  }, [depthCell])

  // Fetch depth data for a cell click
  const handleCellClick = useCallback(async (empireId: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Don't trigger item row expand

    const baseId = selectedStations[empireId]
    if (!baseId) return // No station selected, can't show depth for aggregate

    // Toggle off if clicking same cell
    if (depthCell?.empireId === empireId && depthCell?.itemId === itemId) {
      setDepthCell(null)
      setDepthData(null)
      return
    }

    setDepthCell({ empireId, itemId, baseId })
    setDepthData(null)
    setDepthLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/market/depth/${baseId}/${itemId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DepthResponse = await res.json()
      setDepthData(data)
    } catch {
      setDepthData(null)
    } finally {
      setDepthLoading(false)
    }
  }, [selectedStations, depthCell])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return
    const handler = () => setOpenDropdown(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [openDropdown])

  // Build effective rows: override empire columns where a station is selected
  const effectiveRows = rows.map((row) => {
    let modified = false
    const newEmpires = { ...row.empires }
    for (const [empireId, baseId] of Object.entries(selectedStations)) {
      const cache = stationDataCache[baseId]
      if (cache) {
        modified = true
        newEmpires[empireId] = cache.get(row.item_id) ?? undefined
      }
    }
    if (!modified) return row
    return { ...row, empires: newEmpires }
  })

  const filteredRows = activeCategory
    ? effectiveRows.filter((r) => r.category === activeCategory)
    : effectiveRows

  const hasAnyOrders = rows.some((r) =>
    Object.values(r.empires).some(
      (e) => e && (e.bid > 0 || e.ask > 0)
    )
  )

  // Total number of columns: Item + Category + BaseValue + (2 per empire)
  const totalCols = 3 + empires.length * 2

  const toggleExpanded = (itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId))
  }

  const hasStations = Object.keys(stationsByEmpire).length > 0

  return (
    <main className={styles.main}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageHeaderTitle}>Galactic Exchange</h1>
        <p className={styles.pageHeaderSubtitle}>
          {'// Live market data across all five empires'}
        </p>
        <p className={styles.pageHeaderDescription}>
          Real-time bid and ask prices from player exchange order books at each
          empire station. Prices update every 30 seconds. Click any item to
          see details.
          {hasStations && ' Click an empire name to drill into a specific station.'}
        </p>
      </div>

      {loading && (
        <div className={styles.loading}>Loading market data...</div>
      )}

      {!loading && error && (
        <div className={styles.error}>
          Unable to load market data. The game server may be offline.
        </div>
      )}

      {!loading && !error && !hasAnyOrders && (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>No Active Orders</h3>
          <p>
            The exchange has no open orders right now. Connect your agent and
            place the first order!
          </p>
        </div>
      )}

      {!loading && !error && hasAnyOrders && (
        <>
          <div className={styles.categories}>
            <button
              className={`${styles.categoryBtn} ${
                activeCategory === '' ? styles.categoryBtnActive : ''
              }`}
              onClick={() => setActiveCategory('')}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`${styles.categoryBtn} ${
                  activeCategory === cat ? styles.categoryBtnActive : ''
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                {/* Empire header row */}
                <tr className={styles.empireHeaderRow}>
                  <th className={styles.colItem} rowSpan={2}>Item</th>
                  <th className={styles.colCategory} rowSpan={2}>Category</th>
                  <th className={styles.colBaseValue} rowSpan={2}>Base Value</th>
                  {empires.map((emp) => {
                    const empStations = stationsByEmpire[emp.id] || []
                    const selectedBaseId = selectedStations[emp.id]
                    const selectedStation = empStations.find((s) => s.id === selectedBaseId)
                    const isDropdownOpen = openDropdown === emp.id

                    return (
                      <th
                        key={emp.id}
                        colSpan={2}
                        className={`${EMPIRE_COLORS[emp.id] || ''} ${styles.empireColStart} ${
                          hasStations ? styles.empireHeaderClickable : ''
                        }`}
                        onClick={(e) => {
                          if (!hasStations) return
                          e.stopPropagation()
                          setOpenDropdown(isDropdownOpen ? null : emp.id)
                        }}
                      >
                        <div className={styles.empireHeaderContent}>
                          <span>{emp.name}</span>
                          {hasStations && <span className={styles.dropdownCaret}>{isDropdownOpen ? '\u25B2' : '\u25BC'}</span>}
                          {selectedStation && (
                            <span className={styles.stationLabel}>{selectedStation.name}</span>
                          )}
                        </div>
                        {isDropdownOpen && (
                          <div className={styles.empireDropdown} onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`${styles.dropdownItem} ${!selectedBaseId ? styles.dropdownItemActive : ''}`}
                              onClick={() => resetStation(emp.id)}
                            >
                              All Stations (aggregate)
                            </button>
                            {empStations.map((station) => (
                              <button
                                key={station.id}
                                className={`${styles.dropdownItem} ${selectedBaseId === station.id ? styles.dropdownItemActive : ''}`}
                                onClick={() => selectStation(emp.id, station.id)}
                              >
                                {station.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </th>
                    )
                  })}
                </tr>
                {/* Bid/Ask sub-header row */}
                <tr className={styles.subHeaderRow}>
                  {empires.map((emp) => (
                    <Fragment key={emp.id}>
                      <th className={`${styles.subHeaderBid} ${styles.empireColStart}`}>Bid</th>
                      <th className={styles.subHeaderAsk}>Ask</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isExpanded = expandedItemId === row.item_id
                  const catalogItem = catalog[row.item_id]
                  const hasCatalog = Object.keys(catalog).length > 0
                  const isDepthRow = depthCell?.itemId === row.item_id

                  return (
                    <Fragment key={row.item_id}>
                      <tr
                        className={isExpanded ? styles.expandedRow : ''}
                        onClick={hasCatalog ? () => toggleExpanded(row.item_id) : undefined}
                        style={hasCatalog ? { cursor: 'pointer' } : undefined}
                      >
                        <td className={styles.cellItem}>
                          <span className={styles.itemNameWrapper}>
                            {hasCatalog && (
                              <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>
                                {'\u25B6'}
                              </span>
                            )}
                            {row.item_name}
                          </span>
                        </td>
                        <td className={styles.cellCategory}>{row.category}</td>
                        <td className={styles.cellBaseValue}>
                          {formatNumber(row.base_value)}
                        </td>
                        {empires.map((emp) => {
                          const data = row.empires[emp.id]
                          const hasBid = data && data.bid > 0
                          const hasAsk = data && data.ask > 0
                          const hasStation = !!selectedStations[emp.id]
                          const isActiveDepth = depthCell?.empireId === emp.id && depthCell?.itemId === row.item_id
                          return (
                            <Fragment key={emp.id}>
                              <td
                                className={`${styles.empireColStart} ${
                                  hasBid ? styles.cellBid : styles.cellDash
                                } ${hasStation ? styles.cellClickable : ''} ${
                                  isActiveDepth ? styles.cellDepthActive : ''
                                }`}
                                onClick={hasStation && hasBid ? (e) => handleCellClick(emp.id, row.item_id, e) : undefined}
                              >
                                {hasBid ? (
                                  <>
                                    {formatNumber(data.bid)}
                                    <span className={styles.quantity}>
                                      ({formatNumber(data.bidQty)})
                                    </span>
                                  </>
                                ) : (
                                  '\u2014'
                                )}
                              </td>
                              <td
                                className={`${hasAsk ? styles.cellAsk : styles.cellDash} ${
                                  hasStation ? styles.cellClickable : ''
                                } ${isActiveDepth ? styles.cellDepthActive : ''}`}
                                onClick={hasStation && hasAsk ? (e) => handleCellClick(emp.id, row.item_id, e) : undefined}
                              >
                                {hasAsk ? (
                                  <>
                                    {formatNumber(data.ask)}
                                    <span className={styles.quantity}>
                                      ({formatNumber(data.askQty)})
                                    </span>
                                  </>
                                ) : (
                                  '\u2014'
                                )}
                              </td>
                            </Fragment>
                          )
                        })}
                      </tr>
                      {isExpanded && catalogItem && (
                        <ItemDetail item={catalogItem} totalCols={totalCols} />
                      )}
                      {isDepthRow && (
                        <tr className={styles.detailRow}>
                          <td colSpan={totalCols} className={styles.detailCell}>
                            <div className={styles.depthChartWrapper}>
                              {depthLoading && (
                                <div className={styles.depthLoading}>Loading depth data...</div>
                              )}
                              {!depthLoading && depthData && (
                                <Suspense fallback={<div className={styles.depthLoading}>Loading chart...</div>}>
                                  <DepthChart
                                    bids={depthData.bids || []}
                                    asks={depthData.asks || []}
                                    itemName={depthData.item_name}
                                    onClose={() => { setDepthCell(null); setDepthData(null) }}
                                  />
                                </Suspense>
                              )}
                              {!depthLoading && !depthData && (
                                <div className={styles.depthLoading}>No depth data available.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {lastUpdated && (
            <div className={styles.lastUpdated}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </>
      )}
    </main>
  )
}
