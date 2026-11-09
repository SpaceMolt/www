import { describe, it, expect } from 'bun:test'
import { chunk, keepFailed, normalizeCargo, selectAll, selectedItems, sendInBatches, summarize, type ItemQty } from './itemSelection'

const iron = { item_id: 'iron', name: 'Iron', quantity: 10 }
const ice = { item_id: 'ice', name: 'Ice', quantity: 3 }

describe('selectedItems', () => {
  it('starts every row at its full stack', () => {
    expect(selectedItems([iron, ice], selectAll([iron, ice]))).toEqual([
      { item_id: 'iron', quantity: 10 },
      { item_id: 'ice', quantity: 3 },
    ])
  })

  it('drops rows with a bad quantity and rows that are gone', () => {
    expect(selectedItems([iron, ice], { iron: '11', ice: '1.5', gone: '1' })).toEqual([])
    expect(selectedItems([iron], { iron: '4' })).toEqual([{ item_id: 'iron', quantity: 4 }])
  })
})

describe('normalizeCargo', () => {
  it('drops incomplete rows and fills the name', () => {
    expect(normalizeCargo([{ item_id: 'iron', quantity: 2 }, { item_id: 'x' }, {}])).toEqual([
      { item_id: 'iron', name: 'iron', quantity: 2, size: undefined },
    ])
  })
})

describe('sendInBatches', () => {
  const many: ItemQty[] = Array.from({ length: 250 }, (_, i) => ({ item_id: `i${i}`, quantity: 1 }))

  it('splits at 100 items per call', async () => {
    const sizes: number[] = []
    const results = await sendInBatches(many, async (batch) => {
      sizes.push(batch.length)
      return undefined
    })
    expect(sizes).toEqual([100, 100, 50])
    expect(results.every((r) => r.success)).toBe(true)
    expect(chunk(many).length).toBe(3)
  })

  it('keeps per-item failures and marks unsent items failed when a call throws', async () => {
    let call = 0
    const results = await sendInBatches(many, async (batch) => {
      call += 1
      if (call === 2) throw new Error('Not docked')
      return batch.map((item, i) => ({ ...item, success: i !== 0, error: i === 0 ? 'cargo_full' : undefined }))
    })
    expect(results.length).toBe(250)
    const kept = keepFailed(results)
    expect(Object.keys(kept).length).toBe(1 + 150)
    expect(kept.i0).toBe('1')
    expect(results.find((r) => r.item_id === 'i100')?.error).toBe('Not docked')
  })
})

describe('summarize', () => {
  it('reports success and partial failure', () => {
    expect(summarize('Moved', [{ item_id: 'a', quantity: 1, success: true }])).toEqual({ ok: true, text: 'Moved 1 item' })
    expect(summarize('Moved', [
      { item_id: 'a', quantity: 1, success: true },
      { item_id: 'b', quantity: 1, success: false, error: 'cargo_full' },
    ])).toEqual({ ok: false, text: 'Moved 1 of 2 items. B: Cargo full' })
    expect(summarize('Withdrew', [
      { item_id: 'package:3fda0943', quantity: 1, success: false, error: 'cargo_full', message: 'Not enough cargo space.' },
    ])).toEqual({ ok: false, text: 'Withdrew 0 of 1 item. Sealed package: Not enough cargo space.' })
    expect(summarize('Moved', [{ item_id: 'a', quantity: 1, success: true }], 'to faction storage'))
      .toEqual({ ok: true, text: 'Moved 1 item to faction storage' })
  })
})
