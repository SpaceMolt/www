import { describe, it, expect } from 'bun:test'
import { planGift, parseCreditAmount, type GiftForm } from './giftValidation'

/*
 * dc#689374: the old gift form sent one of ship, item or credits and silently dropped the rest.
 * planGift sends every filled field, or names the one problem that blocks the send.
 */
describe('planGift', () => {
  const iron = { item_id: 'iron', name: 'Iron', quantity: 10 }
  const ice = { item_id: 'ice', name: 'Ice', quantity: 3 }
  const form: GiftForm = { recipient: 'hiver', credits: '', items: [iron, ice], selection: {}, shipIds: [], wallet: 500 }

  it('needs a recipient', () => {
    expect(planGift({ ...form, recipient: '  ', credits: '5' })).toEqual({ problem: 'Enter a recipient' })
  })

  it('needs something to send', () => {
    expect(planGift(form)).toEqual({ problem: 'Choose items, credits or ships to send' })
  })

  it('sends items, credits and ships together', () => {
    expect(planGift({ ...form, credits: '250', selection: { iron: '4', ice: '3' }, shipIds: ['s1', 's2'] })).toEqual({
      plan: {
        recipient: 'hiver',
        items: [{ item_id: 'iron', quantity: 4 }, { item_id: 'ice', quantity: 3 }],
        credits: 250,
        shipIds: ['s1', 's2'],
      },
    })
  })

  it('blocks the send on a bad credit amount instead of dropping it', () => {
    for (const credits of ['0', '1.5', 'abc', '501']) {
      expect(planGift({ ...form, credits, selection: { iron: '4' } })).toHaveProperty('problem')
    }
  })

  it('blocks the send on a bad item quantity instead of dropping the row', () => {
    for (const qty of ['', '0', '11', '2.5']) {
      expect(planGift({ ...form, credits: '5', selection: { iron: qty } })).toEqual({
        problem: 'Fix the quantity on 1 selected item',
      })
    }
  })

  it('ignores a selection key whose row is gone', () => {
    expect(planGift({ ...form, selection: { gone: '5' }, shipIds: ['s1'] })).toEqual({
      plan: { recipient: 'hiver', items: [], credits: 0, shipIds: ['s1'] },
    })
  })
})

describe('parseCreditAmount (fr#412789 faction treasury)', () => {
  it('accepts a whole number from 1 to max', () => {
    expect(parseCreditAmount('1', 500)).toBe(1)
    expect(parseCreditAmount(' 500 ', 500)).toBe(500)
  })

  it('rejects zero, negative, non-integer, blank, and over-max amounts', () => {
    for (const raw of ['0', '-5', '1.5', '1e3', '', 'abc', '501']) {
      expect(parseCreditAmount(raw, 500)).toBeNull()
    }
  })
})
