import type { CinemaCue } from './types'
import { cueRange } from './playback'
import { resolveWeaponFamily } from './weapons'

export interface CinemaAudioCue extends CinemaCue {
  audioPhase?: 'charge' | 'release' | 'impact' | 'shield-impact' | 'contact'
  audioActorId?: string
}

export function buildAudioSchedule(cues: readonly CinemaCue[]): CinemaAudioCue[] {
  const schedule: CinemaAudioCue[] = []
  const losses = new Map<string, CinemaCue[]>()
  for (const cue of cues) if (cue.to && (cue.kind === 'death' || cue.kind === 'knockout')) {
    const key = `${cue.to}:${cue.tick}`
    const group = losses.get(key) ?? []
    group.push(cue); losses.set(key, group)
  }
  const impacts = new Map<string, CinemaAudioCue>()
  const score = (cue: CinemaAudioCue) => (cue.hullDamage ?? 0) > 0
    ? 100 + (['missile', 'torpedo', 'plasma', 'mine', 'smartbomb', 'flak'].includes(cue.weaponFamily ?? '') ? 10 : 0) + cue.intensity
    : cue.intensity
  for (const cue of cues) {
    if (cue.parentId) continue
    if (cue.kind !== 'weapon') { schedule.push({ ...cue, audioActorId: cue.to ?? cue.from }); continue }
    const impactTime = cue.time + Math.max(.015, cue.duration)
    const family = cue.weaponFamily ?? resolveWeaponFamily(cue.weaponName, cue.damageType)
    const event = (phase: NonNullable<CinemaAudioCue['audioPhase']>, time: number, audioActorId = cue.from): CinemaAudioCue =>
      ({ ...cue, id: `${cue.id}:audio:${phase}`, time, weaponFamily: family, audioPhase: phase, audioActorId })
    if (cue.secondaryKind === 'retaliation' || /galvanic hull grid/i.test(cue.weaponName ?? '')) {
      if (cue.hit) schedule.push(event('contact', impactTime))
      continue
    }
    // Match the railgun's half-flight charge and release in weaponVisual().
    const releaseTime = family === 'railgun' ? cue.time + Math.max(.015, cue.duration) * .5 : cue.time
    if (family === 'railgun') schedule.push({ ...event('charge', cue.time), duration: releaseTime - cue.time })
    schedule.push(event('release', releaseTime))
    if (!cue.hit || !cue.to) continue
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
  return schedule.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
}

export function audioCueRange(cues: readonly CinemaAudioCue[], from: number, to: number): readonly CinemaAudioCue[] {
  return cueRange(cues, from, to)
}
