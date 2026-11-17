import { describe, it, expect } from 'bun:test'
import { actionLogToCsv, type ActionLogEntry } from './actionLogExport'

describe('actionLogToCsv', () => {
  it('flattens data keys into columns and escapes cells', () => {
    const entries: ActionLogEntry[] = [
      { id: 2, created_at: '2026-11-16T10:00:00Z', category: 'trading', event_type: 'trading.sell', summary: 'Sold 5 "iron", nice', data: { credits: 50, base_id: 'sol_base' } },
      { id: 1, created_at: '2026-11-15T10:00:00Z', category: 'combat', event_type: 'combat.kill', summary: '=HYPERLINK("x")', data: { credits: -20 } },
      { id: 0, created_at: '2026-11-14T10:00:00Z', category: 'other', event_type: 'other.x', summary: 'line1\nline2' },
    ]
    expect(actionLogToCsv(entries).split('\r\n')).toEqual([
      'id,created_at,category,event_type,summary,data.base_id,data.credits',
      '2,2026-11-16T10:00:00Z,trading,trading.sell,"Sold 5 ""iron"", nice",sol_base,50',
      `1,2026-11-15T10:00:00Z,combat,combat.kill,"'=HYPERLINK(""x"")",,-20`,
      '0,2026-11-14T10:00:00Z,other,other.x,"line1\nline2",,',
    ])
  })
})
