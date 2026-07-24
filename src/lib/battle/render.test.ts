import { describe, it, expect } from 'bun:test'
import { buildTimeline } from './timeline'
import { sampleShips } from './render'
import type { BattleLogEntry, ParticipantSnapshot } from './types'

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
})
