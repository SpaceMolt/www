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

export type BattleCategory = 'pvp' | 'pirate' | 'police' | 'wildlife' | 'pve' | 'npc' | 'arena'

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
  /** Intact ships captured through boarding; omitted by older servers and when zero. */
  ships_captured?: number
  captures?: CaptureLogEntry[]
  destroyed_names?: string[]
  /**
   * Real player usernames among the participants (NPC names excluded), so
   * consumers can link them to profile pages. Absent on battles recorded
   * before the server emitted it.
   */
  player_names?: string[]
  top_damage?: BattleTopDamage
  outcome?: string
  winning_side?: number
  ended_at?: string
}

/**
 * Display metadata for battle categories (glyph, accent color, and the i18n
 * key for the label). The label itself is resolved via useTranslation at the
 * call site so it stays localizable.
 */
export const BATTLE_CATEGORY_META: Record<BattleCategory, { labelKey: string; glyph: string; color: string }> = {
  pvp: { labelKey: 'battles.categoryPvp', glyph: '⚔', color: '#e63946' },
  pirate: { labelKey: 'battles.categoryPirate', glyph: '☠', color: '#ff6b35' },
  police: { labelKey: 'battles.categoryPolice', glyph: '🛡', color: '#4dabf7' },
  wildlife: { labelKey: 'battles.categoryWildlife', glyph: '🐙', color: '#2dd4bf' },
  pve: { labelKey: 'battles.categoryPve', glyph: '🤖', color: '#a8c5d6' },
  npc: { labelKey: 'battles.categoryNpc', glyph: '🤖', color: '#6b8fa3' },
  arena: { labelKey: 'battles.categoryArena', glyph: '◎', color: '#ffd93d' },
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
  /**
   * What this combatant is: player | pirate | police | drone | creature |
   * station | prize | npc. Absent on logs written before the server tagged its
   * snapshots, which is why detectKind() still keeps a heuristic fallback.
   */
  kind?: string
  is_npc?: boolean
  is_boss?: boolean
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
  ignored_resistance_pct?: number
  armor_melt_applied_pct?: number
  system_disable_ticks?: number
  cpu_damage_pct?: number
  lifesteal_pct?: number
  aoe_radius?: number
  chain_targets?: number
  capacitor_drain?: number
  mine_duration?: number
  dot_damage?: number
  dot_duration?: number
  dot_source_id?: string
  shield_drain_requested?: number
  shield_drained?: number
  shield_transfer_pct?: number
  shield_transferred?: number
  secondary_kind?: 'chain' | 'retaliation' | 'aoe' | 'ammo_splash' | string
  emergency_cloak_activated?: boolean
  emergency_cloak_duration?: number
  emergency_cloak_strength?: number
  final_damage: number
  shield_damage: number
  hull_damage: number
  damage_type: string
  disrupted?: boolean
  splash?: boolean
  defense_components?: DefenseComponentLog[]
}

export interface DefenseComponentLog {
  weapon_instance_id: string
  weapon_name: string
  damage_type: string
  incoming_damage: number
  shield_resist_pct: number
  after_shield_resist: number
  type_resist_pct: number
  ignored_resistance_pct?: number
  after_type_resist: number
  flat_reduction_pct: number
  after_flat_reduction: number
  shield_bypass_pct: number
  armor_bypass_pct: number
  ignore_all_defense: boolean
  final_damage: number
  shield_damage: number
  hull_damage: number
  lifesteal_pct?: number
  lifesteal_heal?: number
}

export interface BurnLogEntry {
  source_id?: string
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
  passive_repair?: number
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
  /** combat | self_destruct | police; absent on historical rows. */
  cause?: string
}

export interface BattleEndParticipant {
  player_id: string
  username: string
  side_id: number
  kind?: string
  is_npc?: boolean
  is_boss?: boolean
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
  ships_captured?: number
  captures?: CaptureLogEntry[]
  participants: BattleEndParticipant[]
  category?: string
  participant_names?: string[]
}

/** Public, privacy-safe aggregate personnel result for one ship and tick. */
export interface PersonnelCasualtyLogEntry {
  target_id: string
  casualties_occurred: boolean
  incapacitated: boolean
  triage_applied?: boolean
  triage_converted?: boolean
  triage_provider_id?: string
  triage_provider_ship_id?: string
}

/** Observable boarding transition; exact force sizes and losses stay private. */
export interface BoardingStateLogEntry {
  operation_id: string
  phase: string
  actor_id?: string
  target_id?: string
  event: string
  reason?: string
  casualties_occurred?: boolean
  attacker_casualties?: boolean
  defender_casualties?: boolean
  self_destruct_countdown?: number
  hull_damage?: number
  destroyed?: boolean
}

/** Intact capture record. Captures are not kills or destruction. */
export interface CaptureLogEntry {
  boarding_operation_id: string
  captor_id: string
  captor_username: string
  former_owner_id: string
  former_owner_username: string
  ship_id: string
  ship_class: string
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
  personnel_casualties?: PersonnelCasualtyLogEntry[]
  boarding?: BoardingStateLogEntry[]
  captures?: CaptureLogEntry[]
  regen?: RegenLogEntry[]
  fuel?: FuelLogEntry[]
  flee?: FleeLogEntry[]
  joins?: JoinLogEntry[]
  kills?: KillLogEntry[]
  /** True on every tick of a consequence-free arena match (kills are knockouts). */
  arena?: boolean
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
          Kind?: string
          IsNPC?: boolean
          IsBoss?: boolean
        }
        return {
          player_id: p.player_id ?? legacy.PlayerID ?? '',
          username: p.username ?? legacy.Username ?? '',
          side_id: p.side_id ?? legacy.SideID ?? 0,
          damage_dealt: p.damage_dealt ?? legacy.DamageDealt ?? 0,
          damage_taken: p.damage_taken ?? legacy.DamageTaken ?? 0,
          kill_count: p.kill_count ?? legacy.KillCount ?? 0,
          survived: p.survived ?? legacy.Survived ?? true,
          kind: p.kind ?? legacy.Kind,
          is_npc: p.is_npc ?? legacy.IsNPC,
          is_boss: p.is_boss ?? legacy.IsBoss,
        }
      })
    }
  }
  return entries
}
