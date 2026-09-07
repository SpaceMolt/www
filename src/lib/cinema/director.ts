import type { BattleLogEntry, BattleSummary, ParticipantSnapshot } from '../battle/types'
import type { BattleLoadPhase } from '../battle/battleData'
import { buildAttackVisualPlan } from '../battle/attackVisualPlan'
import { addBattlefieldCoverage } from './coverage'
import { resolveWeaponFamily } from './weapons'
import { mergeRecordedHardwareWeapons, projectCinemaHardware, type HardwareCatalog, type RecordedHardwareWeapon } from './hardware'
import type { CinemaAxis, CinemaCue, CinemaFilm, CinemaHealth, CinemaSequence, CinemaShip, CinemaShot, CinemaSourceSegment } from './types'

export const DIRECTOR_VERSION = 6
const OPENING = 1.2
const AFTERMATH = 3.5
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low))
const fraction = (value: number, max: number) => max > 0 ? clamp(value / max) : 0

export function cinemaHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return hash >>> 0
}

export type CinemaEligibility = 'loading' | 'active' | 'finalizing' | 'unavailable' | 'interrupted' | 'unsupported' | 'uneventful' | 'retreated' | 'ready'

/** Reconciliation is established by the shared paginated loader, never inferred from a terminal row alone. */
export function getCinemaEligibility(
  summary: BattleSummary | null,
  entries: BattleLogEntry[],
  phase: BattleLoadPhase,
): CinemaEligibility {
  if (phase === 'loading') return 'loading'
  if (phase === 'unavailable') return 'unavailable'
  const terminal = entries.find(entry => entry.battle_ended)?.battle_ended
  if (summary?.outcome === 'interrupted' || terminal?.outcome === 'interrupted') return 'interrupted'
  // The shared loader stops polling once logs settle, even if its independent
  // summary request failed or returned an older active header. Offer Retry;
  // waiting for another automatic update would otherwise never finish.
  if (phase === 'complete' && summary?.status !== 'completed') return 'unavailable'
  if (summary?.status === 'active' || phase === 'live') return 'active'
  if (phase !== 'complete' || summary?.status !== 'completed' || !terminal) return 'finalizing'
  if (!entries.length || entries.some(entry => entry.battle_id !== summary.battle_id)) return 'unavailable'
  if (summary.category === 'wildlife' || terminal.category === 'wildlife' ||
      terminal.participants.some(actor => actor.kind === 'creature') ||
      entries.some(entry => entry.snapshots.some(actor => actor.kind === 'creature'))) return 'unsupported'
  // Terminal aggregate names and totals cannot establish drawable appearances.
  // Event-only historical records remain usable when an event identifies one.
  const hasActors = (terminal.captures?.length ?? 0) > 0 || entries.some(entry =>
    entry.snapshots.length > 0 || (entry.joins?.length ?? 0) > 0 || (entry.attacks?.length ?? 0) > 0 ||
    (entry.kills?.length ?? 0) > 0 || (entry.captures?.length ?? 0) > 0)
  if (!hasActors) return 'unavailable'
  const consequential = terminal.ships_destroyed > 0 || (terminal.captures?.length ?? 0) > 0 ||
    entries.some(entry => (entry.kills?.length ?? 0) > 0 || (entry.captures?.length ?? 0) > 0 || entry.burns?.some(burn => burn.destroyed))
  const combat = consequential || terminal.total_damage > 0 || entries.some(entry =>
    entry.burns?.some(burn => burn.damage > 0) || entry.attacks?.some(attack =>
      attack.final_damage > 0 || attack.shield_damage > 0 || attack.hull_damage > 0 ||
      (attack.hit_success && (attack.landed_damage ?? attack.pre_hit_damage ?? attack.raw_damage) > 0)))
  if (!combat) return 'uneventful'
  if (!consequential) {
    // Survived means merely "not destroyed" in the terminal roster. Track the
    // last appearance instead: an escaped pilot can rejoin before the ending.
    const appearances = new Map<string, { side: number; escaped: boolean }>()
    for (const entry of [...entries].sort((a, b) => a.tick - b.tick)) {
      for (const actor of entry.snapshots) appearances.set(actor.player_id, { side: actor.side_id, escaped: false })
      for (const actor of entry.joins ?? []) appearances.set(actor.player_id, { side: actor.side_id, escaped: false })
      for (const flee of entry.flee ?? []) if (flee.escaped) {
        const actor = appearances.get(flee.player_id)
        if (actor) actor.escaped = true
      }
    }
    // Unknown historical participants are not evidence of a full retreat.
    const allKnown = terminal.participants.every(actor => appearances.has(actor.player_id))
    const actors = [...appearances.values()]
    if (allKnown && new Set(actors.map(actor => actor.side)).size >= 2 && actors.every(actor => actor.escaped)) return 'retreated'
  }
  return 'ready'
}

function majorCount(entry: BattleLogEntry): number {
  return (entry.kills?.length ?? 0) + (entry.captures?.length ?? 0) +
    (entry.joins?.length ?? 0) + (entry.flee?.filter(event => event.escaped).length ?? 0)
}

/** Screen time belongs to observed action, never to the number of server ticks. */
function editSegments(entries: BattleLogEntry[]): CinemaSourceSegment[] {
  const meaningful = new Set<number>()
  const outcomes = new Set<number>()
  const stateChanges = new Set<number>()
  const present = new Set<string>()
  const snapshots = new Map<string, ParticipantSnapshot>()
  const captureTargets = new Map<string, string>()
  entries.forEach((entry, index) => {
    let appearance = false
    for (const snap of entry.snapshots) {
      if (snap.hull <= 0 && !present.has(snap.player_id) && index > 0) continue
      if (!present.has(snap.player_id) && index > 0) appearance = true
      const previous = snapshots.get(snap.player_id)
      if (previous && (previous.zone !== snap.zone || previous.stance !== snap.stance ||
          previous.hull !== snap.hull || previous.shield !== snap.shield)) stateChanges.add(index)
      snapshots.set(snap.player_id, snap)
      present.add(snap.player_id)
    }
    for (const join of entry.joins ?? []) present.add(join.player_id)
    for (const boarding of entry.boarding ?? []) if (boarding.target_id) captureTargets.set(boarding.operation_id, boarding.target_id)
    for (const kill of entry.kills ?? []) present.delete(kill.victim_id)
    for (const flee of entry.flee ?? []) if (flee.escaped) present.delete(flee.player_id)
    for (const capture of entry.captures ?? []) present.delete(captureTargets.get(capture.boarding_operation_id) ?? capture.former_owner_id)
    const major = majorCount(entry) - (index === 0 ? (entry.joins?.length ?? 0) : 0)
    if (entry.kills?.length || entry.captures?.length || entry.flee?.some(flee => flee.escaped) ||
        entry.burns?.some(burn => burn.destroyed) || entry.battle_ended?.captures?.length) outcomes.add(index)
    if (appearance || major > 0 || entry.burns?.some(burn => burn.destroyed) || entry.battle_ended?.captures?.length) meaningful.add(index)
    if (entry.zone_moves?.length || entry.commands?.some(command => command.stance) ||
        entry.regen?.some(regen => regen.hull_after !== regen.hull_before || regen.shield_after !== regen.shield_before)) stateChanges.add(index)
  })
  const selected = new Set(meaningful)
  const action = entries.flatMap((entry, index) => entry.attacks?.length || entry.burns?.some(burn => burn.damage > 0) ? [index] : [])
  const ordinary = action.filter(index => !meaningful.has(index))
  // Sample actual volleys, independent of idle rows between them.
  const samples = Math.min(ordinary.length, 12)
  for (let index = 0; index < samples; index++) {
    selected.add(ordinary[Math.floor(index * (ordinary.length - 1) / Math.max(1, samples - 1))])
  }
  // Repetitive health/stance changes are also an edited montage. Keep their
  // projected state, but only show a bounded selection of movement-only beats.
  const stateOnly = [...stateChanges].filter(index => !selected.has(index) && !action.includes(index))
  const selectedState = new Set<number>()
  const stateSamples = Math.min(8, stateOnly.length)
  for (let index = 0; index < stateSamples; index++) selectedState.add(stateOnly[Math.floor(index * (stateOnly.length - 1) / Math.max(1, stateSamples - 1))])
  const durations: number[] = entries.map((entry, index) => selected.has(index) ?
    (outcomes.has(index) ? 3.8 : entry.attacks?.length || entry.burns?.some(burn => burn.damage > 0) ? 2.5 : 1.2) : selectedState.has(index) ? .45 : 0)
  const total = durations.reduce((sum, span) => sum + span, 0)
  const scale = Math.min(1, (180 - OPENING - AFTERMATH) / Math.max(1, total))
  let cursor = OPENING
  return entries.map((entry, index) => {
    const start = cursor
    cursor += durations[index] * scale
    // Unselected ticks remain in the source mapping with zero screen duration.
    // Their state transitions are folded into the next visible beat; actual
    // joins, exits and casualties always belong to the meaningful set above.
    return { start, end: cursor, tick: entry.tick }
  })
}
const rangeProgress: Record<string, number> = { outer: 0, mid: 1 / 3, inner: 2 / 3, engaged: 1 }

function appendMotion(ship: CinemaShip, time: number, zone: string, stance?: string): void {
  const position = rangeProgress[zone]
  if (position === undefined) return
  const frames = ship.motion ?? (ship.motion = [])
  const previous = frames.at(-1)
  const nextStance = stance ?? previous?.stance
  if (previous?.time === time) {
    previous.position = position
    previous.stance = nextStance
    return
  }
  // Keep both ends of each constant hold, so a long wait followed by an
  // advance doesn't become a slow drift throughout all the preceding footage.
  if (previous?.position === position && previous.stance === nextStance && frames.at(-2)?.position === position && frames.at(-2)?.stance === nextStance) previous.time = time
  else frames.push({ time, position, ...(nextStance ? { stance: nextStance } : {}) })
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

interface StoryBeat {
  time: number
  actionTime: number
  impactTime: number
  event?: CinemaCue
  cause?: CinemaCue
  attacker?: string
  defender?: string
  consequence: boolean
  relevance: number
}

/** A small authored story follows recurring rivals, not whichever cue happens to arrive next. */
function directShots(film: CinemaFilm, entries: BattleLogEntry[]): CinemaShot[] {
  const byId = new Map(film.ships.map(ship => [ship.id, ship]))
  const involvement = new Map<string, number>()
  const pairInvolvement = new Map<string, number>()
  const pairKey = (a: string, b: string) => [a, b].sort().join('|')
  const add = (id: string, amount: number) => involvement.set(id, (involvement.get(id) ?? 0) + amount)
  for (const entry of entries) {
    for (const attack of entry.attacks ?? []) {
      const weight = 1 + Math.log2(1 + Math.max(0, attack.final_damage)) * .15
      add(attack.attacker_id, weight)
      add(attack.target_id, weight * .35)
      const key = pairKey(attack.attacker_id, attack.target_id)
      pairInvolvement.set(key, (pairInvolvement.get(key) ?? 0) + weight)
    }
    for (const event of entry.kills ?? []) { add(event.killer_id, 4); add(event.victim_id, 2) }
    for (const event of entry.captures ?? []) { add(event.captor_id, 4); add(event.former_owner_id, 2) }
  }
  const rank = (a: CinemaShip, b: CinemaShip) => (involvement.get(b.playerId) ?? 0) -
    (involvement.get(a.playerId) ?? 0) || a.start - b.start || a.id.localeCompare(b.id)
  const opening = film.ships.filter(ship => ship.start === 0).sort(rank)
  // An involved losing hero is still our point of view. The outcome determines
  // the final reversal and resolution, not a retroactive winner-only opening.
  const protagonist = opening[0] ?? [...film.ships].sort(rank)[0]
  const adversary = opening.filter(ship => ship.sideId !== protagonist?.sideId).sort((a, b) =>
    (pairInvolvement.get(pairKey(protagonist?.playerId ?? '', b.playerId)) ?? 0) -
    (pairInvolvement.get(pairKey(protagonist?.playerId ?? '', a.playerId)) ?? 0) || rank(a, b))[0]
  const axisFor = (a?: string, b?: string): CinemaAxis | undefined => {
    if (!a || !b || a === b) return undefined
    const order = [a, b].sort((left, right) => {
      const l = byId.get(left), r = byId.get(right)
      return Number(r?.sideId === protagonist?.sideId) - Number(l?.sideId === protagonist?.sideId) ||
        (l?.sideIndex ?? 0) - (r?.sideIndex ?? 0) || left.localeCompare(right)
    })
    return { from: order[0], to: order[1], side: 1 }
  }
  const openingAxis = axisFor(opening[0]?.id, adversary?.id)
  const result: CinemaShot[] = [
    {start:0,end:OPENING,kind:'reveal',role:'geography',sequenceId:'establish',subject:opening[0]?.id,target:adversary?.id,axis:openingAxis,intensity:.12},
  ]
  const coreEnd = film.duration - AFTERMATH
  const weaponCues = film.cues.filter(cue => cue.kind === 'weapon' && cue.from && cue.to)
  const weapons = weaponCues.filter(cue => !cue.secondaryKind)
  const cueById = new Map(weaponCues.map(cue => [cue.id, cue]))
  const consequences = film.cues.filter(cue => ['death','knockout','capture','escape'].includes(cue.kind) && cue.to)
  const relevance = (from?: string, to?: string) => {
    const actors = [byId.get(from ?? ''), byId.get(to ?? '')]
    return (actors.some(ship => ship?.playerId === protagonist?.playerId) ? 5 : 0) +
      (actors.some(ship => ship?.playerId === adversary?.playerId) ? 2 : 0)
  }
  const consequenceBeats: StoryBeat[] = consequences.map(event => {
    // A recorded capture/escape is not caused by a gunshot. A collateral loss
    // follows its connected hit back to the actual primary volley; the gun
    // still fires at that primary victim, not at the collateral casualty.
    const cause = ['death','knockout'].includes(event.kind) && !byId.get(event.to ?? '')?.capturedShipId ? weaponCues.flatMap(cue => {
      if (cue.to !== event.to || cue.tick !== event.tick || cue.hit !== true ||
        (event.from && cue.from !== event.from) || cue.time + cue.duration > event.time + .000001) return []
      if (!cue.secondaryKind && !cue.parentId) return [cue]
      if (!['aoe', 'chain', 'ammo_splash'].includes(cue.secondaryKind ?? '') || !cue.parentId) return []
      const primary = cueById.get(cue.parentId)
      return primary && !primary.secondaryKind && !primary.parentId && primary.hit === true &&
        primary.from === cue.from && primary.tick === cue.tick && primary.time + primary.duration <= event.time + .000001 ? [primary] : []
    }).at(-1) : undefined
    return {time:event.time,actionTime:cause?.time ?? event.time,impactTime:cause ? cause.time + cause.duration : event.time,
      event,cause,attacker:cause?.from ?? event.from,defender:event.to,consequence:true,relevance:relevance(event.from,event.to)}
  })
  const weaponBeats: StoryBeat[] = weapons.map(cause => ({time:cause.time + cause.duration,actionTime:cause.time,
    impactTime:cause.time + cause.duration,event:cause,cause,attacker:cause.from,defender:cause.to,
    consequence:false,relevance:relevance(cause.from,cause.to)}))
  const victorious = film.outcome === 'victory' ? consequenceBeats.filter(beat =>
    byId.get(beat.defender ?? '')?.sideId !== film.winningSide) : []
  const decisive = victorious.at(-1) ?? consequenceBeats.at(-1) ?? weaponBeats.at(-1)
  // Cut on actual action. Camera choices never stretch the quiet around it,
  // so muzzle releases, impacts and recorded state all share one clock.
  const selected: StoryBeat[] = []
  for (const segment of film.segments) {
    if (segment.end <= segment.start) continue
    const losses = consequenceBeats.filter(beat => beat.event?.tick === segment.tick)
    const fire = weaponBeats.filter(beat => beat.event?.tick === segment.tick)
    const candidates = losses.length ? losses : fire
    const beat = decisive && candidates.includes(decisive) ? decisive : [...candidates].sort((a,b) => b.relevance-a.relevance)[0]
    if (beat) selected.push(beat)
  }
  const lastConsequence = consequences.at(-1)?.time ?? coreEnd
  const aftermathStart = Math.min(film.duration, Math.max(coreEnd, lastConsequence + .8))
  const sequenceEnds = selected.map((beat,index) => {
    const next = selected[index+1]
    return next ? film.segments.find(segment => segment.tick === next.event?.tick)!.start : aftermathStart
  })
  const contextShot = (start:number,end:number,id:string) => {
    if(end<=start)return
    const available=film.ships.filter(ship=>ship.start<=start+.000001 && ship.end>=end).sort(rank)
    const subject=available.find(ship=>ship.playerId===protagonist?.playerId)??available[0]
    const target=available.find(ship=>ship.sideId!==subject?.sideId)
    result.push({start,end,kind:target?'reveal':'tracking',role:target?'geography':'protagonist',sequenceId:id,
      subject:subject?.id,target:target?.id,axis:axisFor(subject?.id,target?.id),intensity:.2})
  }
  const sequences: CinemaSequence[] = []
  let cursor = OPENING
  selected.forEach((beat,index) => {
    const end = sequenceEnds[index]
    const impactTarget = beat.cause?.to ?? beat.defender
    const pairReady=Math.max(cursor,byId.get(beat.attacker??'')?.start??0,byId.get(beat.defender??'')?.start??0,
      byId.get(impactTarget??'')?.start??0)
    contextShot(cursor,pairReady,`approach:${index}`)
    const axis = axisFor(beat.attacker,impactTarget)
    const sequence: CinemaSequence = {id:`sequence:${index}`,start:pairReady,end,
      kind:beat === decisive ? 'climax' : byId.get(beat.defender ?? '')?.playerId === protagonist?.playerId && beat.consequence ? 'reversal' :
        beat.consequence ? 'confrontation' : 'montage',attacker:beat.attacker,defender:beat.defender,
      causeCueId:beat.cause?.id,eventCueId:beat.event?.id,actionTime:beat.actionTime,impactTime:beat.impactTime,
      consequenceTime:beat.consequence ? beat.time : undefined,axis}
    sequences.push(sequence)
    const focusIds = [...new Set(consequences.filter(cue=>cue.time >= cursor && cue.time < end).flatMap(cue=>cue.to?[cue.to]:[]))]
    const common = {sequenceId:sequence.id,axis,intensity:beat.event?.intensity ?? .4}
    if (beat.cause) {
      const fireStart = Math.min(beat.actionTime,Math.max(pairReady+.5,Math.min(beat.actionTime-1,pairReady+(beat.impactTime-pairReady)*.48)))
      // Read the muzzle release, then recognize the target before the strike.
      const impactLead = Math.max(0,Math.min(.75,beat.cause.duration*.55,beat.cause.duration-.5))
      const impactStart = beat.impactTime-impactLead
      if (fireStart > pairReady) result.push({...common,start:pairReady,end:fireStart,kind:'tracking',role:'setup',
        subject:beat.attacker,target:impactTarget,actionTime:beat.actionTime})
      result.push({...common,start:fireStart,end:impactStart,kind:'broadside',role:'fire',
        subject:beat.attacker,target:impactTarget,actionTime:beat.actionTime})
      const reactionStart = impactTarget !== beat.defender ? Math.min(end, beat.time) : end
      result.push({...common,start:impactStart,end:reactionStart,kind:'impact',role:'impact',subject:impactTarget,target:beat.attacker,
        focusIds,actionTime:beat.impactTime})
      if (reactionStart < end) result.push({...common,start:reactionStart,end,kind:'impact',role:'reaction',subject:beat.defender,target:beat.attacker,
        focusIds,actionTime:beat.time})
    } else {
      const impactStart = Math.max(pairReady,beat.time-1.4)
      const reactionStart = Math.min(end,beat.time+.6)
      const available = (id:string|undefined) => {
        const ship=byId.get(id??'')
        return ship && ship.start<=pairReady && ship.end>=impactStart
      }
      const setupSubject=[beat.attacker,beat.defender,protagonist?.id].find(available)
      const setupTarget=[beat.defender,beat.attacker].find(id=>id!==setupSubject && available(id))
      if (impactStart > pairReady) result.push({...common,start:pairReady,end:impactStart,kind:'tracking',role:'setup',
        subject:setupSubject,target:setupTarget,axis:axisFor(setupSubject,setupTarget),actionTime:beat.time})
      if (reactionStart > impactStart) result.push({...common,start:impactStart,end:reactionStart,kind:'impact',role:'impact',
        subject:beat.defender,target:beat.attacker,focusIds,actionTime:beat.time})
      if (end > reactionStart) result.push({...common,start:reactionStart,end,kind:'impact',role:'reaction',
        subject:beat.defender,target:beat.attacker,focusIds,actionTime:beat.time})
    }
    cursor=end
  })
  if (!sequences.length && cursor < aftermathStart) {
    const firstAppearance=Math.min(aftermathStart,Math.max(cursor,film.ships.reduce((time,ship)=>Math.min(time,ship.start),aftermathStart)))
    contextShot(cursor,firstAppearance,'quiet-approach')
    contextShot(firstAppearance,aftermathStart,'quiet-encounter')
  }
  const survivor = film.ships.filter(ship=>ship.fate==='survived' && ship.end >= aftermathStart &&
    (film.outcome !== 'victory' || ship.sideId===film.winningSide)).sort(rank)[0]
  const lostHero = film.ships.filter(ship=>ship.playerId===protagonist?.playerId && ship.fate!=='survived').at(-1)
  const reminder = lostHero ?? (adversary?.fate !== 'survived' ? adversary : undefined)
  result.push({start:aftermathStart,end:film.duration,kind:'aftermath',role:'resolution',sequenceId:'resolve',
    subject:survivor?.id,target:reminder?.id,axis:axisFor(survivor?.id,reminder?.id),intensity:.12})
  film.story={protagonistId:protagonist?.id,adversaryId:adversary?.id,climaxCueId:decisive?.event?.id,sequences}
  return result
}
/** Compile only settled completed records. The edit is pure and contains no catalog or rendering dependencies. */
export function compileBattleFilm(summary: BattleSummary, source: BattleLogEntry[], reconciled = false, hardwareCatalog?: HardwareCatalog): CinemaFilm {
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
  const segments = editSegments(entries)
  const duration = segments.at(-1)!.end + AFTERMATH
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
  const recordedHardware = new Map<string, RecordedHardwareWeapon[]>()
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
      // A join may reuse metadata from the retired pilot's last snapshot. Its
      // old equipment is not evidence about this new hull's fitted modules.
      hardware: projectCinemaHardware(snapshot?.modules, [], hardwareCatalog),
      start: time, end: duration, fate: 'survived', health: [{ time, hull: snap ? fraction(snap.hull, snap.max_hull) : 1,
        shield: snap ? fraction(snap.shield, snap.max_shield) : 0 }] }
    if (snap) appendMotion(ship, time, snap.zone, snap.stance)
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
    const actionSpan = Math.min(span, 2.5)
    const impactTime = segment.start + actionSpan * 0.72
    const fateTime = Math.min(segment.end, impactTime + Math.min(.4, span * .16))
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
      // Models are static per appearance. The first explicit fit, including [],
      // supersedes firing fallback; repeated or later missing snapshots cannot
      // double modules, erase the fit, or retroactively refit the opening shot.
      if (ship.hardware?.source !== 'modules' && Array.isArray(snap.modules)) {
        ship.hardware = projectCinemaHardware(snap.modules, [], hardwareCatalog)
        recordedHardware.delete(ship.id)
      }
      appendMotion(ship, segment.start, snap.zone, snap.stance)
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
    for (const command of entry.commands ?? []) {
      const ship = active.get(command.player_id)
      const snap = latestSnapshots.get(command.player_id)
      if (ship && snap && command.stance) appendMotion(ship, segment.start + span * .02, snap.zone, command.stance)
    }
    const tickActors = new Map(active)
    const attacks = entry.attacks ?? []
    const plan = buildAttackVisualPlan(attacks)
    const secondaryParents = new Map<number, number>()
    for (const group of plan.groups) for (const secondary of group.secondaryIndices) secondaryParents.set(secondary, group.primaryIndex)
    const emittedPrimary = new Map<number, CinemaCue>()
    const victims = new Set([...(entry.kills ?? []).map(kill => kill.victim_id),
      ...(entry.burns ?? []).filter(burn => burn.destroyed).map(burn => burn.target_id)])
    const decisiveAttacks = new Set(attacks.flatMap((attack, index) => victims.has(attack.target_id) ? [index] : []))
    for (const index of [...decisiveAttacks]) {
      const parent = secondaryParents.get(index)
      if (parent !== undefined) decisiveAttacks.add(parent)
    }
    const hullDamage = new Map<string, number>()
    const shieldDamage = new Map<string, number>()
    const behaviorKeys = new Set<string>()
    const behavior = (cue: Omit<CinemaCue, 'id' | 'tick' | 'time' | 'duration'>, time = impactTime) => {
      const key = `${cue.kind}:${cue.to}:${cue.repairKind ?? cue.drainKind ?? ''}` +
        (cue.kind === 'drain' ? `:${cue.from}:${cue.drainTransferred === true}` : '')
      // A local cue represents the observed effect, not every component that
      // contributed to it. Avoid a crowd of overlapping restoration flashes.
      if (span < .16 || behaviorKeys.has(key) || behaviorKeys.size >= 16) return
      behaviorKeys.add(key)
      addCue({ ...cue, tick: entry.tick, time, duration: Math.min(1.6, Math.max(.4, span * .3)) })
    }
    attacks.forEach((attack, attackIndex) => {
      const from = active.get(attack.attacker_id) ?? (!retired.has(attack.attacker_id) ? ensureShip(attack.attacker_id, segment.start) : undefined)
      const to = active.get(attack.target_id) ?? (!retired.has(attack.target_id) ? ensureShip(attack.target_id, segment.start) : undefined)
      // Gather real gun details before cinematic sampling drops busy/short
      // ticks. Derived splash/chain copies do not establish additional guns.
      if (from && from.hardware?.source !== 'modules' && !attack.secondary_kind && !attack.splash && attack.weapons?.length) {
        const evidence = mergeRecordedHardwareWeapons(recordedHardware.get(from.id) ?? [], attack.weapons)
        recordedHardware.set(from.id, evidence)
        from.hardware = projectCinemaHardware(undefined, evidence, hardwareCatalog)
      }
      if (!from || !to) return
      hullDamage.set(to.playerId, (hullDamage.get(to.playerId) ?? 0) + Math.max(0, attack.hull_damage))
      shieldDamage.set(to.playerId, (shieldDamage.get(to.playerId) ?? 0) + Math.max(0, attack.shield_damage))
      if ((attack.system_disable_ticks ?? 0) > 0) behavior({ kind: 'disable', to: to.id, intensity: .6 })
      if (attack.emergency_cloak_activated === true) behavior({ kind: 'cloak', to: to.id, intensity: .6 })
      if ((attack.shield_drained ?? 0) > 0) behavior({ kind: 'drain', from: from.id, to: to.id, drainKind: 'shield',
        drainTransferred: (attack.shield_transferred ?? 0) > 0,
        intensity: clamp(.2 + fraction(attack.shield_drained!, latestSnapshots.get(to.playerId)?.max_shield ?? 0)) })
      // defense_components.lifesteal_heal is calculated before the server caps
      // healing at maximum hull. It does not confirm a realized gain, so do not
      // turn that field into a restoration or return-flow effect.
      // Even the densest edit retains its recorded causal salvo. Keep the
      // primary of a collateral loss too, so a wave never loses its source.
      if (span <= 0 || span < 0.16 && !decisiveAttacks.has(attackIndex)) return
      const bucket = Math.floor(segment.start * 4)
      const count = budgetByTime.get(bucket) ?? 0
      // Crowd/repetitive exchanges are represented by a bounded sample. Keep a
      // victim's decisive volley even if its quarter-second montage is busy.
      if (count >= 5 && !decisiveAttacks.has(attackIndex)) return
      const parentIndex = secondaryParents.get(attackIndex)
      const parent = parentIndex === undefined ? undefined : emittedPrimary.get(parentIndex)
      if (parentIndex !== undefined && !parent) return
      budgetByTime.set(bucket, count + 1)
      const weapons = attack.weapons ?? []
      // Distinct recorded weapon families and hit outcomes get representative
      // bolts. Dense batteries share a small salvo instead of thousands of meshes.
      const variants = [...new Map(weapons.map(weapon =>
        [`${resolveWeaponFamily(weapon.name, weapon.damage_type)}:${weapon.hit_success ?? attack.hit_success}`, weapon])).values()]
        .sort((a, b) => Number(b.hit_success ?? attack.hit_success) - Number(a.hit_success ?? attack.hit_success))
      const families = new Set<string>()
      const distinctFamilies = variants.filter(weapon => {
        const family = resolveWeaponFamily(weapon.name, weapon.damage_type)
        if (families.has(family)) return false
        families.add(family)
        return true
      })
      // Advance a stable window through oversized batteries rather than always
      // hiding the same later families in every volley of the encounter.
      const rotation = distinctFamilies.length > 6 ? (entry.tick + cinemaHash(from.playerId)) % distinctFamilies.length : 0
      const representatives = [...distinctFamilies.slice(rotation), ...distinctFamilies.slice(0, rotation)].slice(0, 6)
      for (const weapon of variants) if (representatives.length < 6 && !representatives.includes(weapon)) representatives.push(weapon)
      const volley = representatives.length ? representatives : [undefined]
      volley.forEach((weapon, weaponIndex) => {
        const hit = weapon?.hit_success ?? attack.hit_success
        const component = weapon ? attack.defense_components?.find(part => part.weapon_instance_id === weapon.instance_id) : undefined
        const fire = segment.start + actionSpan * (0.08 + (cinemaHash(`${film.seed}:${entry.tick}:${attackIndex}`) % 23) / 100 + weaponIndex * 0.04)
        const cue = addCue({ kind: 'weapon', time: parent?.time ?? fire,
          duration: Math.max(Number.EPSILON, impactTime - (parent?.time ?? fire)), tick: entry.tick, from: from.id, to: to.id,
          damageType: weapon?.damage_type || attack.damage_type || 'kinetic', hit,
          shieldDamage: hit ? Math.max(0, component?.shield_damage ?? attack.shield_damage) : 0,
          hullDamage: hit ? Math.max(0, component?.hull_damage ?? attack.hull_damage) : 0,
          intensity: clamp(0.25 + Math.log10(Math.max(1, attack.final_damage)) / 7),
          secondaryKind: attack.secondary_kind || (attack.splash ? 'ammo_splash' : undefined), parentId: parent?.id,
          weaponName: weapon?.name, weaponFamily: resolveWeaponFamily(weapon?.name, weapon?.damage_type || attack.damage_type),
          ammoName: weapon?.ammo_used, critical: weapon?.crit_fired })
        if (parentIndex === undefined && weaponIndex === 0) emittedPrimary.set(attackIndex, cue)
      })
    })
    for (const burn of entry.burns ?? []) {
      const ship = active.get(burn.target_id)
      if (!ship) continue
      hullDamage.set(burn.target_id, (hullDamage.get(burn.target_id) ?? 0) + Math.max(0, burn.damage))
      if (burn.damage > 0 && span > 0 && (span >= 0.16 || burn.destroyed)) addCue({ kind: 'burn', time: impactTime, duration: Math.min(1.8, span * 0.2), tick: entry.tick,
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
      if (ship && snap) appendHealth(ship, { time: segment.start + actionSpan * 0.82,
        hull: fraction(regen.hull_after, snap.max_hull), shield: fraction(regen.shield_after, snap.max_shield) })
      if (ship && snap) {
        const hullGain = Math.max(0, regen.hull_after - regen.hull_before)
        const shieldGain = Math.max(0, regen.shield_after - regen.shield_before)
        if (hullGain > 0 && (fraction(hullGain, snap.max_hull) >= .02 || (regen.remote_repair ?? 0) > 0))
          behavior({ kind: 'repair', to: ship.id, repairKind: 'hull', intensity: clamp(.2 + fraction(hullGain, snap.max_hull)) }, segment.start + actionSpan * .82)
        if (fraction(shieldGain, snap.max_shield) >= .02)
          behavior({ kind: 'repair', to: ship.id, repairKind: 'shield', intensity: clamp(.15 + fraction(shieldGain, snap.max_shield)) }, segment.start + actionSpan * .82)
      }
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
  // Stable ties retain the source ordering of simultaneous chain recipients;
  // lexical IDs would put cue:10 ahead of cue:2 and redirect the chain.
  film.cues.sort((a, b) => a.time - b.time)
  film.shots = directShots(film, entries)
  film.shots = addBattlefieldCoverage(film)
  return film
}
