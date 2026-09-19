import { Vector3 } from 'three'
import type { CinemaCue } from './types'
import type { WeaponLine, WeaponVisualFrame } from './weaponVisuals'

export interface BoardingVisualFrame extends WeaponVisualFrame { structuralLines: WeaponLine[] }

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const sizeOf = (size: number) => Number.isFinite(size) ? clamp(size, 1, 400) : 16
const finite = (point: Vector3) => point.toArray().every(Number.isFinite)
const smooth = (value: number) => { const p = clamp(value, 0, 1); return p * p * (3 - 2 * p) }
const CONTACT_PHASE = .45

/** Qualitative boarding choreography. Optional sockets anchor to real hull surfaces; moving
 * accents show activity along an attached structure, never personnel counts.
 * Every frame is sampled from absolute cue age and owns its output vectors. */
export function boardingVisual(cue: CinemaCue, age: number, from: Vector3, to: Vector3,
  sourceSize: number, targetSize: number, reducedMotion = false,
  sockets?: { from: Vector3; to: Vector3 }): BoardingVisualFrame {
  const frame: BoardingVisualFrame = { structuralLines: [], lines: [], glows: [], rings: [], projectiles: [] }
  if (cue.kind !== 'boarding' || !cue.boardingPhase || !Number.isFinite(age) ||
      !Number.isFinite(cue.duration) || cue.duration <= 0 || age < 0 || age >= cue.duration ||
      !finite(from) || !finite(to)) return frame

  const source = sizeOf(sourceSize), target = sizeOf(targetSize)
  if (sockets && (!finite(sockets.from) || !finite(sockets.to))) return frame
  const centerDistance = from.distanceTo(to)
  if (!Number.isFinite(centerDistance)) return frame
  // Surface-aware calls must actually reach the hull. Legacy callers retain the
  // conservative center-distance fallback until they can provide real sockets.
  if (sockets ? sockets.from.distanceTo(sockets.to) > Math.max(3, Math.min(source, target) * .25)
    : centerDistance > (source + target) * 1.15) return frame
  const direction = (sockets ? sockets.to.clone().sub(sockets.from) : to.clone().sub(from))
  const distance = direction.length()
  if (!Number.isFinite(distance)) return frame
  if (distance > .00001) direction.divideScalar(distance)
  else direction.set(1, 0, 0)
  const side = new Vector3(-direction.z, 0, direction.x)
  if (side.lengthSq() < .00001) side.set(1, 0, 0)
  side.normalize()
  const up = direction.clone().cross(side).normalize()
  const contact = sockets ? sockets.to.clone()
    : to.clone().addScaledVector(direction, -Math.min(target * .42, centerDistance * .25))
  const sourceContact = sockets ? sockets.from.clone()
    : from.clone().addScaledVector(direction, Math.min(source * .3, centerDistance * .25))
  // A capital boarding a tiny hull still needs a readable contact. The geometric
  // mean gives the connection presence, while the target cap keeps its flare local.
  const unit = clamp(Math.min(target * .6, Math.max(target * .06, Math.sqrt(source * target) * .075)), .8, 20)
  const structureUnit = clamp(Math.min(source, target) * .07, .12, 2)
  const contactRadius = Math.min(target * .95, unit * 3.2)
  const progress = age / cue.duration
  const envelope = Math.sin(Math.PI * progress)
  const tint = cue.boardingPhase === 'plunder' ? 0xc9b27d : 0xcfa475
  const glow = (position: Vector3, radius: number, opacity: number, color = tint) =>
    frame.glows.push({ position: position.clone(), radius, color, opacity: clamp(opacity, 0, 1) * (reducedMotion ? .5 : 1) })
  const structure = (a: Vector3, b: Vector3, width: number) =>
    frame.structuralLines.push({ from: a.clone(), to: b.clone(), width, color: 0x71808a })
  const line = (a: Vector3, b: Vector3, width: number, color = 0x87949b) =>
    frame.lines.push({ from: a.clone(), to: b.clone(), width, color })

  if (cue.boardingPhase === 'approach') return frame
  if (cue.boardingEnded && cue.boardingPhase !== 'plunder') {
    // An extinguishing contact light says nothing about surviving personnel.
    glow(contact, unit * 1.8, (1 - progress) * .2, 0x9ca5ab)
    return frame
  }

  const releasing = cue.boardingPhase === 'withdraw' || cue.boardingPhase === 'plunder'
  const extension = cue.boardingPhase === 'breach' ? smooth(progress / CONTACT_PHASE) : 1
  const start = sourceContact.clone().lerp(contact, releasing ? progress : 0)
  const head = sourceContact.clone().lerp(contact, extension)
  if (extension > 0) {
    // Paired dull rails and transverse clamps distinguish a physical hookup
    // from gunfire. The breach extends before contact; release retracts it.
    for (const sign of [-1, 1]) {
      const offset = side.clone().multiplyScalar(sign * structureUnit * .45)
      structure(start.clone().add(offset), head.clone().add(offset), structureUnit * .12)
    }
    for (const endpoint of [start, head])
      structure(endpoint.clone().addScaledVector(side, -structureUnit), endpoint.clone().addScaledVector(side, structureUnit), structureUnit * .18)
  }
  const arcs = (strength: number) => {
    if (reducedMotion || strength <= 0) return
    const arcSpan = Math.min(unit * 2.6, Math.min(source, target) * .3)
    for (const sign of [-1, 1]) {
      const edge = contact.clone().addScaledVector(side, sign * arcSpan * .5)
      const bend = contact.clone().addScaledVector(side, sign * arcSpan * .22)
        .addScaledVector(up, arcSpan * (.14 + .10 * Math.sin(progress * 25 + sign)))
      line(edge, bend, unit * .013 * strength, 0xf1b978)
      line(bend, contact, unit * .013 * strength, 0xffdbad)
    }
  }
  const transfer = (phase: number, strength: number) => {
    if (reducedMotion || phase < 0 || phase > 1) return
    const position = sourceContact.clone().lerp(contact, smooth(phase))
    glow(position, unit * 1.3, Math.sin(phase * Math.PI) * strength, 0xc6d7d8)
  }

  if (cue.boardingPhase === 'breach') {
    if (progress < CONTACT_PHASE) {
      glow(head, unit * .85, envelope * .4, 0xb1c2c7)
    } else {
      const flash = clamp(1 - Math.abs(progress - .54) / .1, 0, 1)
      glow(contact, contactRadius, flash * .85 + (1 - progress) * .2)
      glow(contact, unit * .75, flash * .95, 0xffeed0)
      arcs(Math.max(flash, envelope * .3))
      // One broad continuous accent is qualitative activity after attachment,
      // not a packet or a count of marines. No accent moves during approach.
      transfer((progress - .56) / .44, .65)
    }
  } else if (cue.boardingPhase === 'assault') {
    const pulse = reducedMotion ? .65 : .2 + .8 * Math.pow(Math.sin(progress * Math.PI * 3), 2)
    glow(contact, contactRadius * (.65 + pulse * .35), envelope * pulse * .65)
    glow(contact, unit * .7, envelope * pulse * .75, 0xffddb3)
    arcs(envelope * pulse)
    transfer((progress * 2) % 1, envelope * .5)
  } else if (releasing) {
    glow(contact, unit * 1.8, (1 - progress) * .22)
    if (cue.boardingPhase === 'plunder') glow(contact, unit * (1.8 + progress * .6), envelope * .35)
  }
  return frame
}
