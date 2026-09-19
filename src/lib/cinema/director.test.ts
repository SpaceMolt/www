import { describe, expect, it } from 'bun:test'
import { compileBattleFilm, getCinemaEligibility, sampleCinemaHealth, sampleCinemaShot, sourceTickAt } from './director'
import type { AttackLogEntry, BattleLogEntry, BattleSummary, ParticipantSnapshot, WeaponFireDetail } from '../battle/types'
import { applyBattleLoadResult, initialBattleLoaderState, shouldPollBattle } from '../battle/battleData'
import { buildHardwareCatalog } from './hardware'

const summary = (over: Partial<BattleSummary> = {}): BattleSummary => ({ battle_id: 'cinema-test', system_id: 'krynn',
  system_name: 'Krynn', status: 'completed', start_tick: 100, duration_ticks: 2, participant_count: 2,
  sides: [{ side_id: 1 }, { side_id: 2 }], total_damage: 100, ships_destroyed: 0, ...over })
const snap = (id: string, side = 1, over: Partial<ParticipantSnapshot> = {}): ParticipantSnapshot => ({
  player_id: id, username: `Pilot ${id}`, ship_class: 'vanguard', kind: 'player', side_id: side,
  zone: 'engaged', stance: 'aggressive', auto_pilot: false, flee_counter: 0, hull: 100, max_hull: 100,
  shield: 100, max_shield: 100, fuel: 50, max_fuel: 100, damage_dealt: 0, damage_taken: 0, kill_count: 0, x: 0, y: 0, ...over,
})
const gun = (id: string, type: string, hit = true): WeaponFireDetail => ({ instance_id: id, name: `${type} weapon`,
  base_damage: 20, after_disruption: 20, type_bonus_pct: 0, crit_chance: 0, crit_roll: 1, crit_fired: false,
  damage: hit ? 20 : 0, damage_type: type, hit_success: hit })
const attack = (from: string, to: string, over: Partial<AttackLogEntry> = {}): AttackLogEntry => ({
  attacker_id: from, target_id: to, zone_distance: 0, weapons: [gun('gun', 'energy')], raw_damage: 20,
  weapon_skill_pct: 0, hit_chance: 1, hit_success: true, final_damage: 20, shield_damage: 20, hull_damage: 0,
  damage_type: 'energy', ...over,
})
const row = (tick: number, over: Partial<BattleLogEntry> = {}): BattleLogEntry => ({ battle_id: 'cinema-test',
  system_id: 'krynn', tick, snapshots: [snap('a', 1), snap('b', 2)], ...over })
const terminal = (tick: number, over: Partial<BattleLogEntry> = {}): BattleLogEntry => row(tick, {
  battle_ended: { outcome: 'victory', winning_side: 1, duration: tick - 99, total_damage: 20, ships_destroyed: 0,
    participants: [{ player_id: 'a', username: 'Pilot a', side_id: 1, damage_dealt: 20, damage_taken: 0, kill_count: 0, survived: true }] }, ...over,
})
const kill = (killer: string, victim: string) => ({ killer_id: killer, victim_id: victim, killer_username: killer, victim_username: victim })

function compile(entries: BattleLogEntry[], over: Partial<BattleSummary> = {}) { return compileBattleFilm(summary(over), entries, true) }

describe('recorded lifecycle hardware', () => {
  it('uses the serializable public catalog projection throughout compilation', () => {
    const catalog = structuredClone(buildHardwareCatalog([{ name: 'Mystery Laser', type: 'utility', cargo_bonus: 100 }]))
    const film = compileBattleFilm(summary(), [row(100, { snapshots: [snap('a', 1, { modules: [{ name: 'Mystery Laser', category: 'module' }] }), snap('b', 2)] }), terminal(101)], true, catalog)
    expect(film.ships[0].hardware).toMatchObject({ source: 'modules', weapons: {}, cargo: 1 })
  })
  it('keeps the first explicit fit rather than counting repeated snapshots or inventing equipment from attacks', () => {
    const modules = [{ name: 'Cargo Expander I', category: 'module' }, { name: 'Mining Laser I', category: 'module' }]
    const film = compile([row(100, { snapshots: [snap('a', 1, { modules }), snap('b', 2, { modules: [] })],
      attacks: [attack('a', 'b'), attack('b', 'a')] }), row(101, { snapshots: [snap('a', 1, { modules }), snap('b', 2)] }),
      terminal(102, { snapshots: [snap('a', 1, { modules: [{ name: 'Null Cannon', category: 'module' }] }), snap('b', 2)] })])
    expect(film.ships[0].hardware).toMatchObject({ source: 'modules', cargo: 1, mining: 1, weapons: {} })
    expect(film.ships[1].hardware).toMatchObject({ source: 'modules', weapons: {}, utility: 0 })
  })
  it('deduplicates repeated firing by hull and lets a later first explicit snapshot replace fallback', () => {
    const volley = [gun('one', 'energy'), gun('two', 'energy')]
    const film = compile([row(100, { attacks: [attack('a', 'b', { weapons: volley }), attack('b', 'a', { weapons: volley })] }),
      row(101, { attacks: [attack('a', 'b', { weapons: volley })] }),
      terminal(102, { snapshots: [snap('a'), snap('b', 2, { modules: [] })] })])
    expect(film.ships[0].hardware).toMatchObject({ source: 'recorded-weapons', weapons: { laser: 2 } })
    expect(film.ships[1].hardware).toMatchObject({ source: 'modules', weapons: {} })
  })
  it('gives returning hulls independent fits without inheriting an old snapshot on a join', () => {
    const film = compile([row(100, { snapshots: [snap('a', 1, { modules: [{ name: 'Null Cannon', category: 'module' }] }), snap('b', 2)],
      kills: [kill('b', 'a')] }), row(101, { snapshots: [snap('b', 2)], joins: [{ player_id: 'a', username: 'Pilot a', side_id: 1 }] }),
      terminal(102, { snapshots: [snap('a', 1, { ship_class: 'shard', modules: [{ name: 'Mining Laser I', category: 'module' }] }), snap('b', 2)] })])
    const hulls = film.ships.filter(ship => ship.playerId === 'a')
    expect(hulls).toHaveLength(2)
    expect(hulls[0].hardware).toMatchObject({ source: 'modules', weapons: { exotic: 1 }, mining: 0 })
    expect(hulls[1].hardware).toMatchObject({ source: 'modules', weapons: {}, mining: 1 })
    const unknownReturn = compile([row(100, { snapshots: [snap('a', 1, { modules: [{ name: 'Null Cannon', category: 'module' }] }), snap('b', 2)],
      kills: [kill('b', 'a')] }), terminal(101, { snapshots: [snap('b', 2)], joins: [{ player_id: 'a', username: 'Pilot a', side_id: 1 }] })])
    expect(unknownReturn.ships.find(ship => ship.id === 'a:1')!.hardware!.source).toBe('unknown')
  })
  it('records weapon evidence from compressed ticks and ignores derived collateral gun copies', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => row(100 + i, { attacks: [attack('a', 'b')] }))
    rows[400].attacks = [attack('a', 'b', { weapons: [{ ...gun('rare', 'void'), name: 'Null Cannon' }] }),
      attack('a', 'b', { secondary_kind: 'chain', weapons: [{ ...gun('copy', 'thermal'), name: 'Plasma Cannon' }] })]
    const film = compile([...rows, terminal(1100)])
    expect(film.ships[0].hardware!.weapons).toEqual({ laser: 1, exotic: 1 })
    expect(film.ships[1].hardware!.source).toBe('unknown')
  })
})

describe('completed-record gate', () => {
  it('makes settled records retryable when the summary failed or still reports active', () => {
    for (const header of [null, summary({ status: 'active' })]) {
      const result = { entries: [row(100), terminal(101)], summary: header, summaryError: 'Summary unavailable', full: true }
      const initial = applyBattleLoadResult(initialBattleLoaderState(), result, 100_000)
      const settled = applyBattleLoadResult(initial, result, 140_000)
      expect(settled.phase).toBe('complete')
      expect(shouldPollBattle(settled)).toBe(false)
      expect(getCinemaEligibility(settled.summary, settled.entries, settled.phase)).toBe('unavailable')
    }
  })
  it('rejects aggregate-only historical records without inventing visible actors', () => {
    const entries = [terminal(101, { snapshots: [] })]
    expect(getCinemaEligibility(summary(), entries, 'complete')).toBe('unavailable')
    expect(() => compile(entries)).toThrow('complete, reconciled')
  })
  it('excludes positively identified creatures without treating NPCs or missing classes as creatures', () => {
    expect(getCinemaEligibility(summary({ category: 'wildlife' }), [row(100), terminal(101)], 'complete')).toBe('unsupported')
    expect(getCinemaEligibility(summary(), [row(100, { snapshots: [snap('a'), snap('b', 2, { kind: 'creature' })] }), terminal(101)], 'complete')).toBe('unsupported')
    expect(getCinemaEligibility(summary(), [row(100, { snapshots: [snap('a'), snap('b', 2, { kind: 'station', ship_class: '' })] }), terminal(101)], 'complete')).toBe('ready')
  })
  it('rejects empty encounters and mutual retreat but keeps one-sided ambushes and single escapes', () => {
    const end = terminal(102, { snapshots: [] })
    Object.assign(end.battle_ended!, { total_damage: 0, ships_destroyed: 0, outcome: 'stalemate' })
    const escape = (id: string) => ({ player_id: id, escaped: true, flee_counter: 3, flee_required: 3 })
    const emptySummary = summary({ total_damage: 0 })
    expect(getCinemaEligibility(emptySummary, [row(100), end], 'complete')).toBe('uneventful')
    expect(getCinemaEligibility(emptySummary, [row(100, { attacks: [attack('a', 'b', { hit_success: false, final_damage: 0, shield_damage: 0, weapons: [gun('miss', 'energy', false)] })] }), end], 'complete')).toBe('uneventful')
    const firing = row(100, { attacks: [attack('a', 'b')] })
    expect(getCinemaEligibility(emptySummary, [firing, row(101, { flee: [escape('a'), escape('b')] }), end], 'complete')).toBe('retreated')
    expect(getCinemaEligibility(emptySummary, [firing, row(101, { flee: [escape('b')] }), end], 'complete')).toBe('ready')
    expect(getCinemaEligibility(emptySummary, [row(100, { kills: [kill('a', 'b')] }), end], 'complete')).toBe('ready')
    expect(getCinemaEligibility(emptySummary, [firing, row(101, { flee: [escape('a'), escape('b')] }), terminal(102)], 'complete')).toBe('ready')
  })
  it('requires reconciled data, terminal row and completed summary independently', () => {
    const entries = [row(100), terminal(101)]
    expect(getCinemaEligibility(summary(), entries, 'complete')).toBe('ready')
    expect(getCinemaEligibility(summary(), entries, 'finalizing')).toBe('finalizing')
    expect(getCinemaEligibility(summary({ status: 'active' }), entries, 'complete')).toBe('unavailable')
    expect(getCinemaEligibility(summary(), [row(100)], 'complete')).toBe('finalizing')
    expect(getCinemaEligibility(summary(), entries, 'unavailable')).toBe('unavailable')
    expect(getCinemaEligibility(null, entries, 'complete')).toBe('unavailable')
    expect(() => compileBattleFilm(summary(), entries)).toThrow('reconciled')
  })
  it('rejects interrupted, mismatched and trailing records', () => {
    const interrupted = terminal(101)
    interrupted.battle_ended!.outcome = 'interrupted'
    expect(getCinemaEligibility(summary(), [row(100), interrupted], 'complete')).toBe('interrupted')
    expect(() => compile([row(100, { battle_id: 'other' }), terminal(101)])).toThrow()
    expect(() => compile([terminal(100), row(101)])).toThrow('terminal')
  })
})

describe('deterministic edit', () => {
  it('compresses a 4,430-tick repetitive exchange and preserves chronological source mapping', () => {
    const entries = Array.from({ length: 4430 }, (_, i) => row(100 + i, { attacks: [attack('a', 'b')] }))
    entries.push(terminal(4530))
    const first = compile(entries)
    const second = compile(entries)
    expect(first).toEqual(second)
    expect(first.duration).toBeGreaterThan(0)
    expect(first.duration).toBeLessThanOrEqual(180)
    expect(first.cues.length).toBeLessThan(entries.length)
    expect(first.ships).toHaveLength(2)
    expect(first.segments.every((segment, i) => i === 0 || segment.start >= first.segments[i - 1].end - 0.000001)).toBe(true)
    expect(sourceTickAt(first, 0)).toBe(100)
    expect(sourceTickAt(first, first.duration)).toBe(4530)
    expect(first.shots[0].kind).toBe('reveal')
    expect(first.shots.at(-1)?.kind).toBe('aftermath')
    for (let t = 0; t < first.duration; t += 0.25) {
      const shot = sampleCinemaShot(first, t)
      expect(shot.start).toBeLessThanOrEqual(t)
      expect(shot.end).toBeGreaterThan(t)
    }
  })
  it('keeps 500 simultaneous actors and all consequential events without extending the runtime', () => {
    const snapshots = Array.from({ length: 500 }, (_, i) => snap(`p${i}`, i % 2 + 1))
    const kills = Array.from({ length: 250 }, (_, i) => kill(`p${i * 2}`, `p${i * 2 + 1}`))
    const entries = [row(100, { snapshots }), row(101, { snapshots, kills,
      attacks: kills.map(event => attack(event.killer_id, event.victim_id, { hull_damage: 100, shield_damage: 0 })) }),
      terminal(102, { snapshots: snapshots.filter((_, i) => i % 2 === 0) })]
    const film = compile(entries)
    expect(film.ships).toHaveLength(500)
    expect(film.cues.filter(cue => cue.kind === 'death')).toHaveLength(250)
    expect(film.duration).toBeLessThanOrEqual(180)
    expect(new Set(film.ships.map(ship => ship.id)).size).toBe(500)
    expect(film.cues.every(cue => Number.isFinite(cue.time) && Number.isFinite(cue.duration))).toBe(true)
  })
})

describe('recorded outcomes and lifecycle identities', () => {
  it('creates a new appearance when a pilot returns after destruction and after escape', () => {
    const film = compile([row(100, { kills: [kill('a', 'b')] }), row(101, { snapshots: [snap('a')] }),
      row(102, { joins: [{ player_id: 'b', username: 'Returned', side_id: 2 }], flee: [{ player_id: 'b', escaped: true, flee_counter: 3, flee_required: 3 }] }),
      row(103, { snapshots: [snap('a')] }), terminal(104)])
    const ships = film.ships.filter(ship => ship.playerId === 'b')
    expect(ships.map(ship => ship.fate)).toEqual(['destroyed', 'escaped', 'survived'])
    expect(ships[0].end).toBeLessThan(ships[1].start)
    expect(ships[1].end).toBeLessThan(ships[2].start)
    expect(film.cues.filter(cue => cue.kind === 'arrival')).toHaveLength(2)
  })
  it('keeps arena knockouts intact and never emits destruction', () => {
    const film = compile([row(100, { attacks: [attack('a', 'b')], kills: [kill('a', 'b')], arena: true }),
      terminal(101, { snapshots: [snap('a')] })])
    expect(film.arena).toBe(true)
    expect(film.cues.filter(cue => cue.kind === 'death')).toHaveLength(0)
    expect(film.cues.filter(cue => cue.kind === 'knockout')).toHaveLength(1)
    expect(film.ships.find(ship => ship.playerId === 'b')?.fate).toBe('knocked_out')
  })
  it('uses boarding actor identity for a captured prize and deduplicates the final aggregate', () => {
    const capture = { boarding_operation_id: 'op1', captor_id: 'a', captor_username: 'a', former_owner_id: 'owner',
      former_owner_username: 'owner', ship_id: 'ship1', ship_class: 'vanguard' }
    const end = terminal(102, { snapshots: [snap('a')] })
    end.battle_ended!.captures = [capture]
    const film = compile([row(100, { snapshots: [snap('a'), snap('prize:p1', 2, { kind: 'prize' })],
      boarding: [{ operation_id: 'op1', phase: 'boarding', target_id: 'prize:p1', event: 'started' }] }),
      row(101, { snapshots: [snap('a'), snap('prize:p1', 2, { kind: 'prize' })], captures: [capture] }), end])
    const captured = film.ships.find(ship => ship.playerId === 'prize:p1')!
    expect(captured.fate).toBe('captured')
    expect(captured.capturedBy).toBe('a')
    expect(captured.capturedShipId).toBe('ship1')
    expect(film.cues.filter(cue => cue.kind === 'capture')).toHaveLength(1)
    expect(film.cues.filter(cue => cue.kind === 'death')).toHaveLength(0)
    expect(film.ships.some(ship => ship.playerId === 'owner')).toBe(false)
  })
  it('retains both killer references for simultaneous mutual destruction', () => {
    const end = terminal(101, { snapshots: [] })
    end.battle_ended!.outcome = 'mutual_destruction'
    const film = compile([row(100, { kills: [kill('a', 'b'), kill('b', 'a')] }), end])
    const deaths = film.cues.filter(cue => cue.kind === 'death')
    expect(deaths.map(cue => cue.from).sort()).toEqual(['a:0', 'b:0'])
    expect(film.outcome).toBe('mutual_destruction')
  })
})

describe('weapon semantics and seeking', () => {
  it('keeps different drain beneficiaries and confirmed transfers distinct within one tick', () => {
    const film = compile([row(100, { snapshots: [snap('a'), snap('b', 2), snap('c')], attacks: [
      attack('a', 'b', { shield_drained: 10, shield_transferred: 0 }),
      attack('c', 'b', { shield_drained: 10, shield_transferred: 5 }),
      attack('a', 'b', { shield_drained: 10, shield_transferred: 4 }),
    ] }), terminal(101)])
    expect(film.cues.filter(cue => cue.kind === 'drain').map(cue => [cue.from, cue.drainTransferred]))
      .toEqual([['a:0', false], ['c:0', true], ['a:0', true]])
  })
  it('does not treat uncapped calculated lifesteal as a realized hull gain', () => {
    const component = { weapon_instance_id: 'gun', weapon_name: 'Life Siphon', damage_type: 'energy',
      incoming_damage: 20, shield_resist_pct: 0, after_shield_resist: 20, type_resist_pct: 0,
      after_type_resist: 20, flat_reduction_pct: 0, after_flat_reduction: 20, shield_bypass_pct: 0,
      armor_bypass_pct: 0, ignore_all_defense: false, final_damage: 20, shield_damage: 0, hull_damage: 20,
      lifesteal_pct: 50, lifesteal_heal: 10 }
    const film = compile([row(100, { attacks: [attack('a', 'b', { defense_components: [component] })] }), terminal(101)])
    expect(film.ships.find(ship => ship.playerId === 'a')?.health.every(frame => frame.hull === 1)).toBe(true)
    expect(film.cues.some(cue => cue.kind === 'drain' && cue.drainKind === 'hull')).toBe(false)
    expect(film.cues.some(cue => cue.kind === 'weapon')).toBe(true)
  })
  it('returns drained shield energy only when an actual transfer is recorded', () => {
    for (const transferred of [0, 5]) {
      const film = compile([row(100, { attacks: [attack('a', 'b', { shield_drained: 8,
        shield_transfer_pct: 100, shield_transferred: transferred })] }), terminal(101)])
      expect(film.cues.find(cue => cue.kind === 'drain')?.drainTransferred).toBe(transferred > 0)
    }
  })
  it('rotates oversized loadouts so the same first six families do not hide the rest forever', () => {
    const names = ['Laser I', 'Graviton Beam I', 'Railgun I', 'Autocannon I', 'Flak Cannon I', 'Plasma Cannon I',
      'Missile Launcher I', 'Torpedo Launcher I', 'EMP Cannon I', 'Dark Matter Cannon', 'Mine Launcher I', 'Harpoon I', 'Smartbomb I']
    const weapons = names.map((name, i) => ({ ...gun(`gun${i}`, 'kinetic'), name }))
    const entries = Array.from({ length: 13 }, (_, i) => row(100 + i, { attacks: [attack('a', 'b', { weapons })] }))
    const film = compile([...entries, terminal(113)])
    const cues = film.cues.filter(cue => cue.kind === 'weapon')
    expect(new Set(cues.map(cue => cue.weaponFamily)).size).toBe(13)
    for (const entry of entries) expect(cues.filter(cue => cue.tick === entry.tick).length).toBeLessThanOrEqual(6)
  })
  it('keeps distinct delivery families with the same damage type before filling mixed hit variants', () => {
    const names = ['Railgun I', 'Autocannon I', 'Flak Cannon I', 'Graviton Beam I']
    const weapons = names.flatMap((name, index) => [true, false].map(hit => ({ ...gun(`${index}:${hit}`, 'kinetic', hit),
      name, ammo_used: 'Standard Rounds', crit_fired: hit })))
    const film = compile([row(100, { attacks: [attack('a', 'b', { weapons, damage_type: 'kinetic' })] }), terminal(101)])
    const cues = film.cues.filter(cue => cue.kind === 'weapon')
    expect(new Set(cues.map(cue => cue.weaponFamily))).toEqual(new Set(['railgun', 'autocannon', 'flak', 'beam']))
    expect(cues.length).toBeLessThanOrEqual(6)
    expect(cues.some(cue => cue.hit === false)).toBe(true)
    expect(cues.every(cue => cue.ammoName === 'Standard Rounds')).toBe(true)
    expect(cues.some(cue => cue.critical)).toBe(true)
  })
  it('emits only observed repairs, drains, disables and emergency cloaks', () => {
    const effects = attack('a', 'b', { system_disable_ticks: 2, emergency_cloak_activated: true, shield_drained: 8 })
    const film = compile([row(100, { attacks: [effects], regen: [{ player_id: 'a', shield_regen: 10, armor_repair: 5,
      shield_before: 50, shield_after: 60, hull_before: 50, hull_after: 55 }] }), terminal(101)])
    expect(film.cues.filter(cue => cue.kind === 'disable').map(cue => cue.to)).toEqual(['b:0'])
    expect(film.cues.filter(cue => cue.kind === 'cloak').map(cue => cue.to)).toEqual(['b:0'])
    expect(film.cues.filter(cue => cue.kind === 'drain').map(cue => cue.from)).toEqual(['a:0'])
    expect(film.cues.filter(cue => cue.kind === 'repair').map(cue => cue.repairKind).sort()).toEqual(['hull', 'shield'])
    expect(film.cues.filter(cue => cue.kind === 'repair').every(cue => !cue.from)).toBe(true)
    const inert = compile([row(100, { attacks: [attack('a', 'b', { lifesteal_pct: 50, emergency_cloak_duration: 3,
      shield_drain_requested: 80 })], regen: [{ player_id: 'a', shield_regen: 10, armor_repair: 5,
      shield_before: 100, shield_after: 100, hull_before: 100, hull_after: 100 }] }), terminal(101)])
    expect(inert.cues.some(cue => ['repair', 'disable', 'cloak', 'drain'].includes(cue.kind))).toBe(false)
  })
  it('misses never emit penetrating impacts and mixed weapon families stay distinct', () => {
    const film = compile([row(100, { attacks: [attack('a', 'b', { weapons: [gun('beam', 'energy'), gun('slug', 'kinetic', false)],
      hull_damage: 10, shield_damage: 10 })] }), terminal(101)])
    const weapons = film.cues.filter(cue => cue.kind === 'weapon')
    expect(weapons.map(cue => cue.damageType)).toEqual(['energy', 'kinetic'])
    const miss = weapons.find(cue => cue.damageType === 'kinetic')!
    expect(miss.hit).toBe(false)
    expect(miss.hullDamage).toBe(0)
    expect(miss.shieldDamage).toBe(0)
  })
  it('links collateral to its source volley without inventing another primary attack', () => {
    const film = compile([row(100, { snapshots: [snap('a'), snap('b', 2), snap('c', 2)],
      attacks: [attack('a', 'b'), attack('a', 'c', { secondary_kind: 'chain' })] }), terminal(101)])
    const cues = film.cues.filter(cue => cue.kind === 'weapon')
    expect(cues).toHaveLength(2)
    expect(cues[1].parentId).toBe(cues[0].id)
    expect(cues[1].time).toBe(cues[0].time)
  })
  it('samples health without damage preceding the recorded impact, independent of seek order', () => {
    const film = compile([row(100, { attacks: [attack('a', 'b', { hull_damage: 25, shield_damage: 20 })] }),
      terminal(101, { snapshots: [snap('a'), snap('b', 2, { hull: 75, shield: 80 })] })])
    const ship = film.ships.find(ship => ship.playerId === 'b')!
    const impact = film.cues.find(cue => cue.kind === 'weapon')!
    expect(sampleCinemaHealth(ship, 0).hull).toBe(1)
    expect(sampleCinemaHealth(ship, impact.time).hull).toBe(1)
    expect(sampleCinemaHealth(ship, impact.time + impact.duration + 0.001).hull).toBe(0.75)
    const late = sampleCinemaHealth(ship, film.duration)
    sampleCinemaHealth(ship, 0)
    expect(sampleCinemaHealth(ship, film.duration)).toEqual(late)
  })
})

describe('editorial pacing', () => {
  it('cuts idle rows while keeping a readable decisive beat in long repetitive exchanges', () => {
    const entries = Array.from({ length: 4000 }, (_, i) => row(100 + i, {
      attacks: i % 2 === 0 ? [attack('a', 'b')] : [],
    }))
    entries[3998].kills = [kill('a', 'b')]
    entries[3999] = terminal(4099, { snapshots: [snap('a')] })
    const film = compile(entries)
    expect(film.segments.filter((_, index) => index % 2 === 1).every(segment => segment.end === segment.start)).toBe(true)
    const decisiveSegment = film.segments[3998]
    expect(decisiveSegment.end - decisiveSegment.start).toBeGreaterThanOrEqual(3.5)
    const volleys = film.cues.filter(cue => cue.kind === 'weapon')
    expect(volleys.length).toBeLessThan(50)
    expect(volleys.every(cue => cue.duration >= 0.08)).toBe(true)
    expect(film.cues.filter(cue => cue.kind === 'death')).toHaveLength(1)
    const death = film.cues.find(cue => cue.kind === 'death')!
    const killingVolley = volleys.find(cue => cue.tick === 4098)!
    expect(killingVolley.time + killingVolley.duration).toBeLessThan(death.time)
  })
  it('gives an observed return a visible arrival even when a historical join row is absent', () => {
    const entries = Array.from({ length: 100 }, (_, i) => row(100 + i, { snapshots: i < 50 && i > 0 ? [snap('a')] : [snap('a'), snap('b', 2)] }))
    entries[0].kills = [kill('a', 'b')]
    entries[99] = terminal(199)
    const film = compile(entries)
    const arrival = film.cues.find(cue => cue.kind === 'arrival')!
    expect(arrival.tick).toBe(150)
    expect(arrival.duration).toBeGreaterThan(0.08)
    expect(film.ships.filter(ship => ship.playerId === 'b')).toHaveLength(2)
  })
})

describe('historical end-state evidence', () => {
  it('counts a recorded station destruction independently of the ships-destroyed aggregate', () => {
    const entries = [row(100, { snapshots: [snap('a'), snap('station', 2, { kind: 'station', ship_class: '' })], kills: [kill('a', 'station')] }),
      terminal(101, { snapshots: [snap('a')] })]
    const film = compile(entries, { ships_destroyed: 0 })
    expect(film.cues.filter(cue => cue.kind === 'death')).toHaveLength(1)
    expect(film.ships.find(ship => ship.playerId === 'station')?.kind).toBe('station')
  })
  it('does not resurrect a destroyed hull from an obsolete zero-hull snapshot or repeated burn', () => {
    const film = compile([row(100, { kills: [kill('a', 'b')] }),
      row(101, { snapshots: [snap('a'), snap('b', 2, { hull: 0 })], burns: [{ target_id: 'b', damage: 5, ticks_remaining: 0, destroyed: true }] }),
      terminal(102, { snapshots: [snap('a')] })])
    expect(film.ships.filter(ship => ship.playerId === 'b')).toHaveLength(1)
    expect(film.cues.filter(cue => cue.kind === 'death')).toHaveLength(1)
  })
})

describe('consequential camera coverage', () => {
  it('holds selected narrative losses through impact and aftermath while retaining all background casualties', () => {
    const snapshots = [snap('a'), snap('b', 2), snap('c', 2), snap('d', 2)]
    const entries = Array.from({ length: 20 }, (_, index) => row(100 + index, {
      snapshots: snapshots.filter(ship => ship.player_id === 'a' ||
        ship.player_id === 'b' && index <= 8 || ship.player_id === 'c' && index <= 9 || ship.player_id === 'd' && index <= 18),
      attacks: index <= 8 ? [attack('a', 'b')] : index <= 9 ? [attack('a', 'c')] : index <= 18 ? [attack('a', 'd')] : [],
      kills: index === 8 ? [kill('a', 'b')] : index === 9 ? [kill('a', 'c')] : index === 18 ? [kill('a', 'd')] : [],
    }))
    entries[19] = terminal(119, { snapshots: [snap('a')] })
    const film = compile(entries)
    expect(film.cues.filter(cue => cue.kind === 'death')).toHaveLength(3)
    for (const sequence of film.story!.sequences.filter(sequence => sequence.consequenceTime !== undefined)) {
      for (const offset of [0, .5, 1]) {
        const shot = sampleCinemaShot(film, sequence.consequenceTime! + offset)
        expect(shot.subject).toBe(sequence.defender)
        expect(shot.sequenceId).toBe(sequence.id)
        expect(shot.kind).toBe('impact')
      }
    }
    expect(film.shots.at(-1)?.kind).toBe('aftermath')
    expect(film.duration).toBeLessThanOrEqual(180)
  })
  it('includes every victim in the framing group for simultaneous losses', () => {
    const film = compile([row(100, { snapshots: [snap('a'), snap('b', 2), snap('c', 2)],
      kills: [kill('a', 'b'), kill('a', 'c')] }), terminal(101, { snapshots: [snap('a')] })])
    const deaths = film.cues.filter(cue => cue.kind === 'death')
    const shot = sampleCinemaShot(film, deaths[0].time)
    const focusIds = (shot as typeof shot & { focusIds?: string[] }).focusIds ?? [shot.subject]
    expect(focusIds).toContain('b:0')
    expect(focusIds).toContain('c:0')
    const held = sampleCinemaShot(film,deaths[0].time+1)
    expect(held.focusIds).toContain('b:0')
    expect(held.focusIds).toContain('c:0')
  })
})

describe('source movement projection', () => {
  it('carries advance and retreat progress while preserving stationary holds', () => {
    const zones = ['outer', 'outer', 'mid', 'mid', 'inner', 'engaged', 'inner']
    const entries = zones.map((zone, index) => row(100 + index, {
      snapshots: [snap('a', 1, { zone }), snap('b', 2)], attacks: [attack('a', 'b')],
      zone_moves: index === 1 ? [{ player_id: 'a', old_zone: 'outer', new_zone: 'mid', reason: 'advance' }] :
        index === 3 ? [{ player_id: 'a', old_zone: 'mid', new_zone: 'inner', reason: 'advance' }] : [],
    }))
    entries[6] = terminal(106, { snapshots: [snap('a', 1, { zone: 'inner' }), snap('b', 2)] })
    const film = compile(entries)
    const motion = film.ships.find(ship => ship.playerId === 'a')!.motion!
    expect(motion.slice(0, 2)).toEqual([{time:0,position:0,stance:'aggressive'},{time:film.segments[1].start,position:0,stance:'aggressive'}])
    expect(motion).toContainEqual({time:film.segments[1].end,position:1 / 3,stance:'aggressive'})
    expect(motion).toContainEqual({time:film.segments[3].end,position:2 / 3,stance:'aggressive'})
    expect(motion).toContainEqual({time:film.segments[5].start,position:1,stance:'aggressive'})
    expect(motion.at(-1)?.position).toBe(2 / 3)
    expect(motion.every((frame, index) => frame.position >= 0 && frame.position <= 1 &&
      (index === 0 || frame.time > motion[index - 1].time))).toBe(true)
  })
  it('keeps a long stationary record compact and gives returning hulls independent motion', () => {
    const entries = Array.from({length:1000}, (_, index) => row(100 + index, {
      snapshots: [snap('a', 1, { zone: 'outer' }), ...(index < 2 || index >= 998 ? [snap('b', 2, { zone: index >= 998 ? 'mid' : 'engaged' })] : [])],
      kills: index === 1 ? [kill('a', 'b')] : [],
    }))
    entries[999] = terminal(1099, { snapshots: [snap('a', 1, { zone:'outer' }), snap('b', 2, {zone:'mid'})] })
    const film = compile(entries)
    expect(film.ships.find(ship => ship.playerId === 'a')!.motion!.length).toBeLessThanOrEqual(2)
    const appearances = film.ships.filter(ship => ship.playerId === 'b')
    expect(appearances[0].motion![0].position).toBe(1)
    expect(appearances[1].motion![0]).toEqual({time:appearances[1].start,position:1 / 3,stance:'aggressive'})
  })
})

describe('authored narrative sequences', () => {
  it('establishes recurring rivals and keeps setup, causal fire, and consequence in one sequence', () => {
    const entries = Array.from({length:36}, (_, index) => row(100 + index, {
      snapshots: [snap('a'), ...(index <= 20 ? [snap('b',2)] : []), snap('c',2)],
      attacks: [attack('a',index <= 20 ? 'b' : 'c')],
      kills: index === 20 ? [kill('a','b')] : index === 34 ? [kill('a','c')] : [],
    }))
    entries[35] = terminal(135, {snapshots:[snap('a')]})
    const film = compile(entries)
    expect(film.story?.protagonistId).toBe('a:0')
    expect(film.story?.adversaryId).toBe('b:0')
    expect(film.shots[0]).toMatchObject({start:0,end:2.5,role:'geography',battlefield:true})
    expect(film.shots.find(shot=>shot.role==='fire')!.start).toBeLessThan(3)
    expect(film.story!.sequences.length).toBeGreaterThanOrEqual(3)
    expect(film.story!.sequences.length).toBeLessThanOrEqual(26)
    for (const sequence of film.story!.sequences) {
      const shots=film.shots.filter(shot=>shot.sequenceId===sequence.id)
      expect(shots.length).toBeGreaterThanOrEqual(2)
      expect(shots.every(shot=>JSON.stringify(shot.axis)===JSON.stringify(sequence.axis))).toBe(true)
      if (!sequence.causeCueId) continue
      const cause=film.cues.find(cue=>cue.id===sequence.causeCueId)!
      expect(cause.kind).toBe('weapon')
      expect(cause.from).toBe(sequence.attacker)
      expect(cause.to).toBe(sequence.defender)
      const firing=shots.find(shot=>shot.role==='fire')!
      expect(firing.subject).toBe(sequence.attacker)
      expect(firing.start).toBeLessThanOrEqual(cause.time)
      expect(firing.end).toBeGreaterThan(cause.time)
      const impact=sampleCinemaShot(film,cause.time+cause.duration)
      expect(impact.subject).toBe(sequence.defender)
      expect(['impact','reaction']).toContain(impact.role!)
    }
    expect(film.shots.every(shot=>shot.sequenceId && shot.role)).toBe(true)
  })
  it('keeps a canonical axis when the recurring rivals exchange attacker and defender roles', () => {
    const entries=Array.from({length:40},(_,index)=>row(100+index,{attacks:[index%2?attack('b','a'):attack('a','b')]}))
    entries[39]=terminal(139)
    const film=compile(entries)
    const axes=film.story!.sequences.map(sequence=>sequence.axis).filter(Boolean)
    expect(axes.length).toBeGreaterThanOrEqual(3)
    expect(new Set(axes.map(axis=>JSON.stringify(axis))).size).toBe(1)
    expect(axes.every(axis=>axis!.side===1)).toBe(true)
  })
  it('lets a dramatically involved protagonist lose, then resolves on actual survivors', () => {
    const entries=Array.from({length:30},(_,index)=>row(100+index,{
      snapshots:[snap('a'),...(index<=10?[snap('b',2)]:[]),snap('c',2)],
      attacks:index===28?[attack('c','a')]:[attack('a',index<=10?'b':'c')],
      kills:index===10?[kill('a','b')]:index===28?[kill('c','a')]:[],
    }))
    const end=terminal(129,{snapshots:[snap('c',2)]})
    end.battle_ended!.winning_side=2
    end.battle_ended!.participants=[{player_id:'c',username:'c',side_id:2,damage_dealt:20,damage_taken:0,kill_count:1,survived:true}]
    entries[29]=end
    const film=compile(entries,{winning_side:2})
    expect(film.story?.protagonistId).toBe('a:0')
    const climax=film.story!.sequences.at(-1)!
    expect(climax.kind).toBe('climax')
    expect(climax.defender).toBe('a:0')
    const event=film.cues.find(cue=>cue.id===climax.eventCueId)!
    const cause=film.cues.find(cue=>cue.id===climax.causeCueId)!
    expect(cause.from).toBe('c:0')
    expect(cause.to).toBe('a:0')
    expect(cause.time+cause.duration).toBeLessThanOrEqual(event.time)
    expect(climax.end).toBeGreaterThanOrEqual(event.time+1)
    const resolution=film.shots.at(-1)!
    expect(resolution.role).toBe('resolution')
    expect(resolution.subject).toBe('c:0')
    expect(resolution.target).toBe('a:0')
  })
})

it('keeps selected causes and every dependent state together without moving events out of chronology', () => {
  const snapshots = [snap('a'),snap('b',2),snap('c',2)]
  const entries=Array.from({length:200},(_,index)=>row(100+index,{
    snapshots:snapshots.filter(ship=>ship.player_id!=='b'||index<=70),
    attacks:[attack('a',index<=70?'b':'c')],
    kills:index===70?[kill('a','b')]:index===198?[kill('a','c')]:[],
  }))
  entries[199]=terminal(299,{snapshots:[snap('a')]})
  const original=JSON.stringify(entries)
  const film=compile(entries)
  expect(JSON.stringify(entries)).toBe(original)
  for(const sequence of film.story!.sequences){
    if(!sequence.causeCueId)continue
    const cause=film.cues.find(cue=>cue.id===sequence.causeCueId)!
    expect(cause.duration).toBeGreaterThanOrEqual(1)
    expect(cause.duration).toBeLessThanOrEqual(2.81)
    expect(sequence.impactTime).toBeCloseTo(cause.time+cause.duration,8)
    if(sequence.consequenceTime!==undefined){
      expect(sequence.consequenceTime).toBeGreaterThanOrEqual(sequence.impactTime)
      expect(sequence.end-sequence.consequenceTime).toBeGreaterThanOrEqual(1.49)
      const victim=film.ships.find(ship=>ship.id===sequence.defender)!
      expect(victim.end).toBeCloseTo(sequence.consequenceTime,8)
    }
  }
  expect(film.cues.every((cue,index)=>cue.duration>0 && (index===0||cue.time>=film.cues[index-1].time))).toBe(true)
  expect(film.segments.every((segment,index)=>segment.end>=segment.start && (index===0||segment.start>=film.segments[index-1].end))).toBe(true)
  expect(film.ships.every(ship=>ship.health.every((frame,index)=>index===0||frame.time>=ship.health[index-1].time))).toBe(true)
  expect(film.shots.every((shot,index)=>shot.end>shot.start && (index===0||Math.abs(shot.start-film.shots[index-1].end)<.00001))).toBe(true)
  expect(film.shots.at(-1)!.end).toBe(film.duration)
})

it('never presents a missed gun or an earlier unrelated volley as the decisive cause', () => {
  const mixed=compile([row(100,{attacks:[attack('a','b',{weapons:[gun('hit','energy'),gun('miss','kinetic',false)],hull_damage:100})],kills:[kill('a','b')]}),terminal(101,{snapshots:[snap('a')]})])
  const mixedClimax=mixed.story!.sequences.at(-1)!
  expect(mixed.cues.find(cue=>cue.id===mixedClimax.causeCueId)?.hit).toBe(true)
  const delayed=compile([row(100,{attacks:[attack('a','b')]}),row(101,{burns:[{source_id:'a',target_id:'b',damage:100,ticks_remaining:0,destroyed:true}]}),terminal(102,{snapshots:[snap('a')]})])
  expect(delayed.story!.sequences.at(-1)?.causeCueId).toBeUndefined()
})

it('never frames a future arrival in a setup, closeup, or engagement axis', () => {
  const entries=Array.from({length:36},(_,index)=>row(100+index,{
    snapshots:[snap('a'),snap('c',2),...(index>=18&&index<=24?[snap('late',2)]:[])],
    joins:index===18?[{player_id:'late',username:'Late arrival',side_id:2}]:[],
    attacks:index<18?[]:[attack('a',index<=24?'late':'c')],
    kills:index===24?[kill('a','late')]:index===34?[kill('a','c')]:[],
  }))
  entries[35]=terminal(135,{snapshots:[snap('a')]})
  const film=compile(entries)
  for(const shot of film.shots){
    for(const id of [shot.subject,shot.target,shot.axis?.from,shot.axis?.to].filter(Boolean)){
      expect(film.ships.find(ship=>ship.id===id)!.start).toBeLessThanOrEqual(shot.start+.000001)
    }
  }
  for(const sequence of film.story!.sequences){
    for(const id of [sequence.attacker,sequence.defender].filter(Boolean)){
      expect(film.ships.find(ship=>ship.id===id)!.start).toBeLessThanOrEqual(sequence.start+.000001)
    }
  }
  expect(film.cues.filter(cue=>cue.kind==='arrival').length).toBeGreaterThan(0)
})

it('does not invent an opening participant when the first recorded row is empty', () => {
  const film=compile([row(100,{snapshots:[]}),row(101,{joins:[{player_id:'a',username:'a',side_id:1},{player_id:'b',username:'b',side_id:2}],attacks:[attack('a','b')]}),terminal(102)])
  for(const shot of film.shots.filter(shot=>shot.start<film.ships[0].start)){
    expect(shot.subject).toBeUndefined()
    expect(shot.target).toBeUndefined()
    expect(shot.axis).toBeUndefined()
  }
})

it('shows the muzzle release before cutting early enough to recognize the victim ahead of impact', () => {
  const entries=Array.from({length:42},(_,index)=>row(100+index,{attacks:[attack('a','b')]}))
  entries[40].kills=[kill('a','b')]
  entries[41]=terminal(141,{snapshots:[snap('a')]})
  const film=compile(entries)
  for(const sequence of film.story!.sequences){
    if(!sequence.causeCueId)continue
    const cause=film.cues.find(cue=>cue.id===sequence.causeCueId)!
    const fire=film.shots.find(shot=>shot.sequenceId===sequence.id && shot.role==='fire')!
    const impact=film.shots.find(shot=>shot.sequenceId===sequence.id && shot.role==='impact')!
    const anticipation=sequence.impactTime-impact.start
    expect(fire.start).toBeLessThanOrEqual(cause.time)
    expect(fire.end-cause.time).toBeGreaterThanOrEqual(.5-.000001)
    expect(anticipation).toBeLessThanOrEqual(cause.duration*.55+.000001)
    expect(anticipation).toBeLessThanOrEqual(1.200001)
    if(cause.duration>=1.4)expect(anticipation).toBeGreaterThanOrEqual(.7)
    expect(impact.subject).toBe(sequence.defender)
  }
})

it('follows the live escaping actor instead of a protagonist destroyed in an earlier sequence', () => {
  const entries=Array.from({length:8},(_,index)=>row(100+index,{
    snapshots:index<=3?[snap('a'),snap('b',2)]:index<7?[snap('b',2)]:[],
    attacks:index<3?[attack('a','b'),attack('a','b')]:index===3?[attack('b','a')]:[],
    kills:index===3?[kill('b','a')]:[],
    flee:index===6?[{player_id:'b',escaped:true,flee_counter:3,flee_required:3}]:[],
  }))
  const end=terminal(107,{snapshots:[]})
  end.battle_ended!.outcome='stalemate';end.battle_ended!.winning_side=0
  entries[7]=end
  const film=compile(entries,{outcome:'stalemate',winning_side:0})
  const escaping=film.story!.sequences.find(sequence=>film.cues.find(cue=>cue.id===sequence.eventCueId)?.kind==='escape')!
  const setup=film.shots.find(shot=>shot.sequenceId===escaping.id&&shot.role==='setup')!
  expect(setup.subject).toBe('b:0')
  expect(setup.target).toBeUndefined()
  expect(film.ships.find(ship=>ship.id===setup.subject)!.end).toBeGreaterThan(setup.start)
})

it('preserves recorded stance transitions independently of zone progress through the edit', () => {
  const film = compile([
    row(100, { snapshots: [snap('a', 1, { zone: 'inner', stance: 'fire' }), snap('b', 2)], attacks: [attack('a','b')] }),
    row(101, { snapshots: [snap('a', 1, { zone: 'inner', stance: 'retreat' }), snap('b', 2)], attacks: [attack('a','b')], zone_moves: [{player_id:'a',old_zone:'inner',new_zone:'mid',reason:'retreat'}] }),
    row(102, { snapshots: [snap('a', 1, { zone: 'mid', stance: 'retreat' }), snap('b', 2)], attacks: [attack('a','b')], commands: [{player_id:'a',command:'set_combat_stance',stance:'flee'}] }),
    terminal(103, { snapshots: [snap('a', 1, {zone:'mid',stance:'flee'}),snap('b',2)] }),
  ])
  const frames = film.ships.find(ship => ship.playerId === 'a')!.motion!
  expect(frames.map(frame => frame.stance)).toContain('fire')
  expect(frames.map(frame => frame.stance)).toContain('retreat')
  expect(frames.map(frame => frame.stance)).toContain('flee')
  expect(frames.some(frame => frame.position === 1/3 && frame.stance === 'retreat')).toBe(true)
  expect(frames.every((frame,index) => !index || frame.time > frames[index-1].time)).toBe(true)
})

describe('collateral consequence direction', () => {
  const cascade = (primaryHit = true, collateralHit = true, killer = 'a') => compile([
    row(100, { snapshots: [snap('a'), snap('b', 2), snap('c', 2), snap('other')], attacks: [
      attack('a', 'b', { weapons: [gun('null', 'void', primaryHit)], hit_success: primaryHit }),
      attack('a', 'c', { weapons: [], secondary_kind: 'aoe', hit_success: collateralHit, hull_damage: collateralHit ? 100 : 0 }),
    ], kills: [kill(killer, 'c')] }),
    terminal(101, { snapshots: [snap('a'), snap('b', 2), snap('other')] }),
  ], { category: 'arena' })

  it('follows an area knockout back to its real primary target and holds the subsequent reaction', () => {
    const film = cascade()
    const sequence = film.story!.sequences.at(-1)!
    const cause = film.cues.find(cue => cue.id === sequence.causeCueId)
    expect(cause).toBeDefined()
    expect(cause!.to).toBe('b:0')
    expect(cause!.from).toBe('a:0')
    expect(cause!.parentId).toBeUndefined()
    expect(sequence.defender).toBe('c:0')
    const event = film.cues.find(cue => cue.id === sequence.eventCueId)!
    expect(event.kind).toBe('knockout')
    expect(event.to).toBe('c:0')
    expect(event.time - (cause!.time + cause!.duration)).toBeCloseTo(.4)
    const fire = film.shots.find(shot => shot.sequenceId === sequence.id && shot.role === 'fire')!
    expect(fire.subject).toBe('a:0')
    expect(fire.target).toBe('b:0')
    const impact = sampleCinemaShot(film, cause!.time + cause!.duration)
    expect(impact.subject).toBe('b:0')
    const reaction = sampleCinemaShot(film, event.time + .1)
    expect(reaction.subject).toBe('c:0')
    expect(reaction.focusIds).toContain('c:0')
    expect(film.ships.find(ship => ship.id === 'c:0')!.end).toBe(event.time)
    expect(film.cues.every((cue, index) => cue.duration > 0 && (!index || cue.time >= film.cues[index - 1].time))).toBe(true)
  })

  it('does not fabricate a parent cause for missed collateral, a missed primary, or a different killer', () => {
    for (const film of [cascade(false, true), cascade(true, false), cascade(true, true, 'other')]) {
      expect(film.story!.sequences.at(-1)!.causeCueId).toBeUndefined()
    }
  })

  it('preserves recorded chain recipient order across two-digit cue identifiers', () => {
    const targets = Array.from({ length: 12 }, (_, index) => `chain:${index + 1}`)
    const film = compile([row(100, {
      snapshots: [snap('a'), snap('b', 2), ...targets.map(id => snap(id, 2))],
      attacks: [attack('a', 'b'), ...targets.map(id => attack('a', id, { weapons: [], secondary_kind: 'chain' }))],
      kills: targets.map(id => kill('a', id)),
    }), terminal(101, { snapshots: [snap('a'), snap('b', 2)] })])
    expect(film.cues.filter(cue => cue.parentId && cue.secondaryKind === 'chain').map(cue => cue.to))
      .toEqual(targets.map(id => `${id}:0`))
  })
})

describe('action-driven edit pacing', () => {
  it('does not stretch a brief exchange into a minute-long film', () => {
    const film=compile([
      row(100,{attacks:[attack('a','b')]}),
      terminal(101,{attacks:[attack('a','b',{hull_damage:100})],kills:[kill('a','b')]}),
    ])
    expect(film.duration).toBeLessThanOrEqual(16)
    expect(film.cues.find(cue=>cue.kind==='weapon')!.time).toBeLessThanOrEqual(3)
    expect(film.duration-Math.max(...film.cues.map(cue=>cue.time+cue.duration))).toBeLessThanOrEqual(3)
  })
  it('does not add screen time for idle cooldown rows between the same actions', () => {
    const first=row(100,{attacks:[attack('a','b')]}),last=terminal(200,{attacks:[attack('a','b')],kills:[kill('a','b')]})
    const sparse=compile([first,last])
    const withIdle=compile([first,...Array.from({length:99},(_,i)=>row(101+i)),last])
    expect(withIdle.duration).toBe(sparse.duration)
    expect(withIdle.segments.slice(1,-1).every(segment=>segment.end===segment.start)).toBe(true)
    const action=withIdle.cues.filter(cue=>cue.kind==='weapon').sort((a,b)=>a.time-b.time)
    expect(action).toHaveLength(2)
    expect(action[1].time-(action[0].time+action[0].duration)).toBeLessThanOrEqual(2)
  })
})

it('keeps same-beat repair frames before the recorded death and leaves the complete loss effect visible', () => {
  const film=compile([row(100,{attacks:[attack('a','b',{hull_damage:100})],kills:[kill('a','b')],
    regen:[{player_id:'b',hull_before:0,hull_after:10,shield_before:0,shield_after:0}]}),terminal(101,{snapshots:[snap('a')]})])
  const victim=film.ships.find(ship=>ship.playerId==='b')!
  expect(victim.health.every((frame,index)=>!index||frame.time>=victim.health[index-1].time)).toBe(true)
  expect(sampleCinemaHealth(victim,victim.end+.01).hull).toBe(0)
  for(const cue of film.cues.filter(cue=>['death','knockout','escape','capture'].includes(cue.kind))) {
    expect(cue.time+cue.duration).toBeLessThanOrEqual(film.duration)
  }
})

it('retains causal volleys inside tiny outcome beats when a very dense battle reaches the runtime cap', () => {
  const weapons=['energy','kinetic','thermal','em','void','explosive'].map((type,index)=>gun(String(index),type))
  const rows=Array.from({length:1200},(_,index)=>row(100+index,{
    snapshots:[snap('a'),snap('anchor',2),snap('victim:'+index,2)],
    attacks:index%2 ? [attack('a','anchor',{weapons}),attack('a','victim:'+index,{weapons:[],secondary_kind:'aoe',hull_damage:100})] :
      [attack('a','victim:'+index,{weapons,hull_damage:100})],
    kills:[kill('a','victim:'+index)],
  }))
  const film=compile([...rows,terminal(1300,{snapshots:[snap('a'),snap('anchor',2)]})])
  expect(film.duration).toBeLessThanOrEqual(180.000001)
  expect(film.cues.filter(cue=>cue.kind==='death')).toHaveLength(1200)
  const weaponsByTick=new Map<number,typeof film.cues>()
  for(const cue of film.cues.filter(cue=>cue.kind==='weapon')) {
    const existing=weaponsByTick.get(cue.tick)??[]
    existing.push(cue);weaponsByTick.set(cue.tick,existing)
  }
  for(const death of film.cues.filter(cue=>cue.kind==='death')) {
    const volley=weaponsByTick.get(death.tick)??[]
    expect(volley.length).toBeGreaterThan(0)
    expect(volley.some(cue=>cue.to===death.to)).toBe(true)
    for(const cue of volley) {
      expect(cue.duration).toBeGreaterThan(0)
      expect(cue.time+cue.duration).toBeLessThanOrEqual(death.time)
      if(cue.parentId) expect(volley.some(parent=>parent.id===cue.parentId)).toBe(true)
    }
  }
  for(const [index,shot] of film.shots.entries()) {
    expect(shot.end).toBeGreaterThan(shot.start)
    if(index) expect(shot.start).toBeCloseTo(film.shots[index-1].end,8)
  }
})

describe('observable boarding cinema',()=>{
  const board=(event:string,phase:string)=>({operation_id:'boarding-one',actor_id:'a',target_id:'b',event,phase})
  it('recognizes a recorded pirate plunder even without hull damage or capture',()=>{
    const entries=[row(100,{boarding:[board('closing_started','latching')]}),row(101,{boarding:[board('latched','assault')]}),terminal(102,{boarding:[board('plundered','resolved')],battle_ended:{...terminal(102).battle_ended!,total_damage:0}})]
    expect(getCinemaEligibility(summary({total_damage:0}),entries,'complete')).toBe('ready')
  })
  it('gives approach, attachment, assault and plunder visible time without inventing a capture',()=>{
    const entries=[row(100,{boarding:[board('closing_started','latching')]}),row(101,{boarding:[board('latched','assault')]}),row(102,{boarding:[{...board('assault_continues','assault'),casualties_occurred:true}]}),terminal(103,{boarding:[board('plundered','resolved')]})]
    const film=compile(entries)
    const boarding=film.cues.filter(cue=>String(cue.kind)==='boarding')
    expect(boarding.map(cue=>'boardingPhase' in cue?cue.boardingPhase:null)).toEqual(['approach','breach','assault','plunder'])
    expect(boarding.every(cue=>cue.from==='a:0'&&cue.to==='b:0'&&cue.duration>0&&cue.time+cue.duration<=film.duration)).toBe(true)
    expect(film.ships.every(ship=>ship.fate==='survived')).toBe(true)
    expect(film.cues.some(cue=>cue.kind==='capture'||cue.kind==='death')).toBe(false)
    expect(film.duration).toBeLessThanOrEqual(20)
  })
  it('does not let an empty self-destruct operation redirect a later historical capture',()=>{
    const capture={boarding_operation_id:'',captor_id:'a',captor_username:'a',former_owner_id:'b',former_owner_username:'b',ship_id:'prize',ship_class:'vanguard'}
    const film=compile([row(100,{snapshots:[snap('a',1),snap('b',2),snap('c',2)],boarding:[{operation_id:'',actor_id:'b',target_id:'c',phase:'self_destruct',event:'self_destruct_attached_blast',hull_damage:1}]}),terminal(101,{snapshots:[snap('a',1),snap('b',2),snap('c',2)],captures:[capture]})])
    expect(film.ships.find(ship=>ship.playerId==='b')!.fate).toBe('captured')
    expect(film.ships.find(ship=>ship.playerId==='c')!.fate).toBe('survived')
  })
})

it('does not turn rejected boarding or capture-ready into hull capture',()=>{
  const board=(event:string,phase:string)=>({operation_id:'op',actor_id:'a',target_id:'b',event,phase})
  const entries=[row(100,{boarding:[board('boarding_rejected','')]}),terminal(101,{battle_ended:{...terminal(101).battle_ended!,total_damage:0}})]
  expect(getCinemaEligibility(summary({total_damage:0}),entries,'complete')).toBe('uneventful')
  expect(()=>compile(entries)).toThrow('complete, reconciled')
  const film=compile([row(100,{boarding:[board('latched','assault')]}),terminal(101,{boarding:[board('capture_ready','resolved')]})])
  expect(film.ships.every(ship=>ship.fate==='survived')).toBe(true)
  expect(film.cues.some(cue=>cue.kind==='capture')).toBe(false)
})

it('samples repetitive boarding while retaining terminal plunder',()=>{
  const board=(event:string,phase:string)=>({operation_id:'op',actor_id:'a',target_id:'b',event,phase})
  const film=compile([row(100,{boarding:[board('latched','assault')]}),...Array.from({length:1000},(_,i)=>row(101+i,{boarding:[board('assault_continues','assault')]})),terminal(1101,{boarding:[board('plundered','resolved')]})])
  const cues=film.cues.filter(cue=>cue.kind==='boarding')
  expect(cues.length).toBeLessThanOrEqual(14)
  expect(cues.at(-1)?.boardingPhase).toBe('plunder')
  expect(film.duration).toBeLessThan(30)
})

it('directs an intact capture from its recorded boarding operation rather than simultaneous gunfire',()=>{
  const capture={boarding_operation_id:'op',captor_id:'a',captor_username:'a',former_owner_id:'b',former_owner_username:'b',ship_id:'prize',ship_class:'vanguard'}
  const film=compile([row(100,{boarding:[{operation_id:'op',actor_id:'a',target_id:'b',event:'closing_started',phase:'latching'}]}),terminal(101,{attacks:[attack('a','b')],boarding:[{operation_id:'op',actor_id:'a',target_id:'b',event:'latched',phase:'assault'},{operation_id:'op',actor_id:'a',target_id:'b',event:'captured',phase:'resolved'}],captures:[capture]})])
  const cue=film.cues.find(cue=>cue.kind==='capture')!
  const sequence=film.story!.sequences.find(sequence=>sequence.eventCueId===cue.id)!
  expect(film.cues.find(cue=>cue.id===sequence.causeCueId)?.kind).toBe('boarding')
  expect(sequence.impactTime).toBeLessThan(cue.time)
})
it('preserves simultaneous legacy boarding operations for different pairs',()=>{
  const boarding=[['a','b'],['c','d']].map(([actor_id,target_id])=>({operation_id:'',actor_id,target_id,event:'latched',phase:'assault'}))
  const snapshots=[snap('a',1),snap('b',2),snap('c',1),snap('d',2)]
  const film=compile([row(100,{snapshots,boarding}),terminal(101,{snapshots})])
  expect(film.cues.filter(cue=>cue.kind==='boarding').map(cue=>[cue.from,cue.to])).toEqual([['a:0','b:0'],['c:0','d:0']])
})
it('preserves a terminal withdrawal after a same-tick withdrawal transition',()=>{
  const board=(event:string,phase:string)=>({operation_id:'op',actor_id:'a',target_id:'b',event,phase})
  const film=compile([row(100,{boarding:[board('latched','assault')]}),terminal(101,{boarding:[
    board('withdrawal_started','withdrawing'),board('withdrawal_started','withdrawing'),board('withdrawn','resolved'),
  ]})])
  const withdrawal=film.cues.filter(cue=>cue.kind==='boarding'&&cue.boardingPhase==='withdraw')
  expect(withdrawal.map(cue=>cue.boardingEvent)).toEqual(['withdrawal_started','withdrawn'])
  expect(withdrawal[0].boardingEnded).toBe(false)
  expect(withdrawal[1].boardingEnded).toBe(true)
  expect(withdrawal[1].time).toBeGreaterThanOrEqual(withdrawal[0].time+withdrawal[0].duration)
})
it('uses a perceptible battlefield master in compiled films before chronological action begins',()=>{
  const film=compile([row(100,{attacks:[attack('a','b')]}),terminal(101)])
  const opening=film.shots[0]
  expect(opening.battlefield).toBe(true)
  expect(opening.end-opening.start).toBeGreaterThanOrEqual(2.5)
  expect(film.segments[0].start).toBe(opening.end)
  expect(film.cues.filter(cue=>cue.kind==='weapon').every(cue=>cue.time>=opening.end)).toBe(true)
  for(let index=1;index<film.shots.length;index++) expect(film.shots[index].start).toBeCloseTo(film.shots[index-1].end,8)
})

it('holds an ongoing exchange through ordinary competing fire but yields to a recorded loss', () => {
  const snapshots=[snap('a',1),snap('b',2),snap('c',2)]
  const film=compile([
    row(100,{snapshots,attacks:[attack('a','c')]}),
    row(101,{snapshots,attacks:[attack('a','b'),attack('a','b'),attack('a','c')]}),
    row(102,{snapshots,attacks:[attack('a','b'),attack('a','b'),attack('a','c')]}),
    row(103,{snapshots,attacks:[attack('a','b',{hull_damage:100})],kills:[kill('a','b')]}),
    terminal(104,{snapshots:[snap('a',1),snap('c',2)]}),
  ])
  const sequences=film.story!.sequences
  expect(sequences[0].defender).toBe('c:0')
  expect(sequences[1].defender).toBe('c:0')
  expect(sequences.at(-1)!.defender).toBe('b:0')
})

it('lets continuity preference expire so ordinary higher-relevance exchanges can take over', () => {
  const snapshots=[snap('a',1),snap('b',2),snap('c',2)]
  const film=compile([
    row(100,{snapshots,attacks:[attack('a','c')]}),
    ...Array.from({length:10},(_,i)=>row(101+i,{snapshots,attacks:[attack('a','b'),attack('a','b'),attack('c','a')]})),
    terminal(111,{snapshots}),
  ])
  const sequences=film.story!.sequences
  expect([sequences[1].attacker,sequences[1].defender].sort()).toEqual(['a:0','c:0'])
  const ordinarySwitch=sequences.slice(1,-1).find(sequence=>sequence.defender==='b:0')
  expect(ordinarySwitch).toBeDefined()
  expect(ordinarySwitch!.start-sequences[0].start).toBeGreaterThanOrEqual(6)
})
