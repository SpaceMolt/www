/**
 * Shared display formatters.
 *
 * These lived as near-identical private copies in a dozen page and component
 * files. One copy, one wording: relative times read "just now / 42s ago /
 * 5m ago / 3h ago / 2d ago", and compact places (event logs, live panes) drop
 * the "ago".
 */

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

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

/** Compact credits/values for stat tiles: 1.2M, 45.3K. */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

/** Play time arrives in seconds. */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Same as formatDate, plus wall-clock time. Falls back to the raw input. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Milliseconds since `at`, or null when the timestamp is unusable. */
function elapsed(at: string | number | undefined): number | null {
  if (at == null) return null
  const then = typeof at === 'number' ? at : Date.parse(at)
  if (Number.isNaN(then)) return null
  // Zero-value Go timestamps ("0001-01-01...") parse fine but would render as
  // an absurd "739000d ago" — treat anything pre-game as unknown.
  if (then < Date.UTC(2020, 0, 1)) return null
  return Math.max(0, Date.now() - then)
}

/** "just now", "42s ago", "5m ago", "3h ago", "2d ago". "" when unusable. */
export function timeAgo(at: string | number | undefined): string {
  const ms = elapsed(at)
  if (ms === null) return ''
  const s = Math.floor(ms / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Same ladder, no "ago" — for dense event logs. */
export function shortAgo(at: string | number | undefined): string {
  const ms = elapsed(at)
  if (ms === null) return ''
  const s = Math.floor(ms / 1000)
  if (s < 10) return 'now'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

/** timeAgo, but anything older than a week reads as a short date. */
export function timeAgoOrDate(iso: string): string {
  const ms = elapsed(iso)
  if (ms === null) return ''
  if (ms < 7 * 86400_000) return timeAgo(iso)
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
