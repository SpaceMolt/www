import { describe, it, expect } from 'bun:test'
import { buildTimeline } from './timeline'
import type { BattleLogEntry, ParticipantSnapshot } from './types'

function snap(over: Partial<ParticipantSnapshot>): ParticipantSnapshot {
  return {
    player_id: 'p1',
    username: 'Somebody',
    side_id: 1,
    zone: 'engaged',
    stance: 'fire',
    auto_pilot: true,
    flee_counter: 0,
    ship_class: '',
    hull: 100,
    max_hull: 100,
    shield: 0,
    max_shield: 0,
    fuel: 0,
    max_fuel: 0,
    damage_dealt: 0,
    damage_taken: 0,
    kill_count: 0,
    x: 0,
    y: 0,
    ...over,
  }
}

function entry(snapshots: ParticipantSnapshot[]): BattleLogEntry {
  return { battle_id: 'b1', system_id: 'sol', tick: 1, snapshots }
}

describe('participant kind', () => {
  // The server tags every snapshot with what the combatant is. Before we read
  // that tag, kind was inferred as "has a ship class → ship, named like a drone →
  // drone, otherwise creature" — which quietly made a station a creature, because
  // a station has no ship class and is named after the base. It drew as an
  // organic blob sitting in the middle of the battlefield.
  it('reads a station off the server tag rather than guessing it is wildlife', () => {
    const t = buildTimeline([entry([snap({ player_id: 'base_1', username: 'Kestrel Redoubt', kind: 'station', max_hull: 40000, hull: 40000 })])], null)
    const meta = t.participants.get('base_1')
    expect(meta?.kind).toBe('station')
    expect(meta?.archetype).toBe('station')
    expect(meta?.shipClassName).toBe('Station')
  })

  it('keeps players, pirates and police as ships whatever they are flying', () => {
    const t = buildTimeline(
      [
        entry([
          snap({ player_id: 'p1', username: 'Vex', kind: 'player', ship_class: 'axiom' }),
          snap({ player_id: 'r1', username: 'Cutthroat', kind: 'pirate', ship_class: 'axiom' }),
          snap({ player_id: 'c1', username: 'Patrol', kind: 'police', ship_class: 'axiom' }),
        ]),
      ],
      null,
    )
    for (const id of ['p1', 'r1', 'c1']) {
      expect(t.participants.get(id)?.kind).toBe('ship')
    }
  })

  it('still falls back to the old heuristic for logs written before the tag existed', () => {
    const t = buildTimeline(
      [
        entry([
          snap({ player_id: 'p1', username: 'Vex', ship_class: 'axiom' }),
          snap({ player_id: 'd1', username: "Vex's combat drone" }),
          snap({ player_id: 'k1', username: 'Void Kraken' }),
        ]),
      ],
      null,
    )
    expect(t.participants.get('p1')?.kind).toBe('ship')
    expect(t.participants.get('d1')?.kind).toBe('drone')
    expect(t.participants.get('k1')?.kind).toBe('creature')
  })
})

describe('detailed combat events', () => {
  it('labels secondary attacks, attributes burns, and reports passive repair', () => {
    const combatEntry = entry([
      snap({ player_id: 'a', username: 'Arc Knight', side_id: 1 }),
      snap({ player_id: 'b', username: 'Bulwark', side_id: 2 }),
    ])
    combatEntry.attacks = [{
      attacker_id: 'a',
      target_id: 'b',
      zone_distance: 1,
      weapons: [],
      raw_damage: 50,
      weapon_skill_pct: 0,
      pre_hit_damage: 50,
      hit_chance: 1,
      hit_roll: 0,
      hit_success: true,
      final_damage: 25,
      shield_damage: 25,
      hull_damage: 0,
      damage_type: 'energy',
      secondary_kind: 'chain',
      chain_targets: 2,
    }]
    combatEntry.burns = [{ source_id: 'a', target_id: 'b', damage: 8, ticks_remaining: 3 }]
    combatEntry.regen = [{
      player_id: 'b',
      shield_regen: 0,
      armor_repair: 0,
      remote_repair: 0,
      passive_repair: 6,
      shield_before: 75,
      shield_after: 75,
      hull_before: 80,
      hull_after: 86,
    }]

    const timeline = buildTimeline([combatEntry], null)
    expect(timeline.events.find(event => event.kind === 'splash')?.text)
      .toBe('Arc Knight → Bulwark for 25 shield energy')
    expect(timeline.events.find(event => event.kind === 'splash')?.secondaryKind).toBe('chain')
    expect(timeline.events.find(event => event.kind === 'burn')?.text)
      .toBe('Bulwark took 8 burn damage from Arc Knight (3 ticks left)')
    expect(timeline.events.find(event => event.kind === 'regen')?.text)
      .toBe('Bulwark restored 6 passive hull repair')
  })

  it('preserves secondary identity when a chain, area, or retaliation attack misses', () => {
    const combatEntry = entry([
      snap({ player_id: 'a', username: 'Arc Knight', side_id: 1 }),
      snap({ player_id: 'b', username: 'Bulwark', side_id: 2 }),
    ])
    combatEntry.attacks = [{
      attacker_id: 'a',
      target_id: 'b',
      zone_distance: 1,
      weapons: [],
      raw_damage: 40,
      weapon_skill_pct: 0,
      pre_hit_damage: 40,
      hit_chance: 0.3,
      hit_roll: 0.8,
      hit_success: false,
      final_damage: 0,
      shield_damage: 0,
      hull_damage: 0,
      damage_type: 'energy',
      secondary_kind: 'retaliation',
    }]

    const timeline = buildTimeline([combatEntry], null)
    expect(timeline.events[0]?.kind).toBe('splash')
    expect(timeline.events[0]?.text).toBe('Arc Knight missed Bulwark (30% to hit)')
    expect(timeline.events[0]?.secondaryKind).toBe('retaliation')
  })
})
