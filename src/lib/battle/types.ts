/**
 * Types for the gameserver battle APIs consumed by the battle viewer:
 *   GET /api/battle/summary?battle_id=X  — single battle summary
 *   GET /api/battle/log?battle_id=X      — per-tick replay log
 *
 * Field names match the Go models' JSON tags (internal/models/battle_log.go).
 */

// --- Battle summary (list + single-battle endpoints) ---

export interface BattleSide {
  side_id: number
  faction_id?: string
  faction_tag?: string
  participants?: string[]
}

export type BattleCategory = 'pvp' | 'pirate' | 'police' | 'wildlife' | 'pve' | 'npc'

export interface BattleTopDamage {
  username: string
  damage: number
}

export interface BattleSummary {
  battle_id: string
  system_id: string
  system_name: string
  origin_poi?: string
  status: 'active' | 'completed'
  /** Absent on servers that predate battle categorization */
  category?: BattleCategory
  start_tick: number
  duration_ticks: number
  participant_count: number
  sides: BattleSide[]
  total_damage: number
  ships_destroyed: number
  destroyed_names?: string[]
  top_damage?: BattleTopDamage
  outcome?: string
  winning_side?: number
  ended_at?: string
}

/** Display metadata for battle categories (label, glyph, accent color). */
export const BATTLE_CATEGORY_META: Record<BattleCategory, { label: string; glyph: string; color: string }> = {
  pvp: { label: 'PvP', glyph: '⚔', color: '#e63946' },
  pirate: { label: 'Pirates', glyph: '☠', color: '#ff6b35' },
  police: { label: 'Police', glyph: '🛡', color: '#4dabf7' },
  wildlife: { label: 'Wildlife', glyph: '🐙', color: '#2dd4bf' },
  pve: { label: 'PvE', glyph: '🤖', color: '#a8c5d6' },
  npc: { label: 'NPC', glyph: '🤖', color: '#6b8fa3' },
}

// --- Battle log (per-tick replay entries) ---

export interface FittedModule {
  name: string
  category: string
  loaded_ammo?: string
  current_ammo?: number
  magazine_size?: number
}

export interface ParticipantSnapshot {
  player_id: string
  username: string
  side_id: number
  faction_id?: string
  zone: string
  stance: string
  target_id?: string
  auto_pilot: boolean
  flee_counter: number
  ship_class: string
  hull: number
  max_hull: number
  shield: number
  max_shield: number
  fuel: number
  max_fuel: number
  damage_dealt: number
  damage_taken: number
  kill_count: number
  // Active status effects (debuffs) at the start of this tick
  disruption_ticks?: number
  speed_penalty_pct?: number
  damage_penalty_pct?: number
  burn_ticks?: number
  burn_damage_per_tick?: number
  armor_melt_ticks?: number
  armor_melt_pct?: number
  x: number
  y: number
  modules?: FittedModule[]
}

export interface WeaponFireDetail {
  instance_id: string
  name: string
  base_damage: number
  after_disruption: number
  type_bonus_pct: number
  crit_chance: number
  crit_roll: number
  crit_fired: boolean
  damage: number
  damage_type: string
  ammo_used?: string
  ammo_mod?: number
}

export interface AttackLogEntry {
  attacker_id: string
  target_id: string
  zone_distance: number
  weapons: WeaponFireDetail[]
  raw_damage: number
  weapon_skill_pct: number
  capital_bonus_pct?: number
  off_buff_pct?: number
  pre_hit_damage: number
  hit_chance: number
  hit_roll: number
  hit_success: boolean
  stance_mult?: number
  after_stance?: number
  def_buff_pct?: number
  after_def_buff?: number
  shield_resist_pct?: number
  type_resist_pct?: number
  flat_reduction_pct?: number
  final_damage: number
  shield_damage: number
  hull_damage: number
  damage_type: string
  disrupted?: boolean
  splash?: boolean
}

export interface BurnLogEntry {
  target_id: string
  damage: number
  ticks_remaining: number
  destroyed?: boolean
}

export interface CommandLogEntry {
  player_id: string
  command: string
  stance?: string
  target_id?: string
}

export interface ZoneMoveLogEntry {
  player_id: string
  old_zone: string
  new_zone: string
  reason: string
}

export interface RegenLogEntry {
  player_id: string
  shield_regen: number
  armor_repair: number
  remote_repair?: number
  shield_before: number
  shield_after: number
  hull_before: number
  hull_after: number
}

export interface FuelLogEntry {
  player_id: string
  fuel_burned: number
  fuel_before: number
  fuel_after: number
  forced_fire: boolean
}

export interface FleeLogEntry {
  player_id: string
  flee_counter: number
  flee_required: number
  escaped: boolean
}

export interface JoinLogEntry {
  player_id: string
  username: string
  side_id: number
}

export interface KillLogEntry {
  killer_id: string
  victim_id: string
  killer_username: string
  victim_username: string
}

export interface BattleEndParticipant {
  player_id: string
  username: string
  side_id: number
  damage_dealt: number
  damage_taken: number
  kill_count: number
  survived: boolean
}

export interface BattleEndLogEntry {
  outcome: string
  winning_side: number
  duration: number
  total_damage: number
  ships_destroyed: number
  participants: BattleEndParticipant[]
}

export interface BattleLogEntry {
  battle_id: string
  system_id: string
  tick: number
  snapshots: ParticipantSnapshot[]
  commands?: CommandLogEntry[]
  autopilot?: { player_id: string; chosen_target?: string; reason: string }[]
  zone_moves?: ZoneMoveLogEntry[]
  attacks?: AttackLogEntry[]
  burns?: BurnLogEntry[]
  regen?: RegenLogEntry[]
  fuel?: FuelLogEntry[]
  flee?: FleeLogEntry[]
  joins?: JoinLogEntry[]
  kills?: KillLogEntry[]
  battle_ended?: BattleEndLogEntry
}

export interface BattleLogResponse {
  battle_id: string
  status?: 'active' | 'completed'
  entries: BattleLogEntry[]
  total_ticks: number
  has_more: boolean
}

// --- Shared constants ---

export const SIDE_COLORS = ['#00d4ff', '#e63946', '#2dd4bf', '#ffd93d', '#9b59b6', '#ff6b35']

export function sideColor(sideIndex: number): string {
  return SIDE_COLORS[sideIndex % SIDE_COLORS.length]
}

/** Zone name → ring index, outermost first. Engaged is the shared centre. */
export const ZONE_ORDER = ['outer', 'mid', 'inner', 'engaged'] as const

export function zoneIndex(zone: string): number {
  const i = ZONE_ORDER.indexOf(zone as (typeof ZONE_ORDER)[number])
  return i === -1 ? 0 : i
}

/** Colors for the six combat damage types. */
export const DAMAGE_TYPE_COLORS: Record<string, string> = {
  kinetic: '#ffd166',
  energy: '#00d4ff',
  explosive: '#ff6b35',
  em: '#9b59b6',
  thermal: '#ff9551',
  void: '#c77dff',
}

export function damageTypeColor(type: string): string {
  return DAMAGE_TYPE_COLORS[type] || '#a8c5d6'
}

/**
 * Battle logs written before the server tagged its participant summary
 * serialize battle_ended.participants with PascalCase keys — normalize
 * them so old battles keep their names.
 */
export function normalizeEntries(entries: BattleLogEntry[]): BattleLogEntry[] {
  for (const entry of entries) {
    if (entry.battle_ended?.participants) {
      entry.battle_ended.participants = entry.battle_ended.participants.map(p => {
        const legacy = p as unknown as {
          PlayerID?: string
          Username?: string
          SideID?: number
          DamageDealt?: number
          DamageTaken?: number
          KillCount?: number
          Survived?: boolean
        }
        return {
          player_id: p.player_id ?? legacy.PlayerID ?? '',
          username: p.username ?? legacy.Username ?? '',
          side_id: p.side_id ?? legacy.SideID ?? 0,
          damage_dealt: p.damage_dealt ?? legacy.DamageDealt ?? 0,
          damage_taken: p.damage_taken ?? legacy.DamageTaken ?? 0,
          kill_count: p.kill_count ?? legacy.KillCount ?? 0,
          survived: p.survived ?? legacy.Survived ?? true,
        }
      })
    }
  }
  return entries
}
