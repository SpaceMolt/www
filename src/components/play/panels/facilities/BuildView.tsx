'use client'

import { useState, useCallback, useEffect } from 'react'
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
import styles from './facilities.module.css'

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
  const { sendCommand, api } = useGame()

  const [discovery, setDiscovery] = useState<FacilityTypesDiscovery | null>(null)
  const [discoveryLoading, setDiscoveryLoading] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredData, setFilteredData] = useState<FacilityTypesFiltered | null>(null)
  const [filteredLoading, setFilteredLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [typeDetail, setTypeDetail] = useState<FacilityTypeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [buildConfirm, setBuildConfirm] = useState<FacilityTypeDetail | null>(null)
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    if (!api) return
    setDiscoveryLoading(true)
    api.callStructured<FacilityTypesDiscovery>('spacemolt_facility', 'types', {})
      .then(data => { if (data) setDiscovery(data) })
      .catch(() => {})
      .finally(() => setDiscoveryLoading(false))
  }, [api])

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
      await sendCommand(action, { facility_type: detail.type_id })
      setBuildConfirm(null)
      onRefresh()
    } catch { /* handled by event log */ }
    setBuilding(false)
  }, [sendCommand, onRefresh])

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
            {filteredData.types.length === 0 ? (
              <div className={shared.emptyState}>No facility types match your search.</div>
            ) : (
              filteredData.types.map(ft => {
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
                                <span className={styles.costValue}>
                                  {typeDetail.build_materials.map(m => `${m.name} x${m.quantity}`).join(', ')}
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

                          {typeDetail.buildable && (
                            <button
                              className={shared.confirmBtn}
                              onClick={() => setBuildConfirm(typeDetail)}
                              type="button"
                            >
                              <Hammer size={11} /> Build {typeDetail.name}
                            </button>
                          )}
                          {!typeDetail.buildable && (
                            <div className={shared.emptyState}>This facility type cannot be built by players.</div>
                          )}
                        </>
                      ) : null
                    )}
                  </div>
                )
              })
            )}
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
                <span className={styles.costValue}>
                  {buildConfirm.build_materials.map(m => `${m.name} x${m.quantity}`).join(', ')}
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
