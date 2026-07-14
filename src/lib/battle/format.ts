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

export function winnerNames(battle: BattleSummary): string[] {
  const side = (battle.sides ?? []).find(s => s.side_id === battle.winning_side)
  return side?.participants ?? []
}

/** Short human label for how a battle ended, or that it's still live. */
export function outcomeLabel(battle: BattleSummary): string {
  if (battle.status === 'active') return 'Battle in progress'
  switch (battle.outcome) {
    case 'victory': {
      const winners = winnerNames(battle)
      return winners.length ? `Victory: ${winners.join(', ')}` : 'Victory'
    }
    case 'stalemate':
      return 'Stalemate'
    case 'mutual_destruction':
      return 'Mutual destruction'
    default:
      return 'Battle concluded'
  }
}

/** Display label for one side: its roster, faction tag, or a generic fallback for unnamed NPC/wildlife/police forces. */
export function sideLabel(side: BattleSide, maxNames = 3): string {
  if (side.participants?.length) {
    const names = side.participants
    const shown = names.slice(0, maxNames).join(', ')
    return names.length > maxNames ? `${shown} +${names.length - maxNames}` : shown
  }
  if (side.faction_tag) return `[${side.faction_tag}]`
  return 'Hostile forces'
}
