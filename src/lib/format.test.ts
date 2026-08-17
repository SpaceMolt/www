import { describe, it, expect } from 'bun:test'
import { isTimestampStatKey, formatStatValue } from './format'

// A player stat like `last_property_tax_assessed_at` holds a unix epoch, not a
// quantity. Rendering it with the plain thousands-separator formatter showed
// "1,786,910,901", which reads as 1.7 billion credits.
describe('isTimestampStatKey', () => {
  it('treats keys ending in _at as timestamps', () => {
    expect(isTimestampStatKey('last_property_tax_assessed_at')).toBe(true)
    expect(isTimestampStatKey('created_at')).toBe(true)
  })

  it('does not treat quantity keys as timestamps', () => {
    expect(isTimestampStatKey('credits_earned')).toBe(false)
    expect(isTimestampStatKey('ore_mined')).toBe(false)
    expect(isTimestampStatKey('time_played')).toBe(false)
    // A big number alone must never be read as a date.
    expect(isTimestampStatKey('at_risk_cargo')).toBe(false)
  })
})

describe('formatStatValue', () => {
  it('renders an epoch-seconds stat as a date, not a big number', () => {
    const out = formatStatValue('last_property_tax_assessed_at', 1786910901, 'UTC')
    expect(out).not.toBe('1,786,910,901')
    expect(out).toBe('Aug 16, 2026')
  })

  it('renders an epoch-milliseconds stat as the same date', () => {
    expect(formatStatValue('last_property_tax_assessed_at', 1786910901000, 'UTC')).toBe('Aug 16, 2026')
  })

  it('renders a date in the viewer timezone when no timezone is given', () => {
    // The Play UI call site passes no timezone, so the default path must not
    // fall back to the thousands-separator render.
    const out = formatStatValue('last_property_tax_assessed_at', 1786910901)
    expect(out).not.toBe('1,786,910,901')
    expect(out).toMatch(/^[A-Z][a-z]{2} \d{1,2}, 2026$/)
  })

  it('renders an unset timestamp as Never', () => {
    expect(formatStatValue('last_property_tax_assessed_at', 0, 'UTC')).toBe('Never')
    expect(formatStatValue('last_property_tax_assessed_at', -1, 'UTC')).toBe('Never')
  })

  it('keeps thousands separators for ordinary numeric stats', () => {
    expect(formatStatValue('credits_earned', 1786910901, 'UTC')).toBe('1,786,910,901')
    expect(formatStatValue('ore_mined', 0, 'UTC')).toBe('0')
  })

  it('falls back to the numeric formatter for an unusable timestamp', () => {
    expect(formatStatValue('last_property_tax_assessed_at', Number.NaN, 'UTC')).toBe('NaN')
  })
})
