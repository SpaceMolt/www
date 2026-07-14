import { describe, it, expect } from 'bun:test'
import { formatDuration, outcomeLabel, sideLabel, truncate, winnerNames } from './format'
import type { BattleSummary } from './types'

function summary(over: Partial<BattleSummary>): BattleSummary {
  return {
    battle_id: 'b1',
    system_id: 'sol',
    system_name: 'Sol',
    status: 'completed',
    start_tick: 0,
    duration_ticks: 6,
    participant_count: 2,
    sides: [],
    total_damage: 0,
    ships_destroyed: 0,
    ...over,
  }
}

describe('formatDuration', () => {
  it('renders sub-minute durations as seconds', () => {
    expect(formatDuration(3)).toBe('30s')
  })

  it('drops the seconds remainder when it is zero', () => {
    expect(formatDuration(6)).toBe('1m')
  })

  it('keeps a nonzero seconds remainder under an hour', () => {
    expect(formatDuration(7)).toBe('1m 10s')
  })

  it('drops the minutes remainder when it is zero at an hour boundary', () => {
    expect(formatDuration(360)).toBe('1h')
  })

  it('keeps a nonzero minutes remainder past an hour', () => {
    expect(formatDuration(366)).toBe('1h 1m')
  })
})

describe('winnerNames', () => {
  it('returns the winning side\'s roster', () => {
    const b = summary({
      winning_side: 2,
      sides: [
        { side_id: 1, participants: ['Loser'] },
        { side_id: 2, participants: ['Winner1', 'Winner2'] },
      ],
    })
    expect(winnerNames(b)).toEqual(['Winner1', 'Winner2'])
  })

  it('returns an empty list when no side matches winning_side', () => {
    const b = summary({ winning_side: 99, sides: [{ side_id: 1, participants: ['Someone'] }] })
    expect(winnerNames(b)).toEqual([])
  })
})

describe('outcomeLabel', () => {
  it('reports an active battle as in progress regardless of outcome', () => {
    const b = summary({ status: 'active', outcome: 'victory' })
    expect(outcomeLabel(b)).toBe('Battle in progress')
  })

  it('names the winners for a victory', () => {
    const b = summary({
      outcome: 'victory',
      winning_side: 1,
      sides: [{ side_id: 1, participants: ['Ace'] }],
    })
    expect(outcomeLabel(b)).toBe('Victory: Ace')
  })

  it('falls back to a bare "Victory" when the winning side has no roster', () => {
    const b = summary({ outcome: 'victory', winning_side: 1, sides: [{ side_id: 1 }] })
    expect(outcomeLabel(b)).toBe('Victory')
  })

  it('labels a stalemate', () => {
    expect(outcomeLabel(summary({ outcome: 'stalemate' }))).toBe('Stalemate')
  })

  it('labels mutual destruction', () => {
    expect(outcomeLabel(summary({ outcome: 'mutual_destruction' }))).toBe('Mutual destruction')
  })

  it('falls back to a generic label for an unrecognized or missing outcome', () => {
    expect(outcomeLabel(summary({}))).toBe('Battle concluded')
  })
})

describe('sideLabel', () => {
  it('joins the roster up to maxNames', () => {
    const side = { side_id: 1, participants: ['A', 'B', 'C'] }
    expect(sideLabel(side, 2)).toBe('A, B +1')
  })

  it('shows every name when the roster is within maxNames', () => {
    const side = { side_id: 1, participants: ['A', 'B'] }
    expect(sideLabel(side, 3)).toBe('A, B')
  })

  it('falls back to the faction tag when there is no roster', () => {
    const side = { side_id: 1, faction_tag: 'HEXC' }
    expect(sideLabel(side)).toBe('[HEXC]')
  })

  it('falls back to a generic label when there is neither roster nor faction tag', () => {
    expect(sideLabel({ side_id: 1 })).toBe('Hostile forces')
  })
})

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('short', 10)).toBe('short')
  })

  it('leaves a string exactly at the limit untouched', () => {
    expect(truncate('1234567890', 10)).toBe('1234567890')
  })

  it('clips and appends an ellipsis past the limit', () => {
    expect(truncate('12345678901', 10)).toBe('123456789…')
  })
})
