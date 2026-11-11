/** The fit_preview response (gameserver internal/apiresponses FitPreviewResponse). */
export interface FitPreview {
  ship_id: string
  valid: boolean
  issues: { code: string; message: string }[]
  stats: FitPreviewStats
  steps: FitStep[]
}

export interface FitPreviewStats {
  max_hull: number
  max_shield: number
  shield_recharge: number
  armor: number
  speed: number
  max_fuel: number
  /** Net module fuel efficiency in percent: positive cuts fuel use. Absent on an older game server, as are the next two. */
  fuel_efficiency?: number
  fuel_per_jump?: number
  /** Jumps a full tank covers. */
  jump_range?: number
  cargo_capacity: number
  cargo_used: number
  cpu_capacity: number
  cpu_used: number
  power_capacity: number
  power_used: number
  weapon_slots: number
  weapon_slots_used: number
  defense_slots: number
  defense_slots_used: number
  utility_slots: number
  utility_slots_used: number
  effective_crew_capacity: number
  effective_marine_capacity: number
  crew: number
  marines: number
}

export interface FitStep {
  action: 'uninstall_mod' | 'install_mod'
  /** Instance id for uninstall_mod, type id for install_mod. */
  module_id: string
  type_id: string
  name: string
  /** An unfit of a kept module that a later step fits again. */
  temporary?: boolean
}

/** Where Apply takes an added module from, in this order of preference. */
export type FitSource = 'cargo' | 'storage' | 'faction' | 'market'

/** One price level of the market's sell side, cheapest first. */
export interface Ask {
  price: number
  qty: number
}

export interface Holdings {
  cargo: Record<string, number>
  storage: Record<string, number>
  faction: Record<string, number>
  asks: Record<string, Ask[]>
}

/** For each planned module, whether it is already fitted. Matches fitted modules by type in plan order, as fit_preview does. */
export function keptFlags(plan: string[], fitted: string[]): boolean[] {
  const left = countBy(fitted)
  return plan.map((id) => {
    if (!left[id]) return false
    left[id]--
    return true
  })
}

/** Planned modules that are not fitted yet, in plan order. */
export function addedModules(plan: string[], fitted: string[]): string[] {
  const kept = keptFlags(plan, fitted)
  return plan.filter((_, i) => !kept[i])
}

export interface Sourced {
  typeId: string
  /** null when the module is in none of the sources Apply can use. */
  source: FitSource | null
  /** Market price for source 'market'. */
  price?: number
}

/**
 * Where each added module comes from: cargo, then your storage, then faction storage, then one bought
 * at the cheapest ask here while credits last. Counts are shared, so two of a module need two in stock.
 */
export function assignSources(added: string[], holdings: Holdings, credits: number): Sourced[] {
  const left = {
    cargo: { ...holdings.cargo },
    storage: { ...holdings.storage },
    faction: { ...holdings.faction },
  }
  const asks = Object.fromEntries(Object.entries(holdings.asks).map(([id, levels]) => [id, levels.map((l) => ({ ...l }))]))
  let wallet = credits
  return added.map((typeId) => {
    for (const source of ['cargo', 'storage', 'faction'] as const) {
      if ((left[source][typeId] ?? 0) > 0) {
        left[source][typeId]--
        return { typeId, source }
      }
    }
    const level = asks[typeId]?.find((l) => l.qty > 0)
    if (level && level.price <= wallet) {
      level.qty--
      wallet -= level.price
      return { typeId, source: 'market', price: level.price }
    }
    return { typeId, source: null }
  })
}

/** The plan without one of each module Apply cannot get, so the rest can still be fitted. */
export function withoutMissing(plan: string[], fitted: string[], sourced: Sourced[]): string[] {
  const drop = countBy(sourced.filter((s) => !s.source).map((s) => s.typeId))
  const kept = keptFlags(plan, fitted)
  return plan.filter((id, i) => {
    if (kept[i] || !drop[id]) return true
    drop[id]--
    return false
  })
}

/**
 * Module fields that are not ship totals: identity and cost, what fit_preview already reports,
 * and per-weapon numbers that mean nothing summed.
 */
const NOT_TOTALS = new Set([
  'size', 'base_value', 'quest_item', 'combat_effects', 'required_skills', 'effect', 'stackable', 'tradeable', 'hazardous',
  'cpu_usage', 'power_usage', 'cpu_bonus', 'power_bonus', 'cargo_bonus', 'hull_bonus', 'hull_penalty', 'shield_bonus',
  'shield_recharge_bonus', 'armor_bonus', 'speed_bonus', 'speed_penalty', 'max_fuel_bonus', 'fuel_efficiency',
  'crew_capacity_bonus', 'marine_capacity_bonus',
  'reach', 'cooldown', 'magazine_size', 'precision_factor', 'remote_repair_range', 'armor_bypass_bonus', 'shield_bypass_bonus',
])

/**
 * Every other module stat in the catalog, summed over a fit. A flag such as boarding_capability
 * counts the modules that have it; a map such as hazard_resistance is summed per entry.
 */
function moduleTotals(ids: string[], module: (id: string) => object | undefined): Record<string, number> {
  const totals: Record<string, number> = {}
  const add = (key: string, n: number) => { totals[key] = (totals[key] ?? 0) + n }
  for (const id of ids) {
    for (const [key, value] of Object.entries(module(id) ?? {})) {
      if (NOT_TOTALS.has(key)) continue
      if (typeof value === 'number') add(key, value)
      else if (value === true) add(key, 1)
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [sub, n] of Object.entries(value)) if (typeof n === 'number') add(`${key}: ${sub}`, n)
      }
    }
  }
  return totals
}

/** The module totals that differ between the fitted modules and the plan, beyond what fit_preview reports. */
export function moduleTotalChanges(fitted: string[], plan: string[], module: (id: string) => object | undefined) {
  const before = moduleTotals(fitted, module)
  const after = moduleTotals(plan, module)
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => (before[key] ?? 0) !== (after[key] ?? 0))
    .sort()
    .map((key) => {
      const label = key.replace(/_pct\b/g, ' %').replace(/_/g, ' ')
      return { label: label[0].toUpperCase() + label.slice(1), before: before[key] ?? 0, after: after[key] ?? 0 }
    })
}

export function countBy(ids: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1
  return counts
}

/** Item quantities by id, from cargo or storage rows. */
export function quantities(rows: { item_id?: string; quantity?: number }[] | undefined): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows ?? []) if (row.item_id) counts[row.item_id] = (counts[row.item_id] ?? 0) + (row.quantity ?? 0)
  return counts
}
