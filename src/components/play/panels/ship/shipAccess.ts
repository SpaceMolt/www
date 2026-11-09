import type { EmpireStanding } from '@spacemolt/lib'

/** The ship-class fields the server gates acquiring or flying a hull on. */
export interface GatedShip {
  piloting_required?: number
  required_reputation?: number
  /** Owning empire, whose reputation `required_reputation` is checked against. */
  faction?: string
  legacy?: boolean
  required_achievement?: string
  required_faction_achievement?: string
  prestige_lock?: string
}

const titleCase = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)

/**
 * Why this player cannot buy or fly a hull; empty when nothing blocks it.
 * Mirrors gameserver checkPilotingRequirement, checkReputationRequirement, and checkPrestigeRequirement.
 * The catalog dump already zeroes piloting_required on prestige hulls. Legacy hulls skip piloting and
 * reputation. The client cannot see achievements, so a prestige hull counts as locked.
 * The server's commissionable set has passed piloting and prestige for this player, so membership clears
 * those. It does not clear reputation: a faction license waives reputation for a commission only, never
 * for buying a listed ship. Piloting and reputation are skipped until skills and standings have loaded.
 */
export function shipBlockReasons(
  ship: GatedShip,
  { piloting, standings, commissionable = false }: {
    piloting?: number
    standings?: Record<string, Pick<EmpireStanding, 'reputation'>>
    commissionable?: boolean
  } = {},
): string[] {
  const required = ship.legacy ? 0 : ship.piloting_required ?? 0
  const needRep = ship.legacy || !ship.faction ? 0 : ship.required_reputation ?? 0
  const rep = ship.faction ? standings?.[ship.faction]?.reputation ?? 0 : 0
  const prestige = Boolean(ship.prestige_lock || ship.required_achievement || ship.required_faction_achievement)
  return [
    !commissionable && piloting !== undefined && piloting < required && `Needs Piloting ${required} (you have ${piloting})`,
    standings !== undefined && rep < needRep && `Needs ${needRep} reputation with ${titleCase(ship.faction ?? '')} (you have ${rep})`,
    !commissionable && prestige && (ship.prestige_lock || 'Prestige hull: needs an achievement'),
  ].filter((reason): reason is string => Boolean(reason))
}
