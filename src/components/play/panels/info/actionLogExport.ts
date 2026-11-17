import type { GetActionLogResponse } from '@spacemolt/lib'

export type ActionLogEntry = GetActionLogResponse['entries'][number]

const BASE_COLUMNS = ['id', 'created_at', 'category', 'event_type', 'summary'] as const

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return ''
  let s = String(v)
  // Player names and summaries are player-controlled text. Defuse spreadsheet formulas.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per entry. Each key that appears in any entry's data map becomes a `data.<key>` column. */
export function actionLogToCsv(entries: ActionLogEntry[]): string {
  const dataKeys = [...new Set(entries.flatMap((e) => Object.keys(e.data ?? {})))].sort()
  const header = [...BASE_COLUMNS, ...dataKeys.map((k) => `data.${k}`)]
  const rows = entries.map((e) => [
    ...BASE_COLUMNS.map((c) => csvCell(e[c])),
    ...dataKeys.map((k) => csvCell(e.data?.[k])),
  ])
  return [header, ...rows].map((r) => r.join(',')).join('\r\n')
}

export function downloadFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url))
}
