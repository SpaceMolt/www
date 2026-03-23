import type { GameState, Recipe } from './types'
import type { Mission, Facility } from '@/lib/gameTypes'

/** Convert snake_case to Title Case */
function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Generic context — included in every bug report
// ---------------------------------------------------------------------------

export function buildGenericContext(state: GameState): string {
  const lines: string[] = []

  // Player
  const p = state.player
  if (p) {
    lines.push('### Player')
    lines.push(`- **Name:** ${p.username}`)
    lines.push(`- **ID:** \`${p.id}\``)
    lines.push(`- **Empire:** ${p.empire || 'none'}`)
    lines.push(`- **Faction:** ${p.faction_id || 'none'}`)
    lines.push(`- **Credits:** ${p.credits.toLocaleString()}`)
  }

  // Location
  lines.push('')
  lines.push('### Location')
  lines.push(`- **System:** ${state.system?.name || 'unknown'}`)
  lines.push(`- **POI:** ${state.poi?.name || 'unknown'}`)
  lines.push(`- **Docked:** ${state.isDocked ? 'yes' : 'no'}`)

  // Ship
  const s = state.ship
  if (s) {
    lines.push('')
    lines.push('### Ship')
    lines.push(`- **Name:** ${s.name}`)
    lines.push(`- **Class:** ${s.class_id || 'unknown'}`)
    lines.push(`- **Hull:** ${s.hull}/${s.max_hull}`)
    lines.push(`- **Shield:** ${s.shield ?? 0}/${s.max_shield ?? 0}`)
    lines.push(`- **Fuel:** ${s.fuel}/${s.max_fuel}`)
    lines.push(`- **Cargo:** ${s.cargo_used ?? 0}/${s.cargo_capacity}`)
    lines.push(`- **Speed:** ${s.speed}`)

    // Cargo contents
    const cargo = s.cargo as Array<{ item_id: string; name?: string; quantity: number }> | undefined
    if (cargo && cargo.length > 0) {
      lines.push('')
      lines.push('### Cargo')
      for (const item of cargo) {
        lines.push(`- ${item.name || titleCase(item.item_id)} x${item.quantity}`)
      }
    }
  }

  // Installed modules
  if (state.shipModules.length > 0) {
    lines.push('')
    lines.push('### Modules')
    for (const m of state.shipModules) {
      lines.push(`- ${m.name} (${m.type}) — ${m.type_id}`)
    }
  }

  // Skills
  if (state.skillsData?.skills) {
    lines.push('')
    lines.push('### Skills')
    for (const [id, info] of Object.entries(state.skillsData.skills)) {
      lines.push(`- ${titleCase(id)}: Lv${info.level}`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Mission context
// ---------------------------------------------------------------------------

export function buildMissionContext(mission: Mission): string {
  const mr = mission as unknown as Record<string, unknown>
  const lines: string[] = []

  lines.push('### Mission')
  lines.push(`- **ID:** \`${mission.mission_id}\``)
  lines.push(`- **Title:** ${mission.title}`)
  lines.push(`- **Difficulty:** ${mission.difficulty}`)
  lines.push(`- **Description:** ${mission.description}`)

  const pct = mr.percent_complete as number | undefined
  if (pct != null) {
    lines.push(`- **Progress:** ${Math.round(pct)}%`)
  }

  const objectives = (mr.objectives || mission.objectives || []) as Array<{
    type: string; description: string; completed?: boolean; current?: number; quantity?: number
  }>
  if (objectives.length > 0) {
    lines.push('')
    lines.push('**Objectives:**')
    for (const obj of objectives) {
      const status = obj.completed ? 'DONE' : obj.current != null ? `${obj.current}/${obj.quantity ?? '?'}` : 'pending'
      lines.push(`- [${status}] ${obj.description} (${obj.type})`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Ship catalog context
// ---------------------------------------------------------------------------

export interface ShipCatalogEntry {
  id: string
  name: string
  class: string
  category: string
  tier: number
  base_hull: number
  base_shield: number
  base_speed: number
  base_fuel: number
  cargo_capacity: number
  weapon_slots: number
  defense_slots: number
  utility_slots: number
  faction?: string
}

export function buildShipCatalogContext(ship: ShipCatalogEntry): string {
  const lines: string[] = []
  lines.push('### Ship Class')
  lines.push(`- **ID:** \`${ship.id}\``)
  lines.push(`- **Name:** ${ship.name}`)
  lines.push(`- **Class:** ${ship.class}`)
  lines.push(`- **Category:** ${ship.category}`)
  lines.push(`- **Tier:** ${ship.tier}`)
  if (ship.faction) lines.push(`- **Faction:** ${ship.faction}`)
  lines.push(`- **Hull:** ${ship.base_hull} · **Shield:** ${ship.base_shield}`)
  lines.push(`- **Speed:** ${ship.base_speed} · **Fuel:** ${ship.base_fuel}`)
  lines.push(`- **Cargo:** ${ship.cargo_capacity}`)
  lines.push(`- **Slots:** W${ship.weapon_slots} / D${ship.defense_slots} / U${ship.utility_slots}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Facility context
// ---------------------------------------------------------------------------

export function buildFacilityContext(facility: Facility): string {
  const lines: string[] = []
  lines.push('### Facility')
  lines.push(`- **ID:** \`${facility.facility_id}\``)
  lines.push(`- **Name:** ${facility.name}`)
  lines.push(`- **Category:** ${facility.category}`)
  lines.push(`- **Active:** ${facility.active}`)
  lines.push(`- **Maintenance OK:** ${facility.maintenance_satisfied}`)
  if (facility.description) lines.push(`- **Description:** ${facility.description}`)
  if (facility.service) lines.push(`- **Service:** ${facility.service}`)
  if (facility.personal_service) lines.push(`- **Personal Service:** ${facility.personal_service}`)
  if (facility.bonus_type) lines.push(`- **Bonus:** ${facility.bonus_type} +${facility.bonus_value}`)
  if (facility.recipe_id) lines.push(`- **Recipe:** ${facility.recipe_id}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Crafting recipe context
// ---------------------------------------------------------------------------

export function buildRecipeContext(recipe: Recipe): string {
  const lines: string[] = []
  lines.push('### Recipe')
  lines.push(`- **ID:** \`${recipe.id}\``)
  lines.push(`- **Name:** ${recipe.name}`)
  lines.push(`- **Category:** ${recipe.category}`)
  lines.push(`- **Crafting Time:** ${recipe.crafting_time} ticks`)
  if (recipe.description) lines.push(`- **Description:** ${recipe.description}`)

  if (recipe.inputs?.length > 0) {
    lines.push(`- **Inputs:** ${recipe.inputs.map(i => `${titleCase(i.item_id)} x${i.quantity}`).join(', ')}`)
  }
  if (recipe.outputs?.length > 0) {
    lines.push(`- **Outputs:** ${recipe.outputs.map(o => `${titleCase(o.item_id)} x${o.quantity}`).join(', ')}`)
  }
  if (recipe.required_skills && Object.keys(recipe.required_skills).length > 0) {
    lines.push(`- **Required Skills:** ${Object.entries(recipe.required_skills).map(([s, l]) => `${titleCase(s)} Lv${l}`).join(', ')}`)
  }
  return lines.join('\n')
}
