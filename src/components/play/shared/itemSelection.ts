import { formatItemId } from '@/data/catalog'
import { errorMessage, stripErrorCode } from './errorMessage'

/** Rows the multi-select list can show: cargo, personal storage, or faction storage. */
export interface SelectableItem {
  item_id: string
  name?: string
  quantity: number
  size?: number
}

/** item_id -> quantity text. A key is present only while its row is checked. */
export type Selection = Record<string, string>

export interface ItemQty {
  item_id: string
  quantity: number
}

/** One per-item outcome, as the server's bulk storage and jettison results report it. */
export interface ItemResult {
  item_id: string
  quantity: number
  success: boolean
  /** Failure code, e.g. `cargo_full`. */
  error?: string
  /** Failure sentence written for players, when the server sends one. */
  message?: string
}

/** useCargo() rows are all-optional (delta-friendly wire shape); drop incomplete entries and normalize item_name -> name. */
export function normalizeCargo(
  raw: Array<{ item_id?: string; item_name?: string; quantity?: number; size?: number }> | null | undefined,
): SelectableItem[] {
  return (raw ?? []).flatMap((c) =>
    c.item_id && c.quantity ? [{ item_id: c.item_id, name: c.item_name ?? c.item_id, quantity: c.quantity, size: c.size }] : [],
  )
}

/** The server's per-call limit for `items[]`. */
export const BULK_LIMIT = 100

export const selectAll = (items: SelectableItem[]): Selection =>
  Object.fromEntries(items.map((item) => [item.item_id, String(item.quantity)]))

/** Checked rows that still exist, with a whole quantity from 1 to the row's stack. Rows that fail the check are left out. */
export function selectedItems(items: SelectableItem[], selection: Selection): ItemQty[] {
  return items.flatMap((item) => {
    if (!(item.item_id in selection)) return []
    const quantity = Number(selection[item.item_id])
    return Number.isInteger(quantity) && quantity >= 1 && quantity <= item.quantity
      ? [{ item_id: item.item_id, quantity }]
      : []
  })
}

export function chunk<T>(list: T[], size = BULK_LIMIT): T[][] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))
}

/**
 * Send the items in calls of at most BULK_LIMIT, one after another (each call is one tick).
 * If a call throws, every item of that call and of the calls not yet sent is reported as failed
 * with the error text, so the caller can keep exactly those rows selected.
 */
export async function sendInBatches(
  items: ItemQty[],
  send: (batch: ItemQty[]) => Promise<ItemResult[] | undefined>,
): Promise<ItemResult[]> {
  const results: ItemResult[] = []
  const batches = chunk(items)
  for (const [index, batch] of batches.entries()) {
    try {
      const batchResults = await send(batch)
      // A response without per-item results means the whole call succeeded.
      results.push(...(batchResults ?? batch.map((item) => ({ ...item, success: true }))))
    } catch (err) {
      const error = errorMessage(err)
      const rest = batches.slice(index).flat()
      return [...results, ...rest.map((item) => ({ ...item, success: false, error }))]
    }
  }
  return results
}

/** The selection to keep after a send: only the failed rows, at the quantity that was tried. */
export const keepFailed = (results: ItemResult[]): Selection =>
  Object.fromEntries(results.filter((r) => !r.success).map((r) => [r.item_id, String(r.quantity)]))

/**
 * One line for a toast: "Moved 4 items to faction storage" or
 * "Moved 3 of 4 items to faction storage. Iron Ore: Not enough space". `where` names the direction.
 */
export function summarize(verb: string, results: ItemResult[], where = ''): { ok: boolean; text: string } {
  const failed = results.filter((r) => !r.success)
  const noun = `${results.length === 1 ? 'item' : 'items'}${where ? ` ${where}` : ''}`
  if (failed.length === 0) return { ok: true, text: `${verb} ${results.length} ${noun}` }
  const reasons = failed.slice(0, 3).map((r) => `${formatItemId(r.item_id)}: ${stripErrorCode(r.message ?? r.error ?? 'failed').replace(/package:[0-9a-f]+/g, 'sealed package')}`).join('; ')
  const more = failed.length > 3 ? ` (+${failed.length - 3} more)` : ''
  return { ok: false, text: `${verb} ${results.length - failed.length} of ${results.length} ${noun}. ${reasons}${more}` }
}
