/** Convert snake_case or kebab-case to Title Case */
export function titleCase(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * True if a numeric stat key holds a unix epoch instead of a quantity.
 * The rule is the key name only — a large value is never proof of a date,
 * because credit totals get large too.
 */
export function isTimestampStatKey(key: string): boolean {
  return key.endsWith('_at')
}

/** Epochs below this bound are seconds; at or above it they are milliseconds. */
const EPOCH_MS_THRESHOLD = 1e11

/**
 * Format one numeric player stat for display. Timestamp keys become a date,
 * every other key keeps thousands separators.
 */
export function formatStatValue(key: string, value: number, timeZone?: string): string {
  if (isTimestampStatKey(key) && Number.isFinite(value)) {
    if (value <= 0) return 'Never'
    const ms = value >= EPOCH_MS_THRESHOLD ? value : value * 1000
    const date = new Date(ms)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(timeZone ? { timeZone } : {}),
      })
    }
  }
  return value.toLocaleString()
}
