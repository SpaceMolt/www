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

  it('keeps a captured prize ship-shaped while retaining its actor identity', () => {
    const t = buildTimeline(
      [entry([snap({ player_id: 'prize:ship-1', username: 'Captured Axiom', kind: 'prize', ship_class: 'axiom' })])],
      null,
    )
    const meta = t.participants.get('prize:ship-1')
    expect(meta?.kind).toBe('ship')
    expect(meta?.actorKind).toBe('prize')
    expect(meta?.archetype).not.toBe('creature')
  })

  it('uses terminal participant data to identify NPCs and bosses', () => {
    const final = entry([snap({ player_id: 'boss', username: 'Red Wake', kind: 'pirate', ship_class: 'axiom' })])
    final.battle_ended = {
      outcome: 'victory',
      winning_side: 1,
      duration: 1,
      total_damage: 0,
      ships_destroyed: 0,
      participants: [{
        player_id: 'boss', username: 'Red Wake', side_id: 1, kind: 'pirate', is_npc: true, is_boss: true,
        damage_dealt: 0, damage_taken: 0, kill_count: 0, survived: true,
      }],
    }

    const meta = buildTimeline([final], null).participants.get('boss')
    expect(meta?.actorKind).toBe('pirate')
    expect(meta?.isNPC).toBe(true)
    expect(meta?.isBoss).toBe(true)
  })

  it('identifies a boss from snapshots while the battle is still active', () => {
    const active = entry([snap({
      player_id: 'boss', username: 'Red Wake', kind: 'pirate', is_npc: true, is_boss: true, ship_class: 'axiom',
    })])
    const meta = buildTimeline([active], null).participants.get('boss')
    expect(meta?.actorKind).toBe('pirate')
    expect(meta?.isNPC).toBe(true)
    expect(meta?.isBoss).toBe(true)
  })

  it('enriches an actor when a newer live snapshot adds NPC identity fields', () => {
    const legacy = entry([snap({
      player_id: 'boss', username: 'Red Wake', ship_class: 'axiom',
    })])
    const enriched = entry([snap({
      player_id: 'boss', username: 'Red Wake', kind: 'pirate', is_npc: true, is_boss: true, ship_class: 'axiom',
    })])
    enriched.tick = 2

    const meta = buildTimeline([legacy, enriched], null).participants.get('boss')
    expect(meta?.actorKind).toBe('pirate')
    expect(meta?.isNPC).toBe(true)
    expect(meta?.isBoss).toBe(true)
  })
})

describe('boarding and capture events', () => {
  it('renders qualitative casualties, triage, boarding phases, self-destruct, and intact capture', () => {
    const combatEntry = entry([
      snap({ player_id: 'captor', username: 'Corsair', side_id: 1 }),
      snap({ player_id: 'target', username: 'Red Wake', side_id: 2 }),
      snap({ player_id: 'medic', username: 'Sawbones', side_id: 2 }),
    ])
    combatEntry.personnel_casualties = [{
      target_id: 'target', casualties_occurred: true, incapacitated: true,
      triage_applied: true, triage_converted: true, triage_provider_id: 'medic',
    }]
    combatEntry.boarding = [
      { operation_id: 'op-1', phase: 'latching', actor_id: 'captor', target_id: 'target', event: 'closing_started' },
      { operation_id: 'op-1', phase: 'assault', actor_id: 'captor', target_id: 'target', event: 'assault_continues', attacker_casualties: true, defender_casualties: true },
      { operation_id: '', phase: 'self_destruct', actor_id: 'target', event: 'self_destruct_countdown', self_destruct_countdown: 2 },
      { operation_id: '', phase: 'self_destruct', actor_id: 'target', event: 'self_destruct_canceled' },
      { operation_id: 'op-1', phase: 'resolved', actor_id: 'captor', target_id: 'target', event: 'captured' },
    ]
    combatEntry.captures = [{
      boarding_operation_id: 'op-1', captor_id: 'captor', captor_username: 'Corsair',
      former_owner_id: 'target', former_owner_username: 'Red Wake', ship_id: 'ship-1', ship_class: 'axiom',
    }]

    const timeline = buildTimeline([combatEntry], null)
    const texts = timeline.events.map(event => event.text)
    expect(texts).toContain('Red Wake suffered personnel casualties and was incapacitated')
    expect(texts).toContain('Triage from Sawbones stabilized casualties aboard Red Wake')
    expect(texts).toContain('Corsair began closing to board Red Wake')
    expect(texts).toContain('Boarding combat continued aboard Red Wake; both sides took casualties')
    expect(texts).toContain("Red Wake's self-destruct countdown — 2 ticks remaining")
    expect(texts).toContain("Red Wake's self-destruct was canceled")
    expect(texts).toContain('Axiom captured intact from Red Wake by Corsair')
    expect(timeline.events.find(event => event.text === 'Axiom captured intact from Red Wake by Corsair')?.translation).toEqual({
      key: 'battles.events.capturedIntact',
      params: { ship: 'Axiom', formerOwner: 'Red Wake', captor: 'Corsair' },
    })
    expect(timeline.events.find(event => event.text === 'Boarding combat continued aboard Red Wake; both sides took casualties')?.translation).toEqual({
      key: 'battles.events.boardingAssaultContinuesBothCasualties',
      params: { target: 'Red Wake' },
    })
    expect(timeline.participants.get('target')?.fate).toBe('captured')
    expect(timeline.participants.get('target')?.capturedBy).toBe('Corsair')
  })

  it('marks a re-captured prize actor rather than its prior claimant', () => {
    const combatEntry = entry([
      snap({ player_id: 'captor', username: 'Second Captor', side_id: 1 }),
      snap({ player_id: 'prize:ship-1', username: 'Claimed Axiom', kind: 'prize', side_id: 2, ship_class: 'axiom' }),
    ])
    combatEntry.boarding = [{
      operation_id: 'op-recapture', phase: 'resolved', actor_id: 'captor', target_id: 'prize:ship-1', event: 'captured',
    }]
    combatEntry.captures = [{
      boarding_operation_id: 'op-recapture', captor_id: 'captor', captor_username: 'Second Captor',
      former_owner_id: 'first-captor', former_owner_username: 'First Captor', ship_id: 'ship-1', ship_class: 'axiom',
    }]

    const timeline = buildTimeline([combatEntry], null)
    expect(timeline.participants.get('prize:ship-1')?.fate).toBe('captured')
    expect(timeline.participants.get('prize:ship-1')?.capturedBy).toBe('Second Captor')
    expect(timeline.participants.get('first-captor')).toBeUndefined()
  })

  it('distinguishes self-destruction from an ordinary combat kill', () => {
    const combatEntry = entry([
      snap({ player_id: 'captain', username: 'Captain', side_id: 1 }),
      snap({ player_id: 'pirate', username: 'Cutthroat', side_id: 2 }),
    ])
    combatEntry.kills = [{
      killer_id: 'captain', victim_id: 'captain', killer_username: 'Captain', victim_username: 'Captain', cause: 'self_destruct',
    }, {
      killer_id: 'captain', victim_id: 'pirate', killer_username: 'Captain', victim_username: 'Cutthroat', cause: 'combat',
    }]

    const timeline = buildTimeline([combatEntry], null)
    expect(timeline.events.find(event => event.actorId === 'captain')?.text).toBe('Captain self-destructed')
    expect(timeline.participants.get('captain')?.deathCause).toBe('self_destruct')
    expect(timeline.events.find(event => event.actorId === 'pirate')?.text).toBe('Cutthroat destroyed by Captain')
  })

  it('remains compatible with old rows that omit every additive field', () => {
    const timeline = buildTimeline([entry([snap({ player_id: 'legacy', username: 'Legacy' })])], null)
    expect(timeline.participants.get('legacy')?.actorKind).toBe('unknown')
    expect(timeline.events).toHaveLength(0)
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
