export interface GiftFormFields {
  credits: string
  itemId: string
  itemQty: string
  shipId: string
}

export type GiftAction =
  | { kind: 'ship'; shipId: string }
  | { kind: 'item'; itemId: string; quantity: number }
  | { kind: 'credits'; credits: number }

const positiveInt = (raw: string): number | null => {
  const value = parseInt(raw, 10)
  return isNaN(value) || value < 1 ? null : value
}

/**
 * Decide the single transfer the Send Gift form describes, or null if it describes
 * none. One send_gift call moves one of a ship, an item stack, or credits, so the
 * fields are ranked ship > item > credits.
 *
 * A selected item always claims the send: if its quantity is blank, zero, or negative
 * the result is null, never a fall-through to the credits field. Returning null must
 * keep the caller from sending and from clearing the form (dc#689374).
 *
 * Both fields come from <input type="number">, and parsing stays parseInt-lenient to
 * match the deposit and withdraw handlers in StorageView. The server is still the
 * authority on the amount: this function does not know the stack size in storage.
 */
export function resolveGiftAction(fields: GiftFormFields): GiftAction | null {
  if (fields.shipId) return { kind: 'ship', shipId: fields.shipId }

  if (fields.itemId) {
    const quantity = positiveInt(fields.itemQty)
    return quantity === null ? null : { kind: 'item', itemId: fields.itemId, quantity }
  }

  const credits = positiveInt(fields.credits)
  return credits === null ? null : { kind: 'credits', credits }
}

/** The Send Gift button is live only with a recipient and a resolvable transfer. */
export function isGiftSubmitDisabled(fields: GiftFormFields & { recipient: string }): boolean {
  return !fields.recipient.trim() || resolveGiftAction(fields) === null
}
