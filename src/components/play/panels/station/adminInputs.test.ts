import { describe, expect, it } from 'bun:test'
import { feePercent, parseAmount, parseItemIds } from './adminInputs'

describe('station admin input helpers', () => {
  it('converts basis points to the percent set_market_fee takes', () => {
    expect(feePercent(250)).toBe(2.5)
    expect(feePercent()).toBe(0)
  })

  it('parses a contraband list from free text', () => {
    expect(parseItemIds(' spice, narcotics\nspice  weapons_grade_plutonium ')).toEqual([
      'spice',
      'narcotics',
      'weapons_grade_plutonium',
    ])
    expect(parseItemIds('  ')).toEqual([])
  })

  it('accepts only non-negative numbers', () => {
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('-1')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
})
