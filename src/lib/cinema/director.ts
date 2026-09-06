import type { BattleLogEntry, BattleSummary, ParticipantSnapshot } from '../battle/types'
import type { BattleLoadPhase } from '../battle/battleData'
import { buildAttackVisualPlan } from '../battle/attackVisualPlan'
import type { CinemaCue, CinemaFilm, CinemaHealth, CinemaShip, CinemaShot, CinemaSourceSegment } from './types'

export const DIRECTOR_VERSION = 2
const OPENING = 8
const AFTERMATH = 10
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low))
const fraction = (value: number, max: number) => max > 0 ? clamp(value / max) : 0

export function cinemaHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return hash >>> 0
}

export type CinemaEligibility = 'loading' | 'active' | 'finalizing' | 'unavailable' | 'interrupted' | 'ready'

/** Reconciliation is established by the shared paginated loader, never inferred from a terminal row alone. */
export function getCinemaEligibility(
  summary: BattleSummary | null,
  entries: BattleLogEntry[],
  phase: BattleLoadPhase,
): CinemaEligibility {
  if (phase === 'loading') return 'loading'
  if (phase === 'unavailable') return 'unavailable'
  if (summary?.status === 'active' || phase === 'live') return 'active'
  const terminal = entries.find(entry => entry.battle_ended)?.battle_ended
  if (summary?.outcome === 'interrupted' || terminal?.outcome === 'interrupted') return 'interrupted'
  if (phase !== 'complete' || summary?.status !== 'completed' || !terminal) return 'finalizing'
  if (!entries.length || entries.some(entry => entry.battle_id !== summary.battle_id)) return 'unavailable'
  return 'ready'
}

function majorCount(entry: BattleLogEntry): number {
  return (entry.kills?.length ?? 0) + (entry.captures?.length ?? 0) +
    (entry.joins?.length ?? 0) + (entry.flee?.filter(event => event.escaped).length ?? 0)
}

function editSegments(entries: BattleLogEntry[], duration: number): CinemaSourceSegment[] {
  const core = duration - OPENING - AFTERMATH
  const meaningful = new Set<number>()
  const present = new Set<string>()
  const captureTargets = new Map<string, string>()
  entries.forEach((entry, index) => {
    let appearance = false
    for (const snap of entry.snapshots) {
      if (snap.hull <= 0 && !present.has(snap.player_id) && index > 0) continue
      if (!present.has(snap.player_id) && index > 0) appearance = true
      present.add(snap.player_id)
    }
    for (const join of entry.joins ?? []) present.add(join.player_id)
    for (const boarding of entry.boarding ?? []) if (boarding.target_id) captureTargets.set(boarding.operation_id, boarding.target_id)
    for (const kill of entry.kills ?? []) present.delete(kill.victim_id)
    for (const flee of entry.flee ?? []) if (flee.escaped) present.delete(flee.player_id)
    for (const capture of entry.captures ?? []) present.delete(captureTargets.get(capture.boarding_operation_id) ?? capture.former_owner_id)
    const major = majorCount(entry) - (index === 0 ? (entry.joins?.length ?? 0) : 0)
    if (appearance || major > 0 || entry.burns?.some(burn => burn.destroyed)) {
      // Give a consequence its approach and reaction, not just an isolated flash.
      for (let offset = -2; offset <= 1; offset++) {
        const candidate = index + offset
        if (candidate >= 0 && candidate < entries.length) meaningful.add(candidate)
      }
    }
  })
  const selected = new Set(meaningful)
  const action = entries.map((entry, index) => entry.attacks?.length ? index : -1).filter(index => index >= 0)
  const pool = action.length ? action : entries.map((_, index) => index)
  const ordinary = pool.filter(index => !meaningful.has(index))
  // Repeated fire/idle alternation is still repetition. Sample across the source
  // range rather than trusting adjacent signatures or allocating time per tick.
  const samples = Math.min(ordinary.length, Math.max(4, Math.floor(core * (meaningful.size ? 0.28 : 1) / 1.5)))
  for (let index = 0; index < samples; index++) {
    selected.add(ordinary[Math.floor(index * (ordinary.length - 1) / Math.max(1, samples - 1))])
  }
  if (!selected.size) selected.add(0)
  const ordinarySelected = [...selected].filter(index => !meaningful.has(index))
  const meaningfulTime = meaningful.size ? core * (ordinarySelected.length ? 0.72 : 1) : 0
  const normalTime = core - meaningfulTime
  let cursor = OPENING
  return entries.map((entry, index) => {
    const start = cursor
    if (meaningful.has(index)) cursor += meaningfulTime / meaningful.size
    else if (selected.has(index)) cursor += normalTime / ordinarySelected.length
    // Unselected ticks remain in the source mapping with zero screen duration.
    // Their state transitions are folded into the next visible beat; actual
    // joins, exits and casualties always belong to the meaningful set above.
    return { start, end: index === entries.length - 1 ? duration - AFTERMATH : cursor, tick: entry.tick }
  })
}
const rangeProgress: Record<string, number> = { outer: 0, mid: 1 / 3, inner: 2 / 3, engaged: 1 }

function appendMotion(ship: CinemaShip, time: number, zone: string): void {
  const position = rangeProgress[zone]
  if (position === undefined) return
  const frames = ship.motion ?? (ship.motion = [])
  const previous = frames.at(-1)
  if (previous?.time === time) {
    previous.position = position
    return
  }
  // Keep both ends of each constant hold, so a long wait followed by an
  // advance doesn't become a slow drift throughout all the preceding footage.
  if (previous?.position === position && frames.at(-2)?.position === position) previous.time = time
  else frames.push({ time, position })
}
function appendHealth(ship: CinemaShip, frame: CinemaHealth, force = false): void {
  const previous = ship.health[ship.health.length - 1]
  if (previous && previous.time === frame.time) {
    ship.health[ship.health.length - 1] = frame
  } else if (!previous || force || Math.abs(previous.hull - frame.hull) > 0.008 ||
    Math.abs(previous.shield - frame.shield) > 0.015 || frame.time - previous.time > 3) {
    ship.health.push(frame)
  }
}

/** Snapshot health is held until the recorded transition, avoiding damage before a shot lands. */
export function sampleCinemaHealth(ship: CinemaShip, time: number): CinemaHealth {
  let low = 0
  let high = ship.health.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (ship.health[middle].time <= time) low = middle
    else high = middle - 1
  }
  return ship.health[low] ?? { time, hull: 1, shield: 0 }
}

export function sampleCinemaShot(film: CinemaFilm, time: number): CinemaShot {
  let low = 0
  let high = film.shots.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (film.shots[middle].start <= time) low = middle
    else high = middle - 1
  }
  return film.shots[low]
}

/** Binary-searchable source mapping is useful for deterministic seeking and debugging the edit. */
export function sourceTickAt(film: CinemaFilm, time: number): number {
  let low = 0
  let high = film.segments.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (film.segments[middle].start <= time) low = middle
    else high = middle - 1
  }
  return film.segments[low]?.tick ?? 0
}

function directShots(film: CinemaFilm): CinemaShot[] {
  const openingShips = film.ships.filter(ship => ship.start === 0)
  const first = openingShips[0] ?? film.ships[0]
  const opponent = openingShips.find(ship => ship.sideId !== first?.sideId)
  const result: CinemaShot[] = []
  const coreEnd = film.duration - AFTERMATH
  const losses = film.cues.filter(cue => ['death', 'knockout', 'capture', 'escape'].includes(cue.kind))
  const clusters: { start: number; end: number; cues: CinemaCue[] }[] = []
  for (const cue of losses) {
    const start = Math.max(0, cue.time - 1.4)
    const end = Math.min(film.duration, cue.time + 2.4)
    const previous = clusters.at(-1)
    // Nearby losses share a moving coverage group. The renderer frames the
    // upcoming/recent members, rather than parking on the first casualty.
    if (previous && start <= previous.end + 1.2) {
      previous.end = Math.max(previous.end, end)
      previous.cues.push(cue)
    } else clusters.push({ start, end, cues: [cue] })
  }
  let shotIndex = 0
  const fillAction = (start: number, end: number) => {
    let cursor = start
    if (cursor === 0 && end > 0) {
      const openingEnd = Math.min(OPENING, end)
      result.push({ start: 0, end: openingEnd, kind: 'reveal', subject: first?.id, target: opponent?.id, intensity: 0.15 })
      cursor = openingEnd
    }
    while (cursor < end - 0.000001) {
      const next = Math.min(end, cursor + 5 + cinemaHash(`${film.seed}:shot:${shotIndex}`) % 4)
      const near = film.cues.filter(cue => cue.time >= cursor && cue.time < next)
      const volley = near.find(cue => cue.kind === 'weapon')
      const active = film.ships.filter(ship => ship.start <= cursor && ship.end >= cursor)
      const kinds = ['tracking', 'broadside', 'tracking', 'pursuit'] as const
      result.push({ start: cursor, end: next, kind: kinds[shotIndex % kinds.length],
        subject: volley?.from ?? active[shotIndex % Math.max(1, active.length)]?.id, target: volley?.to,
        intensity: clamp(0.25 + near.length / 28 + (volley?.intensity ?? 0) * 0.35) })
      cursor = next
      shotIndex++
    }
  }
  let cursor = 0
  for (const cluster of clusters) {
    fillAction(cursor, cluster.start)
    const event = cluster.cues[0]
    result.push({ start: cluster.start, end: cluster.end,
      kind: cluster.cues.every(cue => cue.kind === 'escape') ? 'pursuit' : 'impact',
      subject: event.to, target: event.from,
      focusIds: [...new Set(cluster.cues.flatMap(cue => cue.to ? [cue.to] : []))],
      intensity: Math.max(...cluster.cues.map(cue => cue.intensity)) })
    cursor = cluster.end
  }
  const aftermathStart = Math.max(coreEnd, cursor)
  fillAction(cursor, aftermathStart)
  const survivor = film.ships.find(ship => ship.fate === 'survived' && ship.sideId === film.winningSide)
  if (aftermathStart < film.duration) result.push({ start: aftermathStart, end: film.duration,
    kind: 'aftermath', subject: survivor?.id ?? first?.id, intensity: 0.12 })
  return result
}
/** Compile only settled completed records. The edit is pure and contains no catalog or rendering dependencies. */
export function compileBattleFilm(summary: BattleSummary, source: BattleLogEntry[], reconciled = false): CinemaFilm {
  if (!reconciled || getCinemaEligibility(summary, source, 'complete') !== 'ready') {
    throw new Error('A complete, reconciled battle record is required for cinema.')
  }
  const byTick = new Map<number, BattleLogEntry>()
  for (const entry of source) {
    if (!Number.isSafeInteger(entry.tick) || entry.tick < 0) throw new Error('Invalid battle tick.')
    byTick.set(entry.tick, entry)
  }
  const entries = [...byTick.values()].sort((a, b) => a.tick - b.tick)
  const terminalIndex = entries.findIndex(entry => entry.battle_ended)
  if (terminalIndex !== entries.length - 1) throw new Error('The battle record has rows after its terminal event.')
  const terminal = entries[terminalIndex].battle_ended!
  const arena = summary.category === 'arena' || entries.some(entry => entry.arena || entry.battle_ended?.category === 'arena')
  const meaningful = entries.reduce((count, entry, i) => count + majorCount(entry) - (i === 0 ? (entry.joins?.length ?? 0) : 0), 0)
  const duration = Math.round(clamp(38 + Math.log2(entries.length + 1) * 5 + Math.sqrt(meaningful) * 5, 40, 180))
  const segments = editSegments(entries, duration)
  const sideIds = [...new Set([...summary.sides.map(side => side.side_id), ...entries.flatMap(entry =>
    [...entry.snapshots.map(snap => snap.side_id), ...(entry.joins ?? []).map(join => join.side_id)])])].sort((a, b) => a - b)
  const sideIndices = new Map(sideIds.map((side, index) => [side, index]))
  const film: CinemaFilm = { version: DIRECTOR_VERSION, battleId: summary.battle_id,
    seed: cinemaHash(`${summary.battle_id}:${DIRECTOR_VERSION}`), duration, arena, outcome: terminal.outcome,
    winningSide: terminal.winning_side, systemName: summary.system_name, ships: [], shots: [], cues: [], segments }
  const active = new Map<string, CinemaShip>()
  const appearances = new Map<string, number>()
  const boardingTargets = new Map<string, string>()
  const latestSnapshots = new Map<string, ParticipantSnapshot>()
  const allNames = new Map<string, string>()
  for (const entry of entries) {
    for (const snap of entry.snapshots) allNames.set(snap.player_id, snap.username)
    for (const join of entry.joins ?? []) allNames.set(join.player_id, join.username)
    for (const kill of entry.kills ?? []) { allNames.set(kill.killer_id, kill.killer_username); allNames.set(kill.victim_id, kill.victim_username) }
  }
  const ensureShip = (playerId: string, time: number, snapshot?: ParticipantSnapshot, sideId = 0): CinemaShip => {
    const existing = active.get(playerId)
    if (existing) return existing
    const appearance = appearances.get(playerId) ?? 0
    appearances.set(playerId, appearance + 1)
    const snap = snapshot ?? latestSnapshots.get(playerId)
    const ship: CinemaShip = { id: `${playerId}:${appearance}`, playerId,
      name: snap?.username || allNames.get(playerId) || 'Unidentified vessel', shipClass: snap?.ship_class ?? '',
      kind: snap?.kind ?? (snap?.ship_class ? 'ship' : 'unknown'), sideId: snap?.side_id ?? sideId,
      sideIndex: sideIndices.get(snap?.side_id ?? sideId) ?? 0, factionId: snap?.faction_id,
      start: time, end: duration, fate: 'survived', health: [{ time, hull: snap ? fraction(snap.hull, snap.max_hull) : 1,
        shield: snap ? fraction(snap.shield, snap.max_shield) : 0 }] }
    if (snap) appendMotion(ship, time, snap.zone)
    film.ships.push(ship)
    active.set(playerId, ship)
    return ship
  }
  const addCue = (cue: Omit<CinemaCue, 'id'>): CinemaCue => {
    const result = { ...cue, id: `cue:${film.cues.length}` }
    film.cues.push(result)
    return result
  }
  const retired = new Set<string>()
  const budgetByTime = new Map<number, number>()
  const seenCaptures = new Set<string>()

  entries.forEach((entry, index) => {
    const segment = segments[index]
    const span = segment.end - segment.start
    const impactTime = segment.start + span * 0.72
    const fateTime = segment.start + span * 0.88
    const explicitJoins = new Set((entry.joins ?? []).map(join => join.player_id))
    for (const boarding of entry.boarding ?? []) if (boarding.target_id) boardingTargets.set(boarding.operation_id, boarding.target_id)
    for (const snap of entry.snapshots) {
      if (retired.has(snap.player_id) && snap.hull <= 0 && !explicitJoins.has(snap.player_id)) continue
      // Snapshot rows are the start of a tick. A new row after a recorded exit is
      // a fresh appearance, even if its pilot ID and ship class were reused.
      const wasActive = active.has(snap.player_id)
      latestSnapshots.set(snap.player_id, snap)
      const ship = ensureShip(snap.player_id, index === 0 ? 0 : segment.start, snap)
      ship.shipClass = snap.ship_class || ship.shipClass
      ship.kind = snap.kind || ship.kind
      appendMotion(ship, segment.start, snap.zone)
      appendHealth(ship, { time: segment.start, hull: fraction(snap.hull, snap.max_hull), shield: fraction(snap.shield, snap.max_shield) })
      if (!wasActive && index > 0) addCue({ kind: 'arrival', time: segment.start, duration: Math.min(2, span), tick: entry.tick, to: ship.id, intensity: 0.5 })
      retired.delete(snap.player_id)
    }
    for (const join of entry.joins ?? []) {
      const existed = active.has(join.player_id)
      const ship = ensureShip(join.player_id, index === 0 ? 0 : segment.start, undefined, join.side_id)
      if (!existed && index > 0) addCue({ kind: 'arrival', time: segment.start, duration: Math.min(2, span), tick: entry.tick, to: ship.id, intensity: 0.5 })
      retired.delete(join.player_id)
    }
    const tickActors = new Map(active)
    const attacks = entry.attacks ?? []
    const plan = buildAttackVisualPlan(attacks)
    const secondaryParents = new Map<number, number>()
    for (const group of plan.groups) for (const secondary of group.secondaryIndices) secondaryParents.set(secondary, group.primaryIndex)
    const emittedPrimary = new Map<number, CinemaCue>()
    const victims = new Set((entry.kills ?? []).map(kill => kill.victim_id))
    const hullDamage = new Map<string, number>()
    const shieldDamage = new Map<string, number>()
    attacks.forEach((attack, attackIndex) => {
      const from = active.get(attack.attacker_id) ?? (!retired.has(attack.attacker_id) ? ensureShip(attack.attacker_id, segment.start) : undefined)
      const to = active.get(attack.target_id) ?? (!retired.has(attack.target_id) ? ensureShip(attack.target_id, segment.start) : undefined)
      if (!from || !to) return
      hullDamage.set(to.playerId, (hullDamage.get(to.playerId) ?? 0) + Math.max(0, attack.hull_damage))
      shieldDamage.set(to.playerId, (shieldDamage.get(to.playerId) ?? 0) + Math.max(0, attack.shield_damage))
      if (span < 0.16) return
      const bucket = Math.floor(segment.start * 4)
      const count = budgetByTime.get(bucket) ?? 0
      // Crowd/repetitive exchanges are represented by a bounded sample. Keep a
      // victim's decisive volley even if its quarter-second montage is busy.
      if (count >= 5 && !victims.has(attack.target_id)) return
      const parentIndex = secondaryParents.get(attackIndex)
      const parent = parentIndex === undefined ? undefined : emittedPrimary.get(parentIndex)
      if (parentIndex !== undefined && !parent) return
      budgetByTime.set(bucket, count + 1)
      const weapons = attack.weapons ?? []
      // Distinct recorded weapon families and hit outcomes get representative
      // bolts. Dense batteries share a small salvo instead of thousands of meshes.
      const representatives = [...new Map(weapons.map(weapon =>
        [`${weapon.damage_type}:${weapon.hit_success ?? attack.hit_success}`, weapon])).values()].slice(0, 3)
      const volley = representatives.length ? representatives : [undefined]
      volley.forEach((weapon, weaponIndex) => {
        const hit = weapon?.hit_success ?? attack.hit_success
        const component = weapon ? attack.defense_components?.find(part => part.weapon_instance_id === weapon.instance_id) : undefined
        const fire = segment.start + span * (0.08 + (cinemaHash(`${film.seed}:${entry.tick}:${attackIndex}`) % 23) / 100 + weaponIndex * 0.04)
        const cue = addCue({ kind: 'weapon', time: parent?.time ?? fire,
          duration: Math.max(0.08, impactTime - (parent?.time ?? fire)), tick: entry.tick, from: from.id, to: to.id,
          damageType: weapon?.damage_type || attack.damage_type || 'kinetic', hit,
          shieldDamage: hit ? Math.max(0, component?.shield_damage ?? attack.shield_damage) : 0,
          hullDamage: hit ? Math.max(0, component?.hull_damage ?? attack.hull_damage) : 0,
          intensity: clamp(0.25 + Math.log10(Math.max(1, attack.final_damage)) / 7),
          secondaryKind: attack.secondary_kind || (attack.splash ? 'ammo_splash' : undefined), parentId: parent?.id,
          weaponName: weapon?.name })
        if (parentIndex === undefined && weaponIndex === 0) emittedPrimary.set(attackIndex, cue)
      })
    })
    for (const burn of entry.burns ?? []) {
      const ship = active.get(burn.target_id)
      if (!ship) continue
      hullDamage.set(burn.target_id, (hullDamage.get(burn.target_id) ?? 0) + Math.max(0, burn.damage))
      if (burn.damage > 0 && span >= 0.16) addCue({ kind: 'burn', time: impactTime, duration: Math.min(1.8, span * 0.2), tick: entry.tick,
        from: active.get(burn.source_id ?? '')?.id, to: ship.id, damageType: 'thermal', hit: true, hullDamage: burn.damage, intensity: 0.4 })
    }
    for (const snap of entry.snapshots) {
      const ship = active.get(snap.player_id)
      if (!ship) continue
      appendHealth(ship, { time: impactTime,
        hull: fraction(snap.hull - (hullDamage.get(snap.player_id) ?? 0), snap.max_hull),
        shield: fraction(snap.shield - (shieldDamage.get(snap.player_id) ?? 0), snap.max_shield) })
    }
    for (const regen of entry.regen ?? []) {
      const ship = active.get(regen.player_id)
      const snap = latestSnapshots.get(regen.player_id)
      if (ship && snap) appendHealth(ship, { time: segment.start + span * 0.82,
        hull: fraction(regen.hull_after, snap.max_hull), shield: fraction(regen.shield_after, snap.max_shield) })
    }
    for (const move of entry.zone_moves ?? []) {
      const ship = active.get(move.player_id)
      if (ship) appendMotion(ship, segment.end, move.new_zone)
    }
    const retire = (playerId: string, fate: CinemaShip['fate'], kind: 'death' | 'knockout' | 'capture' | 'escape', from?: string): CinemaShip | undefined => {
      const ship = active.get(playerId)
      if (!ship) return
      ship.end = fateTime
      const lastMotion = ship.motion?.at(-1)
      if (lastMotion && lastMotion.time > fateTime) lastMotion.time = fateTime
      ship.fate = fate
      if (kind === 'death') appendHealth(ship, { time: fateTime, hull: 0, shield: 0 }, true)
      addCue({ kind, time: fateTime, duration: kind === 'escape' ? 2.2 : 3.5, tick: entry.tick,
        from, to: ship.id, intensity: kind === 'death' ? 1 : 0.8 })
      active.delete(playerId)
      retired.add(playerId)
      return ship
    }
    for (const kill of entry.kills ?? []) {
      if (!active.has(kill.victim_id) && !retired.has(kill.victim_id)) ensureShip(kill.victim_id, segment.start)
      retire(kill.victim_id, arena ? 'knocked_out' : 'destroyed', arena ? 'knockout' : 'death', tickActors.get(kill.killer_id)?.id)
    }
    // Older summaries sometimes repeat captures only in the terminal aggregate.
    const captures = [...(entry.captures ?? []), ...(entry.battle_ended?.captures ?? [])]
    for (const capture of captures) {
      const key = capture.boarding_operation_id || `${capture.ship_id}:${capture.former_owner_id}`
      if (seenCaptures.has(key)) continue
      seenCaptures.add(key)
      const targetId = boardingTargets.get(capture.boarding_operation_id) ?? capture.former_owner_id
      if (!active.has(targetId) && !retired.has(targetId)) ensureShip(targetId, segment.start)
      const captor = active.get(capture.captor_id)
      const ship = retire(targetId, arena ? 'knocked_out' : 'captured', arena ? 'knockout' : 'capture', captor?.id)
      if (ship) { ship.capturedBy = capture.captor_id; ship.capturedShipId = capture.ship_id }
    }
    for (const flee of entry.flee ?? []) if (flee.escaped) retire(flee.player_id, 'escaped', 'escape')
    // A burn may be the only historical death record. Never manufacture another
    // death if the same victim already appears in the ordinary kill records.
    for (const burn of entry.burns ?? []) if (burn.destroyed && active.has(burn.target_id)) {
      retire(burn.target_id, arena ? 'knocked_out' : 'destroyed', arena ? 'knockout' : 'death', active.get(burn.source_id ?? '')?.id)
    }
  })
  film.cues.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
  film.shots = directShots(film)
  return film
}
