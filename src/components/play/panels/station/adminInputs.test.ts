import { describe, expect, it } from 'bun:test'
import { feePercent, parseAmount, parseItemIds, readableStationMessage } from './adminInputs'

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
    expect(parseAmount('12')).toBe(12)
    expect(parseAmount('2.5')).toBeNull()
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('-1')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
})

describe('readableStationMessage', () => {
  it('rewrites dock-list results and keeps other messages', () => {
    expect(readableStationMessage('allow_player: Nova.')).toBe('Allowed Nova to dock')
    expect(readableStationMessage('ban: Nova.')).toBe('Banned Nova')
    expect(readableStationMessage('Repair price set to 5 credits per hull point.')).toBe('Repair price set to 5 credits per hull point.')
  })
})
