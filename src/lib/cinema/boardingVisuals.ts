import { Vector3 } from 'three'
import type { CinemaCue } from './types'
import type { WeaponVisualFrame } from './weaponVisuals'

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const sizeOf = (size: number) => Number.isFinite(size) ? clamp(size, 1, 400) : 16
const finite = (point: Vector3) => point.toArray().every(Number.isFinite)

/** Qualitative, hull-local boarding contact. Endpoints are actor centers. No
 * phase depicts personnel counts, launched marines, or a penetrating weapon.
 * Every frame is sampled from absolute cue age and owns its output vectors. */
export function boardingVisual(cue: CinemaCue, age: number, from: Vector3, to: Vector3,
  sourceSize: number, targetSize: number, reducedMotion = false): WeaponVisualFrame {
  const frame: WeaponVisualFrame = { lines: [], glows: [], rings: [], projectiles: [] }
  if (cue.kind !== 'boarding' || !cue.boardingPhase || !Number.isFinite(age) ||
      !Number.isFinite(cue.duration) || cue.duration <= 0 || age < 0 || age >= cue.duration ||
      !finite(from) || !finite(to)) return frame

  const source = sizeOf(sourceSize), target = sizeOf(targetSize)
  const direction = to.clone().sub(from), distance = direction.length()
  if (distance > .00001) direction.divideScalar(distance)
  else direction.set(1, 0, 0)
  const side = new Vector3(-direction.z, 0, direction.x)
  if (side.lengthSq() < .00001) side.set(1, 0, 0)
  side.normalize()
  const up = direction.clone().cross(side).normalize()
  const contact = to.clone().addScaledVector(direction, -Math.min(target * .42, distance * .25))
  const unit = clamp(target * .06, .8, 16)
  const progress = age / cue.duration
  const envelope = Math.sin(Math.PI * progress)
  const tint = cue.boardingPhase === 'plunder' ? 0xc9b27d : 0xcfa475
  const glow = (position: Vector3, radius: number, opacity: number, color = tint) =>
    frame.glows.push({ position: position.clone(), radius, color, opacity: clamp(opacity, 0, 1) * (reducedMotion ? .5 : 1) })
  const line = (a: Vector3, b: Vector3, width: number, color = 0x87949b) =>
    frame.lines.push({ from: a.clone(), to: b.clone(), width, color })

  if (cue.boardingPhase === 'approach') {
    // Closing is navigation evidence, not evidence that the hull was latched.
    return frame
  }

  if (cue.boardingEnded && cue.boardingPhase !== 'plunder') {
    // Even a defeated force can end an operation. A contact light going dark
    // says nothing about whether personnel survived or returned to their ship.
    glow(contact, unit * 1.8, (1 - progress) * .2, 0x9ca5ab)
    return frame
  }

  const releasing = cue.boardingPhase === 'withdraw' || cue.boardingPhase === 'plunder'
  // Safe cinematic berths leave space between hulls. Span that gap with two
  // dull construction rails and transverse clamps, anchored outside both hull
  // centers. A first historical latch cue cannot connect distant formations.
  if (distance <= (source + target) * 2) {
    const sourceContact = from.clone().addScaledVector(direction, Math.min(source * .3, distance * .25))
    const start = sourceContact.lerp(contact, releasing ? progress : 0)
    for (const sign of [-1, 1]) {
      const offset = side.clone().multiplyScalar(sign * unit * .45)
      line(start.clone().add(offset), contact.clone().add(offset), unit * .25)
    }
    for (const endpoint of [start, contact])
      line(endpoint.clone().addScaledVector(side, -unit), endpoint.clone().addScaledVector(side, unit), unit * .35)
  }

  if (cue.boardingPhase === 'breach') {
    glow(contact, unit * 2.2, envelope * .55)
    // A few short warm contact sparks, with no cargo or personnel symbolism.
    if (!reducedMotion) for (let index = 0; index < 3; index++) {
      const phase = (progress * 2 + index / 3) % 1
      const angle = index * 2.399 + (cue.tick % 17) * .21
      const outward = side.clone().multiplyScalar(Math.cos(angle)).addScaledVector(up, Math.sin(angle))
      const start = contact.clone().addScaledVector(outward, unit * phase)
      line(start, start.clone().addScaledVector(outward, unit * .8 * (1 - phase)), unit * .08 * envelope, 0xefb36e)
    }
  } else if (cue.boardingPhase === 'assault') {
    // These soft contact pulses represent an ongoing internal struggle, not
    // recorded hull penetration, casualty counts, or a fabricated explosion.
    const pulse = reducedMotion ? .65 : .5 + .5 * Math.pow(Math.sin(progress * Math.PI * 3), 2)
    glow(contact, unit * 2, envelope * pulse * .5)
    if (!reducedMotion) for (const sign of [-1, 1]) {
      const edge = contact.clone().addScaledVector(side, sign * unit * .8)
      line(edge, edge.clone().addScaledVector(up, unit * .7 * pulse), unit * .09, 0xe7aa72)
    }
  } else if (releasing) {
    glow(contact, unit * 1.8, (1 - progress) * .22)
    if (cue.boardingPhase === 'plunder') glow(contact, unit * (1.8 + progress * .6), envelope * .35)
  }
  return frame
}
