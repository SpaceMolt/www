import type { CinemaCue } from './types'
import { weaponImpactAge } from './playback'

export interface CascadePoint { x: number; y: number; z: number }
export type CascadeFate = 'hit' | 'knockout' | 'death'
export interface CascadeRecipient {
  actorId: string
  cueId: string
  position: CascadePoint
  distance: number
  delay: number
  intensity: number
  fate: CascadeFate
  /** A local accent must not depict destruction before the recorded loss. */
  fateTime?: number
  shield: boolean
}
export interface CinemaCascadePlan {
  id: string
  sourceCueId: string
  kind: 'aoe' | 'ammo_splash' | 'chain'
  time: number
  duration: number
  pulseDuration: number
  center: CascadePoint
  radius: number
  damageType?: string
  recipients: CascadeRecipient[]
}
export interface CascadePulse extends CascadeRecipient { age: number; opacity: number }
export interface CinemaCascadeFrame {
  wave?: { center: CascadePoint; radius: number; opacity: number }
  pulses: CascadePulse[]
  links: { fromActorId: string; toActorId: string; from: CascadePoint; to: CascadePoint; opacity: number }[]
}

const finitePoint = (point: CascadePoint | undefined): point is CascadePoint =>
  !!point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)
const distance = (a: CascadePoint, b: CascadePoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))

/** A spatial presentation of confirmed collateral. Positions are sampled once
 * at the primary impact, so arbitrary playback seeks produce the same front.
 * Area/splash share a wave; chains hop between connected recipients. Neither
 * invents participants, additional damage, or changes lifecycle timestamps.
 */
export function buildCinemaCascades(
  cues: readonly CinemaCue[],
  positionAt: (actorId: string, time: number) => CascadePoint | undefined,
): CinemaCascadePlan[] {
  const byId = new Map(cues.map(cue => [cue.id, cue]))
  const losses = new Map<string, CinemaCue[]>()
  const groups = new Map<string, { primary: CinemaCue; kind: CinemaCascadePlan['kind']; hits: CinemaCue[] }>()
  for (const cue of cues) {
    if (cue.to && (cue.kind === 'death' || cue.kind === 'knockout')) {
      const key = `${cue.to}:${cue.tick}`, list = losses.get(key) ?? []
      list.push(cue); losses.set(key, list)
    }
    if (cue.kind !== 'weapon' || !cue.parentId || cue.hit !== true || !cue.to ||
      !['aoe', 'ammo_splash', 'chain'].includes(cue.secondaryKind ?? '')) continue
    const primary = byId.get(cue.parentId)
    if (!primary?.to || primary.kind !== 'weapon' || primary.parentId || !Number.isFinite(primary.time) || !Number.isFinite(primary.duration)) continue
    const kind = cue.secondaryKind as CinemaCascadePlan['kind']
    const key = `${primary.id}:${kind === 'chain' ? 'chain' : 'area'}`
    const group = groups.get(key) ?? { primary, kind, hits: [] }
    if (kind === 'aoe') group.kind = 'aoe'
    group.hits.push(cue); groups.set(key, group)
  }
  const plans: CinemaCascadePlan[] = []
  for (const [id, group] of groups) {
    const { primary, kind } = group
    const time = primary.time - weaponImpactAge(primary, primary.time)
    const center = positionAt(primary.to!, time)
    if (!finitePoint(center)) continue
    const unique = new Map<string, CinemaCue>()
    if (primary.hit === true) unique.set(primary.to!, primary)
    for (const hit of group.hits) {
      const previous = unique.get(hit.to!)
      if (!previous || hit.intensity > previous.intensity) unique.set(hit.to!, hit)
    }
    const recipients: CascadeRecipient[] = []
    for (const [actorId, hit] of unique) {
      const position = actorId === primary.to ? center : positionAt(actorId, time)
      if (!finitePoint(position)) continue
      const separation = distance(center, position)
      if (!Number.isFinite(separation)) continue
      const loss = losses.get(`${actorId}:${hit.tick}`)?.find(loss =>
        loss.time >= time - .001 && (!loss.from || loss.from === primary.from))
      recipients.push({ actorId, cueId: hit.id, position: { ...position }, distance: separation, delay: 0,
        intensity: clamp(loss?.intensity ?? hit.intensity), fate: loss?.kind === 'death' ? 'death' : loss?.kind === 'knockout' ? 'knockout' : 'hit',
        fateTime: loss?.time, shield: (hit.hullDamage ?? 0) <= 0 })
    }
    // At least one usable collateral recipient must remain after position checks.
    if (!recipients.some(recipient => recipient.actorId !== primary.to)) continue
    // A chain follows the supplied cue sequence, even when its next hop turns
    // inward. Only area propagation is ordered radially around the first hit.
    if (kind !== 'chain') recipients.sort((a, b) => a.distance - b.distance || a.actorId.localeCompare(b.actorId))
    const radius = Math.max(1, ...recipients.map(recipient => recipient.distance))
    const duration = clamp(1.2 + Math.log2(recipients.length + 1) * .12, 1.2, 2)
    const pulseDuration = .22, travel = duration - pulseDuration
    const route = recipients.map((recipient, index) => index ? distance(recipients[index - 1].position, recipient.position) : 0)
    const routeLength = Math.max(1, route.reduce((sum, hop) => sum + hop, 0))
    let traveled = 0
    recipients.forEach((recipient, index) => {
      // Distance preserves the outward front; rank spreads dense equal-radius
      // fleets over time. All 99 victims remain readable within 32 live pulses.
      traveled += route[index]
      const progress = kind === 'chain' ? traveled / routeLength : recipient.distance / radius
      recipient.delay = travel * (.35 * progress + .65 * index / Math.max(1, recipients.length - 1))
    })
    plans.push({ id, sourceCueId: primary.id, kind, time, duration, pulseDuration, center: { ...center }, radius,
      damageType: primary.damageType, recipients })
  }
  return plans.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
}

/** Constant output budget even for very large fleets. The expanding area front
 * covers every recorded recipient while local accents get bounded geometry.
 */
export function sampleCinemaCascade(plan: CinemaCascadePlan, time: number, maxPulses = 32): CinemaCascadeFrame {
  const frame: CinemaCascadeFrame = { pulses: [], links: [] }
  const age = time - plan.time
  if (!Number.isFinite(age) || age < 0 || age >= plan.duration) return frame
  const budget = Math.floor(clamp(maxPulses, 0, 64))
  let low = 0, high = plan.recipients.length
  while (low < high) { const mid = (low + high) >>> 1; if (plan.recipients[mid].delay <= age) low = mid + 1; else high = mid }
  const latest = low - 1
  for (let index = latest; index >= 0 && frame.pulses.length < budget; index--) {
    const recipient = plan.recipients[index], local = age - recipient.delay
    if (local > plan.pulseDuration) break
    const opacity = Math.sin(clamp(local / plan.pulseDuration) * Math.PI)
    const fate = recipient.fateTime !== undefined && time < recipient.fateTime ? 'hit' : recipient.fate
    frame.pulses.push({ ...recipient, fate, age: local, opacity })
    if (plan.kind === 'chain' && index > 0) {
      const previous = plan.recipients[index - 1]
      frame.links.push({ fromActorId: previous.actorId, toActorId: recipient.actorId, from: previous.position, to: recipient.position, opacity })
    }
  }
  if (plan.kind !== 'chain') {
    const before = plan.recipients[latest], after = plan.recipients[latest + 1]
    const start = before?.delay ?? 0, end = after?.delay ?? plan.duration
    const from = before?.distance ?? 0, to = after?.distance ?? plan.radius * 1.12
    const radius = from + (to - from) * clamp((age - start) / Math.max(.001, end - start))
    frame.wave = { center: plan.center, radius, opacity: Math.sin(clamp(age / plan.duration) * Math.PI) * .7 }
  }
  return frame
}
