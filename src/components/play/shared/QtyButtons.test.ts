import { describe, expect, it } from 'bun:test'
import { qtySteps } from './QtyButtons'

describe('qtySteps', () => {
  it('scales the three steps to the largest power of ten up to max', () => {
    expect(qtySteps(3)).toEqual([1])
    expect(qtySteps(50)).toEqual([1, 10])
    expect(qtySteps(500)).toEqual([1, 10, 100])
    expect(qtySteps(4_200_000)).toEqual([10_000, 100_000, 1_000_000])
  })

  it('keeps a +1 step when max is zero', () => {
    expect(qtySteps(0)).toEqual([1])
  })
})
