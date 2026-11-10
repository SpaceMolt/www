import { test, expect } from 'bun:test'
import type { BattleLogEntry } from '@spacemolt/lib'
import type { BattleView } from '@/lib/spacemolt'
import { addLogLine, compatibleAmmo, describeTick, enemiesOf, logFor, nextEnemy, nextTickStart, objectiveText, reachZone, reloadPlan, rulesText, weaponState, zoneDistance } from './combatLogic'

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

test('zoneDistance matches the gameserver: 0 when both engaged, 6 when both outer', () => {
  expect(zoneDistance('engaged', 'engaged')).toBe(0)
  expect(zoneDistance('outer', 'outer')).toBe(6)
  expect(zoneDistance('mid', 'inner')).toBe(3)
})

test('reachZone is the outermost zone a weapon hits from your zone', () => {
  expect(reachZone('outer', 6)).toBe(0)
  expect(reachZone('outer', 3)).toBe(3)
  expect(reachZone('mid', 3)).toBe(2)
  expect(reachZone('outer', 2)).toBeUndefined()
  expect(reachZone('engaged', 9)).toBe(0)
})

test('weaponState: empty before range, then ready or how far to advance', () => {
  expect(weaponState({ ammo: 0, magazine: 8, reach: 6, distance: 2 })).toEqual({ kind: 'empty' })
  expect(weaponState({ reach: 3 })).toEqual({ kind: 'idle' })
  expect(weaponState({ reach: 3, distance: 3 })).toEqual({ kind: 'ready' })
  expect(weaponState({ ammo: 5, magazine: 8, reach: 3, distance: 5 })).toEqual({ kind: 'far', advances: 2 })
  expect(weaponState({ ammo: 5, magazine: 8, distance: 3 })).toEqual({ kind: 'unknown' })
})

test('nextEnemy cycles and starts at the first enemy', () => {
  const enemies = [{ player_id: 'a' }, { player_id: 'b' }]
  expect(nextEnemy(enemies, undefined)?.player_id).toBe('a')
  expect(nextEnemy(enemies, 'a')?.player_id).toBe('b')
  expect(nextEnemy(enemies, 'b')?.player_id).toBe('a')
  expect(nextEnemy([], 'a')).toBeUndefined()
})

test('battle log: counts your damage, and starts over in a new battle', () => {
  const hit = (id: number, kind: 'out' | 'in' | 'miss', dmg?: number) => ({ id, kind, who: 'a > b', dmg })
  const a = [hit(1, 'out', 10), hit(2, 'in', 4), hit(3, 'miss')].reduce((log, line) => addLogLine(log, 'a', line), logFor({ lines: [], dealt: 0, taken: 0 }, 'a'))
  expect(a).toMatchObject({ battleId: 'a', dealt: 10, taken: 4 })
  expect(a.lines.map((l) => l.id)).toEqual([3, 2, 1])
  expect(logFor(a, 'b')).toEqual({ battleId: 'b', lines: [], dealt: 0, taken: 0 })
  expect(addLogLine(a, 'b', hit(4, 'out', 7))).toMatchObject({ battleId: 'b', dealt: 7, taken: 0, lines: [{ id: 4 }] })
})
