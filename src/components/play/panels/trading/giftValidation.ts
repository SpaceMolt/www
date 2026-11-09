import { selectedItems, type ItemQty, type SelectableItem, type Selection } from '../../shared/itemSelection'

export interface GiftForm {
  recipient: string
  credits: string
  /** The rows the item selection was made from (cargo or storage). */
  items: SelectableItem[]
  selection: Selection
  shipIds: string[]
  wallet: number
}

/** Everything one Send press transfers: one bulk item call, one credit call, one call per ship. */
export interface GiftPlan {
  recipient: string
  items: ItemQty[]
  credits: number
  shipIds: string[]
}

/** A whole-number credit amount from 1 to max, or null. Rejects "1.5" and "1e3" instead of truncating them. */
export function parseCreditAmount(raw: string, max: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null
  const value = Number(raw)
  return value < 1 || value > max ? null : value
}

/**
 * Turn the gift form into a plan, or into the one problem that blocks it. Every filled field is either
 * sent or reported: a bad credit amount or a bad item quantity blocks the whole send, so nothing the
 * player entered is dropped without a word (dc#689374).
 */
export function planGift(form: GiftForm): { plan: GiftPlan } | { problem: string } {
  const recipient = form.recipient.trim()
  if (!recipient) return { problem: 'Enter a recipient' }
  const credits = form.credits.trim() ? parseCreditAmount(form.credits, form.wallet) : 0
  if (credits === null) return { problem: 'Credits must be a whole number from 1 to your balance' }
  const items = selectedItems(form.items, form.selection)
  const badRows = form.items.filter((item) => item.item_id in form.selection).length - items.length
  if (badRows > 0) return { problem: `Fix the quantity on ${badRows} selected item${badRows === 1 ? '' : 's'}` }
  if (items.length === 0 && credits === 0 && form.shipIds.length === 0) {
    return { problem: 'Choose items, credits or ships to send' }
  }
  return { plan: { recipient, items, credits, shipIds: form.shipIds } }
}
