'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Hammer,
} from 'lucide-react'
import type { FacilityResponse, StorageResponse } from '@spacemolt/lib'
import { useAccountStore, useCargo, useCommandMutation, useCommandQuery, useLocationState, usePlayer } from '@/lib/spacemolt'
import { usePlay } from '../../PlayProvider'
import { Credits, Modal, Loading, shared } from '../../shared'
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

// The `types` action of spacemolt_facility is overloaded by which params are
// passed: no params -> category discovery, category/name/page -> a filtered
// paginated list, facility_type -> full detail for one type. Each shape is a
// distinct member of the FacilityResponse union; the field combinations below
// are unique discriminators for each (grepped node_modules/@spacemolt/lib).
type FacilityTypesDiscovery = Extract<FacilityResponse, { categories: unknown }>
type FacilityTypesFiltered = Extract<FacilityResponse, { types: unknown }>
type FacilityTypeSummary = FacilityTypesFiltered['types'][number]
// Extract requires the discriminator field to be REQUIRED (not `?`) on the
// target member — `type_id` is required on the detail variant, `build_materials` is not.
type FacilityTypeDetail = Extract<FacilityResponse, { type_id: unknown }>
type ViewStorageResponse = Extract<StorageResponse, { items: unknown }>

interface BuildViewProps {
  onRefresh: () => void
}

const BUILDABLE_CATEGORIES = ['production', 'personal', 'faction']

const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export function BuildView({ onRefresh }: BuildViewProps) {
  const store = useAccountStore()
  const mutate = useCommandMutation()
  const { uiStore } = usePlay()
  const player = usePlayer()
  const factionId = player?.faction_id
  const dockedAt = useLocationState()?.docked_at ?? null

  const reportError = useCallback((err: unknown) => {
    uiStore.dispatch({ type: 'toast', kind: 'danger', text: describeError(err) })
  }, [uiStore])

  // Inventory pools for the have/need indicator on build materials. Cargo +
  // station storage cover personal/station builds; faction storage (fetched
  // below) covers faction builds.
  const cargoRaw = useCargo()
  const cargoItems = useMemo(
    () => (cargoRaw ?? []).flatMap(c => (c.item_id != null && c.quantity != null ? [{ item_id: c.item_id, quantity: c.quantity }] : [])),
    [cargoRaw],
  )

  // Station storage is docked-base-scoped and not part of the core state
  // sections, so it's a panel-local query keyed on dockedAt — mirrors
  // CraftingPanel's have/need indicator (see gameserver crafting.go:
  // "station-storage-centric, no cargo path").
  const { data: storageData } = useCommandQuery(
    async (account) => {
      const resp = await account.commands.spacemolt_storage.view({})
      return resp.structuredContent as ViewStorageResponse | undefined
    },
    [dockedAt],
    { enabled: Boolean(dockedAt) },
  )
  const stationStorageItems = useMemo(() => storageData?.items ?? [], [storageData])

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

  // The category-discovery view (types() with no params) loads once on mount.
  // The filtered list / single-type detail below it are driven by explicit
  // user actions (category click, search, page change, row expand), so those
  // stay imperative one-off calls rather than reactive queries.
  const { data: discovery, loading: discoveryLoading } = useCommandQuery(
    async (account) => {
      const resp = await account.commands.spacemolt_facility.types()
      return resp.structuredContent as FacilityTypesDiscovery | undefined
    },
    [],
  )

  // Faction resources for client-side buildable evaluation. Only fetched if the
  // player belongs to a faction — server's `buildable` flag for faction-typed
  // facilities ignores faction treasury/storage and only checks the player's
  // personal credits/inventory, which hides faction-buildable entries.
  const { data: factionStorage, refetch: refetchFactionStorage } = useCommandQuery(
    async (account) => {
      const resp = await account.commands.spacemolt_storage.view({ target: 'faction' })
      return resp.structuredContent as ViewStorageResponse | undefined
    },
    [factionId],
    { enabled: Boolean(factionId) },
  )
  const { data: factionInfo, refetch: refetchFactionInfo } = useCommandQuery(
    async (account) => {
      const resp = await account.commands.spacemolt_faction.info()
      return resp.structuredContent
    },
    [factionId],
    { enabled: Boolean(factionId) },
  )
  const factionTreasury = typeof factionInfo?.treasury === 'number' ? factionInfo.treasury : null

  // Faction-aware buildable check for a facility type summary. Only used for
  // the "Buildable Only" filter; the server still validates on actual build.
  // Without a fetched detail we can only check credits, not materials — this
  // is intentional, since the cheap path is enough to surface the entry so the
  // user can expand it and see the breakdown.
  const isFactionBuildable = useCallback((ft: FacilityTypeSummary): boolean => {
    if (ft.category !== 'faction') return Boolean(ft.buildable)
    if (!factionId) return Boolean(ft.buildable)
    if (factionTreasury == null) return Boolean(ft.buildable)
    return factionTreasury >= ft.build_cost
  }, [factionId, factionTreasury])

  const fetchFiltered = useCallback(async (category: string, name: string, page: number) => {
    setFilteredLoading(true)
    try {
      const params: {
        category?: 'infrastructure' | 'service' | 'production' | 'faction' | 'personal'
        name?: string
        page: number
        per_page: number
      } = { per_page: 20, page }
      if (category) params.category = category as 'infrastructure' | 'service' | 'production' | 'faction' | 'personal'
      if (name) params.name = name
      const resp = await store.account.commands.spacemolt_facility.types(params)
      const data = resp.structuredContent as FacilityTypesFiltered | undefined
      if (data) setFilteredData(data)
    } catch { /* ignore */ }
    setFilteredLoading(false)
  }, [store])

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
    setExpandedType(typeId)
    setTypeDetail(null)
    setDetailLoading(true)
    try {
      const resp = await store.account.commands.spacemolt_facility.types({ facility_type: typeId })
      const data = resp.structuredContent as FacilityTypeDetail | undefined
      if (data) setTypeDetail(data)
    } catch { /* ignore */ }
    setDetailLoading(false)
  }, [expandedType, store])

  const handleBuild = useCallback(async (detail: FacilityTypeDetail) => {
    setBuilding(true)
    try {
      const result = detail.category === 'personal'
        ? await mutate((c) => c.spacemolt_facility.personal_build({ facility_type: detail.type_id }), { label: 'facility_personal_build' })
        : detail.category === 'faction'
          ? await mutate((c) => c.spacemolt_facility.faction_build({ facility_type: detail.type_id }), { label: 'facility_faction_build' })
          : await mutate((c) => c.spacemolt_facility.build({ facility_type: detail.type_id }), { label: 'facility_build' })
      const owner = detail.category === 'faction' ? 'faction' : 'station'
      const detailsRecord = (result.delta.details ?? {}) as Record<string, unknown>
      const message = (typeof detailsRecord.message === 'string' ? detailsRecord.message : undefined)
        || `Construction started: ${detail.name} (${owner}) — ${detail.build_time} ticks`
      uiStore.dispatch({ type: 'event', kind: 'info', text: message })
      setBuildConfirm(null)
      // Refresh faction resources so subsequent build evaluations are accurate
      if (detail.category === 'faction' && factionId) {
        refetchFactionStorage()
        refetchFactionInfo()
      }
      onRefresh()
    } catch (err) {
      reportError(err)
    }
    setBuilding(false)
  }, [mutate, onRefresh, uiStore, factionId, refetchFactionStorage, refetchFactionInfo, reportError])

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
                            {typeDetail.build_materials && typeDetail.build_materials.length > 0 && (
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
                              const matsOk = !typeDetail.build_materials?.length
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
            {buildConfirm.build_materials && buildConfirm.build_materials.length > 0 && (
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
