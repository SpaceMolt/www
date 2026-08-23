import { describe, it, expect } from 'bun:test'
import {
  formatCompact,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatStatValue,
  isTimestampStatKey,
  shortAgo,
  timeAgo,
  timeAgoOrDate,
} from './format'

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

// One relative-time ladder replaced nine near-identical private copies.
describe('timeAgo / shortAgo', () => {
  const ago = (ms: number) => Date.now() - ms

  it('walks the ladder', () => {
    expect(timeAgo(ago(3_000))).toBe('just now')
    expect(timeAgo(ago(42_000))).toBe('42s ago')
    expect(timeAgo(ago(5 * 60_000))).toBe('5m ago')
    expect(timeAgo(ago(3 * 3600_000))).toBe('3h ago')
    expect(timeAgo(ago(2 * 86400_000))).toBe('2d ago')
  })

  it('drops the "ago" in compact mode', () => {
    expect(shortAgo(ago(3_000))).toBe('now')
    expect(shortAgo(ago(90_000))).toBe('1m')
  })

  it('accepts ISO strings as well as epoch millis', () => {
    expect(timeAgo(new Date(ago(5 * 60_000)).toISOString())).toBe('5m ago')
  })

  // Zero-value Go timestamps must not render as "739000d ago".
  it('returns empty for unusable timestamps', () => {
    expect(timeAgo('0001-01-01T00:00:00Z')).toBe('')
    expect(timeAgo('not a date')).toBe('')
    expect(timeAgo(undefined)).toBe('')
  })

  it('falls back to a short date past a week', () => {
    expect(timeAgoOrDate(new Date(ago(3 * 86400_000)).toISOString())).toBe('3d ago')
    expect(timeAgoOrDate('2026-03-04T12:00:00Z')).toBe('Mar 4')
  })
})

describe('number and date formatting', () => {
  it('separates thousands and compacts big values', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatCompact(1234567)).toBe('1.2M')
  })

  it('renders durations from seconds', () => {
    expect(formatDuration(90)).toBe('1m')
    expect(formatDuration(7200)).toBe('2h')
    expect(formatDuration(90000)).toBe('1d 1h')
  })

  it('keeps the raw input when a datetime will not parse', () => {
    expect(formatDate('nope')).toBe('')
    expect(formatDateTime('nope')).toBe('nope')
  })
})
