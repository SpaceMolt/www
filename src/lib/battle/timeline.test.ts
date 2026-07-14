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
