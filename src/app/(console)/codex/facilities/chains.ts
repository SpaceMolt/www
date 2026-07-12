/*
 * Upgrade chains — the structure that makes 2,652 facilities readable.
 *
 * SERVER-ONLY: this module reaches into `@/data/catalogReference`, which imports
 * `server-only`. It must never be pulled into a client component.
 *
 * The catalog ships 2,652 facilities, but they are not 2,652 distinct buildings.
 * Each one carries a `level` and an optional `upgrades_from` pointing at its
 * predecessor, and following those links collapses the set into 859 upgrade
 * chains — 719 of them production lines (one chain per craftable recipe), plus
 * service, infrastructure, faction and personal buildings. Every member of a
 * chain shares the same category and the same recipe; only the name, the cost,
 * and the draw scale with the level.
 *
 * So the list page shows one row per chain (859 rows, the same order of
 * magnitude as items), and the detail page shows one facility with its whole
 * chain laid out level by level. A flat 2,652-row table would show the same data
 * with none of the structure.
 */

import { allFacilities, facilitiesById, type RawFacility } from '@/data/catalogReference'

export interface FacilityChain {
  /** The lowest-level facility in the chain — the one the list page links to. */
  root: RawFacility
  /** Every level, ascending. Length 1 for facilities that never upgrade. */
  levels: RawFacility[]
}

/** Walk `upgrades_from` to the bottom of the chain. */
function rootOf(facility: RawFacility): RawFacility {
  let current = facility
  const seen = new Set<string>([current.id])
  while (current.upgrades_from) {
    const parent = facilitiesById[current.upgrades_from]
    if (!parent || seen.has(parent.id)) break
    seen.add(parent.id)
    current = parent
  }
  return current
}

interface ChainIndex {
  /** Chains keyed by root id, sorted by root name. */
  list: FacilityChain[]
  /** Every facility id → the chain it belongs to. */
  byFacility: Map<string, FacilityChain>
}

let _index: ChainIndex | null = null

function index(): ChainIndex {
  if (_index) return _index

  const byRoot = new Map<string, RawFacility[]>()
  for (const facility of allFacilities()) {
    const root = rootOf(facility)
    const members = byRoot.get(root.id)
    if (members) members.push(facility)
    else byRoot.set(root.id, [facility])
  }

  const list: FacilityChain[] = []
  const byFacility = new Map<string, FacilityChain>()

  for (const [rootId, members] of byRoot) {
    members.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    const chain: FacilityChain = { root: facilitiesById[rootId], levels: members }
    list.push(chain)
    for (const member of members) byFacility.set(member.id, chain)
  }

  list.sort((a, b) => a.root.name.localeCompare(b.root.name))
  _index = { list, byFacility }
  return _index
}

/** All 859 upgrade chains, sorted by the entry-level facility's name. */
export function allChains(): FacilityChain[] {
  return index().list
}

/** The chain a given facility belongs to (itself, if it never upgrades). */
export function chainFor(facilityId: string): FacilityChain | undefined {
  return index().byFacility.get(facilityId)
}

/** The facility one tier above this one, if any. */
export function upgradesTo(facilityId: string): RawFacility | undefined {
  const chain = chainFor(facilityId)
  if (!chain) return undefined
  const i = chain.levels.findIndex((f) => f.id === facilityId)
  return i >= 0 ? chain.levels[i + 1] : undefined
}
