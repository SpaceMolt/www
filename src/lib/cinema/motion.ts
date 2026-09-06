import type { CinemaShip } from './types'
import { balancedFormationSlot, type FormationSlot } from './formation'
export { fleetMotionSpacing } from './formation'

export interface ShipMotionOptions {
  size: number
  angle: number
  lane: number
  sideCount: number
  spacing: number
  depth: number
  seed: number
  /** Stable per-side slot assigned across the complete lifecycle roster. */
  formation?: FormationSlot
  /** Number of distinct battle sides, for clearance between adjacent fleets. */
  fleetCount?: number
}

export interface ShipMotion {
  x: number
  y: number
  z: number
  /** Three.js Y rotation for a hull whose bow points along local +X. */
  yaw: number
  /** Roll about the ship's local forward axis, in radians. */
  bank: number
  /** Engine strength: zero for disabled hulls, above one under escape thrust. */
  thrust: number
  /** Forward-facing exhaust for reverse combat motion; zero under departure thrust. */
  retroThrust: number
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const smooth = (value: number) => { const p = clamp(value, 0, 1); return p * p * (3 - 2 * p) }

/** Recorded inward progress is artistic spacing guidance, not tactical coordinates. */
export function sampleMotionProgress(ship: CinemaShip, time: number): number {
  const frames = ship.motion
  if (!frames?.length) return 1
  let low = 0, high = frames.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (frames[middle].time <= time) low = middle + 1
    else high = middle
  }
  const left = frames[Math.max(0, low - 1)]
  const right = frames[Math.min(frames.length - 1, low)]
  if (right.time <= left.time) return clamp(left.position, 0, 1)
  const progress = smooth((time - left.time) / (right.time - left.time))
  return clamp(left.position + (right.position - left.position) * progress, 0, 1)
}

interface StanceTurn { time: number; from: number; to: number }
const stanceTurns = new WeakMap<NonNullable<CinemaShip['motion']>, StanceTurn[]>()
const turnAt = (turn: StanceTurn, time: number) => turn.from + (turn.to - turn.from) * smooth((time - turn.time) / 1.6)

/** Cache only immutable compiled frames; a fresh film gets its own timeline. */
function stanceTimeline(frames: NonNullable<CinemaShip['motion']>): StanceTurn[] {
  const existing = stanceTurns.get(frames)
  if (existing) return existing
  const timeline: StanceTurn[] = []
  for (const frame of frames) {
    const to = frame.stance === 'flee' ? 1 : 0
    const previous = timeline.at(-1)
    if (previous?.to === to) continue
    timeline.push({ time: frame.time, from: previous ? turnAt(previous, frame.time) : to, to })
  }
  stanceTurns.set(frames, timeline)
  return timeline
}

/** Stances take effect at the recorded frame, never ahead of a future change. */
function fleeTurn(ship: CinemaShip, time: number): number {
  const frames = ship.motion
  if (!frames?.length) return 0
  const timeline = stanceTimeline(frames)
  let low = 0, high = timeline.length
  while (low < high) { const middle = (low + high) >>> 1; if (timeline[middle].time <= time) low = middle + 1; else high = middle }
  return turnAt(timeline[Math.max(0, low - 1)], time)
}

/**
 * Fixed formations keep the two sides legible. Recorded zone progress moves
 * ships along their side's engagement axis; combat retreat reverses along it.
 * Only a recorded flee stance turns a live ship away from the opposing side.
 * No accumulated simulation state means seeks reconstruct the same formation.
 */
export function sampleShipMotion(ship: CinemaShip, time: number, options: ShipMotionOptions): ShipMotion {
  const { size, angle, lane, sideCount, spacing, depth } = options
  const formation = options.formation ?? balancedFormationSlot(lane, sideCount, spacing, depth)
  const slot = formation.lateral
  // The compiled formation carries an exact shared sector offset. Standalone
  // motion callers use a conservative footprint estimate with the same offset
  // for every member, rather than clamping rows together at a sector boundary.
  const fleetCount = options.fleetCount ?? 2
  const halfAngle = Math.PI / Math.max(2, fleetCount)
  const fallbackSize = Math.max(1, (depth - 55) / 1.25)
  const fallbackWidth = Math.ceil(Math.sqrt(Math.max(1, sideCount) * (depth * 1.7 + 110) / spacing)) * spacing * .5
  const fallbackOffset = fleetCount > 2 ? Math.max(0, ((fallbackWidth + 6) * Math.cos(halfAngle) + fallbackSize * .78 + 24) / Math.sin(halfAngle) - 100) : 0
  const sectorOffset = formation.sectorOffset ?? fallbackOffset
  const zoneSpan = clamp(depth * 0.4, 65, 200)
  // Row spacing covers the entire zone excursion and hull length.
  // Zone changes cannot send a rear row through the row ahead of it.
  const rowDepth = formation.depth
  const height = formation.elevation

  const position = (at: number) => {
    const progress = sampleMotionProgress(ship, at)
    const radius = 150 + size * 0.65 + rowDepth + sectorOffset + zoneSpan * (1 - progress)
    return {
      x: Math.cos(angle) * radius - Math.sin(angle) * slot,
      y: height,
      z: Math.sin(angle) * radius + Math.cos(angle) * slot,
    }
  }

  if (ship.kind === 'station') {
    // Stations never inherit zone maneuvers or disabled drift.
    const radius = 150 + size * 0.65 + rowDepth + sectorOffset
    // A fixed installation occupies a separate formation layer so a
    // neighboring flight lane cannot pass through its stationary structure.
    return { x: Math.cos(angle) * radius - Math.sin(angle) * slot, y: height - (size * 0.9 + 120),
      z: Math.sin(angle) * radius + Math.cos(angle) * slot, yaw: Math.PI - angle, bank: 0, thrust: 0, retroThrust: 0 }
  }

  const sampledAt = Math.max(ship.start, ship.fate === 'survived' ? time : Math.min(time, ship.end))
  const base = position(sampledAt)
  const previousAt = Math.max(ship.start, sampledAt - 0.01)
  const previous = position(previousAt)
  const next = position(sampledAt + 0.01)
  const interval = sampledAt + 0.01 - previousAt
  const velocity = { x: (next.x - previous.x) / interval, y: (next.y - previous.y) / interval, z: (next.z - previous.z) / interval }
  // Combat maneuvers can strafe or reverse while retaining the engagement.
  // A recorded flee stance alone turns the bow and its main drive outward.
  const inwardYaw = Math.PI - angle
  const flee = fleeTurn(ship, sampledAt)
  const yaw = inwardYaw + Math.PI * flee
  const bank = 0
  const after = Math.max(0, time - ship.end)
  const inwardVelocity = -(velocity.x * Math.cos(angle) + velocity.z * Math.sin(angle))
  const reversing = inwardVelocity < -.1
  const mainDrive = reversing ? .08 : .75
  const normalThrust = mainDrive * (1 - flee) + 1.35 * flee
  const retroThrust = reversing ? clamp((-inwardVelocity - .1) / 4, 0, 1) * (1 - flee) : 0
  if (time < ship.end || ship.fate === 'survived') return { ...base, yaw, bank, thrust: normalThrust, retroThrust }

  if (ship.fate === 'escaped' || ship.fate === 'withdrawn') {
    // Velocity matches the live trajectory at departure; acceleration then
    // pulls the ship out of its formation rather than teleporting it away.
    const bearing = angle
    const acceleration = ship.fate === 'escaped' ? 24 : 12
    const boost = after * after * acceleration
    const forwardX = velocity.x + Math.cos(bearing) * after * acceleration * 2
    const forwardZ = velocity.z + Math.sin(bearing) * after * acceleration * 2
    return { x: base.x + velocity.x * after + Math.cos(bearing) * boost,
      y: base.y + velocity.y * after, z: base.z + velocity.z * after + Math.sin(bearing) * boost,
      yaw: Math.atan2(-forwardZ, forwardX), bank, thrust: normalThrust + Math.min(1, after * 0.6), retroThrust: 0 }
  }

  // Preserve momentum through a knockout, capture, or destruction. The visible
  // wreck/disabled hull settles gradually while all propulsion stops at fate.
  const drag = ship.fate === 'destroyed' ? 8 : 5
  const drift = drag * (1 - Math.exp(-after / drag))
  return { x: base.x + velocity.x * drift, y: base.y + velocity.y * drift,
    z: base.z + velocity.z * drift, yaw, bank, thrust: 0, retroThrust: 0 }
}
