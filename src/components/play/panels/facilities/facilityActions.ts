import type { FacilityListingEntry, OwnedFacilityEntry } from '@spacemolt/lib'

/** True when the viewer can cancel this listing: their own, or their faction's (the server still checks ManageFacilities). */
export function isOwnListing(
  listing: Pick<FacilityListingEntry, 'seller_type' | 'seller_name'>,
  { username = '', factionName = '' }: { username?: string; factionName?: string } = {},
): boolean {
  if (!listing.seller_name) return false
  return listing.seller_type === 'faction'
    ? listing.seller_name === factionName
    : listing.seller_name === username
}

type StatusFields = Pick<OwnedFacilityEntry, 'under_construction' | 'ticks_until_complete' | 'damaged' | 'dismantling' | 'power_throttled' | 'missed_rent_cycles' | 'repair_complete_tick'>

/** "Under construction", with the ticks left when the server reports them. Empty once built. */
export function buildStatus({ under_construction, ticks_until_complete: ticks }: Pick<StatusFields, 'under_construction' | 'ticks_until_complete'>): string {
  if (!under_construction) return ''
  return ticks ? `Under construction, ${ticks} tick${ticks === 1 ? '' : 's'} left` : 'Under construction'
}

/** Short warning labels for a cross-station facility row, most urgent first. */
export function facilityWarnings(f: StatusFields): string[] {
  return [
    f.dismantling && 'Dismantling',
    f.damaged && (f.repair_complete_tick ? 'Repairing' : 'Damaged'),
    buildStatus(f),
    (f.missed_rent_cycles ?? 0) > 0 && `Rent ${f.missed_rent_cycles} cycle${f.missed_rent_cycles === 1 ? '' : 's'} behind`,
    f.power_throttled && 'Power throttled',
  ].filter((w): w is string => Boolean(w))
}

/** set_output_price takes credits per produced unit; the UI edits the fee per run. */
export const unitPriceForRunFee = (feePerRun: number, outputPerRun = 1): number => feePerRun / outputPerRun
