'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Hammer, BookOpen, FlaskConical, Star, RefreshCw, AlertTriangle, Lock, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import { ProgressBar } from '../ProgressBar'
import { Panel, shared } from '../shared'
import type { Recipe } from '../types'
import styles from './CraftingPanel.module.css'

function canCraftRecipe(
  recipe: Recipe,
  skills: Record<string, { level: number; xp: number; next_level_xp: number }> | undefined,
  cargoItems: { item_id: string; quantity: number }[]
): { craftable: boolean; reasons: string[] } {
  const reasons: string[] = []

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

  // Auto-load recipes and skills on mount
  useEffect(() => {
    if (!state.recipesData) {
      sendCommand('catalog', { type: 'recipes', page_size: 50, page: 1 })
    }
    if (!state.skillsData) {
      sendCommand('get_skills')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecipes = useCallback(() => {
    sendCommand('catalog', { type: 'recipes', page_size: 50, page: 1 })
  }, [sendCommand])

  const loadMoreRecipes = useCallback(() => {
    const nextPage = (state.recipesData?.page ?? 1) + 1
    sendCommand('catalog', { type: 'recipes', page_size: 50, page: nextPage })
  }, [sendCommand, state.recipesData?.page])

  const loadSkills = useCallback(() => {
    sendCommand('get_skills')
  }, [sendCommand])

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

  // Sort: craftable first, then alphabetical
  const sortedRecipes = useMemo(() => {
    const withStatus = recipes.map((recipe) => ({
      recipe,
      ...canCraftRecipe(recipe, skillsMap, cargoItems),
    }))

    withStatus.sort((a, b) => {
      if (a.craftable !== b.craftable) return a.craftable ? -1 : 1
      return a.recipe.name.localeCompare(b.recipe.name)
    })

    if (filter === 'craftable') {
      return withStatus.filter((r) => r.craftable)
    }
    return withStatus
  }, [recipes, skillsMap, cargoItems, filter])

  const skills = useMemo(() => {
    if (!state.skillsData?.skills) return []
    return Object.entries(state.skillsData.skills).map(([id, s]) => ({
      id,
      ...s,
    }))
  }, [state.skillsData])

  const isDocked = state.isDocked
  const totalRecipes = state.recipesData?.total ?? 0
  const hasMore = totalRecipes > 0 && recipes.length < totalRecipes

  return (
    <Panel
      title="Crafting"
      icon={<Hammer size={16} />}
      headerRight={
        <div className={styles.headerActions}>
          <button
            className={shared.refreshBtn}
            onClick={() => { loadRecipes(); loadSkills() }}
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

        {/* Recipes Section */}
        <div>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><BookOpen size={12} /></span>
            Recipes
            {recipes.length > 0 && totalRecipes > 0 && (
              <span className={styles.recipeCount}>
                {recipes.length} of {totalRecipes}
              </span>
            )}
          </div>

          {/* Filter tabs */}
          {recipes.length > 0 && (
            <div className={styles.filterRow}>
              <button
                className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter('all')}
                type="button"
                title="Show all recipes"
              >
                All
              </button>
              <button
                className={`${styles.filterBtn} ${filter === 'craftable' ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter('craftable')}
                type="button"
                title="Show only recipes you can craft right now"
              >
                <Check size={10} /> Craftable
              </button>
            </div>
          )}

          {!state.recipesData && (
            <ActionButton
              label="Load Recipes"
              icon={<BookOpen size={14} />}
              onClick={loadRecipes}
              size="sm"
            />
          )}
          {state.recipesData && recipes.length === 0 && (
            <div className={shared.emptyState}>
              No recipes available.
            </div>
          )}
          {sortedRecipes.length > 0 && (
            <div className={styles.recipeGrid}>
              {sortedRecipes.map(({ recipe, craftable, reasons }) => {
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
                      <span className={styles.recipeCategory}>{recipe.category}</span>
                    </button>

                    {isExpanded && (
                      <div className={styles.recipeCardBody}>
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
          {hasMore && (
            <ActionButton
              label={`Load more (${recipes.length} of ${totalRecipes})`}
              icon={<BookOpen size={14} />}
              onClick={loadMoreRecipes}
              variant="secondary"
              size="sm"
            />
          )}
        </div>

        <div className={styles.divider} />

        {/* Skills Section */}
        <div>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><Star size={12} /></span>
            Skills
          </div>
          {!state.skillsData && (
            <ActionButton
              label="Load Skills"
              icon={<FlaskConical size={14} />}
              onClick={loadSkills}
              size="sm"
            />
          )}
          {state.skillsData && skills.length === 0 && (
            <div className={shared.emptyState}>
              No skills trained yet.
            </div>
          )}
          {skills.length > 0 && (
            <div className={styles.skillList}>
              {skills.map((skill) => (
                <div key={skill.id} className={styles.skillItem}>
                  <div className={styles.skillInfo}>
                    <span className={styles.skillName}>{skill.id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                  </div>
                  <div className={styles.skillLevel}>
                    <span className={styles.skillLevelText}>
                      Lv {skill.level}
                    </span>
                  </div>
                  {skill.next_level_xp > 0 && (
                    <div className={styles.skillProgress}>
                      <ProgressBar value={skill.xp} max={skill.next_level_xp} color="purple" size="sm" />
                      <span className={styles.skillXp}>
                        {skill.xp} / {skill.next_level_xp} XP
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
    </Panel>
  )
}
