import { describe, expect, it } from 'bun:test'
import { buildFleetFormation, fleetMotionSpacing, type FormationMember } from './formation'
import { sampleShipMotion } from './motion'
import type { CinemaShip } from './types'

const member = (index: number, over: Partial<FormationMember> = {}): FormationMember => ({ id: `ship:${index}:0`, playerId: `pilot:${index}`, size: 20, beam: .5, kind: 'player', family: 'fighter', ...over })
const ship = (member: FormationMember, index: number): CinemaShip => ({ id: member.id, playerId: member.playerId, name: member.id,
  shipClass: '', kind: member.kind ?? 'player', sideId: 1, sideIndex: 0, start: 0, end: 180, fate: 'survived', health: [],
  motion: [{ time: 0, position: index % 2, stance: 'aggressive' }, { time: 60, position: 1 - index % 2, stance: 'defensive' }, { time: 150, position: index % 2, stance: 'aggressive' }] })

describe('cinematic fleet formation', () => {
  it('is independent of source roster order and keeps every return appearance in the same reserved slot', () => {
    const members = Array.from({ length: 40 }, (_, index) => member(index))
    members.push(member(3, { id: 'ship:3:1', size: 240, family: 'capital' }))
    const forward = buildFleetFormation(members), reverse = buildFleetFormation([...members].reverse())
    for (const item of members) expect(forward.get(item.id)).toEqual(reverse.get(item.id))
    expect(forward.get('ship:3:0')).toEqual(forward.get('ship:3:1'))
  })

  it('places support and industrial roles behind combat escorts without using tier as size', () => {
    const members = Array.from({ length: 40 }, (_, index) => member(index, { family: index < 20 ? 'fighter' : 'support' }))
    const slots = buildFleetFormation(members)
    const meanDepth = (items: FormationMember[]) => items.reduce((sum, item) => sum + slots.get(item.id)!.depth, 0) / items.length
    expect(meanDepth(members.slice(20))).toBeGreaterThan(meanDepth(members.slice(0, 20)))
  })

  it('preserves full turning clearance in hundreds of differently sized ships as their zones change', () => {
    const members = Array.from({ length: 180 }, (_, index) => member(index, { size: [20, 36, 90, 250, 400][index % 5], beam: .2 + index % 4 * .2 }))
    const slots = buildFleetFormation(members), spacing = fleetMotionSpacing(members)
    let minimumClearanceRatio = Infinity
    for (const time of [0, 20, 40, 75, 110, 150]) {
      const poses = members.map((member, index) => sampleShipMotion(ship(member, index), time,
        { size: member.size, angle: 0, lane: index, sideCount: members.length, spacing, depth: 555, seed: index * 917, formation: slots.get(member.id) }))
      for (let a = 0; a < members.length; a++) for (let b = a + 1; b < members.length; b++) {
        const distance = Math.hypot(poses[a].x - poses[b].x, poses[a].y - poses[b].y, poses[a].z - poses[b].z)
        minimumClearanceRatio = Math.min(minimumClearanceRatio, distance / (members[a].size + members[b].size))
      }
    }
    expect(minimumClearanceRatio).toBeGreaterThan(.55)
  })

  it('adds a stationary installation below the fleet without reshuffling its mobile formation', () => {
    const members = Array.from({ length: 100 }, (_, index) => member(index))
    const station = member(100, { kind: 'station', family: 'station', size: 400 })
    const fleetOnly = buildFleetFormation(members), withStation = buildFleetFormation([...members, station])
    for (const item of members) expect(withStation.get(item.id)).toEqual(fleetOnly.get(item.id))
    expect(withStation.get(station.id)!.elevation).toBeLessThan(0)
  })

  it('keeps five neighboring fleets clear when one capital faces a hundred small hulls', () => {
    const fleets = [
      [member(0, { size: 360, family: 'capital' })],
      Array.from({ length: 100 }, (_, index) => member(index + 1, { size: 16.2, family: 'industrial' })),
      Array.from({ length: 20 }, (_, index) => member(index + 101, { size: 90 })),
      Array.from({ length: 40 }, (_, index) => member(index + 121)),
      [member(161, { size: 250, family: 'capital' })],
    ]
    let minimumClearanceRatio = Infinity
    for (const time of [0, 15, 35.96, 75, 150]) {
      const poses = fleets.flatMap((fleet, side) => {
        const slots = buildFleetFormation(fleet, fleets.length)
        const spacing = fleetMotionSpacing(fleet), depth = Math.max(130, ...fleet.map(member => member.size * 1.25 + 55))
        return fleet.map((member, index) => ({ side, size: member.size, pose: sampleShipMotion(ship(member, index), time,
          { size: member.size, angle: side / fleets.length * Math.PI * 2, fleetCount: fleets.length, lane: index, sideCount: fleet.length, spacing, depth, seed: index * 917, formation: slots.get(member.id) }) }))
      })
      for (let a = 0; a < poses.length; a++) for (let b = a + 1; b < poses.length; b++) {
        if (poses[a].side === poses[b].side) continue
        const left = poses[a].pose, right = poses[b].pose
        const distance = Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
        minimumClearanceRatio = Math.min(minimumClearanceRatio, distance / (poses[a].size + poses[b].size))
      }
    }
    expect(minimumClearanceRatio).toBeGreaterThan(.78)
  })

  it('preserves compact two-side layouts and applies one common offset without collapsing internal rows', () => {
    const members = Array.from({ length: 100 }, (_, index) => member(index))
    const defaults = buildFleetFormation(members), twoSides = buildFleetFormation(members, 2), fiveSides = buildFleetFormation(members, 5)
    const offsets = new Set<number>()
    for (const member of members) {
      expect(twoSides.get(member.id)).toEqual(defaults.get(member.id))
      const before = twoSides.get(member.id)!, after = fiveSides.get(member.id)!
      expect([after.lateral, after.depth, after.elevation]).toEqual([before.lateral, before.depth, before.elevation])
      offsets.add(after.sectorOffset!)
    }
    expect(offsets.size).toBe(1)
    expect([...offsets][0]).toBeGreaterThan(0)
  })

  it('also separates adjacent stationary installations without inheriting the moving fleet orbit', () => {
    const member = { id: 'station', playerId: 'base', size: 400, beam: .9, kind: 'station', family: 'station' }
    const slots = buildFleetFormation([member], 5)
    const sample = (side: number, time: number) => sampleShipMotion(ship(member, 0), time, { size: 400, angle: side / 5 * Math.PI * 2,
      fleetCount: 5, sideCount: 1, lane: 0, spacing: 520, depth: 555, seed: 1, formation: slots.get(member.id) })
    expect(sample(0, 0)).toEqual(sample(0, 150))
    const a = sample(0, 0), b = sample(1, 150)
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(400 * 2 * .78)
  })
})
