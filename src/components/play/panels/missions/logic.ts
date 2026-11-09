import type { WaitingPassengerView } from '@spacemolt/lib'

const PACKAGE_PREFIX = 'package:'

export interface PackageOption {
  /** The package:<id> item form; quote/post accept it as package_id. */
  item_id: string
  label: string
  source: 'cargo' | 'storage'
}

interface ItemRow {
  item_id?: string
  item_name?: string
  name?: string
  quantity?: number
}

/** Sealed packages held in cargo and station storage, as ship-form options. */
export function packageOptions({ cargo = [], storage = [] }: { cargo?: ItemRow[]; storage?: ItemRow[] } = {}): PackageOption[] {
  const pick = (rows: ItemRow[], source: PackageOption['source']) =>
    rows
      .filter((r) => r.item_id?.startsWith(PACKAGE_PREFIX) && (r.quantity ?? 0) > 0)
      .map((r) => ({
        item_id: r.item_id as string,
        label: r.item_name ?? r.name ?? (r.item_id as string),
        source,
      }))
  return [...pick(cargo, 'cargo'), ...pick(storage, 'storage')]
}

export interface ShipForm {
  packageId: string
  destination: string
  baseReward: string
  speedBonus: string
  visibility: 'public' | 'faction' | 'allies' | 'invited'
  invitedId: string
}

const isWholeNumber = (s: string) => /^\d+$/.test(s.trim())

/** First problem that would make quote/post fail, or null when the form is sendable. */
export function shipFormError({ packageId, destination, baseReward, speedBonus, visibility, invitedId }: ShipForm): string | null {
  if (!packageId) return 'Pick a sealed package to ship.'
  if (!destination.trim()) return 'Enter a destination station.'
  if (!isWholeNumber(baseReward) || Number(baseReward) <= 0) return 'Reward must be a whole number above 0.'
  if (speedBonus.trim() && !isWholeNumber(speedBonus)) return 'Speed bonus must be a whole number.'
  if (visibility === 'invited' && !invitedId.trim()) return 'Invited listings need a carrier id.'
  return null
}

export interface DestinationGroup {
  destination: string
  destination_name: string
  destination_system?: string
  passengers: WaitingPassengerView[]
  estimated_fare: number
}

/** Waiting passengers grouped by destination, richest group first (load_passenger loads one destination). */
export function groupByDestination(waiting: WaitingPassengerView[]): DestinationGroup[] {
  const groups = waiting.reduce((acc, p) => {
    const g = acc.get(p.destination) ?? {
      destination: p.destination,
      destination_name: p.destination_name,
      destination_system: p.destination_system,
      passengers: [],
      estimated_fare: 0,
    }
    return acc.set(p.destination, {
      ...g,
      passengers: [...g.passengers, p],
      estimated_fare: g.estimated_fare + (p.estimated_fare ?? 0),
    })
  }, new Map<string, DestinationGroup>())
  return [...groups.values()].sort((a, b) => b.estimated_fare - a.estimated_fare)
}

/** Shipping deliver/return need the carrier docked at the right station with the sealed box in the active ship. */
export function settleBlock({
  station,
  stationName = station,
  dockedAt,
  hasPackage,
}: {
  station: string
  stationName?: string
  dockedAt?: string | null
  hasPackage: boolean
}): string | null {
  if (dockedAt !== station) return `Dock at ${stationName} first.`
  if (!hasPackage) return 'Withdraw the sealed package into your cargo first.'
  return null
}

/** Missions whose title or description contains `text` (any case), limited to one `type` when set. */
export function filterMissions<M extends { title: string; description: string; type: string }>(
  missions: M[],
  { text = '', type = '' }: { text?: string; type?: string } = {},
): M[] {
  const q = text.trim().toLowerCase()
  return missions.filter((m) =>
    (!type || m.type === type) && (!q || m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)))
}
