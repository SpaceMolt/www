'use client'

import styles from './ItemDetail.module.css'

/* Types from /api/items catalog */

export interface CatalogRecipeItem {
  item_id: string
  item_name: string
  quantity: number
}

export interface CatalogFacility {
  id: string
  name: string
  level: number
  recipe_multiplier?: number
}

export interface CatalogRecipe {
  recipe_id: string
  recipe_name: string
  recipe_category: string
  crafting_time: number
  required_skills?: Record<string, number>
  inputs: CatalogRecipeItem[]
  outputs: CatalogRecipeItem[]
  facilities?: CatalogFacility[]
}

export interface CatalogModuleStats {
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

export interface CatalogItem {
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

export interface CatalogResponse {
  items: Record<string, CatalogItem>
}

const RARITY_CLASSES: Record<string, string> = {
  common: styles.rarityCommon,
  uncommon: styles.rarityUncommon,
  rare: styles.rarityRare,
  exotic: styles.rarityExotic,
}

/** Render the non-zero stats for a module in a readable grid */
export function ModuleStatsDisplay({ mod, compact }: { mod: CatalogModuleStats; compact?: boolean }) {
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
    <div className={`${styles.moduleSection} ${compact ? styles.compact : ''}`}>
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
export function RecipeCard({ recipe, compact }: { recipe: CatalogRecipe; compact?: boolean }) {
  return (
    <div className={`${styles.recipeCard} ${compact ? styles.compact : ''}`}>
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

/** Render item detail content (description, metadata, recipes, module stats) */
export function ItemDetailContent({ item, compact }: { item: CatalogItem; compact?: boolean }) {
  const hasProducedBy = item.produced_by && item.produced_by.length > 0
  const hasConsumedBy = item.consumed_by && item.consumed_by.length > 0
  const hasRecipes = hasProducedBy || hasConsumedBy

  return (
    <div className={`${styles.detailContent} ${compact ? styles.compact : ''}`}>
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
        <div className={`${styles.recipeSections} ${compact ? styles.recipeSectionsCompact : ''}`}>
          {hasProducedBy && (
            <div className={styles.recipeSection}>
              <h4 className={styles.detailSectionTitle}>Produced By</h4>
              {item.produced_by!.map((recipe) => (
                <RecipeCard key={recipe.recipe_id} recipe={recipe} compact={compact} />
              ))}
            </div>
          )}
          {hasConsumedBy && (
            <div className={styles.recipeSection}>
              <h4 className={styles.detailSectionTitle}>Used In</h4>
              {item.consumed_by!.map((recipe) => (
                <RecipeCard key={recipe.recipe_id} recipe={recipe} compact={compact} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Module stats */}
      {item.module && <ModuleStatsDisplay mod={item.module} compact={compact} />}

      {/* Empty state if no extra data */}
      {!hasRecipes && !item.module && (
        <p className={styles.detailEmpty}>
          No crafting recipes or module data available for this item.
        </p>
      )}
    </div>
  )
}

/** Render the expanded item detail as a table row (used by main market page) */
export function ItemDetail({ item, totalCols }: { item: CatalogItem; totalCols: number }) {
  return (
    <tr className={styles.detailRow}>
      <td colSpan={totalCols} className={styles.detailCell}>
        <ItemDetailContent item={item} />
      </td>
    </tr>
  )
}
