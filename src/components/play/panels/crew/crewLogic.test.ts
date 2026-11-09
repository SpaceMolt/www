import { test, expect } from 'bun:test'
import { freeBerths, invitablePlayers, owedBounties, parseCount, recruitCost, transferableFitCrew } from './crewLogic'

const p = { fit_crew: 3, injured_crew: 1, fit_marines: 0, injured_marines: 2 }

test('parseCount clamps junk, negatives and max', () => {
  expect(parseCount('')).toBe(0)
  expect(parseCount('-4')).toBe(0)
  expect(parseCount('12', 5)).toBe(5)
  expect(parseCount('7')).toBe(7)
})

test('personnel math', () => {
  expect(freeBerths(p, 6, 2)).toEqual({ crew: 2, marines: 0 })
  expect(freeBerths(undefined, 4, 1)).toEqual({ crew: 4, marines: 1 })
  expect(recruitCost(2, 1)).toBe(450)
  expect(transferableFitCrew(p)).toBe(2)
  expect(transferableFitCrew({ ...p, fit_crew: 0 })).toBe(0)
})

test('invitablePlayers drops members and offline pilots', () => {
  const nearby = [
    { player_id: 'a', username: 'A', in_combat: false },
    { player_id: 'b', username: 'B', in_combat: false },
    { player_id: 'c', username: 'C', in_combat: false, offline: true },
  ]
  expect(invitablePlayers(nearby, ['a']).map((x) => x.player_id)).toEqual(['b'])
})

test('owedBounties lists only debts, largest first', () => {
  const standings = {
    solarian: { baseline: 0, reputation: 0, outstanding_bounty: 50 },
    crimson: { baseline: 0, reputation: 0, outstanding_bounty: 0 },
    nebula: { baseline: 0, reputation: 0, outstanding_bounty: 900 },
  }
  expect(owedBounties(standings).map((b) => b.empire)).toEqual(['nebula', 'solarian'])
})
