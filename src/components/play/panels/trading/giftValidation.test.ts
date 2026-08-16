import { describe, it, expect } from 'bun:test'
import fs from 'fs'
import path from 'path'
import { resolveGiftAction, isGiftSubmitDisabled } from './giftValidation'

/*
 * dc#689374 — "Play UI gift submit fails silently if the quantity is empty".
 *
 * The Send Gift form in StorageView used to decide what to send with an inline
 * chain of truthiness checks. Two defects came out of it:
 *
 *   - An item selected with a blank quantity matched no branch, so no request was
 *     sent, yet the form still cleared itself and closed. The player saw exactly
 *     what a successful gift looks like.
 *   - Worse, if the Credits field also had a value, the blank quantity fell through
 *     to the credits branch and gifted credits instead of the selected item.
 *
 * resolveGiftAction is the single decision point now: it returns the one transfer
 * the form describes, or null when the form does not describe a valid transfer.
 * The submit handler refuses to send (and refuses to reset) on null.
 */

describe('resolveGiftAction', () => {
  const blank = { credits: '', itemId: '', itemQty: '', shipId: '' }

  it('returns null for an empty form', () => {
    expect(resolveGiftAction(blank)).toBeNull()
  })

  it('sends a ship when a ship is selected', () => {
    expect(resolveGiftAction({ ...blank, shipId: 'ship-1' })).toEqual({ kind: 'ship', shipId: 'ship-1' })
  })

  it('prefers the ship over an item or credits', () => {
    expect(resolveGiftAction({ credits: '100', itemId: 'iron', itemQty: '5', shipId: 'ship-1' })).toEqual({
      kind: 'ship',
      shipId: 'ship-1',
    })
  })

  it('sends an item with a valid quantity', () => {
    expect(resolveGiftAction({ ...blank, itemId: 'iron', itemQty: '5' })).toEqual({
      kind: 'item',
      itemId: 'iron',
      quantity: 5,
    })
  })

  it('prefers the item over credits', () => {
    expect(resolveGiftAction({ ...blank, credits: '100', itemId: 'iron', itemQty: '5' })).toEqual({
      kind: 'item',
      itemId: 'iron',
      quantity: 5,
    })
  })

  // The reported bug.
  it('returns null when an item is selected with a blank quantity', () => {
    expect(resolveGiftAction({ ...blank, itemId: 'iron', itemQty: '' })).toBeNull()
  })

  // The silent wrong action: a selected item must never degrade into a credit gift.
  it('does not fall through to credits when the item quantity is blank', () => {
    expect(resolveGiftAction({ ...blank, credits: '100', itemId: 'iron', itemQty: '' })).toBeNull()
  })

  it('returns null for a zero or negative item quantity', () => {
    expect(resolveGiftAction({ ...blank, itemId: 'iron', itemQty: '0' })).toBeNull()
    expect(resolveGiftAction({ ...blank, itemId: 'iron', itemQty: '-3' })).toBeNull()
    expect(resolveGiftAction({ ...blank, credits: '100', itemId: 'iron', itemQty: '0' })).toBeNull()
  })

  it('returns null for a non-numeric item quantity', () => {
    expect(resolveGiftAction({ ...blank, itemId: 'iron', itemQty: 'abc' })).toBeNull()
  })

  it('sends credits when only credits are filled in', () => {
    expect(resolveGiftAction({ ...blank, credits: '250' })).toEqual({ kind: 'credits', credits: 250 })
  })

  it('returns null for zero, negative, or non-numeric credits', () => {
    expect(resolveGiftAction({ ...blank, credits: '0' })).toBeNull()
    expect(resolveGiftAction({ ...blank, credits: '-5' })).toBeNull()
    expect(resolveGiftAction({ ...blank, credits: 'abc' })).toBeNull()
  })
})

describe('isGiftSubmitDisabled', () => {
  const base = { recipient: 'hiver', credits: '', itemId: '', itemQty: '', shipId: '' }

  it('is disabled without a recipient', () => {
    expect(isGiftSubmitDisabled({ ...base, recipient: '   ', credits: '100' })).toBe(true)
  })

  it('is disabled when the form describes no transfer', () => {
    expect(isGiftSubmitDisabled(base)).toBe(true)
  })

  // The reported bug: the button used to be enabled by item selection alone.
  it('is disabled when an item is selected but the quantity is blank', () => {
    expect(isGiftSubmitDisabled({ ...base, itemId: 'iron' })).toBe(true)
    expect(isGiftSubmitDisabled({ ...base, itemId: 'iron', itemQty: '0' })).toBe(true)
    expect(isGiftSubmitDisabled({ ...base, credits: '100', itemId: 'iron' })).toBe(true)
  })

  it('is enabled for a complete item gift', () => {
    expect(isGiftSubmitDisabled({ ...base, itemId: 'iron', itemQty: '5' })).toBe(false)
  })

  it('is enabled for a credits gift and for a ship gift', () => {
    expect(isGiftSubmitDisabled({ ...base, credits: '100' })).toBe(false)
    expect(isGiftSubmitDisabled({ ...base, shipId: 'ship-1' })).toBe(false)
  })
})

/*
 * There is no React render harness in this repo, so the wiring between the form and
 * the resolver is guarded at the source level: the handler must bail out before it
 * clears the form, so a submit that sends nothing can never look like a success.
 */
describe('StorageView gift submit wiring', () => {
  const source = fs.readFileSync(path.join(import.meta.dir, 'StorageView.tsx'), 'utf8')
  const handlerStart = source.indexOf('const handleSendGift')
  const handlerEnd = source.indexOf('// --- Undocked: remote station viewer ---')
  const handler = source.slice(handlerStart, handlerEnd)

  // Fail loudly rather than degrading to whole-file matching if either anchor moves.
  it('can still find the submit handler', () => {
    expect(handlerStart).toBeGreaterThan(-1)
    expect(handlerEnd).toBeGreaterThan(handlerStart)
  })

  it('decides what to send with resolveGiftAction', () => {
    expect(source).toContain("from './giftValidation'")
    expect(handler).toMatch(/resolveGiftAction\(/)
  })

  it('bails out before it sends or touches any form state', () => {
    const bail = handler.search(/if \(!?action(?: === null)?\)\s*return\b/)
    expect(bail).toBeGreaterThan(-1)
    // Everything the handler does to the form — clearing a field, collapsing the
    // panel, marking a send in flight, issuing the request — must sit after the
    // bail, so a submit that resolves to nothing leaves the UI exactly as it was.
    const preBail = handler.slice(0, bail)
    for (const effect of ['setGift', 'setShowSendGift', 'setSendingGift', 'mutate(', 'refetchStorage(']) {
      expect(preBail).not.toContain(effect)
    }
    // ...and the bail must not carry a body that resets or closes anything.
    const bailStatement = handler.slice(bail, handler.indexOf('return', bail))
    expect(bailStatement).not.toContain('set')
  })

  it('drives the Send Gift button from isGiftSubmitDisabled', () => {
    expect(source).toContain('isGiftSubmitDisabled(')
  })
})
