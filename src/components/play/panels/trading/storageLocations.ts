import { titleCase } from '@/lib/format'

/**
 * gh#2112 — the station list behind the undocked "Remote Storage View" picker.
 *
 * Every `target="self"` storage view returns `locations`: one entry per station
 * where the player holds items or parked ships. The Play client used to scrape
 * that list out of the free-text `hint` with a regex. Gameserver v0.555.0 added
 * a second paragraph to the hint, the regex stopped matching, and the panel went
 * blank for every undocked player.
 *
 * `locations` is not in the generated `@spacemolt/lib` types yet: neither the
 * pinned 11.1.0 nor the newest published 12.2.1 declares it. So the two fields
 * the picker needs are declared here. The server also sends `system`,
 * `system_name`, `item_count`, and `ship_count`. Drop this declaration when the
 * generated types catch up.
 */
export interface StorageLocation {
  base_id: string
  base_name?: string
}

export interface StorageStationOption {
  id: string
  label: string
}

/**
 * Build the station picker options from a storage view. The server sorts
 * `locations` by base id and includes stations that hold only ships, which the
 * hint never listed. `base_name` is blank for a station the player cannot see a
 * name for, so the id is the fallback label.
 */
export function storageStationOptions(
  view: { locations?: StorageLocation[] } | null | undefined,
): StorageStationOption[] {
  return (view?.locations ?? []).map((loc) => ({
    id: loc.base_id,
    label: loc.base_name || titleCase(loc.base_id),
  }))
}
