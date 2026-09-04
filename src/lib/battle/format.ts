// Shared formatting helpers for battle summaries — used by the battles list,
// the battle detail page's metadata, and its share-card image.

import type { BattleSide, BattleSummary } from './types'

export function formatDuration(ticks: number): string {
  const seconds = ticks * 10
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/** Bounds a string's length regardless of how long a name gets, so callers can't overflow a fixed layout. */
export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export function winnerNames(battle: BattleSummary): string[] {
  const side = (battle.sides ?? []).find(s => s.side_id === battle.winning_side)
  return side?.participants ?? []
}

/** "blood_arena" → "Blood Arena": a readable name for a catalog or POI id. */
export function humanizeID(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

/** Display name of an arena venue, derived from its POI id so any future arena reads well. */
export function arenaVenueName(originPoi?: string): string {
  return originPoi ? humanizeID(originPoi) : 'Arena'
}

/** Headline location: the venue and its system for an arena match, else the system. */
export function battleVenue(battle: Pick<BattleSummary, 'category' | 'origin_poi' | 'system_name' | 'system_id'>): string {
  const system = battle.system_name || battle.system_id
  if (battle.category !== 'arena') return system
  return `${arenaVenueName(battle.origin_poi)} · ${system}`
}

/** Short human label for how a battle ended, or that it's still live. */
export function outcomeLabel(battle: BattleSummary): string {
  const arena = battle.category === 'arena'
  if (battle.status === 'active') return arena ? 'Match in progress' : 'Battle in progress'
  switch (battle.outcome) {
    case 'victory': {
      const winningSide = (battle.sides ?? []).find(s => s.side_id === battle.winning_side)
      const word = arena ? 'Winner' : 'Victory'
      if (!winningSide?.participants?.length) return word
      const winners = winningSide.participants
      return `${word}: ${winners.length > 3 ? sideLabel(winningSide) : winners.join(', ')}`
    }
    case 'stalemate':
      return arena ? 'Draw' : 'Stalemate'
    case 'mutual_destruction':
      return arena ? 'Double knockout' : 'Mutual destruction'
    default:
      return arena ? 'Match concluded' : 'Battle concluded'
  }
}

/**
 * Display label for one side. Small engagements name every combatant; larger
 * engagements use a station, faction, commander, or ship-count fleet identity
 * so share metadata and fixed-size cards stay readable.
 */
export function sideLabel(side: BattleSide, maxNames = 3): string {
  if (side.participants?.length) {
    const names = side.participants
    if (names.length <= maxNames) return names.join(', ')

    // Three combatants are still a small engagement on the image card, where
    // maxNames is two; keep the familiar compact “A, B +1” form there.
    if (names.length === maxNames + 1 && names.length <= 3) {
      return `${names.slice(0, maxNames).join(', ')} +1`
    }

    const station = stationDefenseName(names)
    if (station) return `${station} Defense Fleet`

    if (side.faction_tag) return `[${side.faction_tag}] Fleet`

    const commander = names.find(name => COMMANDER_TITLE.test(name))
    if (commander) return `${commander}${commander.endsWith('s') ? '\'' : "'s"} Fleet`

    return `${names.length}-Ship Fleet`
  }
  if (side.faction_tag) return `[${side.faction_tag}]`
  return 'Hostile forces'
}

const COMMANDER_TITLE = /^(?:Admiral|Archon|Commandant|Commander|Director|Grand Marshal|Imperator|Overlord|Sovereign|Warlord)\b/i

/** Extracts and shortens a station participant name for a defense-force label. */
function stationDefenseName(names: string[]): string | undefined {
  const stationParticipant = names.find(name => /\bStation$/i.test(name) && !name.includes(' - '))
    ?? names.find(name => /\bStation$/i.test(name))
  if (!stationParticipant) return undefined

  const stationName = stationParticipant.split(' - ').at(-1)!.replace(/^\[[^\]]+\]\s*/, '')
  return stationName.replace(/\s+(?:Defense|Industrial|Military|Mining|Orbital|Research|Trade)\s+Station$/i, ' Station')
}
