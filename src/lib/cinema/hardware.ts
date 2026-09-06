import type { FittedModule, WeaponFireDetail } from '../battle/types'
import type { RawCatalogItem } from '../../data/catalog'
import { resolveWeaponFamily, type CinemaWeaponFamily } from './weapons'

/** Construction hints from public battle evidence, not an exact equipment manifest. */
export interface CinemaHardware {
  readonly source: 'modules' | 'recorded-weapons' | 'unknown'
  readonly weapons: Readonly<Partial<Record<CinemaWeaponFamily, number>>>
  readonly cargo: number
  readonly mining: number
  readonly salvage: number
  readonly sensor: number
  readonly defense: number
  readonly utility: number
}

type EquipmentKind = 'cargo' | 'mining' | 'salvage' | 'sensor' | 'defense' | 'utility'
/** Only normalized public names and construction categories cross to the client.
 * null means the catalog contains conflicting definitions with the same name. */
export type HardwareCatalog = Readonly<Record<string, EquipmentKind | CinemaWeaponFamily | null>>
export type HardwareCatalogSource = Pick<RawCatalogItem, 'name' | 'type' | 'damage_type' | 'cargo_bonus' | 'mining_power' |
  'harvest_power' | 'survey_power' | 'scanner_power' | 'tow_speed_penalty' | 'remote_repair_power' | 'armor_repair_rate' | 'special'>
export type RecordedHardwareWeapon = Pick<WeaponFireDetail, 'instance_id' | 'name' | 'damage_type'> & {
  /** Stable occurrence within an anonymous legacy volley, never an invented module ID. */
  anonymousIndex?: number
}
const LIMIT = 8
const normalize = (name: string) => name.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()

export function buildHardwareCatalog(items: readonly HardwareCatalogSource[]): HardwareCatalog {
  const catalog: Record<string, EquipmentKind | CinemaWeaponFamily | null> = {}
  for (const item of items) {
    const name = normalize(item.name)
    if (!name || !['weapon', 'defense', 'mining', 'utility'].includes(item.type ?? '')) continue
    let kind: EquipmentKind | CinemaWeaponFamily
    if (item.type === 'weapon') kind = resolveWeaponFamily(item.name, item.damage_type)
    else if (item.type === 'defense' || item.type === 'mining') kind = item.type
    else if ((item.cargo_bonus ?? 0) > 0) kind = 'cargo'
    else if ((item.mining_power ?? 0) > 0 || (item.harvest_power ?? 0) > 0) kind = 'mining'
    else if ((item.scanner_power ?? 0) > 0 || (item.survey_power ?? 0) > 0) kind = 'sensor'
    else if ((item.tow_speed_penalty ?? 0) > 0 || /salvag|tow_|tractor/.test(item.special ?? '')) kind = 'salvage'
    else if ((item.remote_repair_power ?? 0) > 0 || (item.armor_repair_rate ?? 0) > 0) kind = 'defense'
    else kind = equipmentKind(name) ?? 'utility'
    catalog[name] = Object.hasOwn(catalog, name) && catalog[name] !== kind ? null : kind
  }
  return Object.freeze(catalog)
}

function equipmentKind(name: string): EquipmentKind | undefined {
  if (/\bmining\b|\bstrip miner\b|\bharvester\b|\bdeep core extractor\b/.test(name)) return 'mining'
  if (/\bcargo\b|\bfreight\b|\bcontainer\b/.test(name)) return 'cargo'
  if (/\bsalvag\w*\b|\btow rig\b|\btractor\b/.test(name)) return 'salvage'
  if (/\bscanner\b|\bsensor\b|\bradar\b|\bprobe\b|\btarget painter\b|\btracking computer\b/.test(name)) return 'sensor'
  if (/\bshield\b|\barmor\b|\barmour\b|\bplating\b|\bbarrier\b|\baegis\b|\bdamage control\b|\brepair\w*\b|\bregenerator\b|\bhull (integrity|reinforcement|lattice|hardener|coating)\b/.test(name)) return 'defense'
  if (/\bafterburner\b|\bdrive\b|\bengine\b|\bwarp\b|\bcloaking\b|\breactor\b|\bcomputer\b/.test(name)) return 'utility'
}

function moduleKind(module: FittedModule, catalog?: HardwareCatalog): EquipmentKind | CinemaWeaponFamily {
  const category = normalize(module.category ?? '')
  const name = normalize(module.name ?? '')
  // Actual public catalog types/stats take precedence over historical names.
  // Ambiguous duplicate names must not invent a weapon from one candidate.
  if (catalog && Object.hasOwn(catalog, name)) return catalog[name] ?? 'utility'
  if (category === 'weapon' || category === 'weapons') return resolveWeaponFamily(name)
  if (['cargo', 'mining', 'salvage', 'sensor', 'defense'].includes(category)) return category as EquipmentKind
  if (['shield', 'armor', 'armour', 'repair'].includes(category)) return 'defense'
  if (category === 'utility' || category === 'utilities') return equipmentKind(name) ?? 'utility'
  // Public snapshots currently expose item category="module", not the module
  // type. Keep precise nonweapon names ahead of weapon recognition in that case.
  if (category !== 'module' && category !== '') return 'utility'
  const equipment = equipmentKind(name)
  if (equipment) return equipment
  if ((module.magazine_size ?? 0) > 0 || /\blaser\b|\bbeam\b|\brailgun\b|\bautocannon\b|\bflak\b|\bcannon\b|\bblaster\b|\bmissile\b|\btorpedo\b|\bsmartbomb\b|\bmine\b|\bplasma repeater\b|\bmass driver\b|\bscrapgun\b|\bharpoon\b|\b(emp|em|neural|phase) disruptor\b|\bemp pulse\b|\bsystem disabler\b|\b(solar|void|storm) lance\b|\bdark matter\b|\bblood reaver\b|\benergy siphon\b|\bgalvanic hull grid\b/.test(name)) return resolveWeaponFamily(name)
  return 'utility'
}

/** Deduplicate repeated shots while keeping identical fitted copies. Evidence is
 * bounded per family; anonymous legacy entries contribute per-volley maxima. */
export function mergeRecordedHardwareWeapons(previous: readonly RecordedHardwareWeapon[], volley: readonly RecordedHardwareWeapon[]): RecordedHardwareWeapon[] {
  const result: RecordedHardwareWeapon[] = []
  const seen = new Set<string>()
  const counts = new Map<CinemaWeaponFamily, number>()
  for (const batch of [previous, volley]) {
    const anonymous = new Map<string, number>()
    for (const gun of batch) {
      const signature = JSON.stringify([normalize(gun.name ?? ''), gun.damage_type ?? ''])
      const ordinal = gun.anonymousIndex ?? (anonymous.get(signature) ?? 0)
      if (!gun.instance_id) anonymous.set(signature, ordinal + 1)
      const key = gun.instance_id ? JSON.stringify(['instance', gun.instance_id]) : JSON.stringify(['anonymous', signature, ordinal])
      const family = resolveWeaponFamily(gun.name, gun.damage_type)
      if (seen.has(key) || (counts.get(family) ?? 0) >= LIMIT) continue
      seen.add(key)
      counts.set(family, (counts.get(family) ?? 0) + 1)
      result.push({ instance_id: gun.instance_id, name: gun.name, damage_type: gun.damage_type,
        ...(!gun.instance_id ? { anonymousIndex: ordinal } : {}) })
    }
  }
  return result
}

/** An explicit fit, even [], wins over firing evidence. Missing fits remain
 * unknown unless the record supplies actual weapon details for this hull. */
export function projectCinemaHardware(modules: readonly FittedModule[] | undefined, recordedWeapons: readonly RecordedHardwareWeapon[] = [], catalog?: HardwareCatalog): CinemaHardware {
  const weapons: Partial<Record<CinemaWeaponFamily, number>> = {}
  const equipment = { cargo: 0, mining: 0, salvage: 0, sensor: 0, defense: 0, utility: 0 }
  const known = Array.isArray(modules)
  if (known) {
    for (const module of modules) {
      const kind = moduleKind(module, catalog)
      if (kind in equipment) equipment[kind as EquipmentKind] = Math.min(LIMIT, equipment[kind as EquipmentKind] + 1)
      else weapons[kind as CinemaWeaponFamily] = Math.min(LIMIT, (weapons[kind as CinemaWeaponFamily] ?? 0) + 1)
    }
  } else {
    for (const gun of mergeRecordedHardwareWeapons([], recordedWeapons)) {
      const family = resolveWeaponFamily(gun.name, gun.damage_type)
      weapons[family] = Math.min(LIMIT, (weapons[family] ?? 0) + 1)
    }
  }
  return Object.freeze({ source: known ? 'modules' : Object.keys(weapons).length ? 'recorded-weapons' : 'unknown',
    weapons: Object.freeze(weapons), ...equipment })
}
