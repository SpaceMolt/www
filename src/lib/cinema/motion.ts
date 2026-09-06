import type { CinemaShip } from './types'

export interface ShipMotionOptions {
  size: number
  angle: number
  lane: number
  sideCount: number
  spacing: number
  depth: number
  seed: number
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
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const smooth = (value: number) => { const p = clamp(value, 0, 1); return p * p * (3 - 2 * p) }
const ORBIT_RATE = 0.018

/** Per-column formation clearance, shared by every member of a fleet. */
export function fleetMotionSpacing(ships: readonly { size: number; beam: number }[]): number {
  // Bows follow the flight path and turn across column boundaries. Beam-only
  // clearance is insufficient once narrow capitals turn broadside in formation.
  return ships.reduce((spacing, ship) => Math.max(spacing, ship.size * 1.2 + 40, ship.size * ship.beam * 1.4 + 28), 75)
}

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

/**
 * A shared naval sweep moves whole formations through the scene. Individual
 * maneuvers stay inside narrow lanes: fighters bank through small corrections,
 * while large hulls cover fewer hull-lengths and lean much less. No accumulated
 * simulation state means an arbitrary seek produces the exact same formation.
 */
export function sampleShipMotion(ship: CinemaShip, time: number, options: ShipMotionOptions): ShipMotion {
  const { size, angle, lane, sideCount, spacing, depth, seed } = options
  const agility = clamp(52 / Math.max(size, 1), 0.14, 1)
  const phase = ((seed >>> 0) % 6283) / 1000
  const row = Math.floor(lane / 7)
  const columns = Math.min(7, Math.max(1, sideCount))
  const slot = (lane % 7 - (columns - 1) / 2) * spacing
  const zoneSpan = clamp(depth * 0.4, 65, 200)
  // Row spacing covers the entire zone excursion, approach, and hull length.
  // Zone changes cannot send a rear row through the row ahead of it.
  const rowDepth = row * (depth * 1.7 + 110)
  const lateralAmplitude = Math.min(spacing * 0.045, 6) * agility
  const radialAmplitude = Math.min(depth * 0.13, 50) * (0.45 + agility * 0.55)
  const height = (lane % 3 - 1) * Math.min(spacing * 0.15, 24)

  const position = (at: number) => {
    const local = Math.max(0, at - ship.start)
    const bearing = angle + ORBIT_RATE * at
    const progress = sampleMotionProgress(ship, at)
    // A long closing run changes the distance between opposing fleets even
    // under a tracking camera. It therefore produces real foreground/background
    // parallax rather than simply spinning an otherwise rigid tableau.
    const approach = (70 + size * 0.6) * Math.exp(-local / 45)
    const radius = 150 + size * 0.65 + rowDepth + zoneSpan * (1 - progress) + approach
      + Math.sin(local * 0.16 + phase) * radialAmplitude
    const lateral = slot + Math.sin(local * 0.23 + phase) * lateralAmplitude
    return {
      x: Math.cos(bearing) * radius - Math.sin(bearing) * lateral,
      y: height + Math.sin(local * 0.17 + phase) * (2 + agility * 6),
      z: Math.sin(bearing) * radius + Math.cos(bearing) * lateral,
    }
  }

  if (ship.kind === 'station') {
    // Stations never inherit fleet orbit, zone maneuvers, or disabled drift.
    const radius = 150 + size * 0.65 + rowDepth
    // A fixed installation occupies a separate orbital layer so a sweeping
    // neighboring flight lane cannot pass through its stationary structure.
    return { x: Math.cos(angle) * radius - Math.sin(angle) * slot, y: height - (size * 0.9 + 120),
      z: Math.sin(angle) * radius + Math.cos(angle) * slot, yaw: Math.PI - angle, bank: 0, thrust: 0 }
  }

  const sampledAt = Math.max(ship.start, ship.fate === 'survived' ? time : Math.min(time, ship.end))
  const base = position(sampledAt)
  const previousAt = Math.max(ship.start, sampledAt - 0.01)
  const previous = position(previousAt)
  const next = position(sampledAt + 0.01)
  const interval = sampledAt + 0.01 - previousAt
  const velocity = { x: (next.x - previous.x) / interval, y: (next.y - previous.y) / interval, z: (next.z - previous.z) / interval }
  const yaw = Math.atan2(-velocity.z, velocity.x)
  const local = sampledAt - ship.start
  const bank = Math.sin(local * 0.23 + phase) * agility * 0.19
  const after = Math.max(0, time - ship.end)
  const normalThrust = 0.95 + Math.sin(local * 0.31 + phase) * agility * 0.18
  if (time < ship.end || ship.fate === 'survived') return { ...base, yaw, bank, thrust: normalThrust }

  if (ship.fate === 'escaped' || ship.fate === 'withdrawn') {
    // Velocity matches the live trajectory at departure; acceleration then
    // pulls the ship out of its formation rather than teleporting it away.
    const bearing = angle + ORBIT_RATE * ship.end
    const acceleration = ship.fate === 'escaped' ? 24 : 12
    const boost = after * after * acceleration
    const forwardX = velocity.x + Math.cos(bearing) * after * acceleration * 2
    const forwardZ = velocity.z + Math.sin(bearing) * after * acceleration * 2
    return { x: base.x + velocity.x * after + Math.cos(bearing) * boost,
      y: base.y + velocity.y * after, z: base.z + velocity.z * after + Math.sin(bearing) * boost,
      yaw: Math.atan2(-forwardZ, forwardX), bank: bank * Math.exp(-after), thrust: normalThrust + Math.min(1, after * 0.6) }
  }

  // Preserve momentum through a knockout, capture, or destruction. The visible
  // wreck/disabled hull settles gradually while all propulsion stops at fate.
  const drag = ship.fate === 'destroyed' ? 8 : 5
  const drift = drag * (1 - Math.exp(-after / drag))
  const roll = ship.fate === 'captured' ? 0 : (seed % 2 ? 1 : -1) * 0.045 * after
  return { x: base.x + velocity.x * drift, y: base.y + velocity.y * drift - after * after * 0.015,
    z: base.z + velocity.z * drift, yaw, bank: bank + roll, thrust: 0 }
}
