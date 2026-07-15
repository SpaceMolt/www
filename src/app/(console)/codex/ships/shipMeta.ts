/*
 * Shared ship constants and projections for /codex/ships.
 *
 * Imported by BOTH the server list page and the client browser, so it must not
 * import `@/data/catalog` — that would inline the 1.2 MB catalog.json into the
 * client bundle. The server page does the catalog reads and hands the browser
 * the plain `ShipListEntry` projection below.
 */

import { titleCase } from '@/lib/format'

/** An innate hull ability, e.g. `{ type: "integrated_cloak", value: 30 }`. */
export interface ShipCapability {
  type: string
  value?: number
}

/** Exactly the fields the list UI renders — nothing else crosses to the client. */
export interface ShipListEntry {
  id: string
  name: string
  description: string
  empire: string
  empireName: string
  class: string
  category: string
  tier: number
  starter: boolean
  prestige: boolean
  /** Free-text special behaviour tag; searchable. */
  special: string
  base_hull: number
  base_shield: number
  base_shield_recharge: number
  base_armor: number
  base_speed: number
  base_fuel: number
  cargo_capacity: number
  cpu_capacity: number
  power_capacity: number
  weapon_slots: number
  defense_slots: number
  utility_slots: number
}

export const EMPIRE_COLORS: Record<string, string> = {
  solarian: '#ffd700',
  voidborn: '#9b59b6',
  crimson: '#e63946',
  nebula: '#00d4ff',
  outerrim: '#2dd4bf',
}

export const EMPIRE_NAMES: Record<string, string> = {
  solarian: 'Solarian Confederacy',
  voidborn: 'Voidborn Collective',
  crimson: 'Crimson Pact',
  nebula: 'Nebula Trade Federation',
  outerrim: 'Outer Rim Explorers',
}

export const EMPIRE_SHORT_KEYS: Record<string, string> = {
  solarian: 'ships.empireSolarian',
  voidborn: 'ships.empireVoidborn',
  crimson: 'ships.empireCrimson',
  nebula: 'ships.empireNebula',
  outerrim: 'ships.empireOuterRim',
}

export function empireColor(empire: string): string {
  return EMPIRE_COLORS[empire] || '#888'
}

export function shipArtSrc(id: string): string {
  return `/images/ships/catalog/${id}.webp`
}

// Human-readable labels for inherent ship capability types.
const CAPABILITY_LABELS: Record<string, string> = {
  ore_yield_bonus: 'Ore Mining Yield',
  ice_yield_bonus: 'Ice Harvesting Yield',
  gas_yield_bonus: 'Gas Harvesting Yield',
  ore_cargo_efficiency: 'Ore Cargo Space',
  gas_cargo_efficiency: 'Gas Cargo Space',
  ice_cargo_efficiency: 'Ice Cargo Space',
  fuel_efficiency_bonus: 'Fuel Efficiency',
  integrated_cloak: 'Integrated Cloak',
  integrated_scanner: 'Integrated Scanner',
  integrated_survey_scanner: 'Integrated Survey Scanner',
  scan_resistance: 'Scan Resistance',
  ship_bay_capacity: 'Ship Bay Capacity',
  anomaly_detection: 'Anomaly Detection',
  passenger_economy_berths: 'Economy Berths',
  passenger_business_berths: 'Business Berths',
  passenger_first_berths: 'First Class Berths',
}

// Capability types whose value is a percentage of normal cargo space consumed
// (lower is better, e.g. 50 = takes half the usual space).
const CARGO_EFFICIENCY_TYPES = new Set([
  'ore_cargo_efficiency',
  'gas_cargo_efficiency',
  'ice_cargo_efficiency',
])

// Capability types whose value is a percentage bonus.
const PERCENT_BONUS_TYPES = new Set([
  'ore_yield_bonus',
  'ice_yield_bonus',
  'gas_yield_bonus',
  'fuel_efficiency_bonus',
])

export function capabilityLabel(cap: ShipCapability): string {
  return CAPABILITY_LABELS[cap.type] || titleCase(cap.type)
}

export function capabilityValue(cap: ShipCapability): string {
  if (cap.value === undefined) return 'Yes'
  if (CARGO_EFFICIENCY_TYPES.has(cap.type)) return `${cap.value}% of normal`
  if (PERCENT_BONUS_TYPES.has(cap.type)) return `+${cap.value}%`
  return cap.value.toLocaleString('en-US')
}
