import type { CinemaFilm, CinemaShot } from './types'

type CoverageKind = 'arrival' | 'loss' | 'impact'
interface CoverageBeat { time: number; kind: CoverageKind; score: number }
interface Interval { start: number; end: number }

function freeIntervals(blocked: Interval[], duration: number): Interval[] {
  const result: Interval[] = []
  let start = 0
  for (const interval of [...blocked].sort((a, b) => a.start - b.start)) {
    const end = Math.max(0, Math.min(duration, interval.start))
    if (end > start) result.push({ start, end })
    start = Math.max(start, Math.min(duration, interval.end))
  }
  if (start < duration) result.push({ start, end: duration })
  return result
}

/** Add a few fleet masters without retiming any recorded action or hull state. */
export function addBattlefieldCoverage(film: CinemaFilm): CinemaShot[] {
  if (!film.shots.length || film.duration < 6) return film.shots.map(shot => ({ ...shot }))
  const activeAt = (time: number) => film.ships.filter(ship => ship.start <= time && ship.end > time)
  const substantial = (count: number, active: number) => count >= 6 || count >= Math.max(3, Math.ceil(active * .15))
  const events = film.ships.flatMap(ship => [
    ...(ship.start > 0 ? [{ time: ship.start, kind: 'arrival' as const, id: ship.id, side: ship.sideId }] : []),
    ...(ship.fate !== 'survived' ? [{ time: ship.end, kind: 'loss' as const, id: ship.id, side: ship.sideId }] : []),
  ]).sort((a, b) => a.time - b.time)
  const beats: CoverageBeat[] = []
  for (let index = 0; index < events.length;) {
    const time = events[index].time
    const group = []
    while (index < events.length && events[index].time <= time + 1.5) group.push(events[index++])
    const before = activeAt(time - .001), oldSides = new Set(before.map(ship => ship.sideId))
    const arrivals = group.filter(event => event.kind === 'arrival'), losses = group.filter(event => event.kind === 'loss')
    const newSide = arrivals.some(event => !oldSides.has(event.side))
    if (arrivals.length && (newSide || arrivals.length >= Math.max(1, Math.ceil(before.length * .2)))) {
      beats.push({ time: arrivals[0].time, kind: 'arrival', score: 5 + arrivals.length / Math.max(1, before.length) * 8 + Number(newSide) * 8 })
    }
    if (substantial(losses.length, before.length)) {
      beats.push({ time: losses[0].time, kind: 'impact', score: 10 + losses.length / Math.max(1, before.length) * 10 })
    } else if (losses.length >= Math.max(2, Math.ceil(before.length * .2))) {
      beats.push({ time: losses[0].time, kind: 'loss', score: 3 + losses.length / Math.max(1, before.length) * 4 })
    }
  }
  const volleys = new Map<string, { time: number; targets: Set<string> }>()
  for (const cue of film.cues) {
    if (cue.kind !== 'weapon' || cue.hit === false || !cue.to) continue
    const key = cue.parentId ?? cue.id
    const volley = volleys.get(key) ?? { time: cue.time + cue.duration, targets: new Set<string>() }
    volley.time = Math.min(volley.time, cue.time + cue.duration)
    volley.targets.add(cue.to); volleys.set(key, volley)
  }
  for (const volley of volleys.values()) if (substantial(volley.targets.size, activeAt(volley.time - .001).length)) {
    beats.push({ time: volley.time, kind: 'impact', score: 10 + volley.targets.size / Math.max(1, activeAt(volley.time - .001).length) * 10 })
  }

  const windows: Interval[] = [{ start: 0, end: 4 }]
  const limit = Math.min(3, Math.max(1, Math.floor(film.duration / 45)))
  for (const beat of beats.sort((a, b) => b.score - a.score || a.time - b.time)) {
    if (windows.length > limit) break
    const preferred = Math.max(6, beat.time + (beat.kind === 'loss' ? 2.4 : -.5))
    const latest = beat.kind === 'impact' ? beat.time : preferred + 8
    // Keep every selected muzzle readable. An area attack's impact is itself
    // the reason for its master shot, so only that impact may replace a closeup.
    const protectedSpans: Interval[] = film.shots.filter(shot => shot.role === 'fire').map(shot => ({ start: shot.start, end: shot.end }))
    for (const sequence of film.story?.sequences ?? []) {
      const end = Math.max(sequence.impactTime, sequence.consequenceTime ?? sequence.impactTime) + 2.4
      const areaImpact = beat.kind === 'impact' && beat.time >= sequence.impactTime - 1.5 && beat.time <= end
      if (!areaImpact) protectedSpans.push({ start: sequence.actionTime - .6, end })
    }
    for (const window of windows) protectedSpans.push({ start: window.start - 4, end: window.end + 4 })
    let selected: Interval | undefined
    for (const free of freeIntervals(protectedSpans, film.duration)) {
      let start = Math.max(preferred, free.start)
      if (start > latest || start + 4 > free.end) continue
      const containingStart = film.shots.find(shot => shot.start < start && shot.end > start)
      if (containingStart && start - containingStart.start < 1.5) {
        const alignImpact = beat.kind === 'impact' && preferred - containingStart.start <= 1.5
        start = containingStart.start >= free.start && (containingStart.start >= preferred || alignImpact) ? containingStart.start : containingStart.start + 1.5
      }
      if (start > latest) continue
      let end = Math.min(start + 4.5, free.end)
      const containingEnd = film.shots.find(shot => shot.start < end && shot.end > end)
      if (containingEnd && containingEnd.end - end < 1.5) {
        if (containingEnd.end <= free.end && containingEnd.end - start <= 6) end = containingEnd.end
        else end = containingEnd.end - 1.5
      }
      if (end - start < 4 || end - start > 6) continue
      selected = { start, end }; break
    }
    if (selected) windows.push(selected)
  }

  let result = film.shots.map(shot => ({ ...shot }))
  for (const window of windows.sort((a, b) => a.start - b.start)) {
    const base = film.shots.find(shot => shot.start <= window.start && shot.end > window.start) ?? film.shots[0]
    result = result.flatMap(shot => {
      if (shot.end <= window.start || shot.start >= window.end) return [shot]
      return [...(shot.start < window.start ? [{ ...shot, end: window.start }] : []),
        ...(shot.end > window.end ? [{ ...shot, start: window.end }] : [])]
    })
    result.push({ ...base, ...window, kind: 'reveal', role: 'geography', battlefield: true, focusIds: undefined, actionTime: undefined })
  }
  return result.sort((a, b) => a.start - b.start)
}
