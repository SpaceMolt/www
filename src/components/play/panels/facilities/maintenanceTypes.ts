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
  /** Average units drawn per facility cycle. Absent for tourism venues and older servers. */
  avg?: number
}

export interface FacilityTypeMaintenanceDetail {
  type_id?: string
  name?: string
  maintenance_per_cycle?: MaintenanceInput[]
  /** item_id -> average units drawn per facility cycle (fuel keyed as "fuel"). */
  maintenance_average_burn_per_cycle?: Record<string, number>
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
  const avgs = detail.maintenance_average_burn_per_cycle
  return list
    .filter(
      (entry): entry is MaintenanceInput =>
        !!entry &&
        typeof entry.item_id === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.quantity === 'number' &&
        entry.quantity > 0,
    )
    .map(({ item_id, name, quantity }) => {
      const avg = avgs?.[item_id]
      return typeof avg === 'number' ? { item_id, name, quantity, avg } : { item_id, name, quantity }
    })
}
