'use client'

import { useState, useCallback, useMemo } from 'react'
import { Hammer, BookOpen, FlaskConical, Star, RefreshCw, AlertTriangle } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import styles from './CraftingPanel.module.css'

export function CraftingPanel() {
  const { state, sendCommand } = useGame()
  const [craftingId, setCraftingId] = useState<string | null>(null)

  const loadRecipes = useCallback(() => {
    sendCommand('get_recipes')
  }, [sendCommand])

  const loadSkills = useCallback(() => {
    sendCommand('get_skills')
  }, [sendCommand])

  const handleCraft = useCallback((recipeId: string) => {
    setCraftingId(recipeId)
    sendCommand('craft', { recipe_id: recipeId })
    setTimeout(() => setCraftingId(null), 2000)
  }, [sendCommand])

  const recipes = useMemo(() => {
    if (!state.recipesData?.recipes) return []
    return Object.values(state.recipesData.recipes)
  }, [state.recipesData])

  const skills = useMemo(() => {
    if (!state.skillsData?.skills) return []
    return Object.entries(state.skillsData.skills).map(([id, s]) => ({
      id,
      ...s,
    }))
  }, [state.skillsData])

  const isDocked = state.isDocked

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}><Hammer size={16} /></span>
          Crafting
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={loadRecipes}
            title="Refresh recipes"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
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
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><BookOpen size={12} /></span>
            Recipes
          </div>
          {!state.recipesData && (
            <ActionButton
              label="Get Recipes"
              icon={<BookOpen size={14} />}
              onClick={loadRecipes}
              size="sm"
            />
          )}
          {state.recipesData && recipes.length === 0 && (
            <div className={styles.emptyState}>
              No recipes available.
            </div>
          )}
          {recipes.length > 0 && (
            <div className={styles.recipeList}>
              {recipes.map((recipe) => (
                <div key={recipe.id} className={styles.recipeItem}>
                  <div className={styles.recipeHeader}>
                    <span className={styles.recipeName}>{recipe.name}</span>
                    <span className={styles.recipeCategory}>{recipe.category}</span>
                  </div>
                  <div className={styles.recipeDetails}>
                    <div className={styles.recipeRow}>
                      <span className={styles.recipeLabel}>In:</span>
                      <span className={styles.recipeInputs}>
                        {(recipe.inputs ?? []).map((i: { item_id: string; quantity: number }) => `${i.item_id} x${i.quantity}`).join(', ') || 'None'}
                      </span>
                    </div>
                    <div className={styles.recipeRow}>
                      <span className={styles.recipeLabel}>Out:</span>
                      <span className={styles.recipeOutputs}>
                        {(recipe.outputs ?? []).map((o: { item_id: string; quantity: number }) => `${o.item_id} x${o.quantity}`).join(', ') || 'None'}
                      </span>
                    </div>
                    {recipe.required_skills && Object.keys(recipe.required_skills).length > 0 && (
                      <div className={styles.recipeRow}>
                        <span className={styles.recipeLabel}>Skills:</span>
                        <span className={styles.recipeSkills}>
                          {Object.entries(recipe.required_skills)
                            .map(([skill, level]) => `${skill} Lv${level}`)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={styles.recipeCraftBtn}>
                    <ActionButton
                      label="Craft"
                      icon={<Hammer size={12} />}
                      onClick={() => handleCraft(recipe.id)}
                      disabled={!isDocked || craftingId === recipe.id}
                      loading={craftingId === recipe.id}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Skills Section */}
        <div>
          <div className={styles.sectionTitle}>
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
            <div className={styles.emptyState}>
              No skills trained yet.
            </div>
          )}
          {skills.length > 0 && (
            <div className={styles.skillList}>
              {skills.map((skill) => (
                <div key={skill.id} className={styles.skillItem}>
                  <div className={styles.skillInfo}>
                    <span className={styles.skillName}>{skill.id}</span>
                  </div>
                  <div className={styles.skillLevel}>
                    <span className={styles.skillLevelText}>
                      Lv {skill.level}
                    </span>
                    {skill.next_level_xp > 0 && (
                      <span className={styles.skillXp}>
                        {skill.xp} / {skill.next_level_xp} XP
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
