'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Hammer,
} from 'lucide-react'
import { useGame } from '../../GameProvider'
import { Credits, Modal, Loading, shared } from '../../shared'
import type { ViewStorageResponse } from '@/lib/gameTypes'
import styles from './facilities.module.css'

/**
 * Sum of `itemId` quantities across the inventory pools the gameserver will
 * draw from on a build. Personal/station builds draw from ship cargo + station
 * storage; faction builds also draw from the faction lockbox at the current
 * base. We combine all available pools so the have/need indicator never
 * under-reports relative to what the server would accept — the server still
 * does the authoritative check on the actual `facility_build` call.
 *
 * Any pool may be undefined (no ship, not docked, not in a faction, response
 * not yet loaded); those cases collapse to a 0 contribution. Non-finite
 * quantities are coerced to 0 so totals stay safe to display.
 */
export function combinedQuantity(
  itemId: string,
  cargo?: { item_id: string; quantity: number }[] | null,
  storage?: { item_id: string; quantity: number }[] | null,
  factionStorage?: { item_id: string; quantity: number }[] | null,
): number {
  const safe = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)
  const fromCargo = safe((cargo ?? []).find(c => c.item_id === itemId)?.quantity)
  const fromStorage = safe((storage ?? []).find(s => s.item_id === itemId)?.quantity)
  const fromFaction = safe((factionStorage ?? []).find(s => s.item_id === itemId)?.quantity)
  return fromCargo + fromStorage + fromFaction
}

// Not in generated schema — the types endpoint returns untyped structured data

interface FacilityTypesDiscovery {
  action: string
  total: number
  categories: Record<string, {
    count: number
    buildable?: number
    description: string
  }>
}

interface FacilityTypeSummary {
  id: string
  type_id: string
  name: string
  category: string
  level: number
  build_cost: number
  buildable: boolean
  personal_service?: string
  bonus_type?: string
  bonus_value?: number
  recipe_id?: string
  service?: string
}

interface FacilityTypesFiltered {
  action: string
  page: number
  per_page: number
  total: number
  total_pages: number
  types: FacilityTypeSummary[]
}

interface FacilityTypeDetail {
  action: string
  type_id: string
  name: string
  description: string
  category: string
  level: number
  buildable: boolean
  build_cost: number
  build_time: number
  build_materials: { item_id: string; name: string; quantity: number }[]
  labor_cost: number
  rent_per_cycle: number
  recipe?: {
    id: string
    name: string
    crafting_time: number
    inputs: { item_id: string; name: string; quantity: number }[]
    outputs: { item_id: string; name: string; quantity: number }[]
  }
  personal_service?: string
  bonus_type?: string
  bonus_value?: number
  maintenance_per_cycle?: { item_id: string; name: string; quantity: number }[]
  upgrades_to?: string
  upgrades_to_name?: string
  upgrades_from?: string
  upgrades_from_name?: string
}

interface BuildViewProps {
  onRefresh: () => void
}

const BUILDABLE_CATEGORIES = ['production', 'personal', 'faction']

export function BuildView({ onRefresh }: BuildViewProps) {
  const { sendCommand, api, state, dispatch } = useGame()
  const factionId = state.player?.faction_id

  // Inventory pools for the have/need indicator on build materials. Cargo +
  // station storage cover personal/station builds; faction storage (fetched
  // below) covers faction builds. Memoized refs keep React happy in the JSX
  // and avoid recomputing find() on every render of every material row.
  const cargoItems = useMemo(() => state.ship?.cargo ?? [], [state.ship?.cargo])
  const stationStorageItems = useMemo(
    () => (state.isDocked ? state.storageData?.items ?? [] : []),
    [state.isDocked, state.storageData?.items],
  )

  // Ensure station storage is loaded when the build view is open and the
  // player is docked, so the have/need indicator can credit items the player
  // already left at the station. Mirrors CraftingPanel's behavior — without
  // this, items in station storage show as "missing" until the user visits
  // another panel that triggers `view_storage`.
  useEffect(() => {
    if (state.isDocked && !state.storageData) {
      sendCommand('view_storage')
    }
  }, [state.isDocked, state.storageData, sendCommand])

  const [discovery, setDiscovery] = useState<FacilityTypesDiscovery | null>(null)
  const [discoveryLoading, setDiscoveryLoading] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [buildableOnly, setBuildableOnly] = useState(true)
  const [filteredData, setFilteredData] = useState<FacilityTypesFiltered | null>(null)
  const [filteredLoading, setFilteredLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [typeDetail, setTypeDetail] = useState<FacilityTypeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [buildConfirm, setBuildConfirm] = useState<FacilityTypeDetail | null>(null)
  const [building, setBuilding] = useState(false)

  // Faction resources for client-side buildable evaluation. Only fetched if the
  // player belongs to a faction — server's `buildable` flag for faction-typed
  // facilities ignores faction treasury/storage and only checks the player's
  // personal credits/inventory, which hides faction-buildable entries.
  const [factionStorage, setFactionStorage] = useState<ViewStorageResponse | null>(null)
  const [factionTreasury, setFactionTreasury] = useState<number | null>(null)

  useEffect(() => {
    if (!api) return
    setDiscoveryLoading(true)
    api.callStructured<FacilityTypesDiscovery>('spacemolt_facility', 'types', {})
      .then(data => { if (data) setDiscovery(data) })
      .catch(() => {})
      .finally(() => setDiscoveryLoading(false))
  }, [api])

  // Fetch faction storage + treasury once when the build view opens and the
  // player has a faction. These are used to override the server-side
  // `buildable` flag for faction-typed facilities.
  useEffect(() => {
    if (!api || !factionId) return
    let cancelled = false
    api.callStructured<ViewStorageResponse>('spacemolt_storage', 'view', { target: 'faction' })
      .then(data => { if (!cancelled && data) setFactionStorage(data) })
      .catch(() => {})
    api.callStructured<{ treasury?: number }>('spacemolt_faction', 'info', {})
      .then(data => {
        if (!cancelled && data && typeof data.treasury === 'number') {
          setFactionTreasury(data.treasury)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [api, factionId])

  // Faction-aware buildable check for a facility type summary. Only used for
  // the "Buildable Only" filter; the server still validates on actual build.
  // Without a fetched detail we can only check credits, not materials — this
  // is intentional, since the cheap path is enough to surface the entry so the
  // user can expand it and see the breakdown.
  const isFactionBuildable = useCallback((ft: FacilityTypeSummary): boolean => {
    if (ft.category !== 'faction') return ft.buildable
    if (!factionId) return ft.buildable
    if (factionTreasury == null) return ft.buildable
    return factionTreasury >= ft.build_cost
  }, [factionId, factionTreasury])

  const fetchFiltered = useCallback(async (category: string, name: string, page: number) => {
    if (!api) return
    setFilteredLoading(true)
    try {
      const params: Record<string, unknown> = { per_page: 20, page }
      if (category) params.category = category
      if (name) params.name = name
      const data = await api.callStructured<FacilityTypesFiltered>('spacemolt_facility', 'types', params)
      if (data) setFilteredData(data)
    } catch { /* ignore */ }
    setFilteredLoading(false)
  }, [api])

  const handleCategorySelect = useCallback((cat: string) => {
    const newCat = selectedCategory === cat ? '' : cat
    setSelectedCategory(newCat)
    setCurrentPage(1)
    setExpandedType(null)
    setTypeDetail(null)
    if (newCat || searchQuery) {
      fetchFiltered(newCat, searchQuery, 1)
    } else {
      setFilteredData(null)
    }
  }, [selectedCategory, searchQuery, fetchFiltered])

  const handleSearch = useCallback(() => {
    setCurrentPage(1)
    setExpandedType(null)
    setTypeDetail(null)
    if (selectedCategory || searchQuery) {
      fetchFiltered(selectedCategory, searchQuery, 1)
    }
  }, [selectedCategory, searchQuery, fetchFiltered])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    setExpandedType(null)
    setTypeDetail(null)
    fetchFiltered(selectedCategory, searchQuery, page)
  }, [selectedCategory, searchQuery, fetchFiltered])

  const handleExpandType = useCallback(async (typeId: string) => {
    if (expandedType === typeId) {
      setExpandedType(null)
      setTypeDetail(null)
      return
    }
    if (!api) return
    setExpandedType(typeId)
    setTypeDetail(null)
    setDetailLoading(true)
    try {
      const data = await api.callStructured<FacilityTypeDetail>('spacemolt_facility', 'types', { facility_type: typeId })
      if (data) setTypeDetail(data)
    } catch { /* ignore */ }
    setDetailLoading(false)
  }, [expandedType, api])

  const handleBuild = useCallback(async (detail: FacilityTypeDetail) => {
    setBuilding(true)
    const action = detail.category === 'personal'
      ? 'facility_personal_build'
      : detail.category === 'faction'
        ? 'facility_faction_build'
        : 'facility_build'
    try {
      const result = await sendCommand(action, { facility_type: detail.type_id })
      // sendCommand resolves with { error: true, ... } on failure rather than
      // throwing, so check the result before claiming success.
      if (!result?.error) {
        const owner = detail.category === 'faction' ? 'faction' : 'station'
        const message = (result?.message as string | undefined)
          || `Construction started: ${detail.name} (${owner}) — ${detail.build_time} ticks`
        dispatch({ type: 'ADD_EVENT', entry: {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'info',
          message,
          timestamp: Date.now(),
        }})
        setBuildConfirm(null)
        // Refresh faction resources so subsequent build evaluations are accurate
        if (detail.category === 'faction' && api && factionId) {
          api.callStructured<ViewStorageResponse>('spacemolt_storage', 'view', { target: 'faction' })
            .then(data => { if (data) setFactionStorage(data) })
            .catch(() => {})
          api.callStructured<{ treasury?: number }>('spacemolt_faction', 'info', {})
            .then(data => {
              if (data && typeof data.treasury === 'number') setFactionTreasury(data.treasury)
            })
            .catch(() => {})
        }
        onRefresh()
      }
    } catch { /* handled by event log */ }
    setBuilding(false)
  }, [sendCommand, onRefresh, dispatch, api, factionId])

  if (discoveryLoading) return <Loading message="Loading facility catalog..." />

  return (
    <>
      {discovery && (
        <div className={styles.filterBar}>
          {BUILDABLE_CATEGORIES.filter(cat => discovery.categories[cat]).map(cat => {
            const info = discovery.categories[cat]
            return (
              <button
                key={cat}
                className={`${styles.filterBtn} ${selectedCategory === cat ? styles.filterBtnActive : ''}`}
                onClick={() => handleCategorySelect(cat)}
                type="button"
              >
                {cat.replace(/\b\w/g, c => c.toUpperCase())}
                {info.buildable != null && (
                  <span className={styles.filterCount}>({info.buildable})</span>
                )}
              </button>
            )
          })}
          <button
            className={`${styles.filterBtn} ${buildableOnly ? styles.filterBtnActive : ''}`}
            onClick={() => setBuildableOnly(prev => !prev)}
            type="button"
          >
            Buildable Only
          </button>
        </div>
      )}

      <div className={styles.searchRow}>
        <div className={styles.searchInputWrap}>
          <Search size={12} className={styles.searchIcon} />
          <input
            className={`${shared.textInput} ${styles.searchInput}`}
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          />
        </div>
        <button className={shared.actionBtn} onClick={handleSearch} type="button">
          <Search size={11} /> Search
        </button>
      </div>

      {filteredLoading ? (
        <Loading message="Searching..." />
      ) : filteredData ? (
        <>
          <div className={styles.section}>
            {(() => {
              const visibleTypes = buildableOnly
                ? filteredData.types.filter(ft => isFactionBuildable(ft))
                : filteredData.types
              if (visibleTypes.length === 0) return (
                <div className={shared.emptyState}>
                  {buildableOnly
                    ? 'No buildable facility types match your search. Try toggling "Buildable Only" off to see all types.'
                    : 'No facility types match your search.'}
                </div>
              )
              return visibleTypes.map(ft => {
                const isExpanded = expandedType === ft.id
                return (
                  <div key={ft.id} className={styles.typeDetail}>
                    <button
                      className={styles.typeHeader}
                      onClick={() => handleExpandType(ft.id)}
                      type="button"
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className={styles.typeName}>{ft.name}</span>
                      <span className={styles.typeLevel}>L{ft.level}</span>
                      <span className={styles.typeCost}><Credits amount={ft.build_cost} /></span>
                    </button>

                    {isExpanded && (
                      detailLoading ? (
                        <Loading message="Loading details..." />
                      ) : typeDetail ? (
                        <>
                          <div className={styles.cardDescription}>{typeDetail.description}</div>

                          <div className={styles.costBreakdown}>
                            <div className={styles.costRow}>
                              <span className={styles.costLabel}>Build Cost</span>
                              <span className={styles.costValue}><Credits amount={typeDetail.build_cost} /></span>
                            </div>
                            <div className={styles.costRow}>
                              <span className={styles.costLabel}>Build Time</span>
                              <span className={styles.costValue}>{typeDetail.build_time} ticks (~{Math.round(typeDetail.build_time * 10 / 60)}min)</span>
                            </div>
                            <div className={styles.costRow}>
                              <span className={styles.costLabel}>Rent</span>
                              <span className={styles.costValue}><Credits amount={typeDetail.rent_per_cycle} /> /cycle</span>
                            </div>
                            {typeDetail.build_materials.length > 0 && (
                              <div className={styles.costRow}>
                                <span className={styles.costLabel}>Materials</span>
                                <span className={styles.materialList}>
                                  {typeDetail.build_materials.map(m => {
                                    // Faction-typed builds also draw from the
                                    // faction lockbox; personal/station builds
                                    // do not. Pass the faction pool only when
                                    // it applies so we don't double-count.
                                    const factionPool = typeDetail.category === 'faction'
                                      ? factionStorage?.items
                                      : null
                                    const have = combinedQuantity(
                                      m.item_id, cargoItems, stationStorageItems, factionPool,
                                    )
                                    const enough = have >= m.quantity
                                    return (
                                      <span
                                        key={m.item_id}
                                        className={enough ? styles.materialOk : styles.materialMissing}
                                        title={enough
                                          ? `You have ${have} ${m.name}`
                                          : `Need ${m.quantity - have} more ${m.name} (have ${have})`}
                                      >
                                        {m.name} {have}/{m.quantity}
                                      </span>
                                    )
                                  })}
                                </span>
                              </div>
                            )}
                            {typeDetail.bonus_type && typeDetail.bonus_value != null && (
                              <div className={styles.costRow}>
                                <span className={styles.costLabel}>Bonus</span>
                                <span className={styles.costValue}>
                                  {typeDetail.bonus_type.replace(/_/g, ' ')} +{typeDetail.bonus_value}
                                </span>
                              </div>
                            )}
                          </div>

                          {typeDetail.recipe && (
                            <div className={styles.recipeBox}>
                              <div className={styles.recipeLabel}>Produces: {typeDetail.recipe.name}</div>
                              <div className={styles.recipeFlow}>
                                {typeDetail.recipe.inputs.map(inp => (
                                  <span key={inp.item_id}>{inp.name} x{inp.quantity}</span>
                                ))}
                                <span className={styles.recipeArrow}>→</span>
                                {typeDetail.recipe.outputs.map(out => (
                                  <span key={out.item_id}>{out.name} x{out.quantity}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {(typeDetail.upgrades_from_name || typeDetail.upgrades_to_name) && (
                            <div className={styles.upgradeChain}>
                              {typeDetail.upgrades_from_name && (
                                <>
                                  <span>{typeDetail.upgrades_from_name}</span>
                                  <span className={styles.upgradeArrow}>→</span>
                                </>
                              )}
                              <span className={styles.upgradeChainCurrent}>{typeDetail.name}</span>
                              {typeDetail.upgrades_to_name && (
                                <>
                                  <span className={styles.upgradeArrow}>→</span>
                                  <span>{typeDetail.upgrades_to_name}</span>
                                </>
                              )}
                            </div>
                          )}

                          {(() => {
                            // Faction-aware buildable check for the detail view.
                            // The server's `buildable` flag is computed against the
                            // player's personal credits/inventory only — for
                            // faction-typed facilities we instead consult the
                            // faction treasury + faction storage. Final auth
                            // is still the server's job; this just unhides the
                            // Build button so the user can attempt the action.
                            let canBuild = typeDetail.buildable
                            if (!canBuild && typeDetail.category === 'faction' && factionId) {
                              const treasuryOk = factionTreasury != null
                                && factionTreasury >= typeDetail.build_cost
                              const matsOk = !typeDetail.build_materials.length
                                || (factionStorage != null && typeDetail.build_materials.every(m => {
                                  const have = (factionStorage.items || []).find(i => i.item_id === m.item_id)
                                  return (have?.quantity ?? 0) >= m.quantity
                                }))
                              if (treasuryOk && matsOk) canBuild = true
                            }
                            if (canBuild) {
                              return (
                                <button
                                  className={shared.confirmBtn}
                                  onClick={() => setBuildConfirm(typeDetail)}
                                  type="button"
                                >
                                  <Hammer size={11} /> Build {typeDetail.name}
                                </button>
                              )
                            }
                            return (
                              <div className={shared.emptyState}>
                                {typeDetail.category === 'faction' && factionId
                                  ? 'Insufficient faction credits or materials to build this facility.'
                                  : 'This facility type cannot be built by players.'}
                              </div>
                            )
                          })()}
                        </>
                      ) : null
                    )}
                  </div>
                )
              })
            })()}
          </div>

          {filteredData.total_pages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                type="button"
                aria-label="Previous page"
              >
                <ChevronLeft size={12} />
              </button>
              <span>Page {filteredData.page} of {filteredData.total_pages}</span>
              <button
                className={styles.pageBtn}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= filteredData.total_pages}
                type="button"
                aria-label="Next page"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={shared.emptyState}>
          Select a category or search to browse available facility types.
        </div>
      )}

      {buildConfirm && (
        <Modal
          title={`Build ${buildConfirm.name}`}
          icon={<Hammer size={14} />}
          onClose={() => setBuildConfirm(null)}
        >
          <div className={styles.costBreakdown}>
            <div className={styles.costRow}>
              <span className={styles.costLabel}>Cost</span>
              <span className={styles.costValue}><Credits amount={buildConfirm.build_cost} /></span>
            </div>
            <div className={styles.costRow}>
              <span className={styles.costLabel}>Build Time</span>
              <span className={styles.costValue}>{buildConfirm.build_time} ticks (~{Math.round(buildConfirm.build_time * 10 / 60)}min)</span>
            </div>
            <div className={styles.costRow}>
              <span className={styles.costLabel}>Ongoing Rent</span>
              <span className={styles.costValue}><Credits amount={buildConfirm.rent_per_cycle} /> /cycle</span>
            </div>
            {buildConfirm.build_materials.length > 0 && (
              <div className={styles.costRow}>
                <span className={styles.costLabel}>Materials</span>
                <span className={styles.materialList}>
                  {buildConfirm.build_materials.map(m => {
                    const factionPool = buildConfirm.category === 'faction'
                      ? factionStorage?.items
                      : null
                    const have = combinedQuantity(
                      m.item_id, cargoItems, stationStorageItems, factionPool,
                    )
                    const enough = have >= m.quantity
                    return (
                      <span
                        key={m.item_id}
                        className={enough ? styles.materialOk : styles.materialMissing}
                        title={enough
                          ? `You have ${have} ${m.name}`
                          : `Need ${m.quantity - have} more ${m.name} (have ${have})`}
                      >
                        {m.name} {have}/{m.quantity}
                      </span>
                    )
                  })}
                </span>
              </div>
            )}
          </div>
          <div className={styles.cardActions}>
            <button
              className={shared.confirmBtn}
              onClick={() => handleBuild(buildConfirm)}
              disabled={building}
              type="button"
            >
              {building ? <Loader2 size={11} className={shared.spinner} /> : <Hammer size={11} />}
              Confirm Build
            </button>
            <button className={shared.subtleBtn} onClick={() => setBuildConfirm(null)} type="button">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
