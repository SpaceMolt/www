'use client'

import { useState, useCallback } from 'react'
import { Hammer, BookOpen, FlaskConical, Star, RefreshCw, AlertTriangle } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import type { Recipe, Skill } from '../types'
import styles from './CraftingPanel.module.css'

export function CraftingPanel() {
  const { state, sendCommand } = useGame()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [recipesLoaded, setRecipesLoaded] = useState(false)
  const [skillsLoaded, setSkillsLoaded] = useState(false)
  const [loadingRecipes, setLoadingRecipes] = useState(false)
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [craftingId, setCraftingId] = useState<string | null>(null)

  const loadRecipes = useCallback(() => {
    setLoadingRecipes(true)
    sendCommand('get_recipes')
    // Listen for response via a temporary handler pattern
    const timeout = setTimeout(() => {
      setLoadingRecipes(false)
      setRecipesLoaded(true)
    }, 3000)
    // We rely on the OK response from the game state to populate
    // For now, mark as loaded after a short delay
    return () => clearTimeout(timeout)
  }, [sendCommand])

  const loadSkills = useCallback(() => {
    setLoadingSkills(true)
    sendCommand('get_skills')
    const timeout = setTimeout(() => {
      setLoadingSkills(false)
      setSkillsLoaded(true)
    }, 3000)
    return () => clearTimeout(timeout)
  }, [sendCommand])

  const handleCraft = useCallback((recipeId: string) => {
    setCraftingId(recipeId)
    sendCommand('craft', { recipe_id: recipeId })
    setTimeout(() => setCraftingId(null), 2000)
  }, [sendCommand])

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
            title="Load recipes"
            disabled={loadingRecipes}
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
          {!recipesLoaded && !loadingRecipes && (
            <ActionButton
              label="Get Recipes"
              icon={<BookOpen size={14} />}
              onClick={loadRecipes}
              size="sm"
            />
          )}
          {loadingRecipes && (
            <div className={styles.loading}>
              <span className={styles.spinner} />
              Loading recipes...
            </div>
          )}
          {recipesLoaded && recipes.length === 0 && (
            <div className={styles.emptyState}>
              No recipes available. Send &quot;get_recipes&quot; to discover recipes.
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
                        {recipe.inputs.map((i) => `${i.itemId} x${i.quantity}`).join(', ')}
                      </span>
                    </div>
                    <div className={styles.recipeRow}>
                      <span className={styles.recipeLabel}>Out:</span>
                      <span className={styles.recipeOutputs}>
                        {recipe.outputs.map((o) => `${o.itemId} x${o.quantity}`).join(', ')}
                      </span>
                    </div>
                    {Object.keys(recipe.requiredSkills).length > 0 && (
                      <div className={styles.recipeRow}>
                        <span className={styles.recipeLabel}>Skills:</span>
                        <span className={styles.recipeSkills}>
                          {Object.entries(recipe.requiredSkills)
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
          {!skillsLoaded && !loadingSkills && (
            <ActionButton
              label="Load Skills"
              icon={<FlaskConical size={14} />}
              onClick={loadSkills}
              size="sm"
            />
          )}
          {loadingSkills && (
            <div className={styles.loading}>
              <span className={styles.spinner} />
              Loading skills...
            </div>
          )}
          {skillsLoaded && skills.length === 0 && (
            <div className={styles.emptyState}>
              No skills data loaded yet.
            </div>
          )}
          {skills.length > 0 && (
            <div className={styles.skillList}>
              {skills.map((skill) => (
                <div key={skill.id} className={styles.skillItem}>
                  <div className={styles.skillInfo}>
                    <span className={styles.skillName}>{skill.name}</span>
                    <span className={styles.skillCategory}>{skill.category}</span>
                  </div>
                  <div className={styles.skillLevel}>
                    <span className={styles.skillLevelText}>
                      Lv {skill.current_level ?? 0} / {skill.max_level}
                    </span>
                    {skill.xp_to_next != null && (
                      <span className={styles.skillXp}>
                        {skill.current_xp ?? 0} / {skill.xp_to_next} XP
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
