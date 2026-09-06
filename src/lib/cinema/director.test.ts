import { describe, expect, it } from 'bun:test'
import { compileBattleFilm, getCinemaEligibility, sampleCinemaHealth, sampleCinemaShot, sourceTickAt } from './director'
import type { AttackLogEntry, BattleLogEntry, BattleSummary, ParticipantSnapshot, WeaponFireDetail } from '../battle/types'

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

describe('completed-record gate', () => {
  it('requires reconciled data, terminal row and completed summary independently', () => {
    const entries = [row(100), terminal(101)]
    expect(getCinemaEligibility(summary(), entries, 'complete')).toBe('ready')
    expect(getCinemaEligibility(summary(), entries, 'finalizing')).toBe('finalizing')
    expect(getCinemaEligibility(summary({ status: 'active' }), entries, 'complete')).toBe('active')
    expect(getCinemaEligibility(summary(), [row(100)], 'complete')).toBe('finalizing')
    expect(getCinemaEligibility(summary(), entries, 'unavailable')).toBe('unavailable')
    expect(getCinemaEligibility(null, entries, 'complete')).toBe('finalizing')
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
    expect(first.duration).toBeGreaterThanOrEqual(40)
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
  it('reserves most of the action for consequences even when a long exchange alternates fire and idle ticks', () => {
    const entries = Array.from({ length: 4000 }, (_, i) => row(100 + i, {
      attacks: i % 2 === 0 ? [attack('a', 'b')] : [],
    }))
    entries[3998].kills = [kill('a', 'b')]
    entries[3999] = terminal(4099, { snapshots: [snap('a')] })
    const film = compile(entries)
    const coreDuration = film.duration - 18
    const meaningfulTime = film.segments.slice(3996).reduce((sum, segment) => sum + segment.end - segment.start, 0)
    expect(meaningfulTime / coreDuration).toBeCloseTo(0.72, 6)
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
  it('holds every loss on camera through impact and its aftermath, including clustered casualties', () => {
    const snapshots = [snap('a'), snap('b', 2), snap('c', 2), snap('d', 2)]
    const entries = Array.from({ length: 20 }, (_, index) => row(100 + index, {
      snapshots: snapshots.filter(ship => ship.player_id === 'a' ||
        ship.player_id === 'b' && index <= 8 || ship.player_id === 'c' && index <= 9 || ship.player_id === 'd' && index <= 18),
      attacks: index <= 8 ? [attack('a', 'b')] : index <= 9 ? [attack('a', 'c')] : index <= 18 ? [attack('a', 'd')] : [],
      kills: index === 8 ? [kill('a', 'b')] : index === 9 ? [kill('a', 'c')] : index === 18 ? [kill('a', 'd')] : [],
    }))
    entries[19] = terminal(119, { snapshots: [snap('a')] })
    const film = compile(entries)
    for (const cue of film.cues.filter(cue => cue.kind === 'death')) {
      for (const offset of [-1, 0, 1, 2]) {
        const shot = sampleCinemaShot(film, cue.time + offset)
        const focusIds = (shot as typeof shot & { focusIds?: string[] }).focusIds ?? [shot.subject]
        expect(focusIds).toContain(cue.to)
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
    expect(shot.end).toBeGreaterThanOrEqual(deaths[0].time + 2)
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
    expect(motion.slice(0, 2)).toEqual([{time:0,position:0},{time:film.segments[1].start,position:0}])
    expect(motion).toContainEqual({time:film.segments[1].end,position:1 / 3})
    expect(motion).toContainEqual({time:film.segments[3].end,position:2 / 3})
    expect(motion).toContainEqual({time:film.segments[5].start,position:1})
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
    expect(appearances[1].motion![0]).toEqual({time:appearances[1].start,position:1 / 3})
  })
})
