import { test, expect } from 'bun:test'
import type { BattleLogEntry, NotificationBattleDamage } from '@spacemolt/lib'
import type { BattleView } from '@/lib/spacemolt'
import { compatibleAmmo, describeTick, enemiesOf, formatDamage, nextTickStart, objectiveText, reloadPlan, rulesText } from './combatLogic'

test('enemiesOf drops your own side', () => {
  const battle = {
    your_side_id: 1,
    participants: [
      { player_id: 'me', side_id: 1 },
      { player_id: 'ally', side_id: 1 },
      { player_id: 'foe', side_id: 2 },
      { player_id: 'pirate', side_id: 3 },
    ],
  } as unknown as BattleView
  expect(enemiesOf(battle).map((p) => p.player_id)).toEqual(['foe', 'pirate'])
})

test('compatibleAmmo matches ammo family and keeps unknown items', () => {
  // Shaped like the catalog: ammo names its weapon family in effect.subtype.
  const catalog: Record<string, { effect?: { type?: string; subtype?: string } }> = {
    ac_round: { effect: { type: 'ammo', subtype: 'autocannon' } },
    missile: { effect: { type: 'ammo', subtype: 'missile' } },
    iron_ore: {},
  }
  const cargo = [{ item_id: 'ac_round' }, { item_id: 'missile' }, { item_id: 'iron_ore' }, { item_id: 'new_ammo' }]
  const itemOf = (id: string) => catalog[id]
  expect(compatibleAmmo({ ammo_type: 'autocannon' }, cargo, itemOf).map((c) => c.item_id)).toEqual(['ac_round', 'new_ammo'])
  expect(compatibleAmmo({}, cargo, itemOf)).toHaveLength(4)
})

test('reloadPlan skips unpicked weapons and full magazines with the same ammo', () => {
  expect(
    reloadPlan([
      { weaponId: 'w1', ammoId: 'a', loadedId: 'a', full: false },
      { weaponId: 'w2', ammoId: 'a', loadedId: 'a', full: true },
      { weaponId: 'w3', ammoId: 'b', loadedId: 'a', full: true },
      { weaponId: 'w4', full: false },
    ]),
  ).toEqual([
    { weapon_instance_id: 'w1', ammo_item_id: 'a' },
    { weapon_instance_id: 'w3', ammo_item_id: 'b' },
  ])
})

test('formatDamage shows hits and misses', () => {
  const base = { tick: 7, attacker_id: 'a', attacker_name: 'Ana', target_id: 'b', target_name: 'Bo', total_damage: 30, shield_hit: 20, hull_hit: 10 }
  expect(formatDamage({ ...base, hit_success: true } as NotificationBattleDamage)).toBe('T7 Ana > Bo: 30 dmg (20 shd / 10 hull)')
  expect(formatDamage({ ...base, hit_success: false } as NotificationBattleDamage)).toBe('T7 Ana > Bo: miss')
})

test('nextTickStart continues after the last tick', () => {
  expect(nextTickStart([{ tick: 10 }, { tick: 12 }])).toBe(13)
  expect(nextTickStart([])).toBeUndefined()
})

test('describeTick sums attacks per pair and lists kills', () => {
  const entry = {
    tick: 5,
    snapshots: [
      { player_id: 'a', username: 'Ana' },
      { player_id: 'b', username: 'Bo' },
    ],
    joins: [{ player_id: 'b', side_id: 2, username: 'Bo' }],
    attacks: [
      { attacker_id: 'a', target_id: 'b', shield_damage: 5, hull_damage: 3, hit_success: true },
      { attacker_id: 'a', target_id: 'b', shield_damage: 0, hull_damage: 0, hit_success: false },
    ],
    kills: [{ killer_username: 'Ana', victim_username: 'Bo' }],
    battle_ended: { outcome: 'victory' },
  } as unknown as BattleLogEntry
  expect(describeTick(entry)).toEqual([
    'Bo joined side 2',
    'Ana hit Bo for 8 (1 missed)',
    'Ana destroyed Bo',
    'Battle ended: victory',
  ])
})

test('objectiveText describes the win condition', () => {
  expect(objectiveText({})).toBe('knock out every enemy')
  expect(objectiveText({ survive_ticks: 30 })).toBe('survive 30 ticks')
  expect(objectiveText({ time_limit_ticks: 20, no_enemy_escape: true })).toBe('knock out every enemy, within 20 ticks, let no enemy escape')
})

test('rulesText lists only set rules', () => {
  expect(rulesText({ max_side_size: 0 })).toEqual([])
  expect(rulesText({ max_side_size: 1, max_ship_tier: 2, no_cloak: true, banned_modules: ['a', 'b'] })).toEqual([
    'max 1 per side',
    'tier <= 2',
    'no cloak',
    'banned modules: a, b',
  ])
})
