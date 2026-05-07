'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Hammer, RefreshCw, AlertTriangle, Lock, Check, ChevronDown, ChevronRight, Search, Filter } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import { Panel, shared } from '../shared'
import { BugReportButton } from '../BugReportButton'
import { buildRecipeContext } from '../bugReportContext'
import type { Recipe } from '../types'
import { recipesById, formatItemId } from '@/data/catalog'
import { titleCase } from '@/lib/format'
import { canCraftRecipe, availableQuantity } from '@/lib/crafting'
import styles from './CraftingPanel.module.css'

const HIDDEN_CATEGORIES = new Set(['facility only', 'ship passive'])

export function CraftingPanel() {
  const { state, sendCommand } = useGame()
  const [craftingId, setCraftingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'craftable'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Fetch skills on mount (needed for craftability check)
  useEffect(() => {
    if (!state.skillsData) sendCommand('get_skills')
  }, [state.skillsData, sendCommand])

  // When docked, ensure station storage is fetched so the craftable filter
  // can consider items the player has stored at the station, not just cargo.
  // Without this the filter under-counts inventory and hides recipes the
  // gameserver would actually accept (gh#794).
  useEffect(() => {
    if (state.isDocked && !state.storageData) {
      sendCommand('view_storage')
    }
  }, [state.isDocked, state.storageData, sendCommand])

  const refreshSkills = useCallback(() => {
    sendCommand('get_skills')
  }, [sendCommand])

  const handleCraft = useCallback((recipeId: string) => {
    setCraftingId(recipeId)
    sendCommand('craft', { recipe_id: recipeId })
    setTimeout(() => setCraftingId(null), 2000)
  }, [sendCommand])

  const cargoItems = useMemo(() => state.ship?.cargo ?? [], [state.ship?.cargo])
  // Station storage when docked. The gameserver craft handler accepts inputs
  // from cargo + station storage combined, so the craftable filter must too.
  const storageItems = useMemo(
    () => (state.isDocked ? state.storageData?.items ?? [] : []),
    [state.isDocked, state.storageData?.items],
  )
  const skillsMap = state.skillsData?.skills

  const recipes = useMemo((): Recipe[] => {
    return Object.values(recipesById)
      .filter(r => !HIDDEN_CATEGORIES.has((r.category || '').toLowerCase()))
      .map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category || '',
        required_skills: r.required_skills || {},
        inputs: (r.inputs || []).map(i => ({ item_id: i.item_id, quantity: i.quantity })),
        outputs: (r.outputs || []).map(o => ({ item_id: o.item_id, quantity: o.quantity })),
        crafting_time: r.crafting_time || 0,
      }))
  }, [])

  const categories = useMemo(() => {
    const cats = new Set(recipes.map(r => r.category).filter(Boolean))
    return [...cats].sort()
  }, [recipes])

  // Filter, group by category, sort
  const groupedRecipes = useMemo(() => {
    const search = searchQuery.toLowerCase().trim()
    const withStatus = recipes.map((recipe) => ({
      recipe,
      ...canCraftRecipe(recipe, skillsMap, cargoItems, storageItems),
    }))

    let filtered = withStatus
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((r) => r.recipe.category === categoryFilter)
    }
    if (filter === 'craftable') {
      filtered = filtered.filter((r) => r.craftable)
    }
    if (search) {
      filtered = filtered.filter((r) =>
        r.recipe.name.toLowerCase().includes(search) ||
        r.recipe.id.toLowerCase().includes(search) ||
        (r.recipe.outputs ?? []).some(o =>
          o.item_id.toLowerCase().includes(search) ||
          formatItemId(o.item_id).toLowerCase().includes(search)
        ) ||
        (r.recipe.inputs ?? []).some(i =>
          i.item_id.toLowerCase().includes(search) ||
          formatItemId(i.item_id).toLowerCase().includes(search)
        )
      )
    }

    // Sort: craftable first, then alphabetical
    filtered.sort((a, b) => {
      if (a.craftable !== b.craftable) return a.craftable ? -1 : 1
      return a.recipe.name.localeCompare(b.recipe.name)
    })

    // Group by category
    const groups: Record<string, typeof filtered> = {}
    for (const item of filtered) {
      const cat = item.recipe.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [recipes, skillsMap, cargoItems, storageItems, filter, categoryFilter, searchQuery])

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const isDocked = state.isDocked

  return (
    <Panel
      title="Crafting"
      icon={<Hammer size={16} />}
      headerRight={
        <div className={styles.headerActions}>
          <button
            className={shared.refreshBtn}
            onClick={refreshSkills}
            title="Refresh skills"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      }
    >
        {!isDocked && (
          <div className={styles.dockedWarning}>
            <span className={styles.dockedWarningIcon}>
              <AlertTriangle size={14} />
            </span>
            You must be docked at a base to craft items
          </div>
        )}

        {/* Search + filter */}
        {recipes.length > 0 && (
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <Search size={12} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Search recipes or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={styles.categorySelect}>
              <Filter size={10} className={styles.categorySelectIcon} />
              <select
                className={styles.categoryDropdown}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterRow}>
              <button
                className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter('all')}
                type="button"
              >
                All
              </button>
              <button
                className={`${styles.filterBtn} ${filter === 'craftable' ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter('craftable')}
                type="button"
              >
                <Check size={10} /> Craftable
              </button>
            </div>
          </div>
        )}

        {groupedRecipes.length === 0 && (
          <div className={shared.emptyState}>
            {searchQuery || filter === 'craftable' || categoryFilter !== 'all'
              ? 'No recipes match your filters.'
              : 'No recipes available.'}
          </div>
        )}

        {/* Recipe categories as accordions */}
        {groupedRecipes.map(([category, items]) => {
          const isCollapsed = collapsedCategories.has(category)
          const craftableCount = items.filter(r => r.craftable).length
          return (
            <div key={category} className={styles.categoryGroup}>
              <button
                className={styles.categoryHeader}
                onClick={() => toggleCategory(category)}
                type="button"
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className={styles.categoryName}>{category}</span>
                <span className={styles.categoryCount}>
                  {craftableCount > 0 && <span className={styles.craftableCount}>{craftableCount} craftable</span>}
                  {items.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className={styles.recipeGrid}>
                  {items.map(({ recipe, craftable, reasons }) => {
                    const isExpanded = expandedId === recipe.id
                    return (
                      <div
                        key={recipe.id}
                        className={`${styles.recipeCard} ${craftable ? styles.recipeCardCraftable : styles.recipeCardLocked}`}
                      >
                        <button
                          className={styles.recipeCardHeader}
                          onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                          type="button"
                          title={craftable ? 'You can craft this' : reasons.join('; ')}
                        >
                          <div className={styles.recipeCardTitle}>
                            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            <span className={styles.recipeName}>{recipe.name}</span>
                            <BugReportButton contextType="recipe" entityName={recipe.name} entityContext={buildRecipeContext(recipe)} />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className={styles.recipeCardBody}>
                            {recipe.description && (
                              <div className={styles.recipeDesc}>{recipe.description}</div>
                            )}
                            <div className={styles.recipeRow}>
                              <span className={styles.recipeLabel}>In:</span>
                              <span className={styles.recipeInputs}>
                                {(recipe.inputs ?? []).map((i) => {
                                  const name = formatItemId(i.item_id)
                                  const have = availableQuantity(i.item_id, cargoItems, storageItems)
                                  const enough = have >= i.quantity
                                  return (
                                    <span key={i.item_id} className={enough ? styles.inputOk : styles.inputMissing}>
                                      {name} x{i.quantity}{!enough && ` (${have})`}
                                    </span>
                                  )
                                })}
                                {(recipe.inputs ?? []).length === 0 && 'None'}
                              </span>
                            </div>
                            <div className={styles.recipeRow}>
                              <span className={styles.recipeLabel}>Out:</span>
                              <span className={styles.recipeOutputs}>
                                {(recipe.outputs ?? []).map((o) => {
                                  const name = formatItemId(o.item_id)
                                  return `${name} x${o.quantity}`
                                }).join(', ') || 'None'}
                              </span>
                            </div>
                            {recipe.required_skills && Object.keys(recipe.required_skills).length > 0 && (
                              <div className={styles.recipeRow}>
                                <span className={styles.recipeLabel}>Skills:</span>
                                <span className={styles.recipeSkills}>
                                  {Object.entries(recipe.required_skills)
                                    .map(([skill, level]) => {
                                      const name = titleCase(skill)
                                      const have = skillsMap?.[skill]?.level ?? 0
                                      const met = have >= (level as number)
                                      return (
                                        <span key={skill} className={met ? styles.skillMet : styles.skillUnmet}>
                                          {name} Lv{level as number}{!met && ` (have ${have})`}
                                        </span>
                                      )
                                    })}
                                </span>
                              </div>
                            )}
                            {!craftable && reasons.length > 0 && (
                              <div className={styles.reasonsList}>
                                <Lock size={10} />
                                {reasons.map((r, i) => (
                                  <span key={i} className={styles.reasonItem}>{r}</span>
                                ))}
                              </div>
                            )}
                            <div className={styles.recipeCraftBtn}>
                              <ActionButton
                                label="Craft"
                                icon={<Hammer size={12} />}
                                onClick={() => handleCraft(recipe.id)}
                                disabled={!isDocked || !craftable || craftingId === recipe.id}
                                loading={craftingId === recipe.id}
                                size="sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
    </Panel>
  )
}
