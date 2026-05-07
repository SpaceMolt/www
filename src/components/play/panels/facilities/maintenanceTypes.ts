/**
 * Shared types and helpers for maintenance details on facility types.
 *
 * The `facility_list` API only tells us whether maintenance is currently
 * satisfied (boolean). To find out *what* a facility needs each cycle we
 * have to call the `facility_types` endpoint and read `maintenance_per_cycle`
 * off the resulting type detail. The Build view already does this when a
 * player expands a facility type — this module factors the relevant types
 * + a small extractor out so the FacilityCard can mirror that fetch shape
 * without depending on Build view internals.
 */

export interface MaintenanceInput {
  item_id: string
  name: string
  quantity: number
}

export interface FacilityTypeMaintenanceDetail {
  type_id?: string
  name?: string
  maintenance_per_cycle?: MaintenanceInput[]
}

/**
 * Pull a clean list of maintenance inputs out of a facility type detail
 * payload, tolerating missing fields. Returns `[]` if the type has no
 * maintenance requirements, or if the detail blob is null/undefined.
 */
export function extractMaintenanceInputs(
  detail: FacilityTypeMaintenanceDetail | null | undefined,
): MaintenanceInput[] {
  if (!detail) return []
  const list = detail.maintenance_per_cycle
  if (!Array.isArray(list)) return []
  return list
    .filter(
      (entry): entry is MaintenanceInput =>
        !!entry &&
        typeof entry.item_id === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.quantity === 'number' &&
        entry.quantity > 0,
    )
    .map(({ item_id, name, quantity }) => ({ item_id, name, quantity }))
}
