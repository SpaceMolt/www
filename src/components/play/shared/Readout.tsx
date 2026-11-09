'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import shared from '../shared.module.css'
import { Tip } from './Tip'

export type Tone = 'ok' | 'warn' | 'bad'
const TONE: Record<Tone, string> = { ok: '', warn: shared.toneWarn, bad: shared.toneBad }

/** Label/value grid. Children are <Stat> rows. */
export function StatList({ children }: { children: ReactNode }) {
  return <dl className={shared.statList}>{children}</dl>
}

/**
 * One label/value row. `fill` (0..1, above 1 means over) draws a bar for fill levels such as hull or battery.
 * `tone` colors the value and bar; `tip` explains the value in a styled popover.
 */
export function Stat({ label, tone = 'ok', fill, tip, children }: {
  label: ReactNode
  tone?: Tone
  fill?: number
  tip?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={TONE[tone]}>
        <Tip content={tip}>{children}</Tip>
        {fill != null && (
          <span className={`${shared.bar} ${fill > 1 ? shared.barOver : ''}`} aria-hidden="true">
            <i style={{ width: `${Math.min(Math.max(fill, 0), 1) * 100}%` }} />
          </span>
        )}
      </dd>
    </>
  )
}

/** Fill fraction for a have/max pair; 0 when max is 0. */
export const fillOf = (have: number, max: number) => (max > 0 ? have / max : 0)

export interface Chip { id: string; name: string; value: string; bad?: boolean; tip?: ReactNode }

/** Name + count chips that wrap, for lists of needed or held items. Renders nothing when empty. */
export function ItemChips({ title, items }: { title?: ReactNode; items?: Chip[] }) {
  if (!items?.length) return null
  return (
    <div className={shared.chipBlock}>
      {title && <span className={shared.chipTitle}>{title}</span>}
      <div className={shared.chips}>
        {items.map((i) => (
          <Tip key={i.id} content={i.tip}>
            <span className={`${shared.chip} ${i.bad ? shared.chipBad : ''}`}>{i.name}<b>{i.value}</b></span>
          </Tip>
        ))}
      </div>
    </div>
  )
}

/** Short advice lines with an icon. Skips empty entries; renders nothing when all are empty. */
export function Notes({ notes, warn = false }: { notes: (ReactNode | undefined | null | false)[]; warn?: boolean }) {
  const shown = notes.filter((n) => n != null && n !== false && n !== '')
  if (!shown.length) return null
  const Icon = warn ? AlertTriangle : Info
  return (
    <div className={shared.notes}>
      {shown.map((n, i) => (
        <div key={i} className={`${shared.note} ${warn ? shared.noteWarn : ''}`}><Icon size={11} />{n}</div>
      ))}
    </div>
  )
}
