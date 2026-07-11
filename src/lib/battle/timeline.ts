/**
 * Derives everything the battle viewer renders from the raw per-tick log:
 * participant roster with fates, side metadata, a flat event stream, and
 * per-tick damage totals for the timeline intensity chart.
 */

import { getShip, type RawShip } from '@/data/catalog'
import { archetypeForShip, type GlyphArchetype } from './shipGlyphs'
import {
  type BattleLogEntry,
  type BattleSummary,
  type ParticipantSnapshot,
  sideColor,
  zoneIndex,
} from './types'

export type ParticipantKind = 'ship' | 'drone' | 'creature'
export type ParticipantFate = 'fighting' | 'destroyed' | 'escaped' | 'survived'

export interface ParticipantMeta {
  id: string
  name: string
  sideId: number
  sideIndex: number
  color: string
  kind: ParticipantKind
  shipClassId: string
  shipClassName: string
  /** Catalog class string, e.g. "Heavy Fighter" (empty for drones/creatures/unknown) */
  shipClass: string
  /** Glyph silhouette family, resolved once at timeline build */
  archetype: GlyphArchetype
  /** Whether the hull mounts weapons (catalog weapon slots; unknown hulls count as armed) */
  armed: boolean
  /** Ship scale 1 (personal) … 5 (capital); drives glyph size */
  scale: number
  category: string
  factionId?: string
  /** Stable lateral slot within the side (assigned at first appearance) */
  slot: number
  firstTickIndex: number
  /** Last tick index this participant appears in snapshots */
  lastTickIndex: number
  fate: ParticipantFate
  killedBy?: string
  /** Tick index at which the participant died / escaped (event tick) */
  fateTickIndex?: number
}

export interface SideMeta {
  sideId: number
  index: number
  color: string
  label: string
  factionId?: string
  factionTag?: string
  participantIds: string[]
}

export type BattleEventKind =
  | 'join'
  | 'attack'
  | 'miss'
  | 'splash'
  | 'kill'
  | 'burn'
  | 'regen'
  | 'zone'
  | 'stance'
  | 'flee'
  | 'escape'
  | 'end'

export interface BattleEvent {
  tickIndex: number
  tick: number
  kind: BattleEventKind
  color: string
  text: string
  /** Primary participant, used for jump-to-ship on click */
  actorId?: string
}

export interface TickDamage {
  tickIndex: number
  /** Damage dealt this tick, keyed by side index */
  bySide: number[]
  total: number
}

export interface BattleTimeline {
  entries: BattleLogEntry[]
  participants: Map<string, ParticipantMeta>
  sides: SideMeta[]
  sideIndexById: Map<number, number>
  events: BattleEvent[]
  tickDamage: TickDamage[]
  peakTickDamage: number
  totalDamage: number
  /** snapshot lookup: snapshotAt[tickIndex].get(participantId) */
  snapshotAt: Map<string, ParticipantSnapshot>[]
  names: Map<string, string>
}

const EVENT_COLORS: Record<BattleEventKind, string> = {
  join: '#2dd4bf',
  attack: '#ff6b35',
  miss: '#3d5a6c',
  splash: '#c77dff',
  kill: '#e63946',
  burn: '#ff9551',
  regen: '#4dabf7',
  zone: '#4dabf7',
  stance: '#a8c5d6',
  flee: '#ffd93d',
  escape: '#ffd93d',
  end: '#ffd93d',
}

// Drones shoot and creatures bite; for ships, weapon capability comes from the
// hull's catalog weapon slots. A catalog miss (stale build-time catalog) counts
// as armed — battle participants overwhelmingly shoot, and falsely advertising
// an unknown combatant as a soft target is the worse failure.
function resolveArmed(kind: ParticipantKind, ship: RawShip | undefined): boolean {
  if (kind !== 'ship') return true
  if (!ship) return true
  return (ship.weapon_slots ?? 0) > 0
}

function detectKind(snap: ParticipantSnapshot): ParticipantKind {
  if (snap.ship_class) return 'ship'
  // Drones and creatures have no ship class; drones carry the owner's name
  // pattern from the server ("X's combat drone"), creatures are species names.
  if (/\bdrone\b/i.test(snap.username)) return 'drone'
  return 'creature'
}

export function buildTimeline(entries: BattleLogEntry[], summary: BattleSummary | null): BattleTimeline {
  const participants = new Map<string, ParticipantMeta>()
  const names = new Map<string, string>()
  const events: BattleEvent[] = []
  const tickDamage: TickDamage[] = []
  const snapshotAt: Map<string, ParticipantSnapshot>[] = []

  // Collect side ids across the whole battle so colors stay stable.
  const sideIds = new Set<number>()
  for (const entry of entries) {
    for (const s of entry.snapshots) sideIds.add(s.side_id)
    for (const j of entry.joins ?? []) sideIds.add(j.side_id)
  }
  for (const side of summary?.sides ?? []) sideIds.add(side.side_id)
  const sortedSideIds = [...sideIds].sort((a, b) => a - b)
  const sideIndexById = new Map<number, number>()
  sortedSideIds.forEach((id, i) => sideIndexById.set(id, i))

  const sideSlotCounter = new Map<number, number>()

  const name = (id: string) => names.get(id) || id.slice(0, 8)

  // Pass 1: names from every source that carries them.
  for (const entry of entries) {
    for (const snap of entry.snapshots) {
      if (snap.username) names.set(snap.player_id, snap.username)
    }
    for (const j of entry.joins ?? []) {
      if (j.username) names.set(j.player_id, j.username)
    }
    for (const k of entry.kills ?? []) {
      if (k.killer_username) names.set(k.killer_id, k.killer_username)
      if (k.victim_username) names.set(k.victim_id, k.victim_username)
    }
    for (const p of entry.battle_ended?.participants ?? []) {
      if (p.username) names.set(p.player_id, p.username)
    }
  }

  // Pass 2: participants, snapshots index, damage totals, events.
  entries.forEach((entry, tickIndex) => {
    const snapMap = new Map<string, ParticipantSnapshot>()
    const damageBySide = sortedSideIds.map(() => 0)

    for (const snap of entry.snapshots) {
      snapMap.set(snap.player_id, snap)
      let meta = participants.get(snap.player_id)
      if (!meta) {
        const ship = snap.ship_class ? getShip(snap.ship_class) : undefined
        const kind = detectKind(snap)
        const sideIndex = sideIndexById.get(snap.side_id) ?? 0
        const slot = sideSlotCounter.get(snap.side_id) ?? 0
        sideSlotCounter.set(snap.side_id, slot + 1)
        meta = {
          id: snap.player_id,
          name: snap.username || snap.player_id.slice(0, 8),
          sideId: snap.side_id,
          sideIndex,
          color: sideColor(sideIndex),
          kind,
          shipClassId: snap.ship_class,
          shipClassName: ship?.name || (kind === 'ship' ? snap.ship_class : kind),
          shipClass: ship?.class ?? '',
          archetype: archetypeForShip(kind, ship?.class, ship?.category, ship?.scale ?? 1),
          armed: resolveArmed(kind, ship),
          scale: ship?.scale ?? (kind === 'drone' ? 0 : 1),
          category: (ship?.category || kind).toLowerCase(),
          factionId: snap.faction_id,
          slot,
          firstTickIndex: tickIndex,
          lastTickIndex: tickIndex,
          fate: 'fighting',
        }
        participants.set(snap.player_id, meta)
      }
      meta.lastTickIndex = tickIndex
      if (snap.faction_id && !meta.factionId) meta.factionId = snap.faction_id
    }
    snapshotAt.push(snapMap)

    // --- events + damage ---
    for (const j of entry.joins ?? []) {
      events.push({
        tickIndex,
        tick: entry.tick,
        kind: 'join',
        color: EVENT_COLORS.join,
        text: `${j.username || name(j.player_id)} warped into the battle`,
        actorId: j.player_id,
      })
    }

    for (const c of entry.commands ?? []) {
      if (c.stance) {
        events.push({
          tickIndex,
          tick: entry.tick,
          kind: 'stance',
          color: EVENT_COLORS.stance,
          text: `${name(c.player_id)} switched to ${c.stance} stance`,
          actorId: c.player_id,
        })
      }
    }

    for (const z of entry.zone_moves ?? []) {
      const advanced = zoneIndex(z.new_zone) > zoneIndex(z.old_zone)
      events.push({
        tickIndex,
        tick: entry.tick,
        kind: 'zone',
        color: EVENT_COLORS.zone,
        text: `${name(z.player_id)} ${advanced ? 'advanced' : 'fell back'} to ${z.new_zone} range`,
        actorId: z.player_id,
      })
    }

    for (const a of entry.attacks ?? []) {
      const attackerSide = snapMap.get(a.attacker_id)?.side_id
      if (a.hit_success && attackerSide !== undefined) {
        const si = sideIndexById.get(attackerSide)
        if (si !== undefined) damageBySide[si] += a.final_damage
      }
      const crit = a.weapons?.some(w => w.crit_fired)
      if (a.hit_success) {
        const dmgParts = []
        if (a.shield_damage > 0) dmgParts.push(`${a.shield_damage} shield`)
        if (a.hull_damage > 0) dmgParts.push(`${a.hull_damage} hull`)
        const dmgStr = dmgParts.length > 0 ? dmgParts.join(' + ') : `${a.final_damage}`
        const ammo = a.weapons?.find(w => w.ammo_used)?.ammo_used
        const ammoStr = ammo ? ` [${ammo}]` : ''
        const critStr = crit ? ' — CRITICAL' : ''
        if (a.splash) {
          events.push({
            tickIndex,
            tick: entry.tick,
            kind: 'splash',
            color: EVENT_COLORS.splash,
            text: `${name(a.target_id)} caught ${dmgStr} ${a.damage_type} splash from ${name(a.attacker_id)}${ammoStr}`,
            actorId: a.target_id,
          })
        } else {
          events.push({
            tickIndex,
            tick: entry.tick,
            kind: 'attack',
            color: EVENT_COLORS.attack,
            text: `${name(a.attacker_id)} hit ${name(a.target_id)} for ${dmgStr} ${a.damage_type}${ammoStr}${critStr}`,
            actorId: a.attacker_id,
          })
        }
      } else {
        events.push({
          tickIndex,
          tick: entry.tick,
          kind: 'miss',
          color: EVENT_COLORS.miss,
          text: `${name(a.attacker_id)} missed ${name(a.target_id)} (${Math.round(a.hit_chance * 100)}% to hit)`,
          actorId: a.attacker_id,
        })
      }
    }

    for (const b of entry.burns ?? []) {
      events.push({
        tickIndex,
        tick: entry.tick,
        kind: 'burn',
        color: b.destroyed ? EVENT_COLORS.kill : EVENT_COLORS.burn,
        text: b.destroyed
          ? `${name(b.target_id)} burned to destruction (${b.damage} damage)`
          : `${name(b.target_id)} took ${b.damage} burn damage${b.ticks_remaining > 0 ? ` (${b.ticks_remaining} ticks left)` : ''}`,
        actorId: b.target_id,
      })
    }

    for (const r of entry.regen ?? []) {
      const parts = []
      if (r.shield_regen > 0) parts.push(`${r.shield_regen} shield`)
      if (r.armor_repair > 0) parts.push(`${r.armor_repair} armor`)
      if (r.remote_repair) parts.push(`${r.remote_repair} remote hull repair`)
      if (parts.length === 0) continue
      events.push({
        tickIndex,
        tick: entry.tick,
        kind: 'regen',
        color: EVENT_COLORS.regen,
        text: `${name(r.player_id)} restored ${parts.join(' + ')}`,
        actorId: r.player_id,
      })
    }

    for (const f of entry.flee ?? []) {
      if (f.escaped) {
        const meta = participants.get(f.player_id)
        if (meta && meta.fate === 'fighting') {
          meta.fate = 'escaped'
          meta.fateTickIndex = tickIndex
        }
        events.push({
          tickIndex,
          tick: entry.tick,
          kind: 'escape',
          color: EVENT_COLORS.escape,
          text: `${name(f.player_id)} escaped to warp!`,
          actorId: f.player_id,
        })
      } else {
        events.push({
          tickIndex,
          tick: entry.tick,
          kind: 'flee',
          color: EVENT_COLORS.flee,
          text: `${name(f.player_id)} spooling warp drive (${f.flee_counter}/${f.flee_required})`,
          actorId: f.player_id,
        })
      }
    }

    for (const k of entry.kills ?? []) {
      const meta = participants.get(k.victim_id)
      if (meta) {
        meta.fate = 'destroyed'
        meta.killedBy = k.killer_username || name(k.killer_id)
        meta.fateTickIndex = tickIndex
      }
      events.push({
        tickIndex,
        tick: entry.tick,
        kind: 'kill',
        color: EVENT_COLORS.kill,
        text: `${k.victim_username || name(k.victim_id)} destroyed by ${k.killer_username || name(k.killer_id)}`,
        actorId: k.victim_id,
      })
    }

    if (entry.battle_ended) {
      const e = entry.battle_ended
      let outcomeText = 'Battle ended'
      if (e.outcome === 'victory') {
        const winners = (e.participants ?? [])
          .filter(p => p.side_id === e.winning_side)
          .map(p => p.username || name(p.player_id))
        outcomeText = winners.length ? `Victory — ${winners.join(', ')}` : 'Victory'
      } else if (e.outcome === 'stalemate') {
        outcomeText = 'Stalemate — both sides disengaged'
      } else if (e.outcome === 'mutual_destruction') {
        outcomeText = 'Mutual destruction'
      }
      events.push({
        tickIndex,
        tick: entry.tick,
        kind: 'end',
        color: EVENT_COLORS.end,
        text: `${outcomeText} (${e.duration} ticks, ${e.total_damage.toLocaleString()} total damage)`,
      })
      for (const p of e.participants ?? []) {
        const meta = participants.get(p.player_id)
        if (meta && meta.fate === 'fighting') {
          meta.fate = p.survived ? 'survived' : 'destroyed'
        }
      }
    }

    const total = damageBySide.reduce((a, b) => a + b, 0)
    tickDamage.push({ tickIndex, bySide: damageBySide, total })
  })

  // Anyone still marked fighting on a completed battle survived.
  const ended = entries.some(e => e.battle_ended)
  if (ended) {
    for (const meta of participants.values()) {
      if (meta.fate === 'fighting') meta.fate = 'survived'
    }
  }

  // Side metadata (labels from faction tag, else lead participant).
  const summarySides = new Map((summary?.sides ?? []).map(s => [s.side_id, s]))
  const sides: SideMeta[] = sortedSideIds.map((sideId, index) => {
    const ids = [...participants.values()]
      .filter(p => p.sideId === sideId)
      .sort((a, b) => a.slot - b.slot)
      .map(p => p.id)
    const info = summarySides.get(sideId)
    const lead = ids.length > 0 ? participants.get(ids[0])?.name : undefined
    let label = info?.faction_tag ? `[${info.faction_tag}]` : lead || `Side ${sideId}`
    if (!info?.faction_tag && ids.length > 1) label = `${lead} +${ids.length - 1}`
    return {
      sideId,
      index,
      color: sideColor(index),
      label,
      factionId: info?.faction_id,
      factionTag: info?.faction_tag,
      participantIds: ids,
    }
  })

  const peakTickDamage = tickDamage.reduce((m, t) => Math.max(m, t.total), 0)
  const totalDamage = tickDamage.reduce((m, t) => m + t.total, 0)

  return {
    entries,
    participants,
    sides,
    sideIndexById,
    events,
    tickDamage,
    peakTickDamage,
    totalDamage,
    snapshotAt,
    names,
  }
}
