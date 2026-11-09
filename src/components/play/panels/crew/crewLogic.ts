import type { EmpireStanding, NearbyPlayer, V2Personnel } from '@spacemolt/lib'
import { getItem } from '@/data/catalog'

/** Server notes: recruit_personnel charges 100 per crew and 250 per marine. */
export const CREW_RECRUIT_PRICE = 100
export const MARINE_RECRUIT_PRICE = 250

/** Parse a count input; blank or junk is 0, never negative or above max. */
export function parseCount(value: string, max = Infinity): number {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, max)
}

/** Free berths per class: fit + injured both hold a berth. */
export function freeBerths(p: V2Personnel | undefined, crewCap: number, marineCap: number) {
  const crew = Math.max(0, crewCap - (p?.fit_crew ?? 0) - (p?.injured_crew ?? 0))
  const marines = Math.max(0, marineCap - (p?.fit_marines ?? 0) - (p?.injured_marines ?? 0))
  return { crew, marines }
}

/** Recruit cost; crew are filled before marines, as the server does. */
export function recruitCost(crew: number, marines: number): number {
  return crew * CREW_RECRUIT_PRICE + marines * MARINE_RECRUIT_PRICE
}

/** The donor ship must keep one fit crew member aboard. */
export function transferableFitCrew(p: V2Personnel | undefined): number {
  return Math.max(0, (p?.fit_crew ?? 0) - 1)
}

/** Nearby players who are not already in your fleet. */
export function invitablePlayers(nearby: NearbyPlayer[] | undefined, memberIds: string[]): NearbyPlayer[] {
  const members = new Set(memberIds)
  return (nearby ?? []).filter((p) => !members.has(p.player_id) && !p.offline)
}

/** Empires you owe a bounty (crimes, missed taxes) to, largest first. */
export function owedBounties(standings: Record<string, EmpireStanding> | undefined) {
  return Object.entries(standings ?? {})
    .filter(([, s]) => s.outstanding_bounty > 0)
    .map(([empire, s]) => ({ empire, amount: s.outstanding_bounty, jailedUntil: s.jailed_until }))
    .sort((a, b) => b.amount - a.amount)
}

/** Whether cargo holds a repair kit: any item with a repair effect (gameserver selectRepairKit). */
export function hasRepairKit(cargo: { item_id?: string }[] | undefined): boolean {
  return (cargo ?? []).some((c) => getItem(c.item_id ?? '')?.effect?.type === 'repair')
}
