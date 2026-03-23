'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Hammer, BookOpen, RefreshCw, AlertTriangle, Lock, Check, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import { Panel, shared } from '../shared'
import type { Recipe } from '../types'
import styles from './CraftingPanel.module.css'

function canCraftRecipe(
  recipe: Recipe,
  skills: Record<string, { level: number; xp: number; next_level_xp: number }> | undefined,
  cargoItems: { item_id: string; quantity: number }[]
): { craftable: boolean; reasons: string[] } {
  const reasons: string[] = []

  // Facility Only and Ship Passive recipes can never be manually crafted
  const cat = recipe.category?.toLowerCase() ?? ''
  if (cat === 'facility only' || cat === 'ship passive') {
    return { craftable: false, reasons: [`${recipe.category} — cannot be crafted manually`] }
  }

  // Check skills
  if (recipe.required_skills && Object.keys(recipe.required_skills).length > 0) {
    for (const [skillId, reqLevel] of Object.entries(recipe.required_skills)) {
      const playerLevel = skills?.[skillId]?.level ?? 0
      if (playerLevel < (reqLevel as number)) {
        const name = skillId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        reasons.push(`Need ${name} Lv${reqLevel} (have ${playerLevel})`)
      }
    }
  }

  // Check materials
  for (const input of recipe.inputs ?? []) {
    const have = cargoItems.find((c) => c.item_id === input.item_id)?.quantity ?? 0
    if (have < input.quantity) {
      const name = input.item_id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      reasons.push(`Need ${input.quantity}x ${name} (have ${have})`)
    }
  }

  return { craftable: reasons.length === 0, reasons }
}

export function CraftingPanel() {
  const { state, sendCommand } = useGame()
  const [craftingId, setCraftingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'craftable'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const recipesLoading = useRef(false)

  const fetchAllRecipes = useCallback(async () => {
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const result = await sendCommand('catalog', { type: 'recipes', page_size: 50, page })
      const r = result as Record<string, unknown>
      totalPages = (r.total_pages as number) || 1
      page++
    }
  }, [sendCommand])

  // Auto-load all recipes on mount (skills needed for craftability check)
  useEffect(() => {
    if (!state.skillsData) sendCommand('get_skills')
    if (!state.recipesData && !recipesLoading.current) {
      recipesLoading.current = true
      fetchAllRecipes()
    }
  }, [state.skillsData, state.recipesData, sendCommand, fetchAllRecipes])

  // Continue loading if we have partial data
  useEffect(() => {
    if (state.recipesData && state.recipesData.total && Object.keys(state.recipesData.recipes).length < state.recipesData.total && recipesLoading.current) {
      const loaded = Object.keys(state.recipesData.recipes).length
      const nextPage = Math.floor(loaded / 50) + 1
      sendCommand('catalog', { type: 'recipes', page_size: 50, page: nextPage })
    } else if (state.recipesData) {
      recipesLoading.current = false
    }
  }, [state.recipesData, sendCommand])

  const loadRecipes = useCallback(() => {
    recipesLoading.current = true
    fetchAllRecipes()
  }, [fetchAllRecipes])

  const handleCraft = useCallback((recipeId: string) => {
    setCraftingId(recipeId)
    sendCommand('craft', { recipe_id: recipeId })
    setTimeout(() => setCraftingId(null), 2000)
  }, [sendCommand])

  const cargoItems = useMemo(() => state.ship?.cargo ?? [], [state.ship?.cargo])
  const skillsMap = state.skillsData?.skills

  const recipes = useMemo(() => {
    if (!state.recipesData?.recipes) return []
    return Object.values(state.recipesData.recipes)
  }, [state.recipesData])

  // Filter, group by category, sort
  const groupedRecipes = useMemo(() => {
    const search = searchQuery.toLowerCase().trim()
    const withStatus = recipes.map((recipe) => ({
      recipe,
      ...canCraftRecipe(recipe, skillsMap, cargoItems),
    }))

    let filtered = withStatus
    if (filter === 'craftable') {
      filtered = filtered.filter((r) => r.craftable)
    }
    if (search) {
      filtered = filtered.filter((r) =>
        r.recipe.name.toLowerCase().includes(search) ||
        r.recipe.id.toLowerCase().includes(search) ||
        (r.recipe.outputs ?? []).some(o => o.item_id.toLowerCase().includes(search))
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
  }, [recipes, skillsMap, cargoItems, filter, searchQuery])

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const isDocked = state.isDocked
  const totalRecipes = state.recipesData?.total ?? 0
  const allLoaded = recipes.length >= totalRecipes

  return (
    <Panel
      title="Crafting"
      icon={<Hammer size={16} />}
      headerRight={
        <div className={styles.headerActions}>
          <button
            className={shared.refreshBtn}
            onClick={loadRecipes}
            title="Refresh recipes and skills"
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
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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

        {!allLoaded && totalRecipes > 0 && (
          <div className={styles.loadingNotice}>Loading recipes... {recipes.length}/{totalRecipes}</div>
        )}

        {!state.recipesData && (
          <ActionButton
            label="Load Recipes"
            icon={<BookOpen size={14} />}
            onClick={loadRecipes}
            size="sm"
          />
        )}
        {state.recipesData && groupedRecipes.length === 0 && (
          <div className={shared.emptyState}>
            {searchQuery || filter === 'craftable' ? 'No recipes match your filters.' : 'No recipes available.'}
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
                                  const name = i.item_id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                                  const have = cargoItems.find((c) => c.item_id === i.item_id)?.quantity ?? 0
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
                                  const name = o.item_id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
                                      const name = skill.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
