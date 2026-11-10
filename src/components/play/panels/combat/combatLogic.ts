import type { ArenaObjective, ArenaRules, BattleLogEntry } from '@spacemolt/lib'
import type { BattleView } from '@/lib/spacemolt'
import { zoneIndex } from '@/lib/battle/types'

/** Everyone not on your side is a valid battle target. */
export const enemiesOf = (battle: BattleView) =>
  battle.participants.filter((p) => p.side_id !== battle.your_side_id)

/**
 * Cargo items a weapon can load. A weapon without an ammo family (e.g. a
 * Scrapgun firing junk) takes anything. Items missing from the static catalog
 * stay listed, so a catalog older than the server never hides real ammo.
 */
/** The next enemy after the current target, wrapping; the first enemy when nothing is targeted. */
export const nextEnemy = <P extends { player_id: string }>(enemies: P[], currentId?: string): P | undefined =>
  enemies[(enemies.findIndex((e) => e.player_id === currentId) + 1) % enemies.length]

/** gameserver models.ZoneDistance: 0 when both ships are engaged, 6 when both are at the outer zone. */
export const zoneDistance = (a = '', b = '') => 6 - zoneIndex(a) - zoneIndex(b)

/** The outermost zone (0 outer … 3 engaged) a weapon hits from your zone, or undefined if it hits nothing. */
export function reachZone(yourZone: string, reach: number): number | undefined {
  const zone = zoneDistance(yourZone) - reach
  return zone > 3 ? undefined : Math.max(0, zone)
}

export type WeaponState = { kind: 'empty' } | { kind: 'idle' } | { kind: 'ready' } | { kind: 'far'; advances: number }

/** What a weapon can do against the target this tick. An empty magazine wins over range. */
export function weaponState({ ammo = 0, magazine, reach = 0, distance }: { ammo?: number; magazine?: number; reach?: number; distance?: number }): WeaponState {
  if (magazine !== undefined && ammo === 0) return { kind: 'empty' }
  if (distance === undefined) return { kind: 'idle' }
  return distance <= reach ? { kind: 'ready' } : { kind: 'far', advances: distance - reach }
}

export function compatibleAmmo<C extends { item_id: string }>(
  weapon: { ammo_type?: string },
  cargo: C[],
  itemOf: (id: string) => { effect?: { subtype?: string } } | undefined,
): C[] {
  if (!weapon.ammo_type) return cargo
  return cargo.filter((c) => {
    const item = itemOf(c.item_id)
    return !item || item.effect?.subtype === weapon.ammo_type
  })
}

export interface ReloadRow {
  weaponId: string
  ammoId?: string
  loadedId?: string
  full: boolean
}

/** Bulk reload entries: skip weapons with no ammo picked and full magazines that keep their ammo. */
export const reloadPlan = (rows: ReloadRow[]) =>
  rows
    .filter((r) => r.ammoId && !(r.full && r.ammoId === r.loadedId))
    .map((r) => ({ weapon_instance_id: r.weaponId, ammo_item_id: r.ammoId as string }))

/** Next page of a battle log starts one tick after the last tick shown. */
export const nextTickStart = (entries: Pick<BattleLogEntry, 'tick'>[]) =>
  entries.length ? Math.max(...entries.map((e) => e.tick)) + 1 : undefined

/** Plain-text lines for one logged battle tick. Attacks are summed per attacker and target. */
export function describeTick(entry: BattleLogEntry): string[] {
  const names = new Map(entry.snapshots.map((s) => [s.player_id, s.username]))
  const name = (id: string) => names.get(id) ?? id
  const hits = new Map<string, { from: string; to: string; dmg: number; misses: number }>()
  for (const a of entry.attacks ?? []) {
    const key = `${a.attacker_id}>${a.target_id}`
    const row = hits.get(key) ?? { from: a.attacker_id, to: a.target_id, dmg: 0, misses: 0 }
    hits.set(key, { ...row, dmg: row.dmg + a.shield_damage + a.hull_damage, misses: row.misses + (a.hit_success ? 0 : 1) })
  }
  return [
    ...(entry.joins ?? []).map((j) => `${j.username} joined side ${j.side_id}`),
    ...[...hits.values()].map(
      (h) => `${name(h.from)} hit ${name(h.to)} for ${h.dmg}${h.misses ? ` (${h.misses} missed)` : ''}`,
    ),
    ...(entry.kills ?? []).map((k) => `${k.killer_username} destroyed ${k.victim_username}`),
    ...(entry.captures ?? []).map((c) => `${c.captor_username} captured ${c.former_owner_username}'s ${c.ship_class}`),
    ...(entry.flee ?? []).filter((f) => f.escaped).map((f) => `${name(f.player_id)} escaped`),
    ...(entry.battle_ended ? [`Battle ended: ${entry.battle_ended.outcome}`] : []),
  ]
}

/** One line for an arena win condition; an all-zero objective is last side standing. */
export function objectiveText(o: ArenaObjective): string {
  const parts = [
    o.survive_ticks ? `survive ${o.survive_ticks} ticks` : 'knock out every enemy',
    o.time_limit_ticks ? `within ${o.time_limit_ticks} ticks` : '',
    o.no_enemy_escape ? 'let no enemy escape' : '',
  ]
  return parts.filter(Boolean).join(', ')
}

const RULE_FLAGS: [keyof ArenaRules, string][] = [
  ['no_ammo_weapons', 'no ammo weapons'],
  ['no_boarding', 'no boarding'],
  ['no_cloak', 'no cloak'],
  ['no_consumables', 'no consumables'],
  ['no_drones', 'no drones'],
  ['no_tackle', 'no tackle'],
  ['require_empty_cargo', 'empty cargo'],
]

const RULE_LISTS: [keyof ArenaRules, string][] = [
  ['allowed_ship_classes', 'ships'],
  ['allowed_hull_classes', 'hulls'],
  ['allowed_ship_categories', 'categories'],
  ['allowed_damage_types', 'damage'],
  ['banned_ship_classes', 'banned ships'],
  ['banned_hull_classes', 'banned hulls'],
  ['banned_modules', 'banned modules'],
  ['banned_effect_types', 'banned effects'],
]

/** Short loadout rule labels; unset rules are omitted. */
export function rulesText(r: ArenaRules): string[] {
  return [
    r.max_side_size ? `max ${r.max_side_size} per side` : '',
    r.min_side_size ? `min ${r.min_side_size} per side` : '',
    r.min_ship_tier ? `tier ${r.min_ship_tier}+` : '',
    r.max_ship_tier ? `tier <= ${r.max_ship_tier}` : '',
    r.max_ship_scale ? `scale <= ${r.max_ship_scale}` : '',
    r.max_crew ? `crew <= ${r.max_crew}` : '',
    r.max_marines ? `marines <= ${r.max_marines}` : '',
    ...RULE_FLAGS.map(([key, label]) => (r[key] ? label : '')),
    ...RULE_LISTS.map(([key, label]) => {
      const list = r[key] as string[] | undefined
      return list?.length ? `${label}: ${list.join(', ')}` : ''
    }),
  ].filter(Boolean)
}
