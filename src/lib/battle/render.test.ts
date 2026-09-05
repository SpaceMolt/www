import { describe, it, expect } from 'bun:test'
import { buildTimeline } from './timeline'
import { buildAttackVisualPlan, sampleShips } from './render'
import type { AttackLogEntry, BattleLogEntry, ParticipantSnapshot } from './types'

function snap(over: Partial<ParticipantSnapshot>): ParticipantSnapshot {
  return {
    player_id: 'p1',
    username: 'Somebody',
    side_id: 1,
    kind: 'player',
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

function attack(overrides: Partial<AttackLogEntry> = {}): AttackLogEntry {
  return {
    attacker_id: 'attacker', target_id: 'primary', zone_distance: 0, weapons: [], raw_damage: 10,
    weapon_skill_pct: 0, off_buff_pct: 0, pre_hit_damage: 10, hit_chance: 1, hit_roll: 0,
    hit_success: true, final_damage: 10, shield_damage: 0, hull_damage: 10, damage_type: 'void',
    ...overrides,
  }
}

describe('attack visual planning', () => {
  it('groups a massive AOE burst behind its one primary attack', () => {
    const attacks = [
      attack({ target_id: 'primary', aoe_radius: 2 }),
      ...Array.from({ length: 99 }, (_, index) => attack({
        target_id: `splash-${index}`, secondary_kind: 'aoe', splash: true, weapons: [],
      })),
    ]

    expect(buildAttackVisualPlan(attacks)).toEqual({
      primaryIndices: [0],
      orphanSecondaryIndices: [],
      groups: [{ primaryIndex: 0, kind: 'aoe', secondaryIndices: Array.from({ length: 99 }, (_, index) => index + 1) }],
    })
  })

  it('keeps chain and ammo splash groups separate and never promotes orphan secondary hits', () => {
    const attacks = [
      attack({ target_id: 'first' }),
      attack({ target_id: 'chain-1', secondary_kind: 'chain' }),
      attack({ target_id: 'chain-2', secondary_kind: 'chain' }),
      attack({ target_id: 'second' }),
      attack({ target_id: 'splash-1', secondary_kind: 'ammo_splash', splash: true }),
      attack({ attacker_id: 'other', target_id: 'orphan', secondary_kind: 'aoe', splash: true }),
      attack({ attacker_id: 'defender', target_id: 'retaliation', secondary_kind: 'retaliation' }),
    ]

    expect(buildAttackVisualPlan(attacks)).toEqual({
      primaryIndices: [0, 3, 6],
      orphanSecondaryIndices: [5],
      groups: [
        { primaryIndex: 0, kind: 'chain', secondaryIndices: [1, 2] },
        { primaryIndex: 3, kind: 'ammo_splash', secondaryIndices: [4] },
      ],
    })
  })
})

/** Two sides of two, so p4 sits off the central axis and toward-p4 is a
 *  meaningfully different bearing from toward-centre. */
function roster(p1Over: Partial<ParticipantSnapshot>): ParticipantSnapshot[] {
  return [
    snap({ player_id: 'p1', side_id: 1, ...p1Over }),
    snap({ player_id: 'p2', side_id: 1 }),
    snap({ player_id: 'p3', side_id: 2 }),
    snap({ player_id: 'p4', side_id: 2 }),
  ]
}

/** Shortest signed angular gap, in radians. */
function angleGap(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return Math.abs(d)
}

describe('ship facing', () => {
  it('holds the bow on the last target through ticks with no fire, instead of snapping back to centre', () => {
    // p1 commits to p4 on tick 0, reports no target on the idle tick 1, then
    // fires on p4 again on tick 2. The old renderer swung to centre on tick 1.
    const timeline = buildTimeline(
      [
        entry(roster({ target_id: 'p4' })),
        entry(roster({ target_id: undefined })),
        entry(roster({ target_id: 'p4' })),
      ],
      null,
    )

    const ships = sampleShips(timeline, 1, 0, true)
    const p1 = ships.get('p1')!
    const p4 = ships.get('p4')!
    const towardP4 = Math.atan2(p4.pos.y - p1.pos.y, p4.pos.x - p1.pos.x)
    const towardCentre = Math.atan2(-p1.pos.y, -p1.pos.x)

    // The two bearings must genuinely differ, or the test proves nothing.
    expect(angleGap(towardP4, towardCentre)).toBeGreaterThan(0.3)
    // Facing stays trained on p4 on the idle tick.
    expect(angleGap(p1.facing, towardP4)).toBeLessThan(0.05)
    expect(angleGap(p1.facing, towardCentre)).toBeGreaterThan(0.3)
  })

  it('backfills leading idle ticks from the first committed target', () => {
    const timeline = buildTimeline(
      [
        entry(roster({ target_id: undefined })),
        entry(roster({ target_id: 'p4' })),
      ],
      null,
    )
    const ships = sampleShips(timeline, 0, 0, true)
    const p1 = ships.get('p1')!
    const p4 = ships.get('p4')!
    const towardP4 = Math.atan2(p4.pos.y - p1.pos.y, p4.pos.x - p1.pos.x)
    expect(angleGap(p1.facing, towardP4)).toBeLessThan(0.05)
  })

  it('points a fleeing ship the way it is running, not back at its attacker', () => {
    // A ship spooling its warp drive faces radially outward toward the rim, even
    // while it still carries the target it was shooting — so it reads as running,
    // not reversing.
    const timeline = buildTimeline(
      [entry(roster({ stance: 'flee', target_id: 'p4' }))],
      null,
    )
    const ships = sampleShips(timeline, 0, 0, true)
    const p1 = ships.get('p1')!
    const p4 = ships.get('p4')!
    const outward = Math.atan2(p1.pos.y, p1.pos.x)
    const towardP4 = Math.atan2(p4.pos.y - p1.pos.y, p4.pos.x - p1.pos.x)

    expect(angleGap(outward, towardP4)).toBeGreaterThan(0.3)
    expect(angleGap(p1.facing, outward)).toBeLessThan(0.05)
  })

  it('keeps a station square rather than slewing to a target', () => {
    const timeline = buildTimeline(
      [
        entry([
          snap({ player_id: 'base_1', username: 'Redoubt', kind: 'station', side_id: 1, target_id: 'p3' }),
          snap({ player_id: 'p3', side_id: 2 }),
        ]),
      ],
      null,
    )
    const ships = sampleShips(timeline, 0, 0, true)
    expect(ships.get('base_1')!.facing).toBe(0)
  })

  it('removes the former owner without an explosion after an intact capture', () => {
    const captured = entry([snap({ player_id: 'target', username: 'Target', side_id: 2, ship_class: 'axiom' })])
    captured.captures = [{
      boarding_operation_id: 'op-1', captor_id: 'captor', captor_username: 'Captor',
      former_owner_id: 'target', former_owner_username: 'Target', ship_id: 'ship-1', ship_class: 'axiom',
    }]
    const timeline = buildTimeline([captured], null)

    expect(sampleShips(timeline, 0.5, 0, true).get('target')?.alive).toBe(true)
    expect(sampleShips(timeline, 0.9, 0, true).get('target')?.alive).toBe(false)
    expect(timeline.participants.get('target')?.fate).toBe('captured')
  })

  it('removes a recaptured prize actor rather than its prior claimant', () => {
    const captured = entry([snap({
      player_id: 'prize:ship-1', username: 'Claimed Axiom', kind: 'prize', side_id: 2, ship_class: 'axiom',
    })])
    captured.boarding = [{
      operation_id: 'op-recapture', phase: 'resolved', actor_id: 'captor', target_id: 'prize:ship-1', event: 'captured',
    }]
    captured.captures = [{
      boarding_operation_id: 'op-recapture', captor_id: 'captor', captor_username: 'Captor',
      former_owner_id: 'first-captor', former_owner_username: 'First Captor', ship_id: 'ship-1', ship_class: 'axiom',
    }]
    const timeline = buildTimeline([captured], null)

    expect(sampleShips(timeline, 0.5, 0, true).get('prize:ship-1')?.alive).toBe(true)
    expect(sampleShips(timeline, 0.9, 0, true).get('prize:ship-1')?.alive).toBe(false)
  })
})

describe('frame outcome sampling', () => {
  it('resolves each capture target once instead of rescanning captures per participant', () => {
    const snapshots = Array.from({ length: 20 }, (_, index) => snap({
      player_id: `p${index}`,
      username: `Pilot ${index}`,
      side_id: index % 2,
    }))
    const tick = entry(snapshots)
    tick.captures = [
      { boarding_operation_id: 'op-1', captor_id: 'p0', captor_username: 'Pilot 0', former_owner_id: 'p18', former_owner_username: 'Pilot 18', ship_id: 's18', ship_class: 'axiom' },
      { boarding_operation_id: 'op-2', captor_id: 'p1', captor_username: 'Pilot 1', former_owner_id: 'p19', former_owner_username: 'Pilot 19', ship_id: 's19', ship_class: 'axiom' },
    ]
    const timeline = buildTimeline([tick], null)
    let captureLookups = 0
    const targets = timeline.captureTargets
    timeline.captureTargets = new Proxy(targets, {
      get(target, property, receiver) {
        if (property === 'get') {
          return (key: string) => {
            captureLookups++
            return target.get(key)
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })

    sampleShips(timeline, 0.9, 0, true)
    expect(captureLookups).toBe(tick.captures.length)
  })
})
