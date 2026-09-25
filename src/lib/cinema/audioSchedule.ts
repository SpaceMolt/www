import type { CinemaCue, CinemaShot } from './types'
import { cueRange } from './playback'
import { resolveWeaponFamily } from './weapons'
import { hashString } from './synth'

export interface CinemaAudioCue extends CinemaCue {
  audioPhase?: 'charge' | 'release' | 'impact' | 'shield-impact' | 'contact' | 'miss'
  audioActorId?: string
  /** Outside the shot's featured group: heard far away, under the foreground. */
  audioDistant?: boolean
  /** Losses sharing one moment; the first carries a cascade sized by the count. */
  audioMass?: number
  /** Ordinal of a boarding cue within its operation (grapples climb) or of an arrival wave (later waves are shorter). */
  audioStep?: number
  /** One pop in the wide cascade that follows a mass loss. */
  audioCascade?: boolean
}

const explosive = ['missile', 'torpedo', 'plasma', 'mine', 'smartbomb', 'flak']
/** Seconds a warp-in's riser plays before the ship appears. */
export const ARRIVAL_LEAD = .6

export function buildAudioSchedule(cues: readonly CinemaCue[], shots: readonly CinemaShot[] = []): CinemaAudioCue[] {
  const schedule: CinemaAudioCue[] = []
  const featured = (cue: CinemaCue, time: number) => {
    const shot = shots.find(s => time >= s.start && time < s.end)
    const ids = shot ? [...shot.focusIds ?? [], shot.subject, shot.target].filter(Boolean) : []
    return !ids.length || [cue.from, cue.to].some(id => id && ids.includes(id))
  }
  const losses = new Map<string, CinemaCue[]>()
  for (const cue of cues) if (cue.to && (cue.kind === 'death' || cue.kind === 'knockout')) {
    const key = `${cue.to}:${cue.tick}`
    const group = losses.get(key) ?? []
    group.push(cue); losses.set(key, group)
  }
  const impacts = new Map<string, CinemaAudioCue>()
  const score = (cue: CinemaAudioCue) => (cue.hullDamage ?? 0) > 0
    ? 100 + (explosive.includes(cue.weaponFamily ?? '') ? 10 : 0) + cue.intensity
    : cue.intensity
  const lost: CinemaCue[] = []
  const steps = new Map<string, number>()
  for (const cue of cues) {
    if (cue.parentId) continue
    if (cue.kind === 'death' || cue.kind === 'knockout') { lost.push(cue); continue }
    if (cue.kind !== 'weapon') {
      const time = cue.kind === 'arrival' ? Math.max(0, cue.time - ARRIVAL_LEAD) : cue.time
      const operation = cue.operationId ?? `${cue.from}:${cue.to}`
      const key = cue.kind === 'arrival' ? 'arrival' : operation
      const previous = schedule.findLast(other => other.kind === 'arrival')
      // Ships warping in together are one wave: one sound sized by the wave.
      if (cue.kind === 'arrival' && previous && time - previous.time < .3) { previous.audioMass = (previous.audioMass ?? 1) + 1; continue }
      const audioStep = cue.kind === 'boarding' || cue.kind === 'arrival' ? steps.get(key) ?? 0 : undefined
      if (audioStep !== undefined) steps.set(key, audioStep + 1)
      schedule.push({ ...cue, time, audioActorId: cue.to ?? cue.from, audioDistant: !featured(cue, cue.time), audioStep })
      continue
    }
    const impactTime = cue.time + Math.max(.015, cue.duration)
    const family = cue.weaponFamily ?? resolveWeaponFamily(cue.weaponName, cue.damageType)
    const distant = !featured(cue, cue.time)
    const event = (phase: NonNullable<CinemaAudioCue['audioPhase']>, time: number, audioActorId = cue.from): CinemaAudioCue =>
      ({ ...cue, id: `${cue.id}:audio:${phase}`, time, weaponFamily: family, audioPhase: phase, audioActorId, audioDistant: distant })
    if (cue.secondaryKind === 'retaliation' || /galvanic hull grid/i.test(cue.weaponName ?? '')) {
      if (cue.hit) schedule.push(event('contact', impactTime))
      continue
    }
    // Match the railgun's half-flight charge and release in weaponVisual().
    const releaseTime = family === 'railgun' ? cue.time + Math.max(.015, cue.duration) * .5 : cue.time
    if (family === 'railgun' && !distant) schedule.push({ ...event('charge', cue.time), duration: releaseTime - cue.time })
    schedule.push(event('release', releaseTime))
    if (!cue.to) continue
    // A miss passes the target as a quiet whoosh; background misses stay silent.
    if (!cue.hit) { if (!distant) schedule.push(event('miss', impactTime, cue.to)); continue }
    const key = `${cue.to}:${cue.tick}`
    // A nearby destruction/knockout already supplies the decisive impact sound.
    if (losses.get(key)?.some(loss => loss.time >= impactTime - .001 && loss.time - impactTime <= 1.2)) continue
    const impact = event((cue.hullDamage ?? 0) > 0 ? 'impact' : 'shield-impact', impactTime, cue.to)
    // Many guns land together. One representative hit per victim/source tick
    // preserves a readable transient instead of multiplying the same explosion.
    const previous = impacts.get(key)
    if (!previous || score(impact) > score(previous)) impacts.set(key, impact)
  }
  schedule.push(...impacts.values())

  // Simultaneous losses: the first few are staggered and heard in full. A mass
  // loss then spreads into a wide cascade of small, separately pitched pops.
  lost.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
  for (let i = 0; i < lost.length;) {
    let j = i
    while (j < lost.length && lost[j].time - lost[i].time < .12) j++
    const group = lost.slice(i, j).sort((a, b) => Number(featured(b, b.time)) - Number(featured(a, a.time)) || b.intensity - a.intensity || a.id.localeCompare(b.id))
    const mass = group.length >= 8, heard = group.slice(0, mass ? 52 : 12), spread = Math.min(4.5, 1.5 + .04 * group.length)
    let offset = 0
    heard.forEach((cue, k) => {
      const r = hashString(cue.id) / 4294967296
      if (mass && k >= 4) offset = .9 + spread * ((k - 4 + r) / (heard.length - 4)) ** 1.5
      else if (k) offset += k < 4 ? .15 + .15 * r : Math.min(.35, 2.2 / Math.max(1, heard.length - 4)) * (.6 + .8 * r)
      schedule.push({ ...cue, time: cue.time + offset, audioActorId: cue.to ?? cue.from, audioDistant: k >= 4 || !featured(cue, cue.time), audioMass: k ? undefined : group.length, audioCascade: mass && k >= 4 ? true : undefined })
    })
    i = j
  }
  schedule.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))

  // Density budget: a massed battle keeps a few readable transients per moment.
  const recent = new Map<string, number[]>()
  return schedule.filter(cue => {
    const budget = cue.kind === 'arrival' ? ['arrival', .3, 1]
      : cue.audioPhase === 'release' || cue.audioPhase === 'charge' ? cue.audioDistant ? ['far', .12, 1] : [`near:${cue.weaponFamily}`, .08, 3]
      : cue.audioPhase === 'miss' ? ['miss', .2, 1]
      : cue.audioPhase === 'impact' || cue.audioPhase === 'shield-impact' ? cue.audioDistant ? ['farhit', .25, 1] : ['hit', .06, 2]
      : undefined
    if (!budget) return true
    const [key, window, count] = budget as [string, number, number]
    const times = (recent.get(key) ?? []).filter(time => cue.time - time < window)
    if (times.length >= count) return false
    recent.set(key, [...times, cue.time])
    return true
  })
}

export function audioCueRange(cues: readonly CinemaAudioCue[], from: number, to: number): readonly CinemaAudioCue[] {
  return cueRange(cues, from, to)
}
