import type { CinemaCue, CinemaShot } from './types'
import { cueRange } from './playback'
import { resolveWeaponFamily } from './weapons'
import { hashString } from './synth'

export interface CinemaAudioCue extends CinemaCue {
  audioPhase?: 'charge' | 'release' | 'impact' | 'shield-impact' | 'contact' | 'miss'
  audioActorId?: string
  /** Involves the shot's subject or target: mixed hot, in front of everything else. */
  audioHot?: boolean
  /** Outside the shot's featured group: heard far away, under the foreground. */
  audioDistant?: boolean
  /** Losses sharing one moment; the first carries a cascade sized by the count. */
  audioMass?: number
  /** Ordinal of a boarding cue within its operation (grapples climb) or of an arrival wave (later waves are shorter). */
  audioStep?: number
  /** Part of a mass loss: a staggered wide detonation, then the rain of small pops. */
  audioCascade?: 'detonation' | 'pop'
}

const explosive = ['missile', 'torpedo', 'plasma', 'mine', 'smartbomb', 'flak']
/** Seconds a warp-in's riser plays before the ship appears. */
export const ARRIVAL_LEAD = .6

export function buildAudioSchedule(cues: readonly CinemaCue[], shots: readonly CinemaShot[] = []): CinemaAudioCue[] {
  const schedule: CinemaAudioCue[] = []
  // Priority tiers from what the shot features: its subject and target are hot,
  // the rest of its focus group warm, everything else far.
  const shotAt = (time: number) => shots.find(s => time >= s.start && time < s.end)
  const involves = (cue: CinemaCue, ids: (string | undefined)[]) => [cue.from, cue.to].some(id => id && ids.includes(id))
  const hot = (cue: CinemaCue, time: number) => {
    const shot = shotAt(time), ids = [shot?.subject, shot?.target].filter(Boolean)
    return !ids.length || involves(cue, ids)
  }
  const featured = (cue: CinemaCue, time: number) => {
    const shot = shotAt(time), ids = shot ? [...shot.focusIds ?? [], shot.subject, shot.target].filter(Boolean) : []
    return !ids.length || involves(cue, ids)
  }
  const tier = (cue: CinemaCue, time: number) => ({ audioHot: hot(cue, time) || undefined, audioDistant: !featured(cue, time) })
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
      schedule.push({ ...cue, time, audioActorId: cue.to ?? cue.from, ...tier(cue, cue.time), audioStep })
      continue
    }
    const impactTime = cue.time + Math.max(.015, cue.duration)
    const family = cue.weaponFamily ?? resolveWeaponFamily(cue.weaponName, cue.damageType)
    const { audioHot, audioDistant: distant } = tier(cue, cue.time)
    const event = (phase: NonNullable<CinemaAudioCue['audioPhase']>, time: number, audioActorId = cue.from): CinemaAudioCue =>
      ({ ...cue, id: `${cue.id}:audio:${phase}`, time, weaponFamily: family, audioPhase: phase, audioActorId, audioHot, audioDistant: distant })
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
    if (!cue.hit) { if (audioHot) schedule.push(event('miss', impactTime, cue.to)); continue }
    // A destruction/knockout of this victim within 0.3 s supplies the impact sound.
    if (losses.get(`${cue.to}:${cue.tick}`)?.some(loss => loss.time - impactTime <= .3 && impactTime - loss.time <= .15)) continue
    const key = `${cue.to}:${Math.round(impactTime / .25)}`
    const impact = event((cue.hullDamage ?? 0) > 0 ? 'impact' : 'shield-impact', impactTime, cue.to)
    // Many guns land together. One representative hit per victim per quarter
    // second keeps a readable transient instead of multiplying the same explosion.
    const previous = impacts.get(key)
    if (!previous || score(impact) > score(previous)) impacts.set(key, impact)
  }
  schedule.push(...impacts.values())

  // Simultaneous losses: the first few are staggered and heard in full. A mass
  // loss is one big blow, a wide sequence of detonations over about two seconds
  // (more for a bigger count), then a rain of small, separately pitched pops.
  lost.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
  for (let i = 0; i < lost.length;) {
    let j = i
    while (j < lost.length && lost[j].time - lost[i].time < .12) j++
    const group = lost.slice(i, j).sort((a, b) => Number(featured(b, b.time)) - Number(featured(a, a.time)) || b.intensity - a.intensity || a.id.localeCompare(b.id))
    const mass = group.length >= 8, detonations = Math.min(20, 4 + Math.floor(group.length / 4)), heard = group.slice(0, mass ? detonations + 30 : 12)
    let offset = 0
    heard.forEach((cue, k) => {
      const r = hashString(cue.id) / 4294967296
      const audioCascade = !mass || !k ? undefined : k < detonations ? 'detonation' as const : 'pop' as const
      if (audioCascade === 'detonation') offset = .15 + 1.7 * ((k - 1 + r) / (detonations - 1)) ** 1.2
      else if (audioCascade === 'pop') offset = 1.9 + Math.min(3, .1 * (heard.length - detonations)) * ((k - detonations + r) / (heard.length - detonations)) ** 1.4
      else if (k) offset += k < 4 ? .15 + .15 * r : Math.min(.35, 2.2 / Math.max(1, heard.length - 4)) * (.6 + .8 * r)
      schedule.push({ ...cue, time: cue.time + offset, audioActorId: cue.to ?? cue.from, ...tier(cue, cue.time), audioDistant: audioCascade === 'pop' || (!mass && k >= 4) || !featured(cue, cue.time), audioMass: k ? undefined : group.length, audioCascade })
    })
    i = j
  }
  schedule.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))

  // Density budget: a massed battle keeps a few readable transients per moment.
  const recent = new Map<string, number[]>()
  return schedule.filter(cue => {
    // Hot cues keep most transients; warm and far ones are thinned hard so a dense scene stays articulate.
    const level = cue.audioHot ? 'hot' : cue.audioDistant ? 'far' : 'warm'
    const budget = cue.kind === 'arrival' ? ['arrival', .3, 1]
      : cue.audioPhase === 'release' || cue.audioPhase === 'charge' ? { hot: [`hot:${cue.weaponFamily}`, .08, 2], warm: ['warm', .25, 1], far: ['far', .5, 1] }[level]
      : cue.audioPhase === 'miss' ? ['miss', .25, 1]
      : cue.audioPhase === 'impact' || cue.audioPhase === 'shield-impact' ? { hot: ['hothit', .06, 2], warm: ['warmhit', .2, 2], far: ['farhit', .3, 1] }[level]
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
