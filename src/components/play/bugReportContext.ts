import type { Facility, Mission, Recipe } from './types'
import { titleCase } from '@/lib/format'

// The generic (player/ship/location) context lives in BugReportModal itself,
// built from the live state hooks; these helpers format the panel-specific
// context blocks appended to it.

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
  lines.push(`- **Under Construction:** ${facility.under_construction ?? false}`)
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
